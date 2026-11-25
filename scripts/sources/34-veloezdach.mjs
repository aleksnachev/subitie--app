// Източник: veloezdach.com — национален календар за колоездене (schema.org Event на началната страница).
// Взимаме само събитията в Пловдив и областта.
import { getHtml } from "../lib/html.mjs";
import { eventsFromJsonLd, fromSchema, PLOVDIV_AREA } from "../lib/jsonld.mjs";

export const sourceName = "Велоездач";

export default async function () {
  const html = await getHtml("https://veloezdach.com/");
  return eventsFromJsonLd(html)
    .map((e) => fromSchema(e, sourceName))
    .filter((r) => PLOVDIV_AREA.test(`${r.title} ${r.venue} ${r.address} ${r.city}`))
    .map((r) => ({
      ...r,
      id: `velo-${decodeURIComponent(r.url || r.title).split("/").filter(Boolean).pop()}`,
      category: /бягане|run|дуатлон|триатлон/i.test(r.title) && !/вело|bike|колоезд/i.test(r.title) ? "running" : "cycling",
    }));
}
