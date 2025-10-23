// src/utils/filename.ts
export function normalizeFilename(name: string | undefined | null): string {
    if (!name) return "uploaded";
    let n = name;
  
    // Если имя пришло в виде percent-encoding (filename*), декодируем
    try {
      if (/%[0-9A-Fa-f]{2}/.test(n)) {
        n = decodeURIComponent(n);
      }
    } catch { /* ignore */ }
  
    // Признаки mojibake: частые символы Ã, Ð, Ñ, Â и т.п.
    const looksBroken = /[ÃÐÑÂ][^a-z]/.test(n);
    if (looksBroken) {
      try {
        const rec = Buffer.from(n, "latin1").toString("utf8");
        // если после перекодировки появились кириллические буквы — считаем, что починили
        if (/[А-Яа-яЁё]/.test(rec)) return rec;
        return rec; // пусть даже без кириллицы — обычно всё равно лучше
      } catch { /* ignore */ }
    }
  
    return n;
  }
  