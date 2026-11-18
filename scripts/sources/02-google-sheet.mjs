// Източник: Google Form → Google Sheet (за ученически/младежки организации и всички организатори).
//
// Настройка:
// 1. Направете Google Form с полета (имената на колоните трябва да са точно тези):
//    title, start, end, category, ages, venue, address, price, organizer, url, image, description, approved
//    (start/end във формат 2026-12-05 18:30)
// 2. Responses → „Link to Sheets“. В таблицата: File → Share → Publish to web → CSV.
// 3. Копирайте линка в GitHub: Settings → Secrets and variables → Actions → Variables →
//    New variable с име SHEET_CSV_URL.
// 4. Колоната `approved` се попълва от екипа с „да“ — само одобрените се публикуват.
import { parseCsv } from "../lib/normalize.mjs";

export const sourceName = "Форма за организатори";
export const enabled = !!process.env.SHEET_CSV_URL;

const toIso = (s) => {
  if (!s) return null;
  const m = s.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return s;
  let [, a, b, c, hh = "00", mm = "00"] = m;
  const [y, mo, d] = a.length === 4 ? [a, b, c] : [c, b, a]; // 2026-12-05 или 05.12.2026
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:00+02:00`;
};

export default async function () {
  const res = await fetch(process.env.SHEET_CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCsv(await res.text())
    .filter((r) => /^(да|yes|1|true|x)$/i.test(r.approved || ""))
    .map((r) => ({ ...r, start: toIso(r.start), end: toIso(r.end), source: r.organizer || sourceName }));
}
