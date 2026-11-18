import { GROUPS, CATEGORIES, AGES, WHEN, LANGS, T } from "./config.js";

/* ================= Настройки ================= */
const ENDED_VISIBLE_DAYS = 7;          // колко дни след края събитието остава видимо
const DATA_URL = "data/events.json";
const TZ = "Europe/Sofia";
const LS = {
  profile: "subitie.profile.v1",
  favs: "subitie.favs.v1",
  installDismissed: "subitie.installDismissed.v1",
};

/* ================= Локално хранилище ================= */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};

const state = {
  events: [],
  generatedAt: null,
  demo: false,
  loading: true,
  offline: false,
  profile: store.get(LS.profile, null),           // { name, interests:[], age, lang, onboarded }
  favs: store.get(LS.favs, {}),                   // id -> копие на събитието
  filters: { q: "", when: "all", cats: [], age: "all" },
  favTab: "upcoming",
  installEvent: null,
};

// Език: от профила; ако няма – български, освен ако браузърът изобщо не е на български
const browserLang = (navigator.languages || [navigator.language || "bg"]).some((l) => l.startsWith("bg")) ? "bg" : "en";
const lang = () => state.profile?.lang || browserLang;
const t = (key, ...args) => { const v = T[lang()][key] ?? T.bg[key] ?? key; return typeof v === "function" ? v(...args) : v; };
const label = (obj) => obj ? (obj[lang()] || obj.bg) : "";
const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* ================= Помощни ================= */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const locale = () => (lang() === "bg" ? "bg-BG" : "en-GB");

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = (d) => dayKeyFmt.format(d);
const fmt = (d, opts) => new Intl.DateTimeFormat(locale(), { timeZone: TZ, ...opts }).format(d);

function startOf(ev) { return new Date(ev.start).getTime(); }
function endOf(ev) {
  if (ev.end) return new Date(ev.end).getTime();
  const d = new Date(ev.start); d.setHours(23, 59, 59, 999); return d.getTime();
}

/** upcoming | live | ended | hidden */
function statusOf(ev, now = Date.now()) {
  const s = startOf(ev), e = endOf(ev);
  if (now < s) return "upcoming";
  if (now <= e) return "live";
  if (now <= e + ENDED_VISIBLE_DAYS * 86400000) return "ended";
  return "hidden";
}
const isLong = (ev) => endOf(ev) - startOf(ev) > 12 * 3600000;

function localDay(offset = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d;
}
function rangeFor(when) {
  const today = localDay(0);
  const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
  const dow = (today.getDay() + 6) % 7; // 0 = понеделник
  switch (when) {
    case "today": return [Date.now(), endOfDay(today)];
    case "tomorrow": return [localDay(1).getTime(), endOfDay(localDay(1))];
    case "weekend": {
      const sat = dow >= 5 ? today : localDay(5 - dow);
      const sun = localDay(6 - dow);
      return [Math.max(sat.getTime(), Date.now()), endOfDay(sun)];
    }
    case "week": return [Date.now(), endOfDay(localDay(6 - dow))];
    case "month": { const last = new Date(today.getFullYear(), today.getMonth() + 1, 0); return [Date.now(), endOfDay(last)]; }
    default: return null;
  }
}

