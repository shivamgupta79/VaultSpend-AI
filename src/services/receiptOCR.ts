/**
 * Receipt OCR Fusion Service
 * On-device photo scan with AI extraction and categorization
 * Uses RunAnywhere VLM for OCR without cloud vision APIs
 */

import { VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { ModelManager, ModelCategory, VideoCapture } from '@runanywhere/web';
import type { Category } from '../types/finance';
import { DEFAULT_CATEGORIES, SUPPORTED_CURRENCIES } from '../types/finance';

export interface ReceiptData {
  amount: number;
  currency: string;
  merchant: string;
  date: string;
  category: string;
  items: Array<{ name: string; price: number }>;
  confidence: number;
  imageDataUrl: string;
}

export interface ReceiptScanOptions {
  categories?: Category[];
  autoCategory?: boolean;
}

// ---------------------------------------------------------------------------
// Camera capture for receipt scanning
// ---------------------------------------------------------------------------

export class ReceiptScanner {
  private videoCapture: VideoCapture | null = null;
  private stream: MediaStream | null = null;

  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    try {
      const cam = new VideoCapture({ facingMode: 'environment' });
      await cam.start();
      this.videoCapture = cam;
      // Mount video element
      videoElement.parentElement?.appendChild(cam.videoElement);
    } catch (error) {
      throw new Error(`Failed to start camera: ${error}`);
    }
  }

  stopCamera(): void {
    if (this.videoCapture) {
      this.videoCapture.stop();
      this.videoCapture.videoElement.parentNode?.removeChild(this.videoCapture.videoElement);
      this.videoCapture = null;
    }
  }

  captureFrame(): { data: Uint8Array; width: number; height: number } | null {
    if (!this.videoCapture || !this.videoCapture.isCapturing) return null;
    const frame = this.videoCapture.captureFrame(1024); // Capture at reasonable size
    if (!frame) return null;
    return { data: frame.rgbPixels, width: frame.width, height: frame.height };
  }

  captureAsDataURL(videoElement: HTMLVideoElement): string {
    if (!this.videoCapture) throw new Error('Camera not started');
    const frame = this.videoCapture.captureFrame(1024);
    if (!frame) throw new Error('Failed to capture frame');
    
    // Convert RGB to canvas
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    const imageData = ctx.createImageData(frame.width, frame.height);
    // Convert RGB to RGBA
    for (let i = 0; i < frame.rgbPixels.length / 3; i++) {
      imageData.data[i * 4] = frame.rgbPixels[i * 3];
      imageData.data[i * 4 + 1] = frame.rgbPixels[i * 3 + 1];
      imageData.data[i * 4 + 2] = frame.rgbPixels[i * 3 + 2];
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }
}

// ---------------------------------------------------------------------------
// AI-powered OCR using VLM
// ---------------------------------------------------------------------------

export async function extractReceiptData(
  imageData: { data: Uint8Array; width: number; height: number },
  imageDataUrl: string,
  options: ReceiptScanOptions = {}
): Promise<ReceiptData> {
  const { categories = DEFAULT_CATEGORIES, autoCategory = true } = options;

  // Ensure VLM model is loaded
  const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Multimodal);
  if (models.length === 0) {
    throw new Error('No VLM model available');
  }

  const modelId = models[0].id;
  const bridge = VLMWorkerBridge.shared;
  if (!bridge.isModelLoaded) {
    const ok = await ModelManager.loadModel(modelId);
    if (!ok) throw new Error('Failed to load VLM model');
  }

  // Craft prompt for receipt extraction
  const prompt = `Analyze this receipt image and extract the following information in a structured format:

1. Total amount (number only)
2. Currency (${SUPPORTED_CURRENCIES.map(c => c.code).join('/')})
3. Merchant/Store name
4. Date (YYYY-MM-DD format if visible)
5. Individual items with prices (if visible)

Respond in this exact format:
TOTAL: [amount]
CURRENCY: [code]
MERCHANT: [name]
DATE: [YYYY-MM-DD or UNKNOWN]
ITEMS:
- [item name]: [price]
- [item name]: [price]

Be accurate. If information is not clearly visible, mark as UNKNOWN.`;

  try {
    // Process image with VLM
    const result = await VLMWorkerBridge.shared.process(
      imageData.data,
      imageData.width,
      imageData.height,
      prompt
    );

    // Parse VLM response
    const parsed = parseReceiptResponse(result.text);
    
    // Auto-categorize if enabled
    let category = 'other';
    if (autoCategory && parsed.merchant) {
      category = await categorizeFromMerchant(parsed.merchant, categories);
    }

    return {
      ...parsed,
      category,
      imageDataUrl,
    };
  } catch (error) {
    console.error('Receipt OCR failed:', error);
    throw new Error(`Failed to extract receipt data: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Parse VLM response into structured data
// ---------------------------------------------------------------------------

function parseReceiptResponse(text: string): Omit<ReceiptData, 'category' | 'imageDataUrl'> {
  const lines = text.split('\n').map((l) => l.trim());
  
  // Extract total
  const totalLine = lines.find((l) => l.startsWith('TOTAL:'));
  const totalMatch = totalLine?.match(/[\d.]+/);
  const amount = totalMatch ? parseFloat(totalMatch[0]) : 0;

  // Extract currency
  const currencyLine = lines.find((l) => l.startsWith('CURRENCY:'));
  const currency = currencyLine?.split(':')[1]?.trim() || 'INR';

  // Extract merchant
  const merchantLine = lines.find((l) => l.startsWith('MERCHANT:'));
  const merchant = merchantLine?.split(':')[1]?.trim() || 'Unknown';

  // Extract date
  const dateLine = lines.find((l) => l.startsWith('DATE:'));
  const dateStr = dateLine?.split(':')[1]?.trim() || 'UNKNOWN';
  const date = dateStr === 'UNKNOWN' ? new Date().toISOString().split('T')[0] : dateStr;

  // Extract items
  const items: Array<{ name: string; price: number }> = [];
  let inItemsSection = false;
  for (const line of lines) {
    if (line.startsWith('ITEMS:')) {
      inItemsSection = true;
      continue;
    }
    if (inItemsSection && line.startsWith('-')) {
      const itemMatch = line.match(/^-\s*(.+?):\s*([\d.]+)/);
      if (itemMatch) {
        items.push({
          name: itemMatch[1].trim(),
          price: parseFloat(itemMatch[2]),
        });
      }
    }
  }

  // Calculate confidence based on extracted data
  let confidence = 0.5;
  if (amount > 0) confidence += 0.2;
  if (merchant !== 'Unknown') confidence += 0.15;
  if (dateStr !== 'UNKNOWN') confidence += 0.1;
  if (items.length > 0) confidence += 0.05;

  return { amount, currency, merchant, date, items, confidence };
}

// ---------------------------------------------------------------------------
// Categorize based on merchant name
// ---------------------------------------------------------------------------

async function categorizeFromMerchant(merchant: string, categories: Category[]): Promise<string> {
  const merchantLower = merchant.toLowerCase();

  // Try keyword matching first
  for (const cat of categories) {
    for (const keyword of cat.keywords) {
      if (merchantLower.includes(keyword.toLowerCase())) {
        return cat.id;
      }
    }
  }

  // Fallback: Use LLM for categorization
  try {
    const categoryList = categories.map((c) => `${c.name}: ${c.keywords.join(', ')}`).join('\n');
    const prompt = `Categorize this merchant: "${merchant}"

Available categories:
${categoryList}

Respond with only the category name.`;

    const { text } = await VLMWorkerBridge.shared.process(
      new Uint8Array(), // No image needed
      0,
      0,
      prompt
    );

    const matchedCat = categories.find((c) => 
      text.toLowerCase().includes(c.name.toLowerCase())
    );
    return matchedCat?.id || 'other';
  } catch {
    return 'other';
  }
}

// ---------------------------------------------------------------------------
// Capture receipt from file input (alternative to camera)
// ---------------------------------------------------------------------------

export async function scanReceiptFromFile(
  file: File,
  options: ReceiptScanOptions = {}
): Promise<ReceiptData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = async () => {
          // Draw to canvas to extract pixel data
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context not available');
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          // Convert to RGB (VLM expects RGB)
          const rgbData = new Uint8Array(img.width * img.height * 3);
          for (let i = 0; i < imageData.data.length / 4; i++) {
            rgbData[i * 3] = imageData.data[i * 4];
            rgbData[i * 3 + 1] = imageData.data[i * 4 + 1];
            rgbData[i * 3 + 2] = imageData.data[i * 4 + 2];
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const receipt = await extractReceiptData(
            { data: rgbData, width: img.width, height: img.height },
            dataUrl,
            options
          );
          resolve(receipt);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
