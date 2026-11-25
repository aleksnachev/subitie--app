// Уеднаквяване на събития от различни източници.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONFIG = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../js/config.js"), "utf8");
const CATEGORY_IDS = new Set([...CONFIG.matchAll(/id: "([a-z0-9-]+)",\s*group:/g)].map((m) => m[1]));
const AGE_IDS = new Set(["all", "under18", "18-40", "40plus"]);

// Ако източникът не дава категория — познаваме по ключови думи в заглавието/описанието.
const KEYWORDS = [
  // По-специфичните спортове са преди футбола („Ботев“ има и баскетболен, и волейболен отбор)
  ["basketball", /баскетбол|basketball|нбл/i],
  ["volleyball", /волейбол|volleyball/i],
  ["football", /футбол|football|efbet лига|първа лига/i],
  ["volleyball", /волейбол|volleyball/i],
  ["running", /маратон|бягане|крос(?!фит)|\brun\b|running/i],
  ["cycling", /колоездене|велосипед|вело|cycling|bike/i],
  ["rowing", /гребане|гребна база|rowing|кану|каяк/i],
  ["tennis", /тенис|tennis/i],
  ["martial", /бокс|карате|джудо|борба|кикбокс|mma/i],
  ["fitness", /йога|фитнес|кросфит|yoga|fitness|пилатес/i],
  ["outdoor", /катерене|алпинизъм|скално|планинарство|трекинг/i],
  ["sport-other", /гимнастик|чирлидинг|мажорет|шахмат|плуване|тенис на маса|бадминтон|хандбал|ръгби|фехтовка|стрелба|лека атлетика|турнир|шампионат|състезание/i],
  ["opera", /опера|балет|opera|ballet/i],
  ["classical", /филхармония|симфони|камерн|класическ|орган|рецитал/i],
  ["puppet", /куклен/i],
  ["theatre", /театър|постановка|премиера|спектакъл|пиеса|мюзикъл|theatre|musical/i],
  ["standup", /стендъп|stand-up|комеди/i],
  ["cinema", /кино|филм|прожекция|cinema|film/i],
  ["exhibition", /изложба|галерия|exhibition|експозиция/i],
  ["museum", /музей|museum|нощ на музеите/i],
  ["literature", /книга|литератур|поезия|представяне на книга|четене/i],
  ["dance", /танц|dance/i],
  ["festival", /фестивал|fest/i],
  ["workshop", /работилница|уъркшоп|workshop|ателие/i],
  ["education", /лекция|семинар|обучение|конференция|дискусия|talk/i],
  ["volunteering", /доброволч|дарител|благотворител|почистване/i],
  ["kids", /за деца|детск|kids/i],
  ["party", /парти|party|dj\b/i],
  ["food", /вино|дегустация|храна|food|wine|гурме/i],
  ["tour", /(^|[^а-я])тур([^а-я]|$)|разходка|обиколка|\btour\b/i],
  ["concert", /концерт|концерти|concert|live|рок|джаз|група/i],
];

export function guessCategory(text = "") {
  for (const [id, re] of KEYWORDS) if (re.test(text)) return id;
  return "other";
}

