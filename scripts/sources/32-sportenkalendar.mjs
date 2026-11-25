// Източник: sportenkalendar.bg — всички спортни събития в Пловдив + Гребна база.
// Списъкът дава линкове и вида спорт; на страницата на всяко събитие има schema.org SportsEvent.
import { getHtml, sleep, text } from "../lib/html.mjs";
import { eventsFromJsonLd, fromSchema } from "../lib/jsonld.mjs";
import { guessCategory } from "../lib/normalize.mjs";

export const sourceName = "Спортен календар";
const BASE = "https://sportenkalendar.bg";
const LISTS = ["/mesta/plovdiv", "/zali/grebna-baza"];

export default async function () {
  const cards = new Map(); // линк → текст на картата (вид спорт)
  for (const list of LISTS) {
    const html = await getHtml(BASE + list);
    for (const part of html.split("single-event-transform").slice(1)) {
      const href = (part.match(/href="(\/sybitie\/[^"]+)"/) || [])[1];
      if (href && !cards.has(href)) cards.set(href, text(part.split('class="single-event-transform')[0]).slice(0, 400));
    }
    await sleep(300);
  }
  const out = [];
  for (const [href, cardText] of cards) {
    try {
      const page = await getHtml(BASE + href);
      const e = eventsFromJsonLd(page)[0];
      if (!e) continue;
      const raw = fromSchema(e, sourceName);
      // Първо по заглавието; картата съдържа и вида спорт (напр. „Мажоретен спорт“)
      const cat = [raw.title, cardText].map(guessCategory).find((c) => c !== "other") || "other";
      out.push({
        ...raw,
        id: `spk-${href.match(/(\d+)$/)?.[1] || href}`,
        url: BASE + href,
        venue: raw.venue ? `${raw.venue}, Пловдив`.replace(/\s+,/, ",") : "Пловдив",
        category: cat === "other" ? "sport-other" : cat,
        organizer: raw.organizer || undefined,
      });
    } catch (err) { console.warn(`   sportenkalendar ${href}: ${err.message}`); }
    await sleep(300);
  }
  return out;
}
