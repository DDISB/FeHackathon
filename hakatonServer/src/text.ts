import fs from "fs-extra";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";


export type Extracted = { text: string; title: string };


export async function extractText(filePath: string, originalName: string): Promise<Extracted> {
const lower = originalName.toLowerCase();
if (lower.endsWith(".pdf")) {
const buf = await fs.readFile(filePath);
const data = await pdfParse(buf);
const title = data.info?.Title || stripExt(originalName);
return { text: data.text || "", title };
}
if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
// .doc will often work if it is actually .docx; true legacy .doc is not supported
const buf = await fs.readFile(filePath);
const res = await mammoth.extractRawText({ buffer: buf });
return { text: res.value || "", title: stripExt(originalName) };
}
throw new Error("Unsupported file type. Use PDF or DOCX.");
}


export function cleanText(raw: string): string {
let t = raw.replace(/[\u0000-\u001f]/g, " "); // control chars
// remove urls
t = t.replace(/https?:\/\/\S+/g, " ");
// collapse spaces
t = t.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
t = t.replace(/[ \t]{2,}/g, " ");
return t.trim();
}


// Approx. 150 words/min × 30 min ≈ 4500 words per chunk
const WORDS_PER_CHUNK = 4500;


export function chunkByWords(text: string, targetWords = WORDS_PER_CHUNK): string[] {
const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
const chunks: string[] = [];
let current: string[] = [];
let count = 0;


const push = () => {
if (current.length) {
chunks.push(current.join("\n\n"));
current = []; count = 0;
}
};


for (const p of paragraphs) {
const wc = p.split(/\s+/).length;
if (count + wc > targetWords && count > 0) push();
current.push(p); count += wc;
}
push();


// If overall text is small, keep single chunk
return chunks.length ? chunks : [text];
}


function stripExt(name: string): string {
return name.replace(/\.[^.]+$/, "");
}