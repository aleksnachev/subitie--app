// Източник: pptheatre.com — Държавен куклен театър Пловдив, „Програма / Предстоящи събития“.
import { getHtml, text, decode, MONTHS, sofiaIso } from "../lib/html.mjs";

export const sourceName = "Куклен театър Пловдив";

export default async function () {
  const html = await getHtml("https://pptheatre.com/bg");
  const out = [];
  for (const day of html.split('<div class="calendar-list-item').slice(1)) {
    const h = day.match(/<h3>\s*<strong>(\d{1,2})<\/strong>\s*<span>([а-я]+),\s*(\d{4})<\/span>/i);
    if (!h) continue;
    const [d, mon, y] = [+h[1], MONTHS[h[2].toLowerCase()], +h[3]];
    for (const card of day.split("item-card").slice(1)) {
      const href = decode((card.match(/href="([^"]+)"/) || [])[1] || "");
      const title = text((card.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1] || "");
      const tm = card.match(/list-time">(\d{1,2}):(\d{2})/);
      const img = (card.match(/background-image:\s*url\('([^']+)'\)/) || [])[1];
      const age = +(card.match(/age-label">(\d+)/) || [])[1];
      const desc = text((card.match(/resume-description">([\s\S]*?)<\/div>/) || [])[1] || "");
      if (!title) continue;
      out.push({
        id: `pp-${(href.match(/\/p\/(\d+)/) || [])[1] || title}-${y}${mon}${d}${tm ? tm[1] + tm[2] : ""}`,
        title,
        category: "puppet",
        ages: age >= 14 ? ["under18", "18-40", "40plus"] : ["all", "under18"],
        start: sofiaIso(y, mon, d, tm ? +tm[1] : 10, tm ? +tm[2] : 30),
        venue: "Държавен куклен театър Пловдив",
        address: "ул. „Христо Г. Данов“ 14",
        url: href || "https://pptheatre.com/bg",
        image: img ? encodeURI(decode(img)) : undefined,
        description: [age ? `Подходящо за ${age}+ г.` : "", desc].filter(Boolean).join("\n") || undefined,
        source: sourceName,
      });
    }
  }
  return out;
}
