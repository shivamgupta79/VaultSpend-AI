# VaultSpend - AI-Powered Personal Finance Tracker

A privacy-first **Personal Finance Tracker** built with the [`@runanywhere/web`](https://www.npmjs.com/package/@runanywhere/web) SDK. Track expenses offline with **on-device AI** categorization — no server, no API key, 100% private.

## Unique Features

VaultSpend stands out with IoT/AI background fusion features that no other finance app offers:

| Feature | Description | Why Unique |
|---------|-------------|------------|
| **Voice-to-Category** | Offline voice input (Web Speech API) auto-categorizes in Hindi/English | Leverages ESP32 voice skills; rare in web apps |
| **Receipt Upload** | Upload receipt photos for reference, then use voice for quick entry | Combines visual reference with voice-first UX |
| **Predictive Alerts** | Local ML forecasts monthly spend with widget notifications | Proactive, not reactive—your ML edge |
| **Exportable Insights** | Generate PDF/CSV/JSON reports from local data; share without upload | Full data sovereignty for users |
| **Multi-Currency Auto** | GPS-free currency detect from context/AI | Everyday global use, ties to GPS integration history |

## Core Features

| Tab | What it does |
|-----|-------------|
| **💰 Finance** | Complete expense tracking with AI-powered categorization |
| **🎙️ Voice** | Speak your expense in Hindi/English, AI categorizes it |
| **📷 Receipt** | Upload receipt photos for reference, use voice for quick entry |
| **🔮 Insights** | ML-powered spending forecasts & anomaly detection |
| **📥 Export** | Download data as CSV, JSON, or printable PDF report |
| **💬 Chat** | Stream text from an on-device LLM (LFM2 350M) |
| **📷 Vision** | Point your camera and describe what the VLM sees (LFM2-VL 450M) |
| **🎙️ Voice** | Speak naturally — VAD detects speech, STT transcribes, LLM responds |
| **🔧 Tools** | On-device function calling and tool orchestration |

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Models are downloaded on first use and cached in the browser's Origin Private File System (OPFS).

## Privacy & Data Sovereignty

- **100% On-Device**: All AI processing happens locally in your browser
- **No Cloud Uploads**: Your financial data never leaves your device
- **Offline-Capable**: Works without internet after models are downloaded
- **Local Storage**: Data stored in browser's localStorage (you control it)
- **No Tracking**: Zero analytics, no third-party scripts

## How It Works

```
@runanywhere/web (npm package)
  ├── WASM engine (llama.cpp, whisper.cpp, sherpa-onnx)
  ├── Model management (download, OPFS cache, load/unload)
  └── TypeScript API (TextGeneration, STT, TTS, VAD, VLM, VoicePipeline)
```

The app imports everything from `@runanywhere/web`:

```typescript
import { RunAnywhere, SDKEnvironment } from '@runanywhere/web';
import { TextGeneration, VLMWorkerBridge } from '@runanywhere/web-llamacpp';

await RunAnywhere.initialize({ environment: SDKEnvironment.Development });

// Stream LLM text
const { stream } = await TextGeneration.generateStream('Hello!', { maxTokens: 200 });
for await (const token of stream) { console.log(token); }

// VLM: describe an image
const result = await VLMWorkerBridge.shared.process(rgbPixels, width, height, 'Describe this.');
```

## Project Structure

```
src/
├── main.tsx                    # React root
├── App.tsx                     # Tab navigation (Finance | Chat | Vision | Voice | Tools)
├── runanywhere.ts              # SDK init + model catalog + VLM worker
├── types/
│   └── finance.ts              # TypeScript types for finance tracking
├── utils/
│   └── storage.ts              # Local storage utilities (no backend!)
├── services/
│   ├── voiceCategory.ts        # Voice-to-Category AI service
│   ├── receiptOCR.ts           # Receipt OCR with VLM
│   ├── predictiveAlerts.ts     # ML-powered spending forecasts
│   ├── export.ts               # PDF/CSV/JSON export generators
│   └── currencyDetection.ts    # Multi-currency auto-detection
├── workers/
│   └── vlm-worker.ts           # VLM Web Worker entry (2 lines)
├── hooks/
│   └── useModelLoader.ts       # Shared model download/load hook
├── components/
│   ├── FinanceTab.tsx          # Finance tracker main UI
│   ├── ChatTab.tsx             # LLM streaming chat
│   ├── VisionTab.tsx           # Camera + VLM inference
│   ├── VoiceTab.tsx            # Full voice pipeline
│   ├── ToolsTab.tsx            # Function calling demo
│   └── ModelBanner.tsx         # Download progress UI
└── styles/
    └── index.css               # Dark theme CSS with finance styles
```

## Adding Your Own Models

Edit the `MODELS` array in `src/runanywhere.ts`:

```typescript
{
  id: 'my-custom-model',
  name: 'My Model',
  repo: 'username/repo-name',           // HuggingFace repo
  files: ['model.Q4_K_M.gguf'],         // Files to download
  framework: LLMFramework.LlamaCpp,
  modality: ModelCategory.Language,      // or Multimodal, SpeechRecognition, etc.
  memoryRequirement: 500_000_000,        // Bytes
}
```

Any GGUF model compatible with llama.cpp works for LLM/VLM. STT/TTS/VAD use sherpa-onnx models.

## Deployment

### Vercel

```bash
npm run build
npx vercel --prod
```

The included `vercel.json` sets the required Cross-Origin-Isolation headers.

### Netlify

Add a `_headers` file:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

### Any static host

Serve the `dist/` folder with these HTTP headers on all responses:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## Browser Requirements

- Chrome 96+ or Edge 96+ (recommended: 120+)
- WebAssembly (required)
- SharedArrayBuffer (requires Cross-Origin Isolation headers)
- OPFS (for persistent model cache)

## Documentation

- [VaultSpend Features](https://docs.runanywhere.ai/web/introduction)
- [RunAnywhere SDK API Reference](https://docs.runanywhere.ai)
- [npm package](https://www.npmjs.com/package/@runanywhere/web)
- [GitHub](https://github.com/RunanywhereAI/runanywhere-sdks)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI SDK**: RunAnywhere Web SDK (LlamaCpp + ONNX)
- **Models**: 
  - LFM2 350M Q4_K_M (Language)
  - LFM2 1.2B Tool Q4_K_M (Function Calling)
  - LFM2-VL 450M Q4_0 (Vision-Language)
  - Whisper Tiny (Speech Recognition)
  - Piper TTS (Speech Synthesis)
  - Silero VAD v5 (Voice Activity Detection)
- **Storage**: Browser localStorage + OPFS
- **Deployment**: Vercel-ready with COOP/COEP headers

## Competitive Advantages

1. **IoT Background**: Voice skills from ESP32 projects applied to web
2. **AI/ML Edge**: Semantic segmentation experience + on-device inference
3. **Full Privacy**: No cloud dependency, complete data sovereignty
4. **Multi-Language**: Hindi + English voice input (rare in finance apps)
5. **Predictive**: Proactive alerts vs reactive tracking
6. **Global-Ready**: Multi-currency with context-aware detection

## License

MIT