function coverFor(ev) {
  const g = catById[ev.category]?.group || "community";
  const palettes = {
    sport: ["linear-gradient(135deg,#64d137,#3ca1aa)", "linear-gradient(135deg,#3ca1aa,#64d137)", "linear-gradient(160deg,#64d137,#2f8f3a)"],
    culture: ["linear-gradient(135deg,#8327ae,#c058e6)", "linear-gradient(150deg,#5b1a7c,#8327ae)", "linear-gradient(135deg,#8327ae,#3ca1aa)"],
    community: ["linear-gradient(135deg,#3ca1aa,#8327ae)", "linear-gradient(135deg,#050d1a,#3ca1aa)", "linear-gradient(135deg,#f0b429,#64d137)"],
  };
  const list = palettes[g];
  let h = 0; for (const ch of ev.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
const titleOf = (ev) => (lang() === "en" && ev.title_en) || ev.title;
const descOf = (ev) => (lang() === "en" && ev.description_en) || ev.description || "";
const iconOf = (ev) => catById[ev.category]?.icon || "📌";
const catLabel = (ev) => label(catById[ev.category]) || "";

function whenText(ev, long = false) {
  const s = new Date(ev.start), e = new Date(endOf(ev));
  const sameDay = dayKey(s) === dayKey(e);
  const time = (d) => fmt(d, { hour: "2-digit", minute: "2-digit" });
  const hasTime = !ev.allDay;
  if (!sameDay) {
    return `${fmt(s, { day: "numeric", month: "short" })} – ${fmt(e, { day: "numeric", month: "short" })}`;
  }
  const date = long ? fmt(s, { weekday: "long", day: "numeric", month: "long" }) : relDay(s);
  return hasTime ? `${date}, ${time(s)}${ev.end && long ? " – " + time(e) : ""}` : date;
}
function relDay(d) {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return t("today");
  if (k === dayKey(localDay(1))) return t("tomorrow");
  return fmt(d, { weekday: "short", day: "numeric", month: "short" });
}
function priceText(ev) {
  if (ev.price === 0 || ev.price === "0" || /безплат|free|свободен/i.test(String(ev.price || ""))) return t("free");
  return ev.price ? String(ev.price) : "";
}
const isFree = (ev) => priceText(ev) === t("free");

/* ================= Иконки ================= */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  ext: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};

/* ================= Данни ================= */
async function loadEvents() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.events = Array.isArray(data) ? data : data.events || [];
    state.generatedAt = data.generatedAt || null;
    state.demo = !!data.demo;
    state.offline = false;
  } catch (e) {
    console.warn("Неуспешно зареждане на събитията", e);
    state.offline = true;
  }
  state.loading = false;
  refreshFavSnapshots();
}

function refreshFavSnapshots() {
  let changed = false;
  for (const ev of state.events) {
    if (state.favs[ev.id]) { state.favs[ev.id] = { ...ev, savedAt: state.favs[ev.id].savedAt }; changed = true; }
  }
  if (changed) store.set(LS.favs, state.favs);
}

function toggleFav(id) {
  if (state.favs[id]) delete state.favs[id];
  else {
    const ev = state.events.find((e) => e.id === id);
    if (!ev) return;
    state.favs[id] = { ...ev, savedAt: Date.now() };
    navigator.vibrate?.(12);
  }
  store.set(LS.favs, state.favs);
  renderTabbar();
}

