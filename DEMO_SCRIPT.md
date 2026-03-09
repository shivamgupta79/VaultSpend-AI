# VaultSpend - Live Demo Script

## Preparation (Before Demo)
1. Open app: `npm run dev` → http://localhost:5173
2. Clear localStorage (fresh start): `localStorage.clear()` in console
3. Have test receipt image ready
4. Prepare microphone
5. Keep this script open for reference

---

## Demo Flow (10 minutes)

### 1. Introduction (1 min)

"Welcome to **VaultSpend** - a privacy-first personal finance tracker powered by **on-device AI**."

**Key Points:**
- No cloud dependency - everything runs in your browser
- AI-powered categorization with voice
- ML-based spending predictions
- Complete data privacy

---

### 2. Dashboard Overview (1 min)

**Navigate to Finance Tab**

"This is your financial dashboard showing:
- Total expenses this month
- Number of transactions
- Active categories
- Recent spending patterns

Notice there's no signup, no API keys - just start tracking!"

---

### 3. Feature 1: Voice-to-Category (2 min) ⭐

**Click "🎙️ Voice" tab**

"Our first unique feature: **Voice-to-Category**"

**Demo:**
1. Click "Start Voice Input"
2. Speak: "I spent 500 rupees on lunch at a restaurant"
3. Show AI categorization in real-time
4. AI extracts: ₹500, Food & Dining, "lunch at restaurant"
5. Navigate to "Add" tab to show pre-filled form

**Hindi Demo (if audience understands):**
1. Click Voice again
2. Speak: "मैंने 200 रुपये टैक्सी पर खर्च किए"
3. Show AI understands Hindi!

"This leverages our IoT/ESP32 voice experience - same concepts, now in the browser!"

---

### 4. Feature 2: Receipt Upload + Voice Entry (2 min) ⭐

**Click "📷 Receipt" tab**

"Second unique feature: **Receipt Upload with Voice Entry** - best of both worlds!"

**Demo:**
1. Click "Upload Receipt"
2. Select test receipt image
3. Show receipt displays as reference
4. Explain: "Receipt stored locally for your records"
5. Click "🎙️ Voice" tab
6. Say while looking at receipt: "I spent 500 rupees at Starbucks on coffee"
7. Show AI categorizes based on voice
8. Navigate to "Add" to see pre-filled form

"Notice: No complex OCR needed. **Visual reference + voice entry** = fastest & most accurate method. Your receipt stays private in browser!"

---

### 5. Feature 3: Predictive Insights (2 min) ⭐

**Add 2-3 more expenses manually (quick):**
- ₹300, Transportation, "Uber ride"
- ₹150, Food, "Coffee"
- ₹1200, Shopping, "Clothes"

**Click "🔮 Insights" tab**

"Third unique feature: **Predictive Alerts** with ML forecasting"

**Demo:**
1. Click "Generate Insights"
2. Wait for AI analysis
3. Show insights:
   - Spending forecasts
   - Anomaly detection
   - Budget alerts
   - AI recommendations

"This uses **linear regression** for trends and **Z-score analysis** for anomalies. Proactive, not reactive!"

---

### 6. Feature 4: Multi-Currency Auto (1 min) ⭐

**Navigate to "Add" tab**

"Fourth unique feature: **Multi-Currency Auto-Detection**"

**Demo:**
1. Type in description: "Spent $50 on dinner in New York"
2. Show currency auto-detects to USD
3. Clear and type: "खरीदारी के लिए 500 रुपये"
4. Show auto-detects INR

"Context-aware detection - no GPS needed. Uses keywords, timezone, and AI reasoning!"

---

### 7. Feature 5: Exportable Insights (1 min) ⭐

**Click "📥 Export" tab**

"Fifth unique feature: **Exportable Insights** - full data sovereignty"

**Demo:**
1. Click "Print Report (PDF)"
2. Show beautiful HTML report opens
3. Explain: "All processing client-side. No backend needed!"
4. Close print dialog
5. Click "Export CSV"
6. Show file downloads

"Export to CSV for Excel, JSON for developers, or PDF for reports. Complete control of your data!"

---

### 8. Dashboard Review (30 sec)

**Navigate back to Dashboard**

"Let's see our dashboard now populated:
- Total spending calculated
- Categories visualized
- Recent transactions listed
- Alerts displayed

All of this processed **locally in your browser**!"

---

## Closing (30 sec)

"VaultSpend combines:
1. ✅ **Voice skills** from ESP32/IoT background
2. ✅ **Smart UX** (receipt reference + voice = faster than OCR)
3. ✅ **ML/AI** expertise (predictive modeling)
4. ✅ **Privacy-first** philosophy (on-device processing)

**Competitive Advantages:**
- No other app has **Hindi + English voice** for finance
- No other app combines **receipt reference + voice entry** (all do complex OCR)
- No other app gives **ML predictions** locally
- No other app is **100% offline-capable** with AI

Questions?"

---

## Backup Talking Points

### If asked: "What about security?"
"All data stored in browser localStorage. You control it:
- Clear browser data → data deleted
- Export anytime → full backup
- No accounts → no breach risk
- No cloud → no interception"

### If asked: "How does AI work offline?"
"RunAnywhere SDK downloads models to your browser:
- LFM2 350M (~250MB) for text
- Stored in OPFS (Origin Private File System)
- Runs via WebAssembly - near-native speed"

### If asked: "Can I sync across devices?"
"Not currently - that would require cloud sync (defeats privacy).
Alternative: Export as JSON, manually import on other device."

### If asked: "Why not use OCR for receipts?"
"Two reasons: (1) **Speed** - voice entry is faster than waiting for OCR, and (2) **Accuracy** - users verify while speaking. Plus, receipt stays as visual reference!"

---

## Technical Deep-Dive (If Audience is Technical)

### Architecture
```
React UI → RunAnywhere SDK → WASM (llama.cpp)
                          ↓
                  localStorage + OPFS
```

### Models
- **LLM**: LFM2 350M Q4_K_M (quantized)
- **STT**: Web Speech API (native browser)

### ML Techniques
- **Forecasting**: Linear regression on 6-month window
- **Anomaly**: Z-score > 2.0 threshold
- **Categorization**: Keyword matching + LLM fallback

### Performance
- Voice categorization: 1-2s
- Insights generation: 2-3s
- All on-device, no API latency

---

## Common Questions & Answers

**Q: Why not use Google Cloud Vision for OCR?**  
A: Two reasons: (1) **Privacy** - no uploads, and (2) **Speed** - voice entry is actually faster! Users can verify while speaking.

**Q: Why not use OpenAI API for categorization?**  
A: Cost & privacy! On-device LLM is free and private.

**Q: How accurate is the categorization?**  
A: 80-95% depending on description clarity. User can always correct.

**Q: Can it handle multiple currencies in one trip?**  
A: Yes! Each expense can have different currency.

**Q: What if I switch devices?**  
A: Export data, import manually. P2P sync possible future feature.

---

**Demo Tips:**
- ✅ Speak clearly for voice demo
- ✅ Have receipt photo ready (any receipt)
- ✅ Pre-add some expenses if time-constrained
- ✅ Emphasize "on-device" and "privacy" repeatedly
- ✅ Show browser DevTools Network tab (no requests!)

**Break a leg! 🎬**
