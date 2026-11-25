// Източник: operaplovdiv.bg/bg/site/program — „Програма и билети“ на Държавна опера Пловдив.
// Всяка карта: ден/месец, час, място, жанр (клас на картата), автор, заглавие, снимка.
import { getHtml, text, decode, sofiaIso } from "../lib/html.mjs";

export const sourceName = "Опера Пловдив";
const BASE = "https://operaplovdiv.bg";

const GENRE = { opera: "opera", operetta: "opera", ballet: "opera", musical: "theatre", concert: "classical", kids: "kids" };

export default async function () {
  const html = await getHtml(`${BASE}/bg/site/program`);
  const now = new Date();
  const out = [];
  for (const card of html.split('<div class="card accordion-item event').slice(1)) {
    const head = card.split("accordion-body")[0];
    const cls = (card.match(/^\s*([a-z ]+)"/) || [])[1]?.trim().split(/\s+/) || [];
    const day = +(head.match(/class="date">\s*<span>(\d{1,2})<\/span>\s*\/\s*<span>(\d{1,2})<\/span>/) || [])[1];
    const month = +(head.match(/class="date">\s*<span>\d{1,2}<\/span>\s*\/\s*<span>(\d{1,2})<\/span>/) || [])[1];
    if (!day || !month) continue;
    // Гостувания на операта в други градове не са за нас
    if (/Стара Загора|София|Софийска|Варна|Бургас|Русе|Плевен|Хасково|Пазарджик/i.test(text((head.match(/class="location">([\s\S]*?)<\/div>/) || [])[1] || ""))) continue;
    const time = (head.match(/class="time">\s*<span>(\d{1,2}):(\d{2})/) || []);
    const title = text((head.match(/class="title">([\s\S]*?)<\/h3>/) || [])[1] || "");
    const author = text((head.match(/class="author">([\s\S]*?)<\/h2>/) || [])[1] || "");
    const venue = text((head.match(/class="location">[\s\S]*?<span>([\s\S]*?)<\/span>/) || [])[1] || "");
    const tags = [...head.matchAll(/class="tag[^"]*"[^>]*>(?:<i[^>]*><\/i>)?<span>([^<]+)<\/span>/g)].map((m) => m[1].trim());
    const id = (head.match(/performance\/details\?id=(\d+)/) || [])[1];
    const img = (head.match(/<img src="([^"]+)"/) || [])[1];
    // Програмата е за сезона → месец по-малък от текущия значи следващата година
    const year = month < now.getMonth() + 1 - 1 ? now.getFullYear() + 1 : now.getFullYear();
    const genre = cls.find((c) => GENRE[c]);
    const kids = tags.some((t) => /деца/i.test(t));

    out.push({
      id: `opera-${id}-${year}${month}${day}${time[1] || ""}`,
      title,
      category: kids ? "kids" : GENRE[genre] || "opera",
      ages: kids ? ["all", "under18"] : undefined,
      start: sofiaIso(year, month, day, time[1] ? +time[1] : 19, time[2] ? +time[2] : 0),
      venue: decode(venue) || "Дом на културата „Борис Христов“",
      organizer: "Държавна опера Пловдив",
      url: id ? `${BASE}/bg/performance/details?id=${id}` : `${BASE}/bg/site/program`,
      image: img ? BASE + decode(img) : undefined,
      description: [author && `${author} — ${title}`, tags.join(" · ")].filter(Boolean).join("\n") || undefined,
      source: sourceName,
    });
  }
  return out;
}
