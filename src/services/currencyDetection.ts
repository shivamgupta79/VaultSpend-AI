/**
 * Multi-Currency Auto Detection Service
 * Context-aware currency detection using on-device AI (no GPS required)
 */

import { TextGeneration } from '@runanywhere/web-llamacpp';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import { SUPPORTED_CURRENCIES } from '../types/finance';

export interface CurrencyContext {
  text?: string;
  location?: string;
  timeZone?: string;
  recentCurrencies?: string[];
}

export interface CurrencyDetectionResult {
  currency: string;
  confidence: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Currency hints from timezone
// ---------------------------------------------------------------------------

const TIMEZONE_CURRENCY_MAP: Record<string, string[]> = {
  'Asia/Kolkata': ['INR'],
  'Asia/Calcutta': ['INR'],
  'Asia/Mumbai': ['INR'],
  'Asia/Delhi': ['INR'],
  'America/New_York': ['USD'],
  'America/Los_Angeles': ['USD'],
  'America/Chicago': ['USD'],
  'Europe/London': ['GBP'],
  'Europe/Paris': ['EUR'],
  'Europe/Berlin': ['EUR'],
  'Europe/Madrid': ['EUR'],
  'Europe/Rome': ['EUR'],
  'Asia/Tokyo': ['JPY'],
  'Asia/Singapore': ['SGD'],
  'Asia/Dubai': ['AED'],
  'Asia/Hong_Kong': ['HKD'],
};

// ---------------------------------------------------------------------------
// Keyword-based currency hints
// ---------------------------------------------------------------------------

const CURRENCY_KEYWORDS: Record<string, string[]> = {
  INR: ['rupee', 'rupees', 'rs', '₹', 'inr', 'india', 'indian', 'mumbai', 'delhi', 'bangalore'],
  USD: ['dollar', 'dollars', 'usd', '$', 'us', 'america', 'american', 'usa'],
  EUR: ['euro', 'euros', '€', 'eur', 'europe', 'european'],
  GBP: ['pound', 'pounds', '£', 'gbp', 'uk', 'british', 'london'],
  JPY: ['yen', '¥', 'jpy', 'japan', 'japanese', 'tokyo'],
  AED: ['dirham', 'dirhams', 'aed', 'dubai', 'uae', 'emirates'],
  SGD: ['sgd', 'singapore', 'singaporean'],
};

// ---------------------------------------------------------------------------
// Detect currency from context (no GPS)
// ---------------------------------------------------------------------------

export function detectCurrencyFromContext(context: CurrencyContext): CurrencyDetectionResult {
  const { text, timeZone, recentCurrencies } = context;
  
  // 1. Check explicit currency mentions in text
  if (text) {
    const lowerText = text.toLowerCase();
    
    // Check for currency symbols or codes
    for (const curr of SUPPORTED_CURRENCIES) {
      if (lowerText.includes(curr.symbol) || lowerText.includes(curr.code.toLowerCase())) {
        return {
          currency: curr.code,
          confidence: 0.95,
          reason: `Explicit mention of ${curr.code} in text`,
        };
      }
    }

    // Check for keywords
    for (const [code, keywords] of Object.entries(CURRENCY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return {
            currency: code,
            confidence: 0.8,
            reason: `Keyword "${keyword}" suggests ${code}`,
          };
        }
      }
    }
  }

  // 2. Infer from timezone
  if (timeZone) {
    const currencies = TIMEZONE_CURRENCY_MAP[timeZone];
    if (currencies && currencies.length > 0) {
      return {
        currency: currencies[0],
        confidence: 0.7,
        reason: `Timezone ${timeZone} typically uses ${currencies[0]}`,
      };
    }
  }

  // 3. Use most recent currency
  if (recentCurrencies && recentCurrencies.length > 0) {
    const mostRecent = recentCurrencies[0];
    return {
      currency: mostRecent,
      confidence: 0.6,
      reason: `Based on recent transaction history`,
    };
  }

  // 4. Fallback to default (INR for this app)
  return {
    currency: 'INR',
    confidence: 0.3,
    reason: 'Default currency (no context available)',
  };
}

