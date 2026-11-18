// Източник: data/manual.json — събития, въведени ръчно от екипа.
// Най-лесно се редактира директно в GitHub (молив ✏️ → Commit).
import { readFile } from "node:fs/promises";

export const sourceName = "съБИТИЕ+";

export default async function () {
  const file = new URL("../../data/manual.json", import.meta.url);
  const data = JSON.parse(await readFile(file, "utf8"));
  return data.events || data;
}
