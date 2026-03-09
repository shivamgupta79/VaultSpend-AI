import { useState, useEffect, useRef, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';
import type { Expense, Category, PredictiveAlert } from '../types/finance';
import { DEFAULT_CATEGORIES, SUPPORTED_CURRENCIES } from '../types/finance';
import {
  getAllExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getAllCategories,
  getTotalSpendByCategory,
} from '../utils/storage';

const BUDGETS_KEY = 'vaultspend_budgets';
import { VoiceCapture, categorizeExpenseFromText } from '../services/voiceCategory';
import { ReceiptScanner } from '../services/receiptOCR';
import { generateSpendingInsights, checkBudgetAlerts } from '../services/predictiveAlerts';
import { generateFinanceReport, downloadCSV, downloadJSON, printReport } from '../services/export';
import { suggestCurrency, formatCurrency } from '../services/currencyDetection';

type ViewMode = 'dashboard' | 'add' | 'voice' | 'receipt' | 'overview' | 'budget' | 'insights' | 'export';

export function FinanceTab() {
  const llmLoader = useModelLoader(ModelCategory.Language, true);

  const [view, setView] = useState<ViewMode>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  
  // Budget state
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});

  // Add expense form
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'other'>('cash');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseType, setExpenseType] = useState<'expense' | 'income'>('expense');

  // Voice state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const voiceCaptureRef = useRef<VoiceCapture | null>(null);

  // Receipt state
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insights state
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Export state
  const [exportLoading, setExportLoading] = useState(false);

  // Edit transaction state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data on mount
  useEffect(() => {
    loadData();
    loadInsights();
    loadBudgets();
  }, []);

  const loadData = () => {
    setExpenses(getAllExpenses());
    setCategories(getAllCategories());
  };

  const loadBudgets = () => {
    try {
      const stored = localStorage.getItem(BUDGETS_KEY);
      if (stored) {
        setCategoryBudgets(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load budgets:', e);
    }
  };

  const saveBudgets = (budgets: Record<string, number>) => {
    try {
      localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    } catch (e) {
      console.error('Failed to save budgets:', e);
    }
  };

  const loadInsights = async () => {
    const budgetAlerts = checkBudgetAlerts();
    setAlerts(budgetAlerts);
  };

  // ---------------------------------------------------------------------------
  // Manual expense addition
  // ---------------------------------------------------------------------------

  const handleAddExpense = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !category || !description.trim()) {
      alert('Please fill all fields with valid data');
      return;
    }

    const newExpense = addExpense({
      amount: amt,
      currency,
      category,
      description: description.trim(),
      date: expenseDate,
      paymentMethod,
      type: expenseType,
      source: 'manual',
    });

    setExpenses([...getAllExpenses()]);
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseType('expense');
    setView('dashboard');
    await loadInsights();
  };

  // ---------------------------------------------------------------------------
  // Edit expense
  // ---------------------------------------------------------------------------

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(expense.amount.toString());
    setCurrency(expense.currency);
    setCategory(expense.category);
    setDescription(expense.description);
    setPaymentMethod(expense.paymentMethod);
    setExpenseDate(expense.date);
    setExpenseType(expense.type || 'expense');
    setView('add');
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !category || !description.trim()) {
      alert('Please fill all fields with valid data');
      return;
    }

    updateExpense(editingExpense.id, {
      amount: amt,
      currency,
      category,
      description: description.trim(),
      date: expenseDate,
      paymentMethod,
      type: expenseType,
    });

    setExpenses([...getAllExpenses()]);
    setEditingExpense(null);
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseType('expense');
    setView('dashboard');
    await loadInsights();
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseType('expense');
    setView('dashboard');
  };

  // ---------------------------------------------------------------------------
  // Voice-to-Category
  // ---------------------------------------------------------------------------

  const handleVoiceCapture = async () => {
    if (voiceActive) {
      voiceCaptureRef.current?.stopListening();
      setVoiceActive(false);
      return;
    }

    if (llmLoader.state !== 'ready') {
      const ok = await llmLoader.ensure();
      if (!ok) {
        setVoiceStatus('LLM model failed to load');
        return;
      }
    }

    setVoiceActive(true);
    setVoiceStatus('Listening... Speak your expense');

    const vc = new VoiceCapture();
    voiceCaptureRef.current = vc;

    try {
      await vc.startListening(
        'both',
        async (transcript) => {
          setVoiceStatus(`Processing: "${transcript.text}"`);
          setVoiceActive(false);

          try {
            const categorized = await categorizeExpenseFromText(transcript.text, categories);
            
            // Pre-fill form
            setAmount(categorized.amount.toString());
            setCurrency(categorized.currency);
            setCategory(categorized.category);
            setDescription(categorized.description);
            setView('add');
            setVoiceStatus(`Detected: ${formatCurrency(categorized.amount, categorized.currency)} for ${categorized.description}`);
          } catch (error) {
            setVoiceStatus(`Error: ${error}`);
          }
        },
        (error) => {
          setVoiceStatus(`Voice error: ${error}`);
          setVoiceActive(false);
        }
      );
    } catch (error) {
      setVoiceStatus(`Failed to start: ${error}`);
      setVoiceActive(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Receipt OCR - Simplified text extraction approach
  // ---------------------------------------------------------------------------

  const handleReceiptScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setReceiptScanning(true);
    setReceiptStatus('📷 Receipt uploaded! Please enter details manually or use voice input for quick entry.');

    // For demo: Pre-fill with sample data
    // In production, this would call actual OCR API or use proper VLM setup
    setTimeout(() => {
      // Simulate OCR extraction with placeholder
      setReceiptStatus('💡 Tip: Use Voice Input for fastest entry! Say "I spent [amount] on [category]"');
      setReceiptScanning(false);
    }, 1000);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------------------------------------------------------------------------
  // Predictive Insights
  // ---------------------------------------------------------------------------

  const handleGenerateInsights = async () => {
    if (llmLoader.state !== 'ready') {
      const ok = await llmLoader.ensure();
      if (!ok) return;
    }

    setInsightsLoading(true);
    try {
      const insights = await generateSpendingInsights();
      setAlerts([...checkBudgetAlerts(), ...insights]);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    setExportLoading(true);
    try {
      if (format === 'csv') {
        downloadCSV(expenses);
      } else if (format === 'json') {
        await downloadJSON({ includePredictions: true });
      } else if (format === 'pdf') {
        const report = await generateFinanceReport({ includePredictions: true });
        await printReport(report);
      }
    } catch (error) {
      alert(`Export failed: ${error}`);
    } finally {
      setExportLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete expense
  // ---------------------------------------------------------------------------

  const handleDeleteExpense = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteExpense(id);
      setExpenses([...getAllExpenses()]);
      loadInsights();
    }
  };

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  const renderDashboard = () => {
    // Only show expenses (not income) in dashboard totals
    const expenseOnly = expenses.filter(e => e.type === 'expense' || !e.type);
    const incomeOnly = expenses.filter(e => e.type === 'income');
    const totalSpend = expenseOnly.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = incomeOnly.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalSpend;
    const byCategory = getTotalSpendByCategory();
    const sortedCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Filter expenses by search query
    const filteredExpenses = searchQuery
      ? expenses.filter(e => 
          e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.date.includes(searchQuery)
        )
      : expenses;

    return (
      <div className="finance-dashboard">
        {/* Search Bar */}
        <div className="finance-search">
          <input
            type="text"
            placeholder="🔍 Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="finance-search-input"
          />
          {searchQuery && (
            <button 
              className="finance-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="finance-summary">
          <div className="finance-card">
            <h3>💰 Balance</h3>
            <div className={`finance-value ${balance >= 0 ? 'income' : 'expense'}`}>
              ₹{Math.abs(balance).toFixed(2)}
              {balance >= 0 ? '' : ''}
            </div>
            <div className="finance-subtitle">{balance >= 0 ? 'Savings' : 'Deficit'}</div>
          </div>
          <div className="finance-card">
            <h3>📥 Income</h3>
            <div className="finance-value income">₹{totalIncome.toFixed(2)}</div>
            <div className="finance-subtitle">Total received</div>
          </div>
          <div className="finance-card">
            <h3>📤 Expenses</h3>
            <div className="finance-value expense">₹{totalSpend.toFixed(2)}</div>
            <div className="finance-subtitle">Total spent</div>
          </div>
        </div>

        <div className="finance-summary" style={{ marginTop: '16px' }}>
          <div className="finance-card">
            <h3>Transactions</h3>
            <div className="finance-value">{expenses.length}</div>
            <div className="finance-subtitle">Total recorded</div>
          </div>
          <div className="finance-card">
            <h3>Categories</h3>
            <div className="finance-value">{Object.keys(byCategory).length}</div>
            <div className="finance-subtitle">Active this month</div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="finance-alerts">
            <h3>🔔 Alerts & Insights</h3>
            {alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className={`finance-alert finance-alert-${alert.severity}`}>
                <strong>{alert.category ? categories.find(c => c.id === alert.category)?.name : 'General'}:</strong> {alert.message}
              </div>
            ))}
          </div>
        )}

        <div className="finance-categories">
          <h3>Top Categories</h3>
          {sortedCategories.map(([catId, amount]) => {
            const cat = categories.find((c) => c.id === catId);
            const percentage = (amount / totalSpend) * 100;
            return (
              <div key={catId} className="finance-category-row">
                <span className="finance-category-name">
                  {cat?.icon} {cat?.name || catId}
                </span>
                <div className="finance-category-bar">
                  <div 
                    className="finance-category-fill" 
                    style={{ width: `${percentage}%`, backgroundColor: cat?.color }}
                  />
                </div>
                <span className="finance-category-amount">₹{amount.toFixed(0)}</span>
              </div>
            );
          })}
        </div>

        <div className="finance-recent">
          <h3>{searchQuery ? `🔍 Search Results (${filteredExpenses.length})` : 'Recent Transactions'}</h3>
          {filteredExpenses.length === 0 ? (
            <div className="finance-empty-search">
              <p>{searchQuery ? 'No transactions match your search' : 'No transactions yet'}</p>
            </div>
          ) : (
            filteredExpenses.slice(-10).reverse().map((exp) => {
              const cat = categories.find((c) => c.id === exp.category);
              const isIncome = exp.type === 'income';
              return (
                <div key={exp.id} className="finance-transaction">
                  <span className="finance-transaction-icon">{isIncome ? '💵' : (cat?.icon || '💰')}</span>
                  <div className="finance-transaction-info">
                    <div className="finance-transaction-desc">{exp.description}</div>
                    <div className="finance-transaction-meta">{exp.date} • {isIncome ? 'Income' : cat?.name}</div>
                  </div>
                  <div className="finance-transaction-right">
                    <div className={`finance-transaction-amount ${isIncome ? 'income' : ''}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(exp.amount, exp.currency)}
                    </div>
                    <button 
                      className="finance-transaction-edit"
                      onClick={() => handleEditExpense(exp)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button 
                      className="finance-transaction-delete"
                      onClick={() => handleDeleteExpense(exp.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Overview - Weekly, Monthly, Yearly & Category-wise expenses
  // ---------------------------------------------------------------------------

  const renderOverview = () => {
    const now = new Date();
    
    // Calculate date ranges
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day;
      return new Date(d.setDate(diff));
    };

    const today = now.toISOString().split('T')[0];
    const weekStart = getWeekStart(now).toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    // Filter expenses by period
    const weeklyExpenses = expenses.filter(e => e.date >= weekStart && e.date <= today);
    const monthlyExpenses = expenses.filter(e => e.date >= monthStart && e.date <= today);
    const yearlyExpenses = expenses.filter(e => e.date >= yearStart && e.date <= today);

    const weeklyTotal = weeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const yearlyTotal = yearlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Category-wise breakdown
    const categoryTotals = getTotalSpendByCategory();
    const categoryData = Object.entries(categoryTotals)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return { catId, name: cat?.name || catId, icon: cat?.icon || '💰', amount, color: cat?.color || '#10B981' };
      })
      .sort((a, b) => b.amount - a.amount);

    const maxCategoryAmount = Math.max(...categoryData.map(c => c.amount), 1);

    return (
      <div className="finance-overview">
        {/* Period Selection Cards */}
        <div className="overview-periods">
          <div className="overview-period-card">
            <div className="overview-period-icon">📅</div>
            <div className="overview-period-info">
              <h4>This Week</h4>
              <div className="overview-period-amount">₹{weeklyTotal.toFixed(2)}</div>
              <div className="overview-period-count">{weeklyExpenses.length} transactions</div>
            </div>
          </div>

          <div className="overview-period-card">
            <div className="overview-period-icon">📆</div>
            <div className="overview-period-info">
              <h4>This Month</h4>
              <div className="overview-period-amount">₹{monthlyTotal.toFixed(2)}</div>
              <div className="overview-period-count">{monthlyExpenses.length} transactions</div>
            </div>
          </div>

          <div className="overview-period-card">
            <div className="overview-period-icon">📊</div>
            <div className="overview-period-info">
              <h4>This Year</h4>
              <div className="overview-period-amount">₹{yearlyTotal.toFixed(2)}</div>
              <div className="overview-period-count">{yearlyExpenses.length} transactions</div>
            </div>
          </div>
        </div>

        {/* Category-wise breakdown */}
        <div className="overview-categories">
          <h3>📊 Category-wise Expenses</h3>
          
          {categoryData.length === 0 ? (
            <div className="overview-empty">
              <p>No expenses recorded yet. Start tracking!</p>
            </div>
          ) : (
            <div className="overview-category-list">
              {categoryData.map((cat) => {
                const percentage = (cat.amount / maxCategoryAmount) * 100;
                return (
                  <div key={cat.catId} className="overview-category-item">
                    <div className="overview-category-header">
                      <span className="overview-category-icon">{cat.icon}</span>
                      <span className="overview-category-name">{cat.name}</span>
                      <span className="overview-category-amount">₹{cat.amount.toFixed(2)}</span>
                    </div>
                    <div className="overview-category-bar">
                      <div 
                        className="overview-category-fill" 
                        style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <div className="overview-category-percent">
                      {yearlyTotal > 0 ? ((cat.amount / yearlyTotal) * 100).toFixed(1) : 0}% of yearly
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="overview-stats">
          <div className="overview-stat-card">
            <h4>Average Daily</h4>
            <div className="overview-stat-value">
              ₹{(monthlyTotal / Math.max(new Date().getDate(), 1)).toFixed(2)}
            </div>
          </div>
          <div className="overview-stat-card">
            <h4>Daily Budget</h4>
            <div className="overview-stat-value">
              ₹{(monthlyTotal / Math.max(new Date().getDate(), 1)).toFixed(2)}
            </div>
          </div>
          <div className="overview-stat-card">
            <h4>Transactions</h4>
            <div className="overview-stat-value">{expenses.length}</div>
          </div>
        </div>

        {/* Monthly Comparison */}
        <div className="overview-comparison">
          <h3>📈 Monthly Comparison</h3>
          {renderMonthlyComparison()}
        </div>
      </div>
    );
  };

  // Monthly comparison helper
  const renderMonthlyComparison = () => {
    const now = new Date();
    const months: { name: string; amount: number; key: string }[] = [];
    
    for (let i = 2; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      const monthExpenses = expenses.filter(e => e.date.startsWith(monthKey) && (e.type === 'expense' || !e.type));
      const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      months.push({ name: monthName, amount: total, key: monthKey });
    }

    const maxAmount = Math.max(...months.map(m => m.amount), 1);

    return (
      <div className="comparison-chart">
        {months.map((month, idx) => {
          const percentage = (month.amount / maxAmount) * 100;
          const isCurrentMonth = idx === months.length - 1;
          return (
            <div key={month.key} className="comparison-bar-container">
              <div className="comparison-bar-label">{month.name}</div>
              <div className="comparison-bar-wrapper">
                <div 
                  className={`comparison-bar ${isCurrentMonth ? 'current' : ''}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="comparison-bar-amount">₹{month.amount.toFixed(0)}</div>
              {idx > 0 && months[idx-1].amount > 0 && (
                <div className={`comparison-change ${month.amount <= months[idx-1].amount ? 'positive' : 'negative'}`}>
                  {month.amount <= months[idx-1].amount ? '↓' : '↑'} {Math.abs(((month.amount - months[idx-1].amount) / months[idx-1].amount) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Budget view
  // ---------------------------------------------------------------------------

  const renderBudget = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyExpenses = expenses.filter(e => 
      e.date.startsWith(monthKey) && (e.type === 'expense' || !e.type)
    );
    const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const spentByCategory: Record<string, number> = {};
    monthlyExpenses.forEach(e => {
      spentByCategory[e.category] = (spentByCategory[e.category] || 0) + e.amount;
    });

    const handleSetBudget = (catId: string, value: string) => {
      const budget = parseFloat(value);
      const newBudgets = { ...categoryBudgets };
      if (!isNaN(budget) && budget > 0) {
        newBudgets[catId] = budget;
      } else {
        delete newBudgets[catId];
      }
      setCategoryBudgets(newBudgets);
      saveBudgets(newBudgets);
    };

    const totalBudget = Object.values(categoryBudgets).reduce((sum, b) => sum + b, 0);
    const totalSpent = monthlyTotal;
    const remaining = totalBudget - totalSpent;

    return (
      <div className="finance-budget">
        <div className="budget-summary">
          <div className="budget-summary-card">
            <h4>Total Budget</h4>
            <div className="budget-amount">₹{totalBudget.toFixed(2)}</div>
          </div>
          <div className="budget-summary-card">
            <h4>Spent</h4>
            <div className="budget-amount spent">₹{totalSpent.toFixed(2)}</div>
          </div>
          <div className="budget-summary-card">
            <h4>Remaining</h4>
            <div className={`budget-amount ${remaining >= 0 ? 'remaining' : 'over'}`}>
              ₹{Math.abs(remaining).toFixed(2)}
            </div>
          </div>
        </div>

        {totalBudget > 0 && (
          <div className="budget-progress">
            <div className="budget-progress-bar">
              <div 
                className="budget-progress-fill"
                style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
              />
            </div>
            <div className="budget-progress-text">
              {((totalSpent / totalBudget) * 100).toFixed(0)}% of budget used
            </div>
          </div>
        )}

        <div className="budget-categories">
          <h3>Category Budgets</h3>
          {categories.map(cat => {
            const budget = categoryBudgets[cat.id] || 0;
            const spent = spentByCategory[cat.id] || 0;
            const percent = budget > 0 ? (spent / budget) * 100 : 0;
            
            return (
              <div key={cat.id} className="budget-category-item">
                <div className="budget-category-header">
                  <span className="budget-category-icon">{cat.icon}</span>
                  <span className="budget-category-name">{cat.name}</span>
                  <span className="budget-category-spent">₹{spent.toFixed(0)} / </span>
                  <input
                    type="number"
                    className="budget-category-input"
                    placeholder="Budget"
                    value={budget || ''}
                    onChange={(e) => handleSetBudget(cat.id, e.target.value)}
                  />
                </div>
                {budget > 0 && (
                  <div className="budget-category-bar">
                    <div 
                      className={`budget-category-fill ${percent > 100 ? 'over' : ''}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="budget-empty">
          <p>💡 Set budgets for each category to track your spending limits</p>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Add expense view
  // ---------------------------------------------------------------------------

  const renderAddExpense = () => (
    <div className="finance-form">
      <h3>Add Transaction</h3>
      
      <label>Type</label>
      <div className="expense-type-selector">
        <button
          type="button"
          className={`expense-type-btn ${expenseType === 'expense' ? 'active expense' : ''}`}
          onClick={() => setExpenseType('expense')}
        >
          💸 Expense
        </button>
        <button
          type="button"
          className={`expense-type-btn ${expenseType === 'income' ? 'active income' : ''}`}
          onClick={() => setExpenseType('income')}
        >
          💰 Income
        </button>
      </div>

      <label>Amount</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        step="0.01"
      />

      <label>Currency</label>
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code} - {c.name}
          </option>
        ))}
      </select>

      <label>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>

      <label>Description</label>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you spend on?"
      />

      <label>Date</label>
      <input
        type="date"
        value={expenseDate}
        onChange={(e) => setExpenseDate(e.target.value)}
        max={new Date().toISOString().split('T')[0]}
      />

      <label>Payment Method</label>
      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="upi">UPI</option>
        <option value="other">Other</option>
      </select>

      <div className="finance-form-actions">
        {editingExpense ? (
          <>
            <button className="btn btn-primary" onClick={handleUpdateExpense}>
              ✏️ Update
            </button>
            <button className="btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={handleAddExpense}>
              💾 Save Expense
            </button>
            <button className="btn" onClick={() => setView('dashboard')}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="tab-panel finance-panel">
      <nav className="finance-nav">
        <button 
          className={view === 'dashboard' ? 'active' : ''} 
          onClick={() => setView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={view === 'overview' ? 'active' : ''} 
          onClick={() => setView('overview')}
        >
          📈 Overview
        </button>
        <button 
          className={view === 'add' ? 'active' : ''} 
          onClick={() => setView('add')}
        >
          ➕ Add
        </button>
        <button 
          className={view === 'voice' ? 'active' : ''} 
          onClick={() => setView('voice')}
        >
          🎙️ Voice
        </button>
        <button 
          className={view === 'receipt' ? 'active' : ''} 
          onClick={() => setView('receipt')}
        >
          📷 Receipt
        </button>
        <button 
          className={view === 'insights' ? 'active' : ''} 
          onClick={() => setView('insights')}
        >
          🔮 Insights
        </button>
        <button 
          className={view === 'export' ? 'active' : ''} 
          onClick={() => setView('export')}
        >
          📥 Export
        </button>
        <button 
          className={view === 'budget' ? 'active' : ''} 
          onClick={() => setView('budget')}
        >
          💵 Budget
        </button>
      </nav>

      <div className="finance-content">
        {view === 'dashboard' && renderDashboard()}
        {view === 'overview' && renderOverview()}
        {view === 'add' && renderAddExpense()}
        
        {view === 'voice' && (
          <div className="finance-feature">
            <h3>🎙️ Voice-to-Category</h3>
            <p>Speak your expense in Hindi or English, and AI will categorize it automatically.</p>
            
            <button 
              className={`btn ${voiceActive ? 'btn-live-active' : 'btn-primary'}`}
              onClick={handleVoiceCapture}
              disabled={llmLoader.state === 'downloading' || llmLoader.state === 'loading'}
            >
              {voiceActive ? '⏹ Stop Listening' : '🎤 Start Voice Input'}
            </button>
            
            {llmLoader.state !== 'ready' && llmLoader.state !== 'idle' && (
              <div className="finance-status">Loading LLM model... {Math.round(llmLoader.progress * 100)}%</div>
            )}
            
            {voiceStatus && <div className="finance-status">{voiceStatus}</div>}
          </div>
        )}

        {view === 'receipt' && (
          <div className="finance-feature">
            <h3>📷 Receipt Scanner</h3>
            <p>Upload a receipt photo for reference. For fastest entry, use Voice Input after upload!</p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptScan}
              style={{ display: 'none' }}
            />
            
            <button 
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptScanning}
            >
              {receiptScanning ? 'Processing...' : '📸 Upload Receipt'}
            </button>
            
            {receiptPreview && (
              <div className="finance-receipt-preview">
                <img src={receiptPreview} alt="Receipt preview" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '16px' }} />
              </div>
            )}
            
            {receiptStatus && <div className="finance-status">{receiptStatus}</div>}
            
            <div className="finance-status" style={{ marginTop: '16px', background: 'rgba(34, 197, 94, 0.1)', borderLeft: '3px solid #22C55E' }}>
              <strong>💡 Quick Tip:</strong> After uploading, use "🎙️ Voice" tab to quickly add expense details by speaking!
            </div>
          </div>
        )}

        {view === 'insights' && (
          <div className="finance-feature">
            <h3>🔮 Predictive Insights</h3>
            <p>AI-powered spending forecasts and anomaly detection.</p>
            
            <button 
              className="btn btn-primary"
              onClick={handleGenerateInsights}
              disabled={insightsLoading || llmLoader.state !== 'ready'}
            >
              {insightsLoading ? 'Analyzing...' : '🧠 Generate Insights'}
            </button>

            {alerts.length > 0 && (
              <div className="finance-insights-list">
                {alerts.map((alert, i) => (
                  <div key={i} className={`finance-insight finance-insight-${alert.type}`}>
                    <div className="finance-insight-header">
                      <span className={`finance-insight-badge finance-insight-${alert.severity}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="finance-insight-confidence">
                        {Math.round(alert.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p>{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'export' && (
          <div className="finance-feature">
            <h3>📥 Export Data</h3>
            <p>Download your expense data in various formats. All processing is done locally.</p>
            
            <div className="finance-export-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => handleExport('csv')}
                disabled={exportLoading || expenses.length === 0}
              >
                📄 Export CSV
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleExport('json')}
                disabled={exportLoading || expenses.length === 0}
              >
                📋 Export JSON
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleExport('pdf')}
                disabled={exportLoading || expenses.length === 0}
              >
                📑 Print Report (PDF)
              </button>
            </div>

            {exportLoading && <div className="finance-status">Generating export...</div>}
          </div>
        )}

        {view === 'budget' && renderBudget()}
      </div>
    </div>
  );
}
