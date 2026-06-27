import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080; // Uses Railway's port or 8080 locally

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors()); 
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(process.cwd(), "../frontend/public")));

// Multer — memory storage for images (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images are allowed"));
  },
});

// ── Gemini setup ────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ── System prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Iron-Dome AI, an expert misinformation detection and deepfake analysis system specialized in the Cameroonian and broader African media context.

Your job is to analyze any content submitted — text, URLs, YouTube videos, or images — and return a structured verdict.

Always respond in this exact JSON format:
{
  "verdict": "REAL" | "FAKE" | "MISLEADING" | "UNVERIFIABLE",
  "confidence": <number 0-100>,
  "summary": "<2-3 sentence plain-language explanation>",
  "redFlags": ["<flag 1>", "<flag 2>", ...],
  "positiveSignals": ["<signal 1>", "<signal 2>", ...],
  "recommendation": "<one clear action the user should take>",
  "analysisType": "text" | "url" | "youtube" | "image"
}

Rules:
- Be direct and factual. Never hedge excessively.
- For YouTube links: analyze the video title, description, channel credibility, and content claims.
- For URLs: analyze the domain reputation, article content, and source credibility.
- For images: look for deepfake artifacts, metadata inconsistencies, and manipulation signs.
- For text: check for logical fallacies, emotional manipulation, and factual accuracy.
- Consider the African/Cameroonian context when relevant (local political figures, events, media outlets).
- If content is in French, respond with analysis in both French and English summaries.
- Confidence below 60 means UNVERIFIABLE — say so clearly.
- Return ONLY valid JSON. No markdown, no preamble.`;

// ── Helper: call Gemini ─────────────────────────────────────────────────────
async function analyzeWithGemini(parts) {
  try {
    const result = await model.generateContent([SYSTEM_PROMPT, ...parts]);
    const raw = result.response.text().trim();
    const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error("AI Analysis/Parsing Error:", error);
    return {
      verdict: "UNVERIFIABLE",
      confidence: 0,
      summary: "The AI was unable to parse the content or returned an invalid format.",
      redFlags: ["Technical processing error"],
      positiveSignals: [],
      recommendation: "Please try again or check the input content.",
      analysisType: "text"
    };
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: "gemini-1.5-flash", project: "Iron-Dome AI" });
});

app.post("/api/analyze/text", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length < 10)
      return res.status(400).json({ error: "Text too short. Provide at least 10 characters." });

    const parts = [`Analyze this text for misinformation:\n\n"${content}"`];
    const analysis = await analyzeWithGemini(parts);
    analysis.analysisType = "text";
    res.json(analysis);
  } catch (err) {
    console.error("Text analysis error:", err.message);
    res.status(500).json({ error: "Analysis failed. Check your API key or try again." });
  }
});

app.post("/api/analyze/url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith("http"))
      return res.status(400).json({ error: "Provide a valid URL starting with http/https." });

    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

    const prompt = isYouTube
      ? `Analyze this YouTube video for misinformation. Examine the video content, channel credibility, title claims, and any misleading narrative: ${url}`
      : `Analyze this webpage/article URL for misinformation. Examine the domain reputation, article content, source credibility, and factual accuracy: ${url}`;

    const analysis = await analyzeWithGemini([prompt]);
    analysis.analysisType = isYouTube ? "youtube" : "url";
    res.json(analysis);
  } catch (err) {
    console.error("URL analysis error:", err.message);
    res.status(500).json({ error: "Analysis failed. The URL may be inaccessible or invalid." });
  }
});

app.post("/api/analyze/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No image uploaded." });

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const parts = [
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
      "Analyze this image for deepfake manipulation, AI generation artifacts, or misleading visual content. Examine facial features, lighting inconsistencies, background artifacts, metadata signals, and any signs of digital manipulation.",
    ];

    const analysis = await analyzeWithGemini(parts);
    analysis.analysisType = "image";
    res.json(analysis);
  } catch (err) {
    console.error("Image analysis error:", err.message);
    res.status(500).json({ error: "Image analysis failed. Try a different image." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "../frontend/public/index.html"));
});

// ── Start ───────────────────────────────────────────────────────────────────
// UPDATED LINE: Added "0.0.0.0" for Railway compatibility
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🛡️  Iron-Dome AI Backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Model: gemini-1.5-flash`);
});