// ШАБЛОН за нов автоматичен източник (сайт на театър, билетна платформа и т.н.).
// Копирайте този файл, напр. като 11-drama-theatre.mjs, сменете URL-а и логиката
// за извличане и махнете `enabled = false`.
//
// Съвети:
// - Първо проверете дали сайтът има RSS, iCal (.ics) или JSON API — много по-надеждно е от HTML.
// - Много сайтове слагат <script type="application/ld+json"> с "@type": "Event" — функцията
//   по-долу го чете автоматично, без да пишете нищо специално.
// - Спазвайте robots.txt и условията на сайта; винаги давайте линк към оригинала (url).

export const sourceName = "Пример";
export const enabled = false;

const URL_TO_SCRAPE = "https://example.com/events";

export default async function () {
  const html = await (await fetch(URL_TO_SCRAPE, { headers: { "User-Agent": "subitie-bot/1.0" } })).text();
  return fromJsonLd(html, sourceName);
}

/** Извлича schema.org Event записи от страница. Може да се ползва във всеки източник. */
export function fromJsonLd(html, source) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1]); } catch { continue; }
    const items = [data, ...(data["@graph"] || []), ...(Array.isArray(data) ? data : [])].flat();
    for (const it of items) {
      if (!it || !/Event$/.test(String(it["@type"]))) continue;
      out.push({
        title: it.name,
        start: it.startDate,
        end: it.endDate,
        venue: it.location?.name,
        address: typeof it.location?.address === "string" ? it.location.address : it.location?.address?.streetAddress,
        url: it.url,
        image: Array.isArray(it.image) ? it.image[0] : it.image?.url || it.image,
        description: it.description,
        price: it.offers?.price ? `${it.offers.price} ${it.offers.priceCurrency || ""}`.trim() : undefined,
        organizer: it.organizer?.name,
        source,
      });
    }
  }
  return out;
}