/* ================= Филтриране ================= */
function matches(ev, f = state.filters) {
  if (f.cats.length && !f.cats.includes(ev.category)) return false;
  if (f.age !== "all") {
    const ages = ev.ages?.length ? ev.ages : ["all"];
    if (!ages.includes("all") && !ages.includes(f.age)) return false;
  }
  if (f.q) {
    const hay = [ev.title, ev.title_en, ev.venue, ev.organizer, catLabel(ev), ev.description].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function visibleEvents() {
  const now = Date.now();
  const range = rangeFor(state.filters.when);
  const upcoming = [], ended = [];
  for (const ev of state.events) {
    const st = statusOf(ev, now);
    if (st === "hidden" || !matches(ev)) continue;
    if (st === "ended") { if (!range) ended.push(ev); continue; }
    if (range && !(startOf(ev) <= range[1] && endOf(ev) >= range[0])) continue;
    upcoming.push(ev);
  }
  upcoming.sort((a, b) => Math.max(startOf(a), now) - Math.max(startOf(b), now) || startOf(a) - startOf(b));
  ended.sort((a, b) => endOf(b) - endOf(a));
  return { upcoming, ended };
}

function forYou() {
  const p = state.profile;
  if (!p?.interests?.length) return [];
  const now = Date.now();
  return state.events
    .filter((ev) => p.interests.includes(ev.category) && statusOf(ev, now) !== "ended" && statusOf(ev, now) !== "hidden")
    .filter((ev) => !p.age || p.age === "all" || !ev.ages?.length || ev.ages.includes("all") || ev.ages.includes(p.age))
    .sort((a, b) => startOf(a) - startOf(b))
    .slice(0, 10);
}

/* ================= Компоненти ================= */
function favBtn(ev, cls = "fav") {
  const on = !!state.favs[ev.id];
  return `<button class="${cls}" data-fav="${esc(ev.id)}" aria-pressed="${on}" aria-label="${on ? t("removeFav") : t("addFav")}">${I.heart}</button>`;
}

function statusBadge(ev) {
  const st = statusOf(ev);
  if (st === "live") return `<span class="badge live">${isLong(ev) ? (lang() === "bg" ? "Тече сега" : "On now") : t("live")}</span>`;
  if (st === "ended") return `<span class="badge ended">${t("endedBadge")}</span>`;
  if (ev.tentative) return `<span class="badge tentative">${t("tentative")}</span>`;
  if (isFree(ev)) return `<span class="badge free">${t("free")}</span>`;
  return "";
}

function card(ev, i = 0) {
  const st = statusOf(ev);
  const s = new Date(ev.start);
  return `
  <a class="card ${st === "ended" ? "is-ended" : ""}" href="#/e/${encodeURIComponent(ev.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
    <div class="cover" style="--cover:${coverFor(ev)}">
      ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy" onerror="this.remove()">` : `<span aria-hidden="true">${iconOf(ev)}</span>`}
      <div class="date-pill">${fmt(s, { day: "numeric" })}<small>${fmt(s, { month: "long" }).slice(0, 3)}</small></div>
    </div>
    <div class="card-body">
      <span class="card-cat">${iconOf(ev)} ${esc(catLabel(ev))}</span>
      <h3>${esc(titleOf(ev))}</h3>
      ${statusBadge(ev)}
      <div class="meta">
        <span>🕒 ${esc(whenText(ev))}</span>
        ${ev.venue ? `<span>📍 ${esc(ev.venue)}</span>` : ""}
      </div>
    </div>
    ${favBtn(ev)}
  </a>`;
}

function tile(ev, i) {
  return `
  <a class="tile" href="#/e/${encodeURIComponent(ev.id)}" style="--cover:${coverFor(ev)};animation-delay:${i * 40}ms">
    ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="tile-ico" aria-hidden="true">${iconOf(ev)}</span>`}
    ${favBtn(ev)}
    <span class="when">${esc(whenText(ev))}</span>
    <h3>${esc(titleOf(ev))}</h3>
    ${ev.venue ? `<span class="where">📍 ${esc(ev.venue)}</span>` : ""}
  </a>`;
}

function groupedByDay(list) {
  const today = dayKey(new Date());
  const groups = new Map();
  for (const ev of list) {
    const k = startOf(ev) < Date.now() ? today : dayKey(new Date(ev.start));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(ev);
  }
  let i = 0, html = "";
  for (const [k, evs] of groups) {
    const d = new Date(evs[0].start);
    const title = k === today ? t("today") : k === dayKey(localDay(1)) ? t("tomorrow") : fmt(d, { weekday: "long" });
    const sub = k === today ? fmt(new Date(), { day: "numeric", month: "long" }) : fmt(d, { day: "numeric", month: "long" });
    html += `<div class="day-h"><b>${esc(title)}</b> · ${esc(sub)} · ${t("events", evs.length)}</div>`;
    html += `<div class="grid">${evs.map((ev) => card(ev, i++)).join("")}</div>`;
  }
  return html;
}

/* ================= Изгледи ================= */
function viewHome() {
  const f = state.filters;
  const { upcoming, ended } = visibleEvents();
  const fy = forYou();
  const name = state.profile?.name;
  const catsLabel = f.cats.length === 0 ? t("allCategories")
    : f.cats.length === 1 ? `${catById[f.cats[0]].icon} ${label(catById[f.cats[0]])}`
    : `${f.cats.length} ${lang() === "bg" ? "избрани" : "selected"}`;
  const ageLabel = label(AGES.find((a) => a.id === f.age));
  const filtered = f.q || f.cats.length || f.age !== "all" || f.when !== "all";

  return `
  <header class="top">
    <a class="brand" href="#/" aria-label="съБИТИЕ+"><img src="assets/logo-wordmark.png" alt="съБИТИЕ+" width="211" height="30"></a>
    <button class="lang-btn" data-action="lang" aria-label="${t("language")}">🌐 ${lang().toUpperCase()}</button>
  </header>

  ${installBanner()}
  ${state.offline ? `<div class="banner info">📡 ${t("offline")}</div>` : ""}

  <section class="hero">
    <h1>${name ? `${t("hello")}, ${esc(name)}!` : t("helloGuest")}</h1>
    <p>${t("tagline")}${state.demo ? `<span class="demo-flag">${t("demo")}</span>` : ""}</p>
    <label class="search">
      ${I.search}
      <input id="q" type="search" placeholder="${t("search")}" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
      ${f.q ? `<button class="clear" data-action="clear-q" aria-label="Clear">×</button>` : ""}
    </label>
  </section>

  <div class="filters">
    <div class="scroller" role="toolbar" aria-label="${t("when")}">
      ${WHEN.map((w) => `<button class="chip" data-when="${w.id}" aria-pressed="${f.when === w.id}">${label(w)}</button>`).join("")}
    </div>
    <div class="filter-row">
      <button class="drop ${f.cats.length ? "active" : ""}" data-action="cats"><span><small>${t("categories")}</small>${esc(catsLabel)}</span>${I.chev}</button>
      <button class="drop ${f.age !== "all" ? "active" : ""}" data-action="age"><span><small>${t("age")}</small>${esc(ageLabel)}</span>${I.chev}</button>
    </div>
    <div class="scroller" aria-label="${t("categories")}">
      ${CATEGORIES.filter((c) => state.events.some((e) => e.category === c.id)).map((c) =>
        `<button class="chip" data-cat="${c.id}" aria-pressed="${f.cats.includes(c.id)}"><span class="ico">${c.icon}</span>${label(c)}</button>`).join("")}
    </div>
  </div>

  ${!filtered && fy.length ? `
  <section class="section">
    <div class="section-h"><h2>${t("forYou")} ✨</h2><p>${t("forYouHint")}</p></div>
    <div class="rail">${fy.map(tile).join("")}</div>
  </section>` : ""}

  <section class="section">
    <div class="section-h"><h2>${t("upcoming")}</h2><p>${state.loading ? "" : t("events", upcoming.length)}</p></div>
    ${state.loading ? `<div class="grid">${'<div class="skeleton"></div>'.repeat(4)}</div>`
      : upcoming.length ? groupedByDay(upcoming)
      : `<div class="empty"><div class="big">🔍</div><h3>${t("nothing")}</h3><p>${t("nothingHint")}</p>${filtered ? `<button class="btn ghost" data-action="reset">${t("reset")}</button>` : ""}</div>`}
  </section>

  ${ended.length ? `
  <section class="section">
    <div class="section-h"><h2>${t("ended")}</h2><p>${t("endedHint")}</p></div>
    <div class="grid">${ended.map(card).join("")}</div>
  </section>` : ""}
  `;
}

function viewDetail(id) {
  const ev = state.events.find((e) => e.id === id) || state.favs[id];
  if (!ev) {
    return state.loading ? `<div class="skeleton" style="height:300px"></div>`
      : `<div class="empty"><div class="big">🤷</div><h3>${t("nothing")}</h3><a class="btn" href="#/">${t("home")}</a></div>`;
  }
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([ev.venue, ev.address, "Пловдив"].filter(Boolean).join(", "))}`;
  const price = priceText(ev);
  const ages = (ev.ages?.length ? ev.ages : ["all"]).map((a) => label(AGES.find((x) => x.id === a))).join(", ");
  const st = statusOf(ev);
  return `
  <article class="detail">
    <div class="detail-hero" style="--cover:${coverFor(ev)}">
      ${ev.image ? `<img src="${esc(ev.image)}" alt="" onerror="this.remove()">` : `<span class="big-ico" aria-hidden="true">${iconOf(ev)}</span>`}
      <div class="hero-actions">
        <button class="round" data-action="back" aria-label="${t("back")}">${I.back}</button>
        <div class="right">
          <button class="round" data-action="share" data-id="${esc(ev.id)}" aria-label="${t("share")}">${I.share}</button>
          ${favBtn(ev, "round fav")}
        </div>
      </div>
      <div>
        <span class="badge">${iconOf(ev)} ${esc(catLabel(ev))}</span>
        ${st === "live" || st === "ended" || ev.tentative ? statusBadge(ev) : ""}
        <h1>${esc(titleOf(ev))}</h1>
      </div>
    </div>

    <div class="info">
      <div class="info-row"><div class="ic">🗓️</div><div><small>${t("when")}</small><b>${esc(whenText(ev, true))}</b><br><a href="#" data-action="ics" data-id="${esc(ev.id)}">＋ ${t("addCal")}</a></div></div>
      ${ev.venue ? `<div class="info-row"><div class="ic">📍</div><div><small>${t("where")}</small><b>${esc(ev.venue)}</b>${ev.address ? `<br><span>${esc(ev.address)}</span>` : ""}<br><a href="${map}" target="_blank" rel="noopener">${t("openMap")} ↗</a></div></div>` : ""}
      ${price ? `<div class="info-row"><div class="ic">🎟️</div><div><small>${t("price")}</small><b>${esc(price)}</b></div></div>` : ""}
      <div class="info-row"><div class="ic">👥</div><div><small>${t("ages")}</small><b>${esc(ages)}</b></div></div>
      ${ev.organizer ? `<div class="info-row"><div class="ic">🏢</div><div><small>${t("organizer")}</small><b>${esc(ev.organizer)}</b></div></div>` : ""}
    </div>

    ${descOf(ev) ? `<p class="desc">${esc(descOf(ev))}</p>` : ""}
    ${ev.source ? `<p class="source-note">${t("source")}: ${esc(ev.source)}</p>` : ""}

    ${ev.url ? `<div class="cta-bar"><a class="btn primary" href="${esc(ev.url)}" target="_blank" rel="noopener">${t("goToEvent")} ${I.ext}</a></div>` : ""}
  </article>`;
}

function viewFavs() {
  const now = Date.now();
  const all = Object.values(state.favs);
  const upcoming = all.filter((e) => ["upcoming", "live"].includes(statusOf(e, now))).sort((a, b) => startOf(a) - startOf(b));
  const past = all.filter((e) => ["ended", "hidden"].includes(statusOf(e, now))).sort((a, b) => endOf(b) - endOf(a));
  const list = state.favTab === "upcoming" ? upcoming : past;
  return `
  <header class="top"><h1 style="font-family:var(--display);font-weight:800;font-size:26px;margin:0">${t("favourites")} ♡</h1></header>
  <div class="seg" role="tablist">
    <button role="tab" data-favtab="upcoming" aria-selected="${state.favTab === "upcoming"}">${t("favUpcoming")} · ${upcoming.length}</button>
    <button role="tab" data-favtab="past" aria-selected="${state.favTab === "past"}">${t("favPast")} · ${past.length}</button>
  </div>
  ${list.length ? `<div class="grid">${list.map(card).join("")}</div>`
    : `<div class="empty"><div class="big">${state.favTab === "upcoming" ? "💜" : "🕰️"}</div><h3>${t("favEmpty")}</h3><p>${state.favTab === "upcoming" ? t("favEmptyHint") : t("pastEmpty")}</p><a class="btn purple" href="#/">${t("home")}</a></div>`}
  `;
}

function interestPicker(selected) {
  return GROUPS.map((g) => `
    <div class="group-label">${label(g)}</div>
    <div class="wrap">${CATEGORIES.filter((c) => c.group === g.id).map((c) =>
      `<button type="button" class="chip" data-interest="${c.id}" aria-pressed="${selected.includes(c.id)}"><span class="ico">${c.icon}</span>${label(c)}</button>`).join("")}</div>`).join("");
}

function viewProfile() {
  const p = state.profile || { name: "", interests: [], age: "all", lang: lang() };
  const favCount = Object.keys(state.favs).length;
  return `
  <div class="profile-head">
    <div class="avatar">${esc((p.name || "+").trim().charAt(0).toUpperCase() || "+")}</div>
    <div><h1>${esc(p.name || t("profile"))}</h1><p>♡ ${favCount} · ${p.interests.length} ${lang() === "bg" ? "интереса" : "interests"}</p></div>
  </div>
  <form id="profile-form">
    <div class="card-box">
      <h2>${t("yourName")}</h2>
      <input class="field" name="name" value="${esc(p.name)}" placeholder="${t("namePh")}" maxlength="40" autocomplete="given-name">
    </div>
    <div class="card-box">
      <h2>${t("interests")}</h2><p class="hint">${t("interestsHint")}</p>
      ${interestPicker(p.interests)}
    </div>
    <div class="card-box">
      <h2>${t("yourAge")}</h2>
      <div class="wrap" style="margin-top:10px">${AGES.map((a) => `<button type="button" class="chip" data-pick-age="${a.id}" aria-pressed="${p.age === a.id}">${label(a)}</button>`).join("")}</div>
    </div>
    <div class="card-box">
      <h2>${t("language")}</h2>
      <div class="wrap" style="margin-top:10px">${LANGS.map((l) => `<button type="button" class="chip" data-pick-lang="${l.id}" aria-pressed="${p.lang === l.id}">${l.label}</button>`).join("")}</div>
    </div>
    <button class="btn primary block" type="submit">${t("save")}</button>
  </form>
  <p class="note">🔒 ${t("localNote")}</p>
  <div style="text-align:center"><button class="danger" data-action="wipe">${t("clearData")}</button></div>
  `;
}

/* ================= Банер за инсталиране ================= */
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installBanner() {
  if (isStandalone() || store.get(LS.installDismissed, false)) return "";
  if (state.installEvent) return `<div class="banner"><span>📲</span><button data-action="install" style="font-weight:800;text-align:left">${t("install")}</button><button class="x" data-action="dismiss-install" aria-label="Close">×</button></div>`;
  if (isIos()) return `<div class="banner"><span>📲</span><span><b>${t("install")}</b><br>${t("installIos")}</span><button class="x" data-action="dismiss-install" aria-label="Close">×</button></div>`;
  return "";
}

/* ================= Листове ================= */
function openSheet(html, onMount) {
  const root = $("#sheet-root");
  root.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.style.overflow = "hidden";
  onMount?.($(".sheet", root));
}
function closeSheet() { $("#sheet-root").innerHTML = ""; document.body.style.overflow = ""; }

function sheetCategories() {
  let picked = [...state.filters.cats];
  const draw = (sheet) => {
    sheet.querySelector(".body").innerHTML = GROUPS.map((g) => `
      <div class="group-label">${label(g)}</div>
      <div class="cat-grid">${CATEGORIES.filter((c) => c.group === g.id).map((c) => `
        <button class="opt" role="checkbox" data-pick="${c.id}" aria-checked="${picked.includes(c.id)}"><span class="ico">${c.icon}</span>${label(c)}</button>`).join("")}</div>`).join("");
  };
  openSheet(`<h2>${t("categories")}</h2><div class="body"></div>
    <div class="actions"><button class="btn ghost" data-sheet="clear">${t("reset")}</button><button class="btn purple" data-sheet="apply">${t("apply")}</button></div>`, (sheet) => {
    draw(sheet);
    sheet.addEventListener("click", (e) => {
      const p = e.target.closest("[data-pick]");
      if (p) { const id = p.dataset.pick; picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]; draw(sheet); return; }
      const a = e.target.closest("[data-sheet]")?.dataset.sheet;
      if (a === "clear") { picked = []; draw(sheet); }
      if (a === "apply") { state.filters.cats = picked; closeSheet(); render(); }
    });
  });
}

function sheetAge() {
  openSheet(`<h2>${t("age")}</h2><div class="opt-list">${AGES.map((a) =>
    `<button class="opt" role="radio" data-age="${a.id}" aria-checked="${state.filters.age === a.id}">${label(a)}${state.filters.age === a.id ? '<span class="chk">✓</span>' : ""}</button>`).join("")}</div>`, (sheet) => {
    sheet.addEventListener("click", (e) => {
      const b = e.target.closest("[data-age]");
      if (b) { state.filters.age = b.dataset.age; closeSheet(); render(); }
    });
  });
}

function sheetWelcome() {
  const draft = { name: "", interests: [], age: "all", lang: lang(), onboarded: true };
  const draw = (sheet) => {
    sheet.querySelector(".body").innerHTML = `
      <img class="welcome-logo" src="assets/logo-c.jpg" alt="" width="120" height="120">
      <h2 style="text-align:center">${t("welcomeTitle")}</h2>
      <p style="text-align:center">${t("welcomeText")}</p>
      <div class="wrap" style="justify-content:center;margin-bottom:12px">${LANGS.map((l) => `<button class="chip" data-wl="${l.id}" aria-pressed="${draft.lang === l.id}">${l.label}</button>`).join("")}</div>
      ${interestPicker(draft.interests)}
      <div class="group-label">${t("yourAge")}</div>
      <div class="wrap">${AGES.map((a) => `<button class="chip" data-wa="${a.id}" aria-pressed="${draft.age === a.id}">${label(a)}</button>`).join("")}</div>
      <div class="actions"><button class="btn ghost" data-w="skip">${t("skip")}</button><button class="btn primary" data-w="go">${t("start")} →</button></div>`;
  };
  openSheet(`<div class="body"></div>`, (sheet) => {
    draw(sheet);
    sheet.addEventListener("click", (e) => {
      const i = e.target.closest("[data-interest]");
      if (i) { const id = i.dataset.interest; draft.interests = draft.interests.includes(id) ? draft.interests.filter((x) => x !== id) : [...draft.interests, id]; i.setAttribute("aria-pressed", draft.interests.includes(id)); return; }
      const wl = e.target.closest("[data-wl]"); if (wl) { draft.lang = wl.dataset.wl; saveProfile(draft); draw(sheet); return; }
      const wa = e.target.closest("[data-wa]"); if (wa) { draft.age = wa.dataset.wa; sheet.querySelectorAll("[data-wa]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.wa === draft.age)); return; }
      const w = e.target.closest("[data-w]")?.dataset.w;
      if (w) { saveProfile(draft); closeSheet(); render(); }
    });
  });
}

function saveProfile(p) {
  state.profile = { ...(state.profile || {}), ...p, onboarded: true };
  store.set(LS.profile, state.profile);
  document.documentElement.lang = state.profile.lang;
}

/* ================= Календар и споделяне ================= */
function downloadIcs(ev) {
  const d = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (s = "") => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//subitie//BG", "BEGIN:VEVENT",
    `UID:${ev.id}@subitie`, `DTSTAMP:${d(Date.now())}`, `DTSTART:${d(startOf(ev))}`, `DTEND:${d(endOf(ev))}`,
    `SUMMARY:${clean(titleOf(ev))}`, `LOCATION:${clean([ev.venue, ev.address, "Пловдив"].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${clean((ev.url ? ev.url + "\n\n" : "") + descOf(ev))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${ev.id}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function share(ev) {
  const url = location.href.split("#")[0] + "#/e/" + encodeURIComponent(ev.id);
  const data = { title: titleOf(ev), text: `${titleOf(ev)} — ${whenText(ev, true)}`, url };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(url); toast(t("linkCopied")); }
  } catch {}
}

function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ================= Рутер и рендер ================= */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("e/")) return { name: "detail", id: decodeURIComponent(h.slice(2)) };
  if (h === "fav") return { name: "fav" };
  if (h === "profile") return { name: "profile" };
  return { name: "home" };
}

