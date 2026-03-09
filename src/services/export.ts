/**
 * Export Service - Generate PDF reports from expense data
 * Pure client-side PDF generation with no backend required
 */

import type { Expense, Category, FinanceReport } from '../types/finance';
import { getAllExpenses, getAllCategories, getTotalSpendByCategory, getTotalSpendByCurrency } from '../utils/storage';
import { generateSpendingForecasts } from './predictiveAlerts';

export interface ExportOptions {
  startDate?: string;
  endDate?: string;
  includePredictions?: boolean;
  includeCharts?: boolean;
}

// ---------------------------------------------------------------------------
// Generate finance report data
// ---------------------------------------------------------------------------

export async function generateFinanceReport(options: ExportOptions = {}): Promise<FinanceReport> {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate = new Date().toISOString().split('T')[0],
    includePredictions = true,
  } = options;

  const allExpenses = getAllExpenses();
  const expenses = allExpenses.filter((e) => e.date >= startDate && e.date <= endDate);

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = 0; // TODO: Add income tracking

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const exp of expenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }

  // Group by currency
  const byCurrency: Record<string, number> = {};
  for (const exp of expenses) {
    byCurrency[exp.currency] = (byCurrency[exp.currency] || 0) + exp.amount;
  }

  // Top expenses
  const topExpenses = expenses
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Predictions
  const predictions = includePredictions ? await generateSpendingForecasts() : [];
  const alerts = predictions.map((f) => ({
    id: '',
    type: 'forecast' as const,
    severity: 'medium' as const,
    category: f.category,
    message: `Predicted spending for next month: ₹${f.predictedSpend.toFixed(0)}`,
    prediction: f.predictedSpend,
    confidence: f.confidence,
    date: new Date().toISOString(),
  }));

  return {
    period: { start: startDate, end: endDate },
    totalExpenses,
    totalIncome,
    byCategory,
    byCurrency,
    topExpenses,
    predictions: alerts,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Export as CSV
// ---------------------------------------------------------------------------

export function exportToCSV(expenses: Expense[]): string {
  const categories = getAllCategories();
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const header = 'Date,Amount,Currency,Category,Description,Payment Method,Source\n';
  const rows = expenses.map((e) =>
    [
      e.date,
      e.amount,
      e.currency,
      categoryMap.get(e.category) || e.category,
      `"${e.description.replace(/"/g, '""')}"`,
      e.paymentMethod,
      e.source,
    ].join(',')
  );

  return header + rows.join('\n');
}

export function downloadCSV(expenses: Expense[], filename = 'expenses.csv'): void {
  const csv = exportToCSV(expenses);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export as JSON
// ---------------------------------------------------------------------------

export async function exportToJSON(options: ExportOptions = {}): Promise<string> {
  const report = await generateFinanceReport(options);
  return JSON.stringify(report, null, 2);
}

export async function downloadJSON(options: ExportOptions = {}, filename = 'finance-report.json'): Promise<void> {
  const json = await exportToJSON(options);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export as PDF using simple HTML-to-PDF approach
// For a production app, use a library like jsPDF or pdfmake
// ---------------------------------------------------------------------------

export async function generatePDFHTML(report: FinanceReport): Promise<string> {
  const categories = getAllCategories();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const { period, totalExpenses, byCategory, byCurrency, topExpenses, predictions } = report;

  // Category breakdown HTML
  const categoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([catId, amount]) => {
      const cat = categoryMap.get(catId);
      const percentage = ((amount / totalExpenses) * 100).toFixed(1);
      return `
        <tr>
          <td>${cat?.icon || ''} ${cat?.name || catId}</td>
          <td style="text-align: right;">₹${amount.toFixed(2)}</td>
          <td style="text-align: right;">${percentage}%</td>
        </tr>
      `;
    })
    .join('');

  // Top expenses HTML
  const topExpenseRows = topExpenses
    .slice(0, 5)
    .map((exp) => {
      const cat = categoryMap.get(exp.category);
      return `
        <tr>
          <td>${exp.date}</td>
          <td>${cat?.name || exp.category}</td>
          <td>${exp.description}</td>
          <td style="text-align: right;">${exp.currency} ${exp.amount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  // Predictions HTML
  const predictionRows = predictions
    .slice(0, 5)
    .map((pred) => {
      const severityColor = pred.severity === 'high' ? '#ef4444' : pred.severity === 'medium' ? '#f59e0b' : '#10b981';
      return `
        <tr style="background: ${severityColor}22;">
          <td>${categoryMap.get(pred.category || '')?.name || pred.category}</td>
          <td>${pred.message}</td>
          <td style="text-align: right;">${(pred.confidence * 100).toFixed(0)}%</td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VaultSpend Finance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1e293b;
      background: #ffffff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #ff6900;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #ff6900;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
    }
    .summary-card.expenses { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .summary-card.categories { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .summary-card h3 {
      font-size: 14px;
      margin-bottom: 10px;
      opacity: 0.9;
    }
    .summary-card .value {
      font-size: 28px;
      font-weight: bold;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #0f172a;
      border-left: 4px solid #ff6900;
      padding-left: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      font-size: 13px;
    }
    td {
      padding: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
    }
    tr:hover {
      background: #f8fafc;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
    }
    @media print {
      body { padding: 20px; }
      .summary { page-break-after: avoid; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>💰 VaultSpend Finance Report</h1>
    <div class="subtitle">
      Period: ${period.start} to ${period.end}<br>
      Generated: ${new Date(report.generatedAt).toLocaleString()}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card expenses">
      <h3>Total Expenses</h3>
      <div class="value">₹${totalExpenses.toFixed(2)}</div>
    </div>
    <div class="summary-card categories">
      <h3>Categories</h3>
      <div class="value">${Object.keys(byCategory).length}</div>
    </div>
    <div class="summary-card">
      <h3>Transactions</h3>
      <div class="value">${topExpenses.length}</div>
    </div>
  </div>

  <div class="section">
    <h2>📊 Spending by Category</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: right;">Amount</th>
          <th style="text-align: right;">Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${categoryRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>💸 Top Expenses</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${topExpenseRows}
      </tbody>
    </table>
  </div>

  ${predictions.length > 0 ? `
  <div class="section">
    <h2>🔮 Predictive Insights</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Insight</th>
          <th style="text-align: right;">Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${predictionRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>VaultSpend - Your Privacy-First Finance Tracker</p>
    <p>All data processed locally on your device • No cloud uploads</p>
  </div>
</body>
</html>
  `;

  return html;
}

export async function downloadPDFHTML(report: FinanceReport, filename = 'finance-report.html'): Promise<void> {
  const html = await generatePDFHTML(report);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper to open report in new window for printing to PDF
export async function printReport(report: FinanceReport): Promise<void> {
  const html = await generatePDFHTML(report);
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print report');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
}