// ---------------------------------------------------------------------------
// AI-powered currency detection for ambiguous cases
// ---------------------------------------------------------------------------

export async function detectCurrencyWithAI(context: CurrencyContext): Promise<CurrencyDetectionResult> {
  // Try rule-based first
  const ruleBasedResult = detectCurrencyFromContext(context);
  if (ruleBasedResult.confidence >= 0.8) {
    return ruleBasedResult;
  }

  // If confidence is low and we have text, use AI
  if (!context.text || context.text.trim().length < 5) {
    return ruleBasedResult;
  }

  try {
    // Ensure LLM is loaded
    const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
    if (models.length === 0) {
      return ruleBasedResult;
    }

    const modelId = models[0].id;
    const loadedModel = ModelManager.getLoadedModel(ModelCategory.Language);
    if (!loadedModel) {
      const ok = await ModelManager.loadModel(modelId);
      if (!ok) return ruleBasedResult;
    }

    const currencyList = SUPPORTED_CURRENCIES.map((c) => `${c.code} (${c.name})`).join(', ');
    const prompt = `Detect the currency from this text: "${context.text}"

Supported currencies: ${currencyList}

Respond with ONLY the 3-letter currency code (e.g., INR, USD, EUR).`;

    const { text: response } = await TextGeneration.generate(prompt, {
      maxTokens: 10,
      temperature: 0.1,
      systemPrompt: 'You are a currency detection assistant. Respond with only the currency code.',
    });

    // Extract currency code
    const detected = response.trim().toUpperCase().slice(0, 3);
    const validCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === detected);

    if (validCurrency) {
      return {
        currency: validCurrency.code,
        confidence: 0.85,
        reason: 'AI-detected from context',
      };
    }

    return ruleBasedResult;
  } catch (error) {
    console.error('AI currency detection failed:', error);
    return ruleBasedResult;
  }
}

// ---------------------------------------------------------------------------
// Helper: Get user's timezone
// ---------------------------------------------------------------------------

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Kolkata'; // Default
  }
}

// ---------------------------------------------------------------------------
// Helper: Get recent currencies from expense history
// ---------------------------------------------------------------------------

export function getRecentCurrencies(expenses: Array<{ currency: string; date: string }>): string[] {
  // Get last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentExpenses = expenses.filter((e) => e.date >= thirtyDaysAgo);

  // Count frequency
  const currencyCount: Record<string, number> = {};
  for (const exp of recentExpenses) {
    currencyCount[exp.currency] = (currencyCount[exp.currency] || 0) + 1;
  }

  // Sort by frequency
  return Object.entries(currencyCount)
    .sort(([, a], [, b]) => b - a)
    .map(([currency]) => currency);
}

// ---------------------------------------------------------------------------
// Smart currency suggester for new expense
// ---------------------------------------------------------------------------

export async function suggestCurrency(
  text: string,
  recentExpenses: Array<{ currency: string; date: string }>
): Promise<CurrencyDetectionResult> {
  const context: CurrencyContext = {
    text,
    timeZone: getUserTimezone(),
    recentCurrencies: getRecentCurrencies(recentExpenses),
  };

  return await detectCurrencyWithAI(context);
}

// ---------------------------------------------------------------------------
// Currency conversion (simple offline rates - would need periodic updates)
// ---------------------------------------------------------------------------

// Base rates relative to INR (approximate, for demo)
const CURRENCY_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 0.012, // 1 INR = 0.012 USD
  EUR: 0.011,
  GBP: 0.0095,
  JPY: 1.8,
  AED: 0.044,
  SGD: 0.016,
};

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  
  const fromRate = CURRENCY_RATES[from] || 1;
  const toRate = CURRENCY_RATES[to] || 1;
  
  // Convert to INR first, then to target currency
  const inINR = amount / fromRate;
  return inINR * toRate;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
  if (!currency) return `${currencyCode} ${amount.toFixed(2)}`;
  
  return `${currency.symbol}${amount.toFixed(2)}`;
}
