// src/routes/update.ts
import express from "express";
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { randomUUID } from "crypto";
import { splitForTTS } from "../utils/textSplit";
import { concatWavFiles } from "../utils/wav";
import { addRecord, getRecord, listRecords, ChapterItem, deleteRecord } from "../store/records";
import { normalizeFilename } from "../utils/filename";

// ------- ENV -------
const API_KEY = process.env.YANDEX_API_KEY;

const IAM = process.env.YANDEX_IAM_TOKEN;
const FOLDER_ID = process.env.YANDEX_FOLDER_ID!;
const TTS_DEFAULT_VOICE = process.env.TTS_VOICE || "ermil";
const TTS_DEFAULT_ROLE = process.env.TTS_ROLE || "friendly";
const TTS_DEFAULT_SPEED = Number(process.env.TTS_SPEED || "1.0");
const MAX_TTS_CHARS = Number(process.env.MAX_TTS_CHARS || "4000");
const MIN_CHAPTER_MINUTES = Number(process.env.MIN_CHAPTER_MINUTES || "30");
const WPM = Number(process.env.WPM || "150"); // слов/мин

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

const authHeader = () =>
  API_KEY ? { Authorization: `Api-Key ${API_KEY}` } : { Authorization: `Bearer ${IAM}` };

const needsXFolderId = () => !API_KEY && !!IAM;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const countWords = (t: string) => (t.match(/\p{L}+/gu) || []).length;

// ------- file → text -------
async function extractTextFromFile(filePath: string, originalName: string): Promise<string> {
  const ext = (path.extname(originalName) || "").toLowerCase();
  if (ext === ".pdf") {
    const data = await pdfParse(await fs.readFile(filePath));
    return data.text || "";
  }
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value || "";
  }
  return await fs.readFile(filePath, "utf8");
}

// ------- YandexGPT: очистка и главы -------
type Chapter = { title: string; text: string };

async function buildChaptersWithYandexGPT(rawText: string, minMinutes = MIN_CHAPTER_MINUTES, wpm = WPM): Promise<Chapter[]> {
  const modelUri = `gpt://${FOLDER_ID}/yandexgpt`;
  const jsonSchema = {
    schema: {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 3 },
              text: { type: "string", minLength: 200 },
            },
            required: ["title", "text"],
            additionalProperties: false,
          },
        },
      },
      required: ["chapters"],
      additionalProperties: false,
    },
  };

  const SYSTEM = [
    "Ты опытный редактор и продюсер аудиокниг.",
    "1) Очисти входной документ: удали ссылки/URL, подписи к изображениям, рекламные и мусорные блоки, артефакты OCR, хедеры/футеры, номера страниц.",
    "2) Сохрани нормальные абзацы и связный текст.",
    `3) Разбей на логичные главы. Длительность каждой главы — максимум ${minMinutes} минут при скорости чтения ~${wpm} слов/мин.`,
    "Заголовок ~3–12 слов. Не обрывай мысль.",
    "Верни СТРОГО один JSON по заданной схеме (без пояснений вне JSON).",
  ].join("\n");

  const USER = [
    "Исходный текст между чертами:",
    "-----",
    rawText.slice(0, 250_000),
    "-----",
  ].join("\n");

  const body = {
    modelUri,
    completionOptions: {
      stream: false,
      temperature: 0.3,
      maxTokens: "12000",
      reasoningOptions: { mode: "DISABLED" },
    },
    jsonSchema,
    messages: [
      { role: "system", text: SYSTEM },
      { role: "user", text: USER },
    ],
  };

  const { data } = await axios.post(
    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
    body,
    { headers: { "Content-Type": "application/json", ...authHeader() } }
  );

  const text: string = data?.result?.alternatives?.[0]?.message?.text ?? "";
  if (!text) throw new Error("Пустой ответ YandexGPT");

  let parsed: { chapters: Chapter[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}$/);
    if (!match) throw new Error("Не удалось распарсить JSON глав");
    parsed = JSON.parse(match[0]);
  }

  const minWords = minMinutes * wpm;
  const compacted: Chapter[] = [];
  for (const ch of parsed.chapters) {
    if (compacted.length === 0) {
      compacted.push(ch);
      continue;
    }
    const last = compacted[compacted.length - 1];
    if (countWords(ch.text) < minWords) {
      compacted[compacted.length - 1] = {
        title: last.title,
        text: `${last.text}\n\n${ch.title}\n\n${ch.text}`,
      };
    } else {
      compacted.push(ch);
    }
  }
  return compacted;
}

