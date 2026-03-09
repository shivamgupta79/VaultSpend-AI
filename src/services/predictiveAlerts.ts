/**
 * Predictive Alerts Service
 * On-device ML-powered spending forecasts and anomaly detection
 * Uses RunAnywhere LLM for intelligent predictions
 */

import { TextGeneration } from '@runanywhere/web-llamacpp';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import type { Expense, PredictiveAlert, Category } from '../types/finance';
import { getAllExpenses, getMonthlyTrend, getAllCategories } from '../utils/storage';

export interface SpendingForecast {
  category: string;
  currentSpend: number;
  predictedSpend: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

export interface AnomalyDetection {
  expense: Expense;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// Simple linear regression for trend prediction
// ---------------------------------------------------------------------------

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0 };

  const xMean = (n - 1) / 2;
  const yMean = data.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    numerator += xDiff * (data[i] - yMean);
    denominator += xDiff * xDiff;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// Statistical anomaly detection (Z-score)
// ---------------------------------------------------------------------------

function calculateZScore(value: number, data: number[]): number {
  if (data.length < 2) return 0;
  
  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  return stdDev > 0 ? (value - mean) / stdDev : 0;
}

// ---------------------------------------------------------------------------
// Predictive spending forecast for each category
// ---------------------------------------------------------------------------

export async function generateSpendingForecasts(): Promise<SpendingForecast[]> {
  const expenses = getAllExpenses();
  const categories = getAllCategories();
  const forecasts: SpendingForecast[] = [];

  // Get last 6 months of spending by category
  const monthlyTrend = getMonthlyTrend(6);
  const currentMonth = new Date().toISOString().slice(0, 7);

  for (const category of categories) {
    // Get monthly spend for this category over last 6 months
    const categorySpend: number[] = [];
    
    for (const month of monthlyTrend) {
      const monthExpenses = expenses.filter(
        (e) => e.category === category.id && e.date.startsWith(month.month)
      );
      const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      categorySpend.push(total);
    }

    if (categorySpend.every((v) => v === 0)) continue; // Skip categories with no spending

    // Simple linear regression to predict next month
    const { slope, intercept } = linearRegression(categorySpend);
    const predictedSpend = Math.max(0, slope * categorySpend.length + intercept);
    const currentSpend = categorySpend[categorySpend.length - 1];

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > currentSpend * 0.1) trend = 'increasing';
    else if (slope < -currentSpend * 0.1) trend = 'decreasing';

    // Calculate confidence based on data consistency (inverse of coefficient of variation)
    const mean = categorySpend.reduce((sum, v) => sum + v, 0) / categorySpend.length;
    const stdDev = Math.sqrt(
      categorySpend.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / categorySpend.length
    );
    const cv = mean > 0 ? stdDev / mean : 1;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - cv));

    forecasts.push({
      category: category.id,
      currentSpend,
      predictedSpend,
      trend,
      confidence,
    });
  }

  return forecasts;
}

// ---------------------------------------------------------------------------
// Anomaly detection for unusual expenses
// ---------------------------------------------------------------------------