// Латиница в id-тата, за да са линковете за споделяне чисти (…#/e/hamlet-2026-11-18)
const TR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sht",ъ:"a",ь:"y",ю:"yu",я:"ya" };
const slug = (s) => s.toLowerCase().replace(/[а-я]/g, (c) => TR[c] ?? c).normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Връща чисто събитие или null, ако липсват задължителни полета. */
export function normalize(raw, sourceName) {
  if (!raw?.title || !raw?.start) return null;
  const start = new Date(raw.start);
  if (isNaN(start)) return null;

  let end = raw.end ? new Date(raw.end) : null;
  if ((!end || isNaN(end) || end < start) && !raw.allDay) {
    // Има час на започване, но не и на край → приемаме ~3 часа (концерт, спектакъл, мач)
    end = new Date(start.getTime() + 3 * 3600000);
  } else if (!end || isNaN(end) || end < start) {
    // Без край → до края на деня (23:59 българско време)
    end = new Date(start.toLocaleString("en-US", { timeZone: "Europe/Sofia" }));
    const sofiaOffset = start.getTime() - end.getTime();
    end.setHours(23, 59, 0, 0);
    end = new Date(end.getTime() + sofiaOffset);
  }

  let category = raw.category && CATEGORY_IDS.has(raw.category) ? raw.category : guessCategory(`${raw.title} ${raw.description || ""}`);
  let ages = (Array.isArray(raw.ages) ? raw.ages : String(raw.ages || "all").split(/[,;]\s*/)).filter((a) => AGE_IDS.has(a));
  if (!ages.length) ages = ["all"];

  const ev = {
    id: raw.id || `${slug(sourceName)}-${slug(raw.title)}-${start.toISOString().slice(0, 10)}`,
    title: String(raw.title).trim(),
    title_en: raw.title_en || undefined,
    category,
    ages,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: !!raw.allDay || undefined,
    sessions: raw.sessions > 1 ? raw.sessions : undefined,
    tentative: raw.tentative ? true : undefined,
    venue: raw.venue || undefined,
    address: raw.address || undefined,
    price: raw.price ?? undefined,
    organizer: raw.organizer || undefined,
    url: raw.url || undefined,
    image: raw.image || undefined,
    description: raw.description || undefined,
    description_en: raw.description_en || undefined,
    source: raw.source || sourceName,
    demo: raw.demo || undefined,
  };
  return JSON.parse(JSON.stringify(ev)); // маха undefined полетата
}

/** Едно и също събитие от два източника = същото заглавие (приблизително) + същия ден. */
export function dedupe(events) {
  // Денят по българско време (иначе 00:00 ч. в София е „вчера“ в UTC)
  const day = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
  // + часът, за да не слеем сутрешно и вечерно представление
  const hour = (e) => e.allDay ? "" : new Date(e.start).toLocaleTimeString("en-GB", { timeZone: "Europe/Sofia", hour: "2-digit" });
  const key = (e) => `${slug(e.title).replace(/-/g, "").slice(0, 30)}|${day(e.start)}|${hour(e)}`;
  // Предпочитаме записа с точен час и потвърдена дата, после по-пълния
  const score = (x) => Object.keys(x).length - (x.allDay ? 4 : 0) - (x.tentative ? 4 : 0);
  const seen = new Map();
  for (const e of events) {
    const k = key(e);
    const prev = seen.get(k);
    if (!prev || score(e) > score(prev)) seen.set(k, e);
  }

  // Втори кръг: различни заглавия за едно и също нещо в един ден
  // („Концерт на Chris Norman“ = „Chris Norman Live - Plovdiv“) от различни източници
  const STOP = new Set(["kontsert", "live", "plovdiv", "with", "festival", "tour", "turne", "sabitie", "event", "center", "fest"]);
  const words = (t) => new Set(slug(t).split("-").filter((w) => w.length >= 4 && !STOP.has(w)));
  const list = [...seen.values()];
  const drop = new Set();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (drop.has(a) || drop.has(b) || a.source === b.source || day(a.start) !== day(b.start)) continue;
      // Сутрешно и вечерно представление на едно заглавие са различни събития
      if (!a.allDay && !b.allDay && Math.abs(new Date(a.start) - new Date(b.start)) > 90 * 60000) continue;
      const wa = words(a.title), wb = words(b.title);
      const common = [...wa].filter((w) => wb.has(w)).length;
      if (common >= 2 || (common >= 1 && Math.min(wa.size, wb.size) <= 1)) drop.add(score(a) >= score(b) ? b : a);
    }
  }
  return list.filter((e) => !drop.has(e));
}

/** Малък CSV парсер (за публикуван Google Sheet). */
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}
