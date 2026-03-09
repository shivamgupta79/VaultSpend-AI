import { useState, useRef, useEffect, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';
import { getAllExpenses, getAllCategories, getTotalSpendByCategory, getMonthlyTrend } from '../utils/storage';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  stats?: { tokens: number; tokPerSec: number; latencyMs: number };
}

// System context about VaultSpend
const SYSTEM_PROMPT = `You are VaultSpend AI Assistant, a helpful financial advisor built into VaultSpend - a privacy-first expense tracking app.

ABOUT VAULTSPEND:
- 100% on-device AI-powered expense tracker
- No cloud uploads, complete privacy
- Features: Voice input (Hindi/English), Receipt scanning, Predictive insights, Multi-currency support
- All data stored locally in browser

YOUR ROLE:
1. Answer questions about VaultSpend features and how to use them
2. Provide financial advice based on user's expense data
3. Explain spending patterns and insights
4. Give practical money-saving tips
5. Help users understand their financial health

GUIDELINES:
- Be friendly, concise, and helpful
- Use simple language
- Give actionable advice
- Respect user's privacy (data stays local)
- Encourage smart financial habits

When discussing expenses, provide specific insights with numbers and categories.`;

export function ChatTab() {
  const loader = useModelLoader(ModelCategory.Language);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Get expense context for AI
  const getExpenseContext = useCallback(() => {
    const expenses = getAllExpenses();
    const categories = getAllCategories();
    const byCategory = getTotalSpendByCategory();
    const monthlyTrend = getMonthlyTrend(3);

    if (expenses.length === 0) {
      return "User has no expenses tracked yet.";
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryBreakdown = Object.entries(byCategory)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return `${cat?.name || catId}: ₹${amount.toFixed(0)}`;
      })
      .join(', ');

    const recentExpenses = expenses.slice(-5).map(e => {
      const cat = categories.find(c => c.id === e.category);
      return `₹${e.amount} on ${cat?.name || e.category} (${e.description})`;
    }).join('; ');

    return `EXPENSE DATA:
Total Expenses: ₹${total.toFixed(2)}
Total Transactions: ${expenses.length}
By Category: ${categoryBreakdown}
Recent 5: ${recentExpenses}
Monthly Trend: ${monthlyTrend.map(m => `${m.month}:₹${m.total.toFixed(0)}`).join(', ')}`;
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;

    // Ensure model is loaded
    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setGenerating(true);

    // Add empty assistant message for streaming
    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);

    try {
      // Build enhanced prompt with expense context
      const expenseContext = getExpenseContext();
      const enhancedPrompt = `${expenseContext}

USER QUESTION: ${text}

Provide a helpful, concise answer based on the expense data above. If the question is about their spending, analyze the data and give specific insights. If it's about VaultSpend features, explain clearly.`;

      const { stream, result: resultPromise, cancel } = await TextGeneration.generateStream(enhancedPrompt, {
        maxTokens: 512,
        temperature: 0.7,
        systemPrompt: SYSTEM_PROMPT,
      });
      cancelRef.current = cancel;

      let accumulated = '';
      for await (const token of stream) {
        accumulated += token;
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', text: accumulated };
          return updated;
        });
      }

      const result = await resultPromise;
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: 'assistant',
          text: result.text || accumulated,
          stats: {
            tokens: result.tokensUsed,
            tokPerSec: result.tokensPerSecond,
            latencyMs: result.latencyMs,
          },
        };
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: 'assistant', text: `Error: ${msg}` };
        return updated;
      });
    } finally {
      cancelRef.current = null;
      setGenerating(false);
    }
  }, [input, generating, messages.length, loader, getExpenseContext]);

  const handleCancel = () => {
    cancelRef.current?.();
  };

  // Suggested questions
  const suggestedQuestions = [
    "Where am I spending the most?",
    "How much did I spend this month?",
    "Give me tips to save money",
    "What are my spending patterns?",
    "How does VaultSpend work?",
    "How to use voice input?",
  ];

  const askQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="tab-panel chat-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      <div className="message-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <h3>💬 VaultSpend AI Assistant</h3>
            <p>Ask me anything about your expenses or how to use VaultSpend!</p>
            
            <div className="chat-suggestions">
              <p className="chat-suggestions-label">Try asking:</p>
              {suggestedQuestions.map((q, i) => (
                <button 
                  key={i} 
                  className="chat-suggestion-btn"
                  onClick={() => askQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-bubble">
              <p>{msg.text || '...'}</p>
              {msg.stats && (
                <div className="message-stats">
                  {msg.stats.tokens} tokens · {msg.stats.tokPerSec.toFixed(1)} tok/s · {msg.stats.latencyMs.toFixed(0)}ms
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          type="text"
          placeholder="Ask about your expenses or VaultSpend features..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={generating}
        />
        {generating ? (
          <button type="button" className="btn" onClick={handleCancel}>Stop</button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!input.trim()}>Send</button>
        )}
      </form>
    </div>
  );
}
