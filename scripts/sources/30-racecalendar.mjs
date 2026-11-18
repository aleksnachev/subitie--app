// Източник: racecalendar.bg/plovdiv — бегови състезания в радиус 30 км от Пловдив.
// Страницата е Angular с вградени данни (<script id="ng-state">), които четем директно.
import { getHtml, sofiaIso } from "../lib/html.mjs";

export const sourceName = "RaceCalendar.bg";

const TERRAIN = { 1: "Трейл", 2: "Шосе", 3: "Писта", 4: "Крос" };

export default async function () {
  const html = await getHtml("https://racecalendar.bg/plovdiv");
  const state = JSON.parse((html.match(/<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "{}");
  const block = Object.values(state).find((v) => /\/race\/city\//.test(v?.u || ""));
  const races = block?.b?.results || [];

  return races.filter((r) => !r.cancelled).map((r) => {
    const [y, m, d] = r.startDate.split("-").map(Number);
    const [y2, m2, d2] = (r.endDate || r.startDate).split("-").map(Number);
    const times = r.distances.map((x) => x.startTime).filter(Boolean).sort();
    const [hh, mm] = times[0] ? times[0].split(":").map(Number) : [0, 0];
    const dist = [...new Set(r.distances.map((x) => +x.distance).filter(Boolean))].sort((a, b) => a - b);
    const multi = r.endDate && r.endDate !== r.startDate;
    return {
      id: `rc-${r.id}`,
      title: r.name,
      category: /вело|bike|cycling|колоездене/i.test(r.name) ? "cycling" : "running",
      start: sofiaIso(y, m, d, hh, mm),
      end: multi ? sofiaIso(y2, m2, d2, 23, 59) : undefined,
      allDay: !times[0] || undefined,
      venue: r.city,
      url: r.link || `https://racecalendar.bg/run-race/${r.nameId}`,
      description: [
        dist.length ? `Дистанции: ${dist.map((x) => (x >= 1 ? `${+x.toFixed(1)} км` : `${x * 1000} м`)).join(", ")}` : "",
        TERRAIN[r.terrain] ? `Терен: ${TERRAIN[r.terrain]}` : "",
        r.isDateConfirmed === false ? "⚠ Датата още не е потвърдена от организатора." : "",
      ].filter(Boolean).join("\n"),
      tentative: r.isDateConfirmed === false || undefined,
      source: sourceName,
    };
  });
}
