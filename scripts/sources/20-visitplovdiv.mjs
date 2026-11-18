// Източник: visitplovdiv.com — официалният туристически портал на Община Пловдив.
//
// Списъкът /bg/events е подреден по дата на публикуване, затова обхождаме първите
// няколко страници и отваряме всяко събитие. Има два вида страници:
//  1) Отделно събитие: дата (22/12/2026), „Час на мероприятието“, място в първия абзац.
//  2) Месечна програма („Програма на Драматичен театър Пловдив - декември 2026“):
//     всеки абзац е отделно представление → разделяме ги на отделни събития.
import { getHtml, sleep, text, decode, MONTHS, sofiaIso } from "../lib/html.mjs";
import { guessCategory } from "../lib/normalize.mjs";

export const sourceName = "Visit Plovdiv";

const BASE = "https://www.visitplovdiv.com";
const LIST_PAGES = 4;   // ~9 събития на страница
const DELAY_MS = 400;   // пауза между заявките, за да не натоварваме сайта

export default async function () {
  const ids = new Set();
  for (let page = 0; page < LIST_PAGES; page++) {
    const html = await getHtml(`${BASE}/bg/events?page=${page}`);
    for (const m of html.matchAll(/<h1><a href="\/bg\/node\/(\d+)">/g)) ids.add(m[1]);
    await sleep(DELAY_MS);
  }

  const out = [];
  for (const id of ids) {
    try {
      const html = await getHtml(`${BASE}/bg/node/${id}`);
      out.push(...parseNode(html, `${BASE}/bg/node/${id}`, id));
    } catch (e) {
      console.warn(`   visitplovdiv ${id}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  return out;
}

function field(html, label) {
  const re = new RegExp(`<span>${label}</span></li>\\s*(?:<!--[\\s\\S]*?-->\\s*)*<li>([\\s\\S]*?)</li>`);
  const m = html.match(re);
  return m ? text(m[1]) : "";
}

function parseDateRange(s) {
  const all = [...(s || "").matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((m) => ({ d: +m[1], m: +m[2], y: +m[3] }));
  return all.length ? { from: all[0], to: all[all.length - 1] } : null;
}

const priceOf = (entry) => /свободен|безплат/i.test(entry) ? "Безплатно" : "";

export function parseNode(html, url, id) {
  const title = text((html.match(/<h1 class="main-title">([\s\S]*?)<\/h1>/) || [])[1] || "");
  const range = parseDateRange((html.match(/event-date_'>([^<]*)/) || [])[1]);
  if (!title || !range) return [];

  const article = (html.match(/class="article_content">([\s\S]*?)<div class="article_related">/) || [])[1] || "";
  let image = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  if (image) image = encodeURI(decode(image).replace(/^http:/, "https:"));
  const organizer = field(html, "Организатор");
  const entry = field(html, "Вход");
  const time = field(html, "Час на мероприятието");

  if (/^Програма на /i.test(title)) return parseProgram(article, { title, range, organizer, url, image, id });

  // Отделно събитие: първият абзац е „Заглавие, жанр / Ден, дата от ЧЧ:ММ / Място“
  const paragraphs = text(article).split(/\n\n+/).filter(Boolean);
  const head = (paragraphs[0] || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const genre = head[0]?.includes(",") ? head[0].split(",").pop().trim() : "";
  const venue = head.length >= 3 ? head[head.length - 1] : undefined;
  const hm = (time || head[1] || "").match(/(\d{1,2})[:.](\d{2})/);
  const { from, to } = range;
  const multiDay = from.d !== to.d || from.m !== to.m || from.y !== to.y;

  return [{
    id: `vp-${id}`,
    title,
    category: [genre, head[0], `${title} ${paragraphs.slice(1).join(" ")}`]
      .map((s) => guessCategory(`${s} ${title}`)).find((c) => c !== "other") || "other",
    start: sofiaIso(from.y, from.m, from.d, hm ? +hm[1] : 0, hm ? +hm[2] : 0),
    end: multiDay ? sofiaIso(to.y, to.m, to.d, 23, 59) : undefined,
    allDay: !hm || undefined,
    venue: venue && venue.length < 90 ? venue : undefined,
    organizer: organizer || undefined,
    price: priceOf(entry) || undefined,
    url,
    image,
    description: paragraphs.slice(1).join("\n\n").slice(0, 900) || undefined,
    source: sourceName,
  }];
}

function parseProgram(article, { title, range, organizer, url, image, id }) {
  const isOpera = /опера/i.test(title);
  const baseVenue = isOpera ? "Дом на културата „Борис Христов“" : /драматичен/i.test(title) ? "Драматичен театър Пловдив" : organizer;
  const out = [];
  let n = 0;
  for (const block of article.split(/<\/p>/i)) {
    const linkM = block.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const lines = text(block).split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const dm = lines[0].match(/(\d{1,2})\s+([а-я]+)/i);
    const month = dm && MONTHS[dm[2].toLowerCase()];
    if (!month) continue;
    const tm = lines[0].match(/(\d{1,2})[:.](\d{2})/);
    const year = month < range.from.m ? range.from.y + 1 : range.from.y;

    const showTitle = linkM ? text(linkM[2]) : lines.find((l, i) => i > 0 && !/зала|сцена/i.test(l)) || lines[1];
    const rest = lines.slice(1).filter((l) => l !== showTitle);
    const hall = rest.find((l) => /зала|сцена/i.test(l) && l.length < 40);
    const venueLine = rest.find((l) => /дом на културата|театър|театър|площад|панаир/i.test(l));
    const genre = rest.find((l) => l !== hall && l !== venueLine && l.length < 40) || "";
    const extra = rest.filter((l) => l !== hall && l !== venueLine).join(". ");

    out.push({
      id: `vp-${id}-${++n}`,
      title: showTitle,
      category: isOpera ? guessCategory(`${genre} опера`) : guessCategory(`${genre} ${showTitle} театър`),
      start: sofiaIso(year, month, +dm[1], tm ? +tm[1] : 19, tm ? +tm[2] : 0),
      venue: venueLine || (hall ? `${baseVenue} – ${hall}` : baseVenue),
      organizer: organizer || undefined,
      url: linkM ? decode(linkM[1]) : url,
      image,
      description: extra || undefined,
      source: sourceName,
    });
  }
  return out;
}
