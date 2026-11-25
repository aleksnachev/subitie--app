// schema.org Event данни (<script type="application/ld+json">).
// Много сайтове ги слагат за Google — това е най-надеждният начин за четене на събития.
import { decode, text, sofiaIso } from "./html.mjs";

/** Връща всички обекти от тип *Event на страницата (Event, MusicEvent, SportsEvent…). */
export function eventsFromJsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    // Някои сайтове оставят нови редове вътре в низовете → невалиден JSON; заменяме ги с интервал
    try { data = JSON.parse(m[1].replace(/[\r\n\t]+/g, " ")); } catch { continue; }
    const walk = (x) => {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(walk);
      if (/Event$/.test(String(x["@type"]))) out.push(x);
      for (const k of ["@graph", "itemListElement", "item", "subEvent"]) walk(x[k]);
    };
    walk(data);
  }
  return out;
}

/** dd/mm/yyyy hh:mm → ISO (някои сайтове не спазват стандарта) */
function fixDate(s) {
  if (!s) return s;
  s = String(s);
  const m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return sofiaIso(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  // „2026-11-29T20:00:00“ без часова зона = българско време (иначе на сървъра става UTC)
  const n = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/);
  if (n) return sofiaIso(+n[1], +n[2], +n[3], +n[4], +n[5]);
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // само дата
  if (d) return sofiaIso(+d[1], +d[2], +d[3], 0, 0);
  return s;
}

/** schema.org Event → нашия „суров“ формат (normalize.mjs довършва останалото). */
export function fromSchema(e, source) {
  const loc = Array.isArray(e.location) ? e.location[0] : e.location || {};
  const addr = typeof loc.address === "string" ? loc.address : loc.address || {};
  const img = Array.isArray(e.image) ? e.image[0] : e.image?.url || e.image;
  const offer = Array.isArray(e.offers) ? e.offers[0] : e.offers;
  const start = fixDate(e.startDate);
  return {
    title: decode(String(e.name || "")).replace(/\s+/g, " ").trim(),
    start,
    end: fixDate(e.endDate),
    allDay: /^\d{4}-\d{2}-\d{2}$/.test(String(e.startDate || "")) || undefined,
    venue: decode(String(loc.name || "")).trim() || undefined,
    address: typeof addr === "string" ? addr : [addr.streetAddress, addr.addressLocality].filter(Boolean).join(", ") || undefined,
    city: typeof addr === "string" ? addr : `${addr.addressLocality || ""} ${addr.addressRegion || ""} ${addr.streetAddress || ""}`,
    url: e.url,
    image: typeof img === "string" && !/\/$/.test(img) ? img : undefined,
    description: e.description ? text(decode(String(e.description))).slice(0, 900) : undefined,
    price: offer?.price ? `${offer.price} ${offer.priceCurrency || ""}`.trim() : undefined,
    organizer: (Array.isArray(e.organizer) ? e.organizer[0] : e.organizer)?.name || undefined,
    source,
  };
}

/** Дали мястото е в Пловдив или региона (за национални календари). */
export const PLOVDIV_AREA = /Пловдив|Plovdiv|Асеновград|Asenovgrad|Марково|Брестник|Бачково|Перущица|Хисаря|Карлово|Стамболийски|Раковски|Садово|Първомай|Куклен|Кричим|Съединение|Калояново|Марица/i;