export function detectAnomalies(): AnomalyDetection[] {
  const expenses = getAllExpenses();
  const anomalies: AnomalyDetection[] = [];

  if (expenses.length < 5) return anomalies; // Need enough data

  // Group by category
  const byCategory: Record<string, Expense[]> = {};
  for (const exp of expenses) {
    if (!byCategory[exp.category]) byCategory[exp.category] = [];
    byCategory[exp.category].push(exp);
  }

  // Check each category for outliers
  for (const [category, catExpenses] of Object.entries(byCategory)) {
    if (catExpenses.length < 3) continue;

    const amounts = catExpenses.map((e) => e.amount);
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    
    // Use Z-score to detect outliers
    for (const exp of catExpenses) {
      const zScore = calculateZScore(exp.amount, amounts);
      
      if (Math.abs(zScore) > 2) {
        const severity: 'low' | 'medium' | 'high' = 
          Math.abs(zScore) > 3 ? 'high' : Math.abs(zScore) > 2.5 ? 'medium' : 'low';
        
        anomalies.push({
          expense: exp,
          reason: `Unusual ${exp.amount > sortedAmounts[sortedAmounts.length - 1] / 2 ? 'high' : 'low'} amount for ${category}`,
          severity,
        });
      }
    }
  }

  return anomalies.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

// ---------------------------------------------------------------------------
// AI-powered spending insights using LLM
// ---------------------------------------------------------------------------

export async function generateSpendingInsights(): Promise<PredictiveAlert[]> {
  const forecasts = await generateSpendingForecasts();
  const anomalies = detectAnomalies();
  const alerts: PredictiveAlert[] = [];

  // Create alerts from forecasts (overspending predictions)
  for (const forecast of forecasts) {
    if (forecast.trend === 'increasing' && forecast.predictedSpend > forecast.currentSpend * 1.2) {
      const categories = getAllCategories();
      const category = categories.find((c) => c.id === forecast.category);
      
      alerts.push({
        id: '',
        type: 'forecast',
        severity: 'medium',
        category: forecast.category,
        message: `${category?.name || forecast.category} spending predicted to increase by ${Math.round(((forecast.predictedSpend - forecast.currentSpend) / forecast.currentSpend) * 100)}% next month`,
        prediction: forecast.predictedSpend,
        confidence: forecast.confidence,
        date: new Date().toISOString(),
      });
    }
  }

  // Create alerts from anomalies
  for (const anomaly of anomalies.slice(0, 3)) { // Top 3 anomalies
    alerts.push({
      id: '',
      type: 'anomaly',
      severity: anomaly.severity,
      category: anomaly.expense.category,
      message: `Unusual expense detected: ${anomaly.reason}`,
      prediction: anomaly.expense.amount,
      confidence: 0.85,
      date: new Date().toISOString(),
    });
  }

  // Use AI for additional insights if LLM is available
  try {
    const aiInsights = await generateAIInsights(forecasts, anomalies);
    alerts.push(...aiInsights);
  } catch (error) {
    console.warn('AI insights not available:', error);
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// AI-powered insights using RunAnywhere LLM
// ---------------------------------------------------------------------------

async function generateAIInsights(
  forecasts: SpendingForecast[],
  anomalies: AnomalyDetection[]
): Promise<PredictiveAlert[]> {
  // Ensure LLM is loaded
  const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
  if (models.length === 0) return [];

  const modelId = models[0].id;
  const loadedModel = ModelManager.getLoadedModel(ModelCategory.Language);
  if (!loadedModel) {
    const ok = await ModelManager.loadModel(modelId);
    if (!ok) return [];
  }

  // Prepare data summary
  const categories = getAllCategories();
  const forecastSummary = forecasts
    .slice(0, 5)
    .map((f) => {
      const cat = categories.find((c) => c.id === f.category);
      return `${cat?.name || f.category}: current ₹${f.currentSpend.toFixed(0)}, predicted ₹${f.predictedSpend.toFixed(0)} (${f.trend})`;
    })
    .join('\n');

  const anomalySummary = anomalies
    .slice(0, 3)
    .map((a) => `${a.reason}: ₹${a.expense.amount} on ${a.expense.date}`)
    .join('\n');

  const prompt = `Analyze this spending data and provide 2-3 actionable insights or recommendations.

Spending Forecasts:
${forecastSummary}

Anomalies:
${anomalySummary}

Provide insights in this format:
INSIGHT 1: [one sentence insight]
INSIGHT 2: [one sentence insight]
INSIGHT 3: [one sentence insight]

Focus on practical money-saving tips and spending patterns.`;

  try {
    const { text } = await TextGeneration.generate(prompt, {
      maxTokens: 200,
      temperature: 0.4,
      systemPrompt: 'You are a financial advisor providing concise, actionable spending insights.',
    });

    // Parse insights
    const insights: PredictiveAlert[] = [];
    const lines = text.split('\n').filter((l) => l.match(/INSIGHT \d+:/));

    for (const line of lines) {
      const message = line.replace(/INSIGHT \d+:\s*/, '').trim();
      if (message) {
        insights.push({
          id: '',
          type: 'trend',
          severity: 'low',
          message,
          prediction: 0,
          confidence: 0.7,
          date: new Date().toISOString(),
        });
      }
    }

    return insights;
  } catch (error) {
    console.error('Failed to generate AI insights:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Budget tracking alerts
// ---------------------------------------------------------------------------

export function checkBudgetAlerts(): PredictiveAlert[] {
  const expenses = getAllExpenses();
  const categories = getAllCategories();
  const alerts: PredictiveAlert[] = [];
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Check spending against default budgets (if set in categories)
  for (const category of categories) {
    if (!category.budget) continue;

    const monthlySpend = expenses
      .filter((e) => e.category === category.id && e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    const percentUsed = (monthlySpend / category.budget) * 100;

    if (percentUsed >= 90) {
      alerts.push({
        id: '',
        type: 'overspend',
        severity: percentUsed >= 100 ? 'high' : 'medium',
        category: category.id,
        message: `${category.name} budget ${percentUsed >= 100 ? 'exceeded' : 'almost exhausted'}: ₹${monthlySpend.toFixed(0)} / ₹${category.budget}`,
        prediction: monthlySpend,
        confidence: 1.0,
        date: new Date().toISOString(),
      });
    }
  }

  return alerts;
}
