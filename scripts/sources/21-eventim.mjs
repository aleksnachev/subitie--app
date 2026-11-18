// Източник: eventim.bg — страницата „Събития в Пловдив“.
//
// Eventim позволява автоматично четене само на тази обща страница (отделните страници
// на събитията връщат 403 за ботове и не ги заобикаляме). Затова всяко събитие тук е
// „серия“: заглавие, снимка, период (напр. 01.12.2026 ─ 30.12.2026) и брой дати.
// Точните часове потребителят вижда в Eventim чрез бутона „Към събитието“.
// За пълни данни → партньорство с Eventim (те имат партньорска програма/фийд).
import { getHtml, text, decode, sofiaIso } from "../lib/html.mjs";
import { guessCategory } from "../lib/normalize.mjs";

// ⚠ ИЗКЛЮЧЕН: Eventim не отговаря на ботове, които се представят честно (subitie-bot),
// а представянето като обикновен браузър би било заобикаляне на защитата им.
// Включете го (enabled = true), когато Eventim ви разреши достъп/даде фийд —
// тогава сменете CITY_URL с техния фийд или добавете разрешения User-Agent.
export const enabled = false;

export const sourceName = "Eventim";

const CITY_URL = "https://www.eventim.bg/city/%D0%BF%D0%BB%D0%BE%D0%B2%D0%B4%D0%B8%D0%B2-7477/";

// Слъгът на мястото в линка → човешко име
const VENUES = [
  [/колодрум/, "Зала „Колодрум“"],
  [/комплекс-с-и-л-а/, "Комплекс „Сила“"],
  [/дом-на-културата-борис-христов/, "Дом на културата „Борис Христов“"],
  [/античен-театър/, "Античен театър"],
  [/международен-панаир/, "Международен панаир Пловдив"],
  [/драматичен-театър/, "Драматичен театър Пловдив"],
  [/летен-театър/, "Летен театър Пловдив"],
  [/гребна-база/, "Гребна база Пловдив"],
];

export default async function () {
  const html = await getHtml(CITY_URL);
  const out = [];
  for (const part of html.split('<product-group-item').slice(1)) {
    const title = text((part.match(/listing-headline[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "");
    const data = text((part.match(/class="listing-data"[^>]*>([\s\S]*?)<\/span><\/span>/) || [])[1] || "");
    const dates = [...data.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map((m) => [+m[3], +m[2], +m[1]]);
    if (!title || !dates.length) continue;

    const links = [...part.matchAll(/href="(\/(?:event|eventseries|artist)\/[^"]+)"/g)].map((m) => decode(m[1]));
    const eventLink = links.find((l) => l.startsWith("/event/"));
    const groupLink = links.find((l) => !l.startsWith("/event/"));
    const count = +(data.match(/(\d+)\s+събити/) || [])[1] || 1;
    const slug = decodeURI(eventLink || "").toLowerCase();
    const venue = VENUES.find(([re]) => re.test(slug))?.[1];
    const img = (part.match(/data-src="([^"]+)"/) || [])[1];
    const [from, to] = [dates[0], dates[dates.length - 1]];

    out.push({
      id: `eventim-${(eventLink || groupLink || title).match(/(\d{5,})\/?$/)?.[1] || title}`,
      title,
      category: guessCategory(`${title} ${slug}`),
      start: sofiaIso(from[0], from[1], from[2], 0, 0),
      end: sofiaIso(to[0], to[1], to[2], 23, 59),
      allDay: true,
      sessions: count,
      venue,
      url: "https://www.eventim.bg" + encodeURI(count > 1 && groupLink ? groupLink : eventLink || groupLink || ""),
      image: img && !/fallback/.test(img) ? img : undefined,
      description: count > 1 ? `${count} дати между ${data.match(/[\d.]+\s*─\s*[\d.]+/)?.[0] || ""}. Виж всички дати и часове в Eventim.` : undefined,
      source: sourceName,
    });
  }
  return out;
}
