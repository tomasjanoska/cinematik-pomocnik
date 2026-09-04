import { $, locName } from "./util.js";
import { state, t, txt, saveSettings } from "./state.js";
import { loadFired, saveFired } from "./storage.js";
import { paint } from "./render.js";
import { loadResPass, reservedEvents, matchSchedule } from "./reservations.js";
import { openDetail } from "./detail.js";

let remindTimers = [];

function leadMs() { return state.notifyMins * 60 * 1000; }

function remindTargets() {
  const now = Date.now();
  const map = new Map();
  const add = (key, start, title, venue, openId, res) => {
    if (start.getTime() <= now) return;
    const prev = map.get(key);
    if (!prev) map.set(key, { key, start, title, venue, openId, res, at: start.getTime() - leadMs() });
    else if (res) prev.res = true;
  };
  if (state.notifyFav) {
    for (const it of state.items) {
      if (!state.favs.has(it.id)) continue;
      add("i" + it.id, it.start, txt(it.raw.NameLocalized), locName(it.loc || {}), it.id, false);
    }
  }
  if (state.notifyRes) {
    for (const tk of state.tickets) {
      const pass = state.resPass.get(tk.payload);
      if (!pass || !pass.ok) continue;
      for (const e of reservedEvents(pass)) {
        const it = matchSchedule(e);
        add(it ? "i" + it.id : "r" + e.TicketDateId, e.start, e.Name, e.venueName || "", it ? it.id : null, true);
      }
    }
  }
  return [...map.values()];
}

async function fireRemind(x) {
  if (!state.notifyOn || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (x.start.getTime() <= Date.now()) return;
  const fired = loadFired();
  if (fired[x.key]) return;
  fired[x.key] = Date.now();
  saveFired(fired);
  const mins = Math.max(1, Math.round((x.start.getTime() - Date.now()) / 60000));
  const kind = x.res ? t("notifyRes") : t("notifyFav");
  const opts = {
    body: t("notifyBody")(mins, x.venue || "", kind),
    tag: "cm-" + x.key,
    lang: state.lang,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { id: x.openId },
  };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    if (reg) await reg.showNotification(x.title || t("name"), opts);
    else new Notification(x.title || t("name"), opts);
  } catch {}
}

async function scheduleReminders() {
  remindTimers.forEach(clearTimeout);
  remindTimers = [];
  if (!state.notifyOn || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (state.notifyRes && state.tickets.length) await Promise.allSettled(state.tickets.map(loadResPass));
  const now = Date.now();
  const fired = loadFired();
  for (const x of remindTargets()) {
    const delay = x.at - now;
    if (delay <= 0) {
      if (!fired[x.key]) void fireRemind(x);
      continue;
    }
    if (delay > 8 * 86400000) continue;
    remindTimers.push(setTimeout(() => { void fireRemind(x); }, Math.min(delay, 2147483647)));
  }
}

function goFilm(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  state.pendingFilm = n;
  const it = state.items.find((x) => x.id === n);
  if (!it) return;
  state.pendingFilm = null;
  if (it.day !== state.day) { state.day = it.day; paint(); }
  openDetail(n);
}

async function setNotify(on) {
  const note = (msg) => {
    const el = $("notify-status");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  };
  if (on) {
    if (typeof Notification === "undefined") {
      state.notifyOn = false;
      saveSettings();
      note(t("notifyNo"));
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      state.notifyOn = false;
      saveSettings();
      note(t("notifyDenied"));
      const box = document.querySelector("[data-notify]");
      if (box) box.checked = false;
      return;
    }
  }
  state.notifyOn = on;
  saveSettings();
  note("");
  void scheduleReminders();
}

export { leadMs, remindTargets, fireRemind, scheduleReminders, goFilm, setNotify };
