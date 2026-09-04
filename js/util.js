import { TZ, NIGHT_END, INVITON_SITE, CINEMATIK_SITE, APP_IOS, APP_ANDROID } from "./config.js";
import { COPY, SEC_HUE } from "./copy.js";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function wideUi() { return matchMedia("(min-width: 721px) and (min-height: 501px)").matches; }

const locFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function parts(date) {
  const o = {};
  for (const p of locFmt.formatToParts(date)) if (p.type !== "literal") o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, hour: +o.hour, min: +o.minute, date: new Date(Date.UTC(o.year, o.month - 1, o.day)) };
}

function parseIdt(s) { return new Date(Number(String(s).replace("$idt/", ""))); }

function addDays(date, n) { const x = new Date(date); x.setUTCDate(x.getUTCDate() + n); return x; }

function ymd(date) { return date.toISOString().slice(0, 10); }

function festDay(date) {
  const p = parts(date);
  return ymd(p.hour < NIGHT_END ? addDays(p.date, -1) : p.date);
}

function minsOnDay(date, dayKey) {
  const p = parts(date);
  let h = p.hour + p.min / 60;
  const key = ymd(p.date);
  if (key > dayKey) h += 24;
  else if (key < dayKey) h -= 24;
  return h * 60;
}

function clockLabel(date) {
  const p = parts(date);
  return String(p.hour).padStart(2, "0") + ":" + String(p.min).padStart(2, "0");
}

function locName(loc) {
  const n = (loc && loc.NameLocalized) || {};
  return n.Slovak || n.English || (loc && loc.VenueName) || "—";
}

function personName(p) {
  const fields = Object.fromEntries((p.CustomFields || []).map((f) => [f.FieldName, f.FieldValue]));
  return fields.Meno || fields.Priezvisko || "";
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function parseMeta(desc) {
  const raw = stripHtml(desc).replace(/[ \t]+\n/g, "\n").trim();
  const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const line = [...lines].reverse().find((l) => /\d+\s*min/i.test(l)) || "";
  const runtime = +(line.match(/(\d+)\s*min/i) || [])[1] || 0;
  const orig = (line.split(";")[0] || "").trim();
  const year = +(line.match(/\b((?:19|20)\d{2})\b/) || [])[1] || 0;
  const cut = raw.search(/\sRéžia|\sDirector:|\nOcenenia/);
  const synopsis = (cut > 40 ? raw.slice(0, cut) : (lines[0] || "")).replace(/\s+/g, " ").trim();
  const credits = cut > 0 ? raw.slice(cut).replace(/^\s*(Réžia|Director:)/, "$1").trim() : "";
  return { runtime, orig, year, synopsis, credits };
}

function pack(items) {
  const ends = [];
  for (const it of items.sort((a, b) => a.start - b.start || a.end - b.end)) {
    let lane = ends.findIndex((e) => e <= it.start);
    if (lane < 0) { lane = ends.length; ends.push(it.end); }
    else ends[lane] = it.end;
    it.lane = lane;
  }
  return ends.length || 1;
}

function fold(s) {
  return String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function stripTag(s) { return String(s || "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim(); }

function stripPart(s) { return String(s || "").replace(/\s*\[\d+\s*\/\s*\d+\]\s*/g, " ").trim(); }

function secColor(name) { return `oklch(0.72 0.12 ${SEC_HUE[name] ?? 55})`; }

function qrDataUrl(text) {
  if (typeof qrcode !== "function") throw new Error("qr");
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  const make = (level) => {
    const qr = qrcode(0, level);
    qr.addData(String(text), "Byte");
    qr.make();
    return qr.createDataURL(4, 4);
  };
  try { return make("M"); } catch { return make("L"); }
}

function officialAppHref() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return APP_ANDROID;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return APP_IOS;
  return CINEMATIK_SITE;
}

function disclaimerHtml(lang) {
  const c = COPY[lang] || COPY.sk;
  const inviton = `<a href="${INVITON_SITE}" target="_blank" rel="noopener">Inviton</a>`;
  const app = `<a href="${esc(officialAppHref())}" target="_blank" rel="noopener">${c.officialApp}</a>`;
  return c.disclaimer(inviton, app);
}

export { $, esc, wideUi, parts, parseIdt, addDays, ymd, festDay, minsOnDay, clockLabel, locName, personName, stripHtml, parseMeta, pack, fold, stripTag, stripPart, secColor, qrDataUrl, officialAppHref, disclaimerHtml };
