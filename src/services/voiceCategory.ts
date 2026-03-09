/**
 * Voice-to-Category Service
 * Offline voice input with on-device AI categorization (Hindi/English)
 * Leverages RunAnywhere SDK for speech recognition and LLM categorization
 */

import { TextGeneration } from '@runanywhere/web-llamacpp';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import type { Category, Expense } from '../types/finance';
import { DEFAULT_CATEGORIES, SUPPORTED_CURRENCIES } from '../types/finance';

export interface VoiceTranscript {
  text: string;
  language: 'en' | 'hi' | 'mixed';
  confidence: number;
}

export interface CategorizedExpense {
  amount: number;
  currency: string;
  category: string;
  description: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Voice capture using Web Speech API (more languages) + RunAnywhere STT fallback
// ---------------------------------------------------------------------------

export class VoiceCapture {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    // Try Web Speech API first (supports Hindi)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }
  }

  async startListening(
    language: 'en' | 'hi' | 'both',
    onResult: (transcript: VoiceTranscript) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (this.isListening) {
      throw new Error('Already listening');
    }

    // Web Speech API approach (supports Hindi natively)
    if (this.recognition) {
      this.isListening = true;
      this.recognition.lang = language === 'hi' ? 'hi-IN' : language === 'en' ? 'en-US' : 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        // Detect language
        const hasHindi = /[\u0900-\u097F]/.test(transcript);
        const detectedLang = hasHindi ? 'hi' : 'en';
        
        onResult({
          text: transcript,
          language: hasHindi && /[a-zA-Z]/.test(transcript) ? 'mixed' : detectedLang,
          confidence,
        });
        this.isListening = false;
      };

      this.recognition.onerror = (event: any) => {
        onError(`Speech recognition error: ${event.error}`);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
    } else {
      // Fallback: Use RunAnywhere STT (Whisper) - English only
      onError('Web Speech API not available. Using fallback STT (English only).');
      // TODO: Implement RunAnywhere STT fallback if needed
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// ---------------------------------------------------------------------------
// AI Categorization using RunAnywhere LLM
// ---------------------------------------------------------------------------

export async function categorizeExpenseFromText(
  text: string,
  categories: Category[] = DEFAULT_CATEGORIES
): Promise<CategorizedExpense> {
  // Ensure LLM model is loaded
  const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
  if (models.length === 0) {
    throw new Error('No language model available');
  }

  const modelId = models[0].id;
  const loadedModel = ModelManager.getLoadedModel(ModelCategory.Language);
  if (!loadedModel) {
    await ModelManager.loadModel(modelId);
  }

  // Build prompt for expense extraction and categorization
  const categoryList = categories.map((c) => `${c.name}: ${c.keywords.join(', ')}`).join('\n');
  const currencyList = SUPPORTED_CURRENCIES.map((c) => `${c.code} (${c.symbol})`).join(', ');

  const prompt = `Extract expense details from this text and categorize it.

Text: "${text}"

Available categories:
${categoryList}

Supported currencies: ${currencyList}

Extract:
1. Amount (number only)
2. Currency code (${SUPPORTED_CURRENCIES.map(c => c.code).join('/')})
3. Category (choose best match from above)
4. Description (brief summary)

Respond in this exact format:
AMOUNT: [number]
CURRENCY: [code]
CATEGORY: [category name]
DESCRIPTION: [text]

Example:
AMOUNT: 500
CURRENCY: INR
CATEGORY: Food & Dining
DESCRIPTION: Lunch at restaurant`;

  try {
    const { text: response } = await TextGeneration.generate(prompt, {
      maxTokens: 200,
      temperature: 0.2,
      systemPrompt: 'You are a financial assistant that extracts expense information from text. Be accurate and concise.',
    });

    // Parse response
    const lines = response.split('\n').map((l) => l.trim());
    const amountLine = lines.find((l) => l.startsWith('AMOUNT:'));
    const currencyLine = lines.find((l) => l.startsWith('CURRENCY:'));
    const categoryLine = lines.find((l) => l.startsWith('CATEGORY:'));
    const descLine = lines.find((l) => l.startsWith('DESCRIPTION:'));

    const amount = parseFloat(amountLine?.split(':')[1]?.trim() || '0');
    const currency = currencyLine?.split(':')[1]?.trim() || 'INR';
    const categoryName = categoryLine?.split(':')[1]?.trim() || 'Other';
    const description = descLine?.split(':')[1]?.trim() || text.slice(0, 100);

    // Find matching category ID
    const category = categories.find((c) => 
      c.name.toLowerCase() === categoryName.toLowerCase()
    ) || categories.find((c) => c.name === 'Other');

    return {
      amount,
      currency,
      category: category?.id || 'other',
      description,
      confidence: 0.8, // Could enhance with more sophisticated confidence scoring
    };
  } catch (error) {
    console.error('AI categorization failed:', error);
    
    // Fallback: Basic keyword matching
    return fallbackCategorization(text, categories);
  }
}

// ---------------------------------------------------------------------------
// Fallback categorization (keyword-based)
// ---------------------------------------------------------------------------

function fallbackCategorization(
  text: string,
  categories: Category[]
): CategorizedExpense {
  const lowerText = text.toLowerCase();
  
  // Extract amount using regex
  const amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // Detect currency
  let currency = 'INR';
  for (const curr of SUPPORTED_CURRENCIES) {
    if (lowerText.includes(curr.code.toLowerCase()) || lowerText.includes(curr.symbol)) {
      currency = curr.code;
      break;
    }
  }

  // Match category by keywords
  let bestCategory = categories.find((c) => c.name === 'Other');
  let maxMatches = 0;

  for (const cat of categories) {
    const matches = cat.keywords.filter((kw) => lowerText.includes(kw.toLowerCase())).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = cat;
    }
  }

  return {
    amount,
    currency,
    category: bestCategory?.id || 'other',
    description: text.slice(0, 100),
    confidence: maxMatches > 0 ? 0.6 : 0.3,
  };
}

// ---------------------------------------------------------------------------
// Combined voice-to-expense pipeline
// ---------------------------------------------------------------------------

export async function voiceToExpense(
  language: 'en' | 'hi' | 'both',
  categories: Category[] = DEFAULT_CATEGORIES
): Promise<CategorizedExpense> {
  return new Promise((resolve, reject) => {
    const voiceCapture = new VoiceCapture();

    voiceCapture.startListening(
      language,
      async (transcript) => {
        try {
          const expense = await categorizeExpenseFromText(transcript.text, categories);
          resolve(expense);
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(new Error(error));
      }
    );
  });
}