// ------- SpeechKit TTS v3 → WAV -------
async function synthesizeWavV3(text: string, outFile: string, voice: string, role: string, speed: number) {
  await fs.ensureDir(path.dirname(outFile));
  const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeader() };
  if (needsXFolderId()) headers["x-folder-id"] = FOLDER_ID;

  const body = {
    text,
    hints: [
      { voice: String(voice) },
      { role: String(role) },
      { speed: String(speed) },
    ],
    unsafeMode: true,
    outputAudioSpec: { containerAudio: { containerAudioType: "WAV" } },
  };

  const response = await axios.post(
    "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis",
    body,
    { headers, responseType: "stream", validateStatus: () => true }
  );

  if (response.status !== 200) {
    const chunks: Buffer[] = [];
    for await (const chunk of response.data) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const errText = Buffer.concat(chunks).toString("utf8");
    throw new Error(`TTS v3 ${response.status}: ${errText || "Bad Request"}`);
  }

  const writeStream = fs.createWriteStream(outFile);
  await new Promise<void>((resolve, reject) => {
    let buffer = "";
    response.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          const b64 = obj?.result?.audioChunk?.data as string | undefined;
          if (b64) writeStream.write(Buffer.from(b64, "base64"));
        } catch { /* skip */ }
      }
    });
    response.data.on("end", () => { writeStream.end(); resolve(); });
    response.data.on("error", reject);
  });

  return outFile;
}

// много кусков → один WAV
async function synthesizeLongTextWav(
    text: string,
    outFile: string,
    voice: string,
    role: string,
    speed: number,
    maxChars = MAX_TTS_CHARS
  ) {
    let chunks = splitForTTS(text, maxChars);
    const tmpDir = outFile + ".parts";
    await fs.ensureDir(tmpDir);
  
    // helper с авто-ретраем на Too long text
    const tryOne = async (t: string, idx: number) => {
      const part = require("path").join(tmpDir, `part-${String(idx).padStart(3, "0")}.wav`);
      try {
        await synthesizeWavV3(t, part, voice, role, speed);
        return part;
      } catch (e: any) {
        if (typeof e?.message === "string" && /Too long text/i.test(e.message)) {
          // резать ещё мельче
          const smaller = splitForTTS(t, Math.max(800, Math.floor(maxChars * 0.7)));
          const parts: string[] = [];
          for (let i = 0; i < smaller.length; i++) {
            parts.push(await tryOne(smaller[i], Number(`${idx}${i}`))); // уникальный индекс
          }
          // склеиваем эти субчасти в один part
          const merged = part.replace(/\.wav$/, ".merged.wav");
          await concatWavFiles(parts, merged);
          await Promise.all(parts.map((p) => fs.remove(p).catch(() => {})));
          return merged;
        }
        throw e;
      }
    };
  
    const partFiles: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      partFiles.push(await tryOne(chunks[i], i));
    }
  
    await concatWavFiles(partFiles, outFile);
    // cleanup
    await Promise.all(partFiles.map((p) => fs.remove(p).catch(() => {})));
    await fs.remove(tmpDir).catch(() => {});
  }


// общая функция генерации (для /upload и для /update)
async function processDocumentAndTTS(params: {
  text?: string;
  file?: Express.Multer.File | undefined;
  voice: string;
  role: string;
  speed: number;
  minMinutes: number;
  wpm: number;
}) {
    const jobId = randomUUID();
  const outDir = path.join(process.cwd(), "output", jobId);
  await fs.ensureDir(outDir);

  const { voice, role, speed, minMinutes, wpm } = params;

  // сырой текст + remember имя файла
  let rawText = (params.text as string) || "";
  let originalName = "text-input.txt";

  if (!rawText && params.file) {
    originalName = normalizeFilename(params.file.originalname || "uploaded");
    rawText = await extractTextFromFile(params.file.path, params.file.originalname);
    await fs.remove(params.file.path).catch(() => {});
  }

  if (!rawText || rawText.trim().length < 50) throw new Error("Нет входного текста (ни файл, ни text)");

  // главы
  const chapters = await buildChaptersWithYandexGPT(rawText, minMinutes, wpm);

  // синтез
  const results: ChapterItem[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const words = countWords(ch.text);
    const minutes = Math.max(minMinutes, Math.ceil(words / Math.max(wpm, 1)));
    const fname = `${String(i + 1).padStart(2, "0")}-${slug(ch.title) || "chapter"}.wav`;
    const outPath = path.join(outDir, fname);
    await synthesizeLongTextWav(ch.text, outPath, voice, role, speed);
    results.push({
      index: i + 1,
      title: ch.title,
      words,
      minutes,
      audioFile: fname,
      audioPath: `/output/${jobId}/${fname}`,
    });
  }

  return { id: jobId, originalName, outDir, chapters: results };
}

// -------------------- ЭНДПОИНТЫ --------------------

// НОВЫЙ: POST /upload → { id }
// src/routes/update.ts
router.post("/upload", upload.single("file"), async (req, res) => {
  const voice = String(req.body.voice || TTS_DEFAULT_VOICE);
  const role = String(req.body.role || TTS_DEFAULT_ROLE);
  const speed = Number(req.body.speed || TTS_DEFAULT_SPEED);
  const minMinutes = Number(req.body.minMinutes || MIN_CHAPTER_MINUTES);
  const wpm = Number(req.body.wpm || WPM);

  // 1) Заголовки для длинного chunked-ответа и снятия буферизации
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // если вдруг за Nginx
  // res.setHeader("Connection", "keep-alive"); // опционально
  (res as any).flushHeaders?.(); // если есть

  // 2) Heartbeat — раз в 15 сек шлём пробел+перевод строки
  const HEARTBEAT_MS = 15_000;
  const hb = setInterval(() => {
    if (!res.writableEnded) res.write(" \n");
  }, HEARTBEAT_MS);

  try {
    const { id, originalName, outDir, chapters } = await processDocumentAndTTS({
      text: req.body.text,
      file: req.file,
      voice, role, speed, minMinutes, wpm,
    });


    await addRecord({ id, originalName, outDir, chapters });

    clearInterval(hb);
    // ВАЖНО: только в самом конце отправляем валидный JSON
    res.end(JSON.stringify({ id }));
  } catch (err: any) {
    clearInterval(hb);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || "Internal error" }));
  }
});

router.delete("/records/:id", async (req, res) => {
  try {
    const ok = await deleteRecord(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// СПИСОК: GET /records → [{ id, index, originalName, chapterCount, createdAt }]
router.get("/records", async (_req, res) => {
  try {
    const items = await listRecords();
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// ПОЛУЧИТЬ ОДНУ ЗАПИСЬ: GET /records/:id → { id, index, originalName, chapterCount, createdAt, chapters: [...] }
router.get("/records/:id", async (req, res) => {
  try {
    const item = await getRecord(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json({
      id: item.id,
      index: item.index,
      originalName: item.originalName,
      chapterCount: item.chapterCount,
      createdAt: item.createdAt,
      chapters: item.chapters,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

export default router;