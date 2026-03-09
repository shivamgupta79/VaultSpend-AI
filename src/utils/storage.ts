/**
 * Local Storage utilities for VaultSpend
 * All data stays on-device for complete privacy
 */

import type { Expense, Category, Budget, PredictiveAlert } from '../types/finance';
import { DEFAULT_CATEGORIES } from '../types/finance';

const STORAGE_KEYS = {
  EXPENSES: 'vaultspend_expenses',
  CATEGORIES: 'vaultspend_categories',
  BUDGETS: 'vaultspend_budgets',
  ALERTS: 'vaultspend_alerts',
  SETTINGS: 'vaultspend_settings',
} as const;

export interface AppSettings {
  baseCurrency: string;
  language: 'en' | 'hi' | 'both';
  voiceEnabled: boolean;
  receiptScanEnabled: boolean;
  predictiveAlertsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'INR',
  language: 'both',
  voiceEnabled: true,
  receiptScanEnabled: true,
  predictiveAlertsEnabled: true,
};

// ---------------------------------------------------------------------------
// Generic storage helpers
// ---------------------------------------------------------------------------

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Failed to get ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to set ${key} in localStorage:`, err);
  }
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export function getAllExpenses(): Expense[] {
  return getItem<Expense[]>(STORAGE_KEYS.EXPENSES, []);
}

export function getExpensesByDateRange(startDate: string, endDate: string): Expense[] {
  const all = getAllExpenses();
  return all.filter((e) => e.date >= startDate && e.date <= endDate);
}

export function getExpensesByCategory(category: string): Expense[] {
  return getAllExpenses().filter((e) => e.category === category);
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Expense {
  const all = getAllExpenses();
  const newExpense: Expense = {
    ...expense,
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all.push(newExpense);
  setItem(STORAGE_KEYS.EXPENSES, all);
  return newExpense;
}

export function updateExpense(id: string, updates: Partial<Expense>): Expense | null {
  const all = getAllExpenses();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  setItem(STORAGE_KEYS.EXPENSES, all);
  return all[idx];
}

export function deleteExpense(id: string): boolean {
  const all = getAllExpenses();
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === all.length) return false;
  setItem(STORAGE_KEYS.EXPENSES, filtered);
  return true;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function getAllCategories(): Category[] {
  const stored = getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  if (stored.length === 0) {
    setItem(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return stored;
}

export function addCategory(category: Omit<Category, 'id'>): Category {
  const all = getAllCategories();
  const newCat: Category = {
    ...category,
    id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  all.push(newCat);
  setItem(STORAGE_KEYS.CATEGORIES, all);
  return newCat;
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export function getAllBudgets(): Budget[] {
  return getItem<Budget[]>(STORAGE_KEYS.BUDGETS, []);
}

export function addBudget(budget: Omit<Budget, 'id'>): Budget {
  const all = getAllBudgets();
  const newBudget: Budget = {
    ...budget,
    id: `bud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  all.push(newBudget);
  setItem(STORAGE_KEYS.BUDGETS, all);
  return newBudget;
}

export function deleteBudget(id: string): boolean {
  const all = getAllBudgets();
  const filtered = all.filter((b) => b.id !== id);
  if (filtered.length === all.length) return false;
  setItem(STORAGE_KEYS.BUDGETS, filtered);
  return true;
}

// ---------------------------------------------------------------------------
// Predictive Alerts
// ---------------------------------------------------------------------------

export function getAllAlerts(): PredictiveAlert[] {
  return getItem<PredictiveAlert[]>(STORAGE_KEYS.ALERTS, []);
}

export function addAlert(alert: Omit<PredictiveAlert, 'id'>): PredictiveAlert {
  const all = getAllAlerts();
  const newAlert: PredictiveAlert = {
    ...alert,
    id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  all.push(newAlert);
  setItem(STORAGE_KEYS.ALERTS, all);
  return newAlert;
}

export function clearAlerts(): void {
  setItem(STORAGE_KEYS.ALERTS, []);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  return getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...updates };
  setItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

export function getTotalSpendByCategory(): Record<string, number> {
  const expenses = getAllExpenses();
  return expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
}

export function getTotalSpendByCurrency(): Record<string, number> {
  const expenses = getAllExpenses();
  return expenses.reduce((acc, exp) => {
    acc[exp.currency] = (acc[exp.currency] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
}

export function getMonthlyTrend(months: number = 6): { month: string; total: number }[] {
  const expenses = getAllExpenses();
  const now = new Date();
  const result: { month: string; total: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
    const total = expenses
      .filter((e) => e.date.startsWith(monthKey))
      .reduce((sum, e) => sum + e.amount, 0);
    result.push({ month: monthKey, total });
  }

  return result;
}
