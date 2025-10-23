// src/store/records.ts
import path from "path";
import fs from "fs-extra";

export type ChapterItem = {
  index: number;
  title: string;
  words: number;
  minutes: number;
  audioFile: string; // имя файла в outDir, напр. "01-title.wav"
  audioPath: string; // публичный URL под /output, напр. "/output/<id>/01-title.wav"
};

export type RecordItem = {
  id: string;
  index: number; // порядковый номер (автоинкремент)
  createdAt: string; // ISO
  originalName: string;
  chapterCount: number;
  outDir: string; // абсолютный путь до папки с файлами
  chapters: ChapterItem[];
  status: "done" | "error";
  error?: string;
};

type DB = {
  lastIndex: number;
  order: string[]; // массив id по порядку
  byId: Record<string, RecordItem>;
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "records.json");

async function loadDB(): Promise<DB> {
  await fs.ensureDir(DATA_DIR);
  if (!(await fs.pathExists(DB_FILE))) {
    const fresh: DB = { lastIndex: 0, order: [], byId: {} };
    await fs.writeJson(DB_FILE, fresh, { spaces: 2 });
    return fresh;
  }
  return (await fs.readJson(DB_FILE)) as DB;
}

async function saveDB(db: DB) {
  await fs.writeJson(DB_FILE, db, { spaces: 2 });
}

export async function addRecord(partial: Omit<RecordItem, "index" | "createdAt" | "chapterCount" | "status"> & { status?: "done" | "error"; error?: string }) {
  const db = await loadDB();
  const index = db.lastIndex + 1;
  const item: RecordItem = {
    ...partial,
    index,
    createdAt: new Date().toISOString(),
    chapterCount: partial.chapters.length,
    status: partial.status ?? "done",
  };
  db.lastIndex = index;
  db.order.push(item.id);
  db.byId[item.id] = item;
  await saveDB(db);
  return item;
}

export async function getRecord(id: string) {
  const db = await loadDB();
  return db.byId[id] || null;
}

export async function listRecords() {
  const db = await loadDB();
  // вернём по убыванию индекса (новые сверху)
  const items = db.order.map((id) => db.byId[id]).filter(Boolean).sort((a, b) => b.index - a.index);
  return items.map((r) => ({
    id: r.id,
    index: r.index,
    originalName: r.originalName,
    chapterCount: r.chapterCount,
    createdAt: r.createdAt,
  }));
}

export async function deleteRecord(id: string): Promise<boolean> {
  const db = await loadDB();
  const rec = db.byId[id];
  if (!rec) return false;

  // пробуем удалить директорию с файлами озвучки
  const outDir = rec.outDir || path.join(process.cwd(), "output", id);
  try {
    if (await fs.pathExists(outDir)) {
      await fs.remove(outDir);
    }
  } catch (e) {
    // если не получилось удалить файлы — всё равно продолжим чистить БД
    // но вернём 500 на роуте, если нужно — можно пробросить ошибку
    console.warn(`[records] failed to remove ${outDir}:`, (e as Error).message);
  }

  // чистим БД
  delete db.byId[id];
  db.order = db.order.filter((x) => x !== id);
  await saveDB(db);

  return true;
}
