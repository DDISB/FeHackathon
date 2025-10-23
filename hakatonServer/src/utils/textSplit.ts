// src/utils/textSplit.ts
/**
 * Делим текст на куски <= maxChars, стараясь резать по \n\n, затем по предложениям.
 * Если абзац/предложение всё равно длиннее, режем по символам.
 */
export function splitForTTS(text: string, maxChars = 4000): string[] {
    const clean = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  
    if (clean.length <= maxChars) return [clean];
  
    const chunks: string[] = [];
    const paras = clean.split(/\n{2,}/);
  
    const pushSmart = (buf: string) => {
      if (!buf) return;
      if (buf.length <= maxChars) {
        chunks.push(buf.trim());
        return;
      }
      // попробуем порезать по предложениям
      const sentences = buf.split(/(?<=[\.\!\?…])\s+/);
      let cur = "";
      for (const s of sentences) {
        if ((cur + (cur ? " " : "") + s).length > maxChars) {
          if (cur) chunks.push(cur.trim());
          if (s.length > maxChars) {
            // очень длинное «предложение»: строгий рез по символам
            for (let i = 0; i < s.length; i += maxChars) {
              chunks.push(s.slice(i, i + maxChars));
            }
            cur = "";
          } else {
            cur = s;
          }
        } else {
          cur += (cur ? " " : "") + s;
        }
      }
      if (cur) chunks.push(cur.trim());
    };
  
    let acc = "";
    for (const p of paras) {
      const candidate = acc ? acc + "\n\n" + p : p;
      if (candidate.length <= maxChars) {
        acc = candidate;
      } else {
        pushSmart(acc);
        acc = p;
      }
    }
    pushSmart(acc);
  
    return chunks.filter(Boolean);
  }
  