// Източник: kolodrumplovdiv.com — зала „Колодрум“ (волейбол, баскетбол, гимнастика, концерти).
// Началната страница има слайдер с предстоящите събития: заглавие, дата, линк, снимка.
// Отваряме всяко събитие, за да познаем категорията от описанието и да намерим часа.
import { getHtml, sleep, text, decode, sofiaIso } from "../lib/html.mjs";
import { guessCategory } from "../lib/normalize.mjs";

export const sourceName = "Колодрум Пловдив";
const BASE = "https://kolodrumplovdiv.com";

export default async function () {
  const html = await getHtml(BASE + "/");
  const out = [];
  const seen = new Set();
  for (const slide of html.split('<div class="slide">').slice(1)) {
    const title = text((slide.match(/homepage-slider-title">([\s\S]*?)<\/h2>/) || [])[1] || "");
    const dm = slide.match(/homepage-slider-date">[^<]*?(\d{2})\.(\d{2})\.(\d{4})/);
    const href = (slide.match(/href="(\/bg\/sybitia\/[^"]+)"/) || [])[1];
    if (!title || !dm || seen.has(href)) continue;
    seen.add(href);
    const img = (slide.match(/data-src="([^"]+)"/) || [])[1];

    let body = "";
    try { body = text((await getHtml(BASE + href)).replace(/[\s\S]*?<main|<footer[\s\S]*/gi, "")).slice(0, 3000); } catch {}
    const tm = body.match(/(?:от|начало|час[а]?[:\s]*)\s*(\d{1,2})[:.](\d{2})/i);
    // Първо по заглавието, после по описанието; концертите често пишат „турне“/„live“
    const cat = /концерт|турне|\blive\b|\btour\b/i.test(title) ? "concert"
      : [title, body.slice(0, 800)].map(guessCategory).find((c) => c !== "other") || "other";
    out.push({
      id: `kolodrum-${href.split("/").pop()}`,
      title,
      category: cat === "other" ? "sport-other" : cat,
      start: sofiaIso(+dm[3], +dm[2], +dm[1], tm ? +tm[1] : 0, tm ? +tm[2] : 0),
      allDay: !tm || undefined,
      venue: "Зала „Колодрум“",
      address: "ул. „Асеновградско шосе“ 8, Пловдив",
      url: BASE + href,
      image: img ? BASE + encodeURI(decode(img)) : undefined,
      source: sourceName,
    });
    await sleep(300);
  }
  return out;
}