function renderTabbar() {
  const r = route().name;
  const favN = Object.values(state.favs).filter((e) => ["upcoming", "live"].includes(statusOf(e))).length;
  $("#tabbar").innerHTML = `
    <a class="tab" href="#/" ${r === "home" || r === "detail" ? 'aria-current="page"' : ""}>${I.home}${t("home")}</a>
    <a class="tab" href="#/fav" ${r === "fav" ? 'aria-current="page"' : ""}>${I.heart}${t("favourites")}${favN ? `<span class="count">${favN}</span>` : ""}</a>
    <a class="tab" href="#/profile" ${r === "profile" ? 'aria-current="page"' : ""}>${I.user}${t("profile")}</a>`;
}

let lastRoute = null;
function render() {
  const r = route();
  const view = $("#view");
  const focusQ = document.activeElement?.id === "q";
  const caret = focusQ ? document.activeElement.selectionStart : null;
  view.innerHTML = r.name === "detail" ? viewDetail(r.id) : r.name === "fav" ? viewFavs() : r.name === "profile" ? viewProfile() : viewHome();
  renderTabbar();
  document.title = r.name === "detail" ? `${titleOf(state.events.find((e) => e.id === r.id) || state.favs[r.id] || { title: "" })} · съБИТИЕ+` : "съБИТИЕ+";
  if (focusQ) { const q = $("#q"); q?.focus(); q?.setSelectionRange(caret, caret); }
  const key = r.name + (r.id || "");
  if (key !== lastRoute) { window.scrollTo(0, r.name === "home" ? (render.homeY || 0) : 0); lastRoute = key; }
}

