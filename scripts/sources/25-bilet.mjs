// Източник: bilet.bg — търсене по град „Пловдив“, после страницата на всяко събитие
// (там има schema.org Event с точен час, място и снимка). /api/ е забранен в robots.txt
// и не го ползваме — четем само публичните страници.
import { getHtml, sleep } from "../lib/html.mjs";
import { eventsFromJsonLd, fromSchema, PLOVDIV_AREA } from "../lib/jsonld.mjs";
import { guessCategory } from "../lib/normalize.mjs";

export const sourceName = "bilet.bg";
const SEARCH = "https://bilet.bg/bg/search?city=%D0%9F%D0%BB%D0%BE%D0%B2%D0%B4%D0%B8%D0%B2";

export default async function () {
  const html = await getHtml(SEARCH);
  const links = [...new Set([...html.matchAll(/href="(\/bg\/events\/[^"?#]+)/g)].map((m) => m[1]))];
  const out = [];
  for (const path of links.slice(0, 60)) {
    try {
      const page = await getHtml("https://bilet.bg" + path);
      for (const e of eventsFromJsonLd(page)) {
        const raw = fromSchema(e, sourceName);
        if (!PLOVDIV_AREA.test(`${raw.city} ${raw.venue} ${raw.address}`)) continue;
        const og = (page.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
        const cat = guessCategory(`${raw.title} ${raw.description || ""}`);
        out.push({ ...raw, id: `bilet-${path.match(/(\d+)$/)?.[1] || path}`, image: raw.image || og, category: cat === "other" || cat === "tour" ? "concert" : cat });
      }
    } catch (e) { console.warn(`   bilet ${path}: ${e.message}`); }
    await sleep(300);
  }
  return out;
}
