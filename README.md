# 🛡️ Iron-Dome AI — Demo App

Misinformation detection & deepfake analysis powered by **Google Gemini**.

## Stack
- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS (single file, zero build step)
- **AI**: Google Gemini 1.5 Flash (via `@google/generative-ai`)

---

## Quick Start

### 1. Get your Gemini API key
→ https://aistudio.google.com/app/apikey (free tier works)

### 2. Setup backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
```

### 3. Run

```bash
node server.js
# or for auto-reload:
node --watch server.js
```

Open **http://localhost:3001** — the backend serves the frontend automatically.

---

## API Endpoints

| Method | Route | Body |
|--------|-------|------|
| GET | `/api/health` | — |
| POST | `/api/analyze/text` | `{ content: "..." }` |
| POST | `/api/analyze/url` | `{ url: "https://..." }` |
| POST | `/api/analyze/image` | `multipart/form-data` with `image` field |

**YouTube links** → send to `/api/analyze/url` — auto-detected.

### Example response

```json
{
  "verdict": "FAKE",
  "confidence": 87,
  "summary": "This content contains fabricated claims...",
  "redFlags": ["No credible source cited", "Emotionally manipulative language"],
  "positiveSignals": ["Specific dates mentioned"],
  "recommendation": "Do not share. Cross-check with CRTV or Cameroon Tribune.",
  "analysisType": "text"
}
```

---

## Deploy to production

### Option A — Railway (free, recommended)
1. Push to GitHub
2. Connect repo at https://railway.app
3. Add env var `GEMINI_API_KEY`
4. Done — Railway auto-detects Node.js

### Option B — Render
Same steps at https://render.com → New Web Service

### Option C — VPS (your own server)
```bash
npm install -g pm2
pm2 start server.js --name iron-dome
pm2 save
```

---

## WhatsApp integration (next step)
Point your WhatsApp Business webhook to:
- Text messages → `POST /api/analyze/text`
- Links → `POST /api/analyze/url`
- Images → `POST /api/analyze/image`

Parse the verdict JSON and format a WhatsApp reply message.
