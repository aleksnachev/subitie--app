// Източник: songkick.com — концерти в Пловдив (страницата има schema.org MusicEvent).
import { getHtml } from "../lib/html.mjs";
import { eventsFromJsonLd, fromSchema } from "../lib/jsonld.mjs";

export const sourceName = "Songkick";

export default async function () {
  const html = await getHtml("https://www.songkick.com/metro-areas/26889-bulgaria-plovdiv");
  return eventsFromJsonLd(html).map((e) => {
    const raw = fromSchema(e, sourceName);
    // „aetherian @ Under City“ → „aetherian“ (мястото го показваме отделно)
    const title = raw.title.replace(/\s+@\s+.+$/, "").trim();
    return {
      ...raw,
      id: `sk-${(raw.url || "").match(/\/(\d+)-/)?.[1] || title}`,
      title,
      category: /Festival/.test(e["@type"]) || /festival/i.test(raw.title) ? "festival" : "concert",
      venue: raw.venue === "Plovdiv Rowing Canal" ? "Гребна база Пловдив" : raw.venue,
    };
  });
}
