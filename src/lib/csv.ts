// src/lib/csv.ts
/**
 * Đọc file CSV và parse thành mảng object theo header
 */
export async function parseCsv(file: File): Promise<Record<string, string>[]> {
  // Đọc toàn bộ text
  const text = await file.text();

  // Split thành các dòng, loại bỏ dòng trống
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  // Header là dòng đầu
  const headers = lines[0].split(",").map((h) => h.trim());

  // Phần data
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] ?? "";
    });
    return obj;
  });
}
