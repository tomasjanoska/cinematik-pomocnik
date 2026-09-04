import { FAV_KEY, SET_KEY, FIRED_KEY, RATE_KEY, RATE_MAX } from "./config.js";

function loadFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return new Set((Array.isArray(raw) ? raw : []).map(Number).filter(Number.isFinite));
  } catch { return new Set(); }
}

function clampMins(n) {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.min(180, Math.max(1, x)) : 15;
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SET_KEY) || "{}");
    const tickets = Array.isArray(raw.tickets) ? raw.tickets.filter((x) => x && x.id && x.payload).map((x) => ({ ...x, resOn: x.resOn !== false })) : [];
    const activeTicketId = tickets.some((x) => x.id === raw.activeTicketId) ? raw.activeTicketId : tickets[0]?.id || null;
    const lang = raw.lang === "en" ? "en" : "sk";
    const shareName = typeof raw.shareName === "string" ? raw.shareName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "";
    return { lang, tickets, activeTicketId, notifyOn: !!raw.notifyOn, notifyMins: clampMins(raw.notifyMins), notifyFav: raw.notifyFav !== false, notifyRes: raw.notifyRes !== false, soundOn: raw.soundOn === true, shareName };
  } catch { return { lang: "sk", tickets: [], activeTicketId: null, notifyOn: false, notifyMins: 15, notifyFav: true, notifyRes: true, soundOn: false, shareName: "" }; }
}

function loadFired() {
  try {
    const o = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

function loadMine() {
  const out = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(RATE_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [k, v] of Object.entries(raw)) {
      if (!k || k === "__proto__" || k === "constructor" || k === "prototype") continue;
      if (!v || typeof v !== "object") continue;
      const stars = Math.round(Number(v.stars));
      const note = typeof v.note === "string" ? v.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, RATE_MAX) : "";
      const s = Number.isInteger(stars) && stars >= 1 && stars <= 10 ? stars : 0;
      if (s || note) out.set(k, { stars: s, note });
    }
  } catch {}
  return out;
}

function saveFired(o) {
  const cut = Date.now() - 2 * 86400000;
  const next = {};
  for (const [k, v] of Object.entries(o)) if (Number(v) > cut) next[k] = v;
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(next)); } catch {}
}

export { loadFavs, clampMins, loadSettings, loadFired, saveFired, loadMine };
