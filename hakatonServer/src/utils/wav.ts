// src/utils/wav.ts
import fs from "fs-extra";

/**
 * Находит позицию data-chunk и его длину в WAV.
 */
function findDataChunk(buf: Buffer) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let offset = 12; // после RIFF(12 байт) идут чанки
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const next = offset + 8 + size;
    if (id === "data") return { dataOffset: offset + 8, dataSize: size, headerSize: offset + 8 };
    offset = next + (size % 2); // чётность
  }
  throw new Error("WAV data chunk not found");
}

/**
 * Конкатенация нескольких WAV с одинаковыми параметрами в один WAV.
 * Берём заголовок первого файла и дописываем остальные data без заголовков,
 * а затем обновляем размеры RIFF и data.
 */
export async function concatWavFiles(inputs: string[], output: string) {
  if (inputs.length === 0) throw new Error("No input files");

  const first = await fs.readFile(inputs[0]);
  const { dataOffset: firstDataOffset, dataSize: firstDataSize } = findDataChunk(first);

  // Собираем общую «data»
  let totalData = first.slice(firstDataOffset, firstDataOffset + firstDataSize);
  for (let i = 1; i < inputs.length; i++) {
    const buf = await fs.readFile(inputs[i]);
    const { dataOffset, dataSize } = findDataChunk(buf);
    totalData = Buffer.concat([totalData, buf.slice(dataOffset, dataOffset + dataSize)]);
  }

  // Новый размер data
  const newDataSize = totalData.length;

  // Скелет выходного: заголовок первого до начала его data + новые данные
  const header = Buffer.from(first.slice(0, firstDataOffset));
  const out = Buffer.concat([header, totalData]);

  // Обновить размеры:
  // - общий RIFF chunk size по смещению 4: fileSize - 8
  out.writeUInt32LE(out.length - 8, 4);

  // - data chunk size — идёт сразу после 'data' (смещение firstDataOffset - 4)
  out.writeUInt32LE(newDataSize, firstDataOffset - 4);

  await fs.ensureDir(require("path").dirname(output));
  await fs.writeFile(output, out);
}
