// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import updateRouter from "./routes/update";

const app = express();

// базовые мидлвары
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));

// раздача готовых WAV
app.use(
  "/output",
  express.static(path.join(process.cwd(), "output"), {
    fallthrough: true,
    maxAge: "30d",
    immutable: false,
  })
);

// здоровье
app.get("/health", (_req, res) => res.json({ ok: true }));

// наш эндпоинт /update
app.use(updateRouter);

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.url}` }));

// старт
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
