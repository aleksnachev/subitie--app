// Източник: kalendarbyagane.com/kalendar/plovdiv/ — бягания в Пловдивска област.
// Страницата е Astro; данните са в props на <astro-island> (сериализирани като [0, стойност]).
// Много състезания имат само „очаквана“ дата за следващата година (estimated_dates) —
// маркираме ги с tentative, за да ги покаже приложението като ориентировъчни.
import { getHtml, decode, sofiaIso } from "../lib/html.mjs";

export const sourceName = "Календар Бягане";

const PAGE = "https://www.kalendarbyagane.com/kalendar/plovdiv/";
const unwrap = (v) => Array.isArray(v)
  ? (v[0] === 1 ? v[1].map(unwrap) : v[0] === 0 ? unwrap(v[1]) : v)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unwrap(x)])) : v;

// Английските имена на места от сайта → български
const PLACES = [
  [/Stadium Plovdiv/i, "Стадион „Пловдив“"], [/Plovdiv Province|Пловдивска област/i, ""],
  [/Plovdiv/g, "Пловдив"], [/Asenovgrad/g, "Асеновград"], [/Karlovo/g, "Карлово"],
  [/Hisarya/g, "Хисаря"], [/,\s*България$/, ""],
];
function bgPlace(s = "") {
  let v = s;
  for (const [re, to] of PLACES) v = v.replace(re, to);
  const parts = [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))];
  return parts.join(", ") || undefined;
}

export default async function () {
  const html = await getHtml(PAGE);
  const props = [...html.matchAll(/<astro-island[^>]*props="([^"]*)"/g)]
    .map((m) => decode(m[1])).sort((a, b) => b.length - a.length)[0];
  if (!props) throw new Error("Няма данни на страницата");
  const rows = unwrap(JSON.parse(props)).initialRows || [];

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const out = [];
  for (const r of rows) {
    const p = r.payload || {};
    // Най-близката дата, която не е отминала с повече от седмица
    const next = (r.race_dates || []).filter(([, to]) => to >= weekAgo).sort((a, b) => a[0].localeCompare(b[0]))[0];
    if (!next || !p.name) continue;
    const [from, to] = next;
    const ymd = (s) => [+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8)];
    const [hh, mm] = p.start_time ? p.start_time.split(":").map(Number) : [0, 0];
    const tentative = !!p.estimated_dates || p.date_status !== "confirmed";
    out.push({
      id: `kb-${r.domain_name}-${from}`,
      // „Tepe Jambore 2026“ за изданието през 2027 → без годината
      title: decode(p.name).replace(/\s*\b(20\d\d)\b/g, (m, y) => (y === from.slice(0, 4) ? m : "")).trim(),
      category: /cycl|bike|вело|колоезд/i.test(`${p.name} ${p.type}`) ? "cycling" : "running",
      start: sofiaIso(...ymd(from), hh, mm),
      end: to !== from ? sofiaIso(...ymd(to), 23, 59) : undefined,
      allDay: !p.start_time || undefined,
      venue: bgPlace(p.location),
      organizer: typeof p.organizer === "string" ? p.organizer : undefined,
      url: p.website || p.registration_url || `https://www.kalendarbyagane.com/stranitsi-na-sastezaniyata/${r.domain_name}/`,
      description: [
        p.type_local ? `Вид: ${p.type_local}` : "",
        typeof p.distance_verbose === "string" ? `Дистанции: ${p.distance_verbose}` : "",
        tentative ? "⚠ Ориентировъчна дата (по миналогодишното издание) — проверете при организатора." : "",
      ].filter(Boolean).join("\n"),
      tentative: tentative || undefined,
      source: sourceName,
    });
  }
  return out;
}
