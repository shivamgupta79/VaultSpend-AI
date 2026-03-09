# VaultSpend - User Guide

Welcome to **VaultSpend**, your privacy-first AI-powered personal finance tracker!

## What Makes VaultSpend Unique?

🔒 **100% Private**: All data stays on your device  
🤖 **AI-Powered**: Smart categorization with on-device AI  
🎙️ **Voice Input**: Speak expenses in Hindi or English  
📷 **Receipt Scanning**: Scan receipts with your camera  
🔮 **Predictive Insights**: ML forecasts your spending  
💰 **Multi-Currency**: Auto-detects currency from context  
📥 **Export Anywhere**: Download as CSV, JSON, or PDF  

---

## Getting Started

### 1. Add Your First Expense

**Option A: Manual Entry**
1. Click the "➕ Add" tab
2. Enter amount, currency, category, description
3. Select payment method (Cash/Card/UPI/Other)
4. Click "Save Expense"

**Option B: Voice Input** ⭐
1. Click the "🎙️ Voice" tab
2. Click "Start Voice Input"
3. Speak your expense:
   - English: "I spent 500 rupees on lunch"
   - Hindi: "मैंने 500 रुपये खाने पर खर्च किए"
4. AI auto-fills the form for you
5. Confirm and save

**Option C: Receipt Reference + Voice** ⭐
1. Click the "📷 Receipt" tab
2. Click "Upload Receipt"
3. Take a photo or upload receipt image for reference
4. Switch to "🎙️ Voice" tab
5. Speak the expense details looking at the receipt
6. AI categorizes automatically
7. Confirm and save

---

## Features Guide

### 📊 Dashboard

Your financial overview at a glance:

- **Total Expenses**: This month's spending
- **Transactions**: Number of recorded expenses
- **Categories**: Active spending categories
- **Alerts**: Important spending notifications
- **Top Categories**: Visual breakdown by category
- **Recent Transactions**: Last 5 expenses

---

### 🎙️ Voice-to-Category

**How it works:**
1. Click "🎙️ Voice" tab
2. Allow microphone permission (first time)
3. Click "Start Voice Input"
4. Speak naturally:
   - "I paid 150 rupees for taxi"
   - "Spent $50 on groceries"
   - "मैंने 2000 रुपये कपड़ों पर खर्च किए"
5. AI understands and categorizes automatically

**Supported Languages:**
- ✅ English (US/UK)
- ✅ Hindi (Devanagari)
- ✅ Mixed (code-switching supported)

**AI Categorization:**
The AI analyzes keywords and context to assign the right category:
- "taxi", "uber", "ola" → Transportation
- "restaurant", "food", "lunch" → Food & Dining
- "shopping", "clothes" → Shopping
- And more...

---

### 📷 Receipt Upload + Voice Entry

**How it works:**
1. Click "📷 Receipt" tab
2. Click "Upload Receipt"
3. Upload receipt photo for visual reference
4. Receipt displays on screen
5. Switch to "🎙️ Voice" tab
6. Look at receipt and speak: "I spent 500 rupees at Starbucks"
7. AI categorizes based on your voice input

**Best Workflow:**
- Upload receipt for record-keeping
- Use voice input to quickly enter details
- Receipt stays in browser for reference
- Delete receipts anytime to free space

**Privacy Note:**
Receipts are stored in your browser only. No uploads to any server.

---

### 🔮 Predictive Insights

**What you get:**
- **Spending Forecasts**: Predicted expenses for next month
- **Anomaly Alerts**: Unusual spending patterns detected
- **Budget Warnings**: When you're near budget limits
- **AI Recommendations**: Actionable money-saving tips

**How to generate:**
1. Click "🔮 Insights" tab
2. Click "Generate Insights"
3. Wait for AI analysis (~2-3 seconds)
4. View insights organized by severity:
   - 🔴 **High**: Urgent attention needed
   - 🟡 **Medium**: Review recommended
   - 🟢 **Low**: FYI notifications

**Example Insights:**
- "Food spending predicted to increase by 25% next month"
- "Unusual expense: ₹5000 on Shopping (92% confidence)"
- "Budget alert: Transportation 95% exhausted"

**How it works:**
- **Linear Regression**: Analyzes 6-month history for trends
- **Z-Score Analysis**: Detects statistical outliers
- **AI Reasoning**: LLM generates actionable advice

---

### 📥 Exportable Insights

Download your data in multiple formats:

**CSV Export** 📄
- Raw transaction data
- Open in Excel, Google Sheets, or any spreadsheet app
- Perfect for custom analysis

**JSON Export** 📋
- Structured report with predictions
- Includes metadata and insights
- Developer-friendly format

**PDF Report** 📑
- Beautiful printable report
- Includes:
  - Summary statistics
  - Category breakdown
  - Top expenses
  - Predictive insights
- Print to PDF or physical printer

**Privacy:**
All export processing happens **locally in your browser**. No data is uploaded to generate reports.

---

### 💰 Multi-Currency Support

**Automatic Detection:**
VaultSpend intelligently detects currency based on:
1. **Explicit mentions**: "$50", "₹500", "€20"
2. **Keywords**: "dollar", "rupee", "euro", "pound"
3. **Timezone**: Infers from your location (no GPS)
4. **Transaction history**: Learns from recent usage

