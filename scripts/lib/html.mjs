// Малки помощни функции за четене на HTML без външни библиотеки.

export const UA = "Mozilla/5.0 (compatible; subitie-bot/1.0; +https://subitie-plus.netlify.app)";

export async function getHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "bg,en;q=0.8" },
    signal: AbortSignal.timeout(30000), // сайт, който не отговаря, не трябва да спира всичко
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} за ${url}`);
  return res.text();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", bdquo: "„", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };
export function decode(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** HTML → чист текст; <br> и </p> стават нови редове. */
export function text(html = "") {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  ).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const MONTHS = {
  "януари": 1, "февруари": 2, "март": 3, "април": 4, "май": 5, "юни": 6,
  "юли": 7, "август": 8, "септември": 9, "октомври": 10, "ноември": 11, "декември": 12,
};

/** Българско време → ISO с правилното отместване (+02:00 зимно, +03:00 лятно). */
export function sofiaIso(y, m, d, hh = 0, mm = 0) {
  const pad = (n) => String(n).padStart(2, "0");
  // Лятното часово време в ЕС: от последната неделя на март до последната неделя на октомври
  const lastSunday = (month) => { const x = new Date(Date.UTC(y, month, 0)); return x.getUTCDate() - x.getUTCDay(); };
  const summer = (m > 3 && m < 10) || (m === 3 && d >= lastSunday(3)) || (m === 10 && d < lastSunday(10));
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${summer ? "+03:00" : "+02:00"}`;
}
