/**
 * VaultSpend - Personal Finance Tracker Types
 * On-device AI-powered expense tracking with unique features
 */

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string; // ISO date string
  paymentMethod: 'cash' | 'card' | 'upi' | 'other';
  type: 'expense' | 'income'; // NEW: Track income too
  source: 'manual' | 'voice' | 'receipt' | 'auto';
  tags?: string[];
  receiptImage?: string; // Base64 data URL
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  keywords: string[]; // For AI categorization
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}

export interface PredictiveAlert {
  id: string;
  type: 'overspend' | 'trend' | 'anomaly' | 'forecast';
  severity: 'low' | 'medium' | 'high';
  category?: string;
  message: string;
  prediction: number;
  confidence: number;
  date: string;
}

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number; // Conversion rate to base currency
  lastUpdated: string;
}

export interface FinanceReport {
  period: { start: string; end: string };
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
  byCurrency: Record<string, number>;
  topExpenses: Expense[];
  predictions: PredictiveAlert[];
  generatedAt: string;
}

// Default categories with keywords for AI categorization
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: 'Food & Dining',
    icon: '🍽️',
    color: '#FF6B6B',
    keywords: ['food', 'restaurant', 'cafe', 'breakfast', 'lunch', 'dinner', 'snack', 'grocery', 'khana', 'nashta', 'खाना'],
  },
  {
    id: 'transport',
    name: 'Transportation',
    icon: '🚗',
    color: '#4ECDC4',
    keywords: ['taxi', 'uber', 'ola', 'bus', 'train', 'metro', 'fuel', 'petrol', 'gas', 'parking', 'toll', 'transport', 'यात्रा'],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#FFD93D',
    keywords: ['shopping', 'clothes', 'fashion', 'amazon', 'flipkart', 'mall', 'store', 'खरीदारी'],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#95E1D3',
    keywords: ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'ticket', 'मनोरंजन'],
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    icon: '⚕️',
    color: '#A8E6CF',
    keywords: ['doctor', 'hospital', 'medicine', 'pharmacy', 'gym', 'yoga', 'fitness', 'health', 'दवा', 'स्वास्थ्य'],
  },
  {
    id: 'bills',
    name: 'Bills & Utilities',
    icon: '📱',
    color: '#C7CEEA',
    keywords: ['electricity', 'water', 'internet', 'phone', 'mobile', 'recharge', 'bill', 'utility', 'बिल'],
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: '#FFEAA7',
    keywords: ['school', 'college', 'course', 'book', 'tuition', 'education', 'शिक्षा'],
  },
  {
    id: 'other',
    name: 'Other',
    icon: '💰',
    color: '#B2BABB',
    keywords: ['other', 'misc', 'miscellaneous'],
  },
];

// Supported currencies with symbols
export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];