**Supported Currencies:**
- 🇮🇳 INR (Indian Rupee) - ₹
- 🇺🇸 USD (US Dollar) - $
- 🇪🇺 EUR (Euro) - €
- 🇬🇧 GBP (British Pound) - £
- 🇯🇵 JPY (Japanese Yen) - ¥
- 🇦🇪 AED (UAE Dirham) - د.إ
- 🇸🇬 SGD (Singapore Dollar) - S$

**Example:**
- "Spent $50 on dinner" → Auto-detects USD
- "मैंने 500 रुपये खर्च किए" → Auto-detects INR
- Timezone "Asia/Kolkata" → Suggests INR

---

## Categories

VaultSpend includes 8 smart categories:

| Icon | Category | Keywords |
|------|----------|----------|
| 🍽️ | Food & Dining | food, restaurant, cafe, lunch, dinner, खाना |
| 🚗 | Transportation | taxi, uber, bus, metro, fuel, यात्रा |
| 🛍️ | Shopping | clothes, fashion, amazon, mall, खरीदारी |
| 🎬 | Entertainment | movie, netflix, game, concert, मनोरंजन |
| ⚕️ | Health & Fitness | doctor, hospital, gym, yoga, स्वास्थ्य |
| 📱 | Bills & Utilities | electricity, water, internet, phone, बिल |
| 📚 | Education | school, college, book, course, शिक्षा |
| 💰 | Other | Miscellaneous expenses |

AI automatically assigns categories based on keywords in your description.

---

## Privacy & Security

### What data is stored?
- ✅ Expense records (amount, category, date, description)
- ✅ Categories and budgets
- ✅ Settings (currency, language preferences)

### Where is data stored?
- 📦 **Browser localStorage**: User data (you control it)
- 📦 **OPFS**: AI models (cached for offline use)

### What is NOT stored?
- ❌ No account information (no signup required)
- ❌ No personal identifiers
- ❌ No location tracking
- ❌ No analytics or telemetry

### Data Control
- 🔐 **You own your data** - stored locally on your device
- 🗑️ **Easy deletion** - clear browser data to remove
- 📤 **Full export** - download all data anytime
- 🚫 **No cloud sync** - nothing leaves your device

---

## Tips & Best Practices

### For Voice Input
1. Speak clearly in a quiet environment
2. Mention amount first: "500 rupees for lunch"
3. Include category hints: "taxi", "food", "shopping"
4. Review AI suggestions before saving

### For Receipt Upload
1. Keep receipts for visual reference
2. Upload clear, readable photos
3. Use voice input for fastest data entry
4. Delete old receipts to save storage

### For Budgeting
1. Set realistic monthly budgets per category
2. Check "Insights" weekly for predictions
3. Act on alerts when spending >90%
4. Review trends monthly to adjust budgets

### For Data Management
1. Export data monthly as backup (CSV/JSON)
2. Review top expenses to identify savings
3. Use predictive insights to plan ahead
4. Delete old data if privacy-concerned

---

## Troubleshooting

### Models not loading?
- ✅ Ensure stable internet (first-time download)
- ✅ Clear browser cache and reload
- ✅ Check browser console for errors

### Voice input not working?
- ✅ Allow microphone permissions
- ✅ Use Chrome/Edge (best support)
- ✅ Check microphone settings in OS

### Receipt scanning slow?
- ✅ Use smaller images (<2MB)
- ✅ Wait for VLM model to load (first time)
- ✅ Ensure sufficient RAM (4GB+ recommended)

### Data not saving?
- ✅ Check localStorage quota (usually 5-10MB)
- ✅ Clear old data to free space
- ✅ Export data before clearing

---

## Keyboard Shortcuts

- `Tab` - Navigate tabs
- `Enter` - Submit forms
- `Esc` - Cancel actions

---

## Browser Requirements

**Recommended:**
- Chrome 120+ or Edge 120+
- 4GB+ RAM
- 2GB free storage

**Minimum:**
- Chrome 96+ or Edge 96+
- 2GB RAM
- 500MB free storage

**Not Supported:**
- Internet Explorer
- Safari (limited support)
- Firefox (partial support)

---

## FAQ

**Q: Is my data backed up?**  
A: No, data stays only on your device. Export regularly as backup.

**Q: Can I use VaultSpend offline?**  
A: Yes! After models are downloaded, works 100% offline.

**Q: Does VaultSpend track my location?**  
A: No GPS tracking. Currency detection uses timezone only.

**Q: Can I sync across devices?**  
A: Not currently. Export/import to manually transfer data.

**Q: Is there a mobile app?**  
A: No native app, but works in mobile browsers (Chrome recommended).

**Q: Can I categorize old expenses?**  
A: Yes, edit any expense to change category.

**Q: How accurate is AI categorization?**  
A: 80-95% depending on description clarity.

**Q: Can I customize categories?**  
A: Currently uses 8 default categories. Custom categories coming soon.

---

## Support

For issues or feedback:
- 📧 Check browser console for error logs
- 🐛 Report bugs on GitHub
- 💡 Feature requests welcome

---

## Credits

Built with:
- **RunAnywhere Web SDK** - On-device AI
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool

AI Models:
- **LFM2 350M** by Liquid AI - Text generation
- **LFM2-VL 450M** by Liquid AI - Vision-language
- **Whisper Tiny** by OpenAI - Speech recognition
- **Piper TTS** - Speech synthesis

---

**Enjoy VaultSpend! Track smarter, not harder. 💰**