/* ================= Събития ================= */
document.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) {
    e.preventDefault(); e.stopPropagation();
    toggleFav(fav.dataset.fav);
    const on = !!state.favs[fav.dataset.fav];
    document.querySelectorAll(`[data-fav="${CSS.escape(fav.dataset.fav)}"]`).forEach((b) => { b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? t("removeFav") : t("addFav")); });
    if (route().name === "fav") render();
    return;
  }
  const w = e.target.closest("[data-when]");
  if (w) { state.filters.when = w.dataset.when; render(); return; }
  const c = e.target.closest("[data-cat]");
  if (c) { const id = c.dataset.cat; const cs = state.filters.cats; state.filters.cats = cs.includes(id) ? cs.filter((x) => x !== id) : [...cs, id]; render(); return; }
  const ft = e.target.closest("[data-favtab]");
  if (ft) { state.favTab = ft.dataset.favtab; render(); return; }

  // Профил – избор в формата (без запис, докато не натиснеш „Запази“)
  const pi = e.target.closest("#profile-form [data-interest], #profile-form [data-pick-age], #profile-form [data-pick-lang]");
  if (pi) {
    if (pi.dataset.interest) pi.setAttribute("aria-pressed", pi.getAttribute("aria-pressed") !== "true");
    else {
      const attr = pi.dataset.pickAge ? "data-pick-age" : "data-pick-lang";
      document.querySelectorAll(`#profile-form [${attr}]`).forEach((b) => b.setAttribute("aria-pressed", b === pi));
    }
    return;
  }

  const a = e.target.closest("[data-action]")?.dataset.action;
  if (!a) return;
  const ev = () => state.events.find((x) => x.id === e.target.closest("[data-id]")?.dataset.id) || state.favs[e.target.closest("[data-id]")?.dataset.id];
  switch (a) {
    case "cats": sheetCategories(); break;
    case "age": sheetAge(); break;
    case "close-sheet": closeSheet(); break;
    case "reset": state.filters = { q: "", when: "all", cats: [], age: "all" }; render(); break;
    case "clear-q": e.preventDefault(); state.filters.q = ""; render(); break;
    case "lang": saveProfile({ lang: lang() === "bg" ? "en" : "bg" }); render(); break;
    case "back": history.length > 1 ? history.back() : (location.hash = "#/"); break;
    case "share": share(ev()); break;
    case "ics": e.preventDefault(); downloadIcs(ev()); break;
    case "install": state.installEvent?.prompt(); state.installEvent = null; render(); break;
    case "dismiss-install": store.set(LS.installDismissed, true); render(); break;
    case "wipe":
      if (confirm(t("clearConfirm"))) { store.remove(LS.profile); store.remove(LS.favs); state.profile = null; state.favs = {}; location.hash = "#/"; render(); sheetWelcome(); }
      break;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    state.filters.q = e.target.value.trim();
    clearTimeout(render._q); render._q = setTimeout(render, 160);
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "profile-form") return;
  e.preventDefault();
  const f = e.target;
  saveProfile({
    name: f.name.value.trim(),
    interests: [...f.querySelectorAll('[data-interest][aria-pressed="true"]')].map((b) => b.dataset.interest),
    age: f.querySelector('[data-pick-age][aria-pressed="true"]')?.dataset.pickAge || "all",
    lang: f.querySelector('[data-pick-lang][aria-pressed="true"]')?.dataset.pickLang || lang(),
  });
  toast(t("saved"));
  render();
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
window.addEventListener("hashchange", () => { closeSheet(); render(); });
window.addEventListener("scroll", () => { if (route().name === "home") render.homeY = window.scrollY; }, { passive: true });
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.installEvent = e; if (route().name === "home") render(); });

/* ================= Service worker (автоматични ъпдейти) ================= */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      // Проверявай за нова версия всеки път, когато приложението се отвори отново
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { reg.update(); loadEvents().then(render); } });
      let reloaded = false;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        sessionStorage.setItem("subitie.updated", "1");
        location.reload();
      });
    } catch (e) { console.warn("SW регистрацията неуспешна", e); }
  });
}

/* ================= Старт ================= */
document.documentElement.lang = lang();
render();
loadEvents().then(() => {
  render();
  if (!state.profile?.onboarded) sheetWelcome();
  if (sessionStorage.getItem("subitie.updated")) { sessionStorage.removeItem("subitie.updated"); toast(t("updated")); }
});
setInterval(() => { if (route().name !== "profile") render(); }, 60000); // обновява баджовете „На живо“/„Приключило“
