// Източник: opoznaiplovdiv.bg/kalendar — „Опознай Пловдив“.
// Сайтът зарежда календара си от собствен публичен адрес (MyListing тема), който връща
// готовия HTML на картите по 5 на страница. Ползваме същия адрес, както самата страница.
import { getHtml, sleep, text, decode, MONTHS, sofiaIso } from "../lib/html.mjs";
import { guessCategory } from "../lib/normalize.mjs";

export const sourceName = "Опознай Пловдив";

const API = (page) =>
  `https://opoznaiplovdiv.bg/?mylisting-ajax=1&action=get_listings&listing_type=event&form_data[page]=${page}&form_data[preserve_page]=true&form_data[sort]=latest`;
const MAX_PAGES = 20;

export default async function () {
  const out = [];
  let pages = 1;
  for (let page = 0; page < Math.min(pages, MAX_PAGES); page++) {
    const data = JSON.parse(await getHtml(API(page)));
    if (!data || !data.html) break;
    pages = data.max_num_pages || 1;
    for (const card of data.html.split("lf-item-container").slice(1)) {
      const ev = parseCard(card);
      if (ev) out.push(ev);
    }
    await sleep(400);
  }
  return out;
}

function parseCard(card) {
  const rawTitle = text((card.match(/listing-preview-title">([\s\S]*?)<\/h4>/) || [])[1] || "");
  const url = decode((card.match(/<a href="([^"]+)"/) || [])[1] || "");
  const id = (card.match(/listing-id-(\d+)/) || [])[1];
  const items = [...card.matchAll(/<li[^>]*>\s*<i class="([^"]+)"[^>]*><\/i>([\s\S]*?)<\/li>/g)].map((m) => [m[1], text(m[2])]);
  const address = items.find(([c]) => /location/.test(c))?.[1];
  const when = items.find(([c]) => /calendar/.test(c))?.[1] || "";
  const image = (card.match(/<img[^>]+src="([^"]+)"/) || [])[1];

  // „ноември 17, 2026 0:00 - ноември 21, 2026 0:00“ или „декември 9, 2026 19:00 - 19:00“
  const dates = [...when.matchAll(/([а-я]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})/gi)]
    .map((m) => ({ mo: MONTHS[m[1].toLowerCase()], d: +m[2], y: +m[3], hh: +m[4], mm: +m[5] }))
    .filter((x) => x.mo);
  if (!rawTitle || !dates.length) return null;
  const [a, b] = [dates[0], dates[dates.length - 1]];
  const allDay = a.hh === 0 && a.mm === 0;
  const multiDay = dates.length > 1 && (a.d !== b.d || a.mo !== b.mo || a.y !== b.y);

  // „"Уют" в Драматичен Театър Пловдив 30.11.2026“ → заглавие „Уют“, място „Драматичен Театър Пловдив“
  const datesRe = /\s*\d{1,2}\.\d{1,2}(\.\d{2,4})?(\s*[-–]\s*\d{1,2}\.\d{1,2}(\.\d{2,4})?)?\s*(г\.)?\s*$/;
  let title = rawTitle.replace(datesRe, "").trim();
  let venue;
  const quoted = title.match(/^["„“]([^"„“”]+)["“”]\s+в\s+(.+)$/);
  if (quoted) { title = quoted[1].trim(); venue = quoted[2].replace(/Кулен/, "Куклен").trim(); }

  const iconCat = /theater-masks/.test(card) ? "театър" : "";
  return {
    id: `op-${id || title}`,
    title,
    category: [rawTitle, `${venue || ""} ${iconCat}`].map(guessCategory).find((c) => c !== "other") || "other",
    start: sofiaIso(a.y, a.mo, a.d, a.hh, a.mm),
    end: multiDay ? sofiaIso(b.y, b.mo, b.d, 23, 59) : undefined,
    allDay: allDay || undefined,
    venue: venue || address,
    address: venue ? address : undefined,
    url,
    image: image && !/placeholder/.test(image) ? image : undefined,
    source: sourceName,
  };
}
