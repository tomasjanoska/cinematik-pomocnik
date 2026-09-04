import { unlockLoadAudio } from "./feedback.js";
import { $, wideUi, festDay } from "./util.js";
import { state, saveSettings } from "./state.js";
import { clampMins } from "./storage.js";
import { syncFiltUi } from "./filters.js";
import { renderBoard, placeNow } from "./render-board.js";
import { renderMain, paint, syncResButtons } from "./render.js";
import { openMine, unresMine, refreshResChip } from "./reservations.js";
import { bookItem, bookFavs } from "./booking.js";
import { scheduleReminders, goFilm, setNotify } from "./reminders.js";
import { openDetail, toggleFav } from "./detail.js";
import { openSettings, openScan, scanFile, savePendingTicket, deleteTicket, showTicket } from "./tickets.js";
import { load } from "./data.js";
import { openShare, closeShare, sendShare, syncShareUrl } from "./share.js";

document.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-day]");
  if (tab) { state.day = tab.dataset.day; paint(); return; }
  const langBtn = e.target.closest("#lang-sk, #lang-en");
  if (langBtn) {
    state.lang = langBtn.id === "lang-en" ? "en" : "sk";
    document.documentElement.lang = state.lang;
    saveSettings();
    paint();
    if ($("settings").open) void openSettings();
    if ($("share").open) openShare();
    if ($("scan").open) void openScan();
    return;
  }
  const clear = e.target.closest("[data-clear]");
  if (clear) {
    const what = clear.dataset.clear;
    if (what === "sec" || what === "all") state.selSec.clear();
    if (what === "ven" || what === "all") state.selVenue.clear();
    if (what === "q" || what === "all") { state.query = ""; $("q").value = ""; }
    paint(); return;
  }
  const sec = e.target.closest("[data-sec]");
  if (sec) {
    const name = sec.dataset.sec;
    if (state.selSec.has(name)) state.selSec.delete(name); else state.selSec.add(name);
    paint(); return;
  }
  const ven = e.target.closest("[data-ven]");
  if (ven) {
    const id = ven.dataset.ven;
    if (state.selVenue.has(id)) state.selVenue.delete(id); else state.selVenue.add(id);
    paint(); return;
  }
  if (e.target.closest("#filt-open")) { $("filt-sheet").showModal(); return; }
  if (e.target.closest("#filt-done")) { $("filt-sheet").close(); return; }
  const fav = e.target.closest("[data-fav]");
  if (fav) { toggleFav(+fav.dataset.fav); return; }
  const resOpen = e.target.closest("[data-res-open]");
  if (resOpen) { $("res-card").close(); openDetail(+resOpen.dataset.resOpen); return; }
  const hit = e.target.closest(".block-hit, .q-hit");
  if (hit) { openDetail(+hit.dataset.id); return; }
  if (e.target.closest("#btn-program, [data-go-program]")) { state.onlyFavs = false; paint(); return; }
  if (e.target.closest("#btn-favs")) {
    state.onlyFavs = wideUi() ? !state.onlyFavs : true;
    paint(); return;
  }
  if (e.target.closest("#view-grid")) { state.view = "grid"; paint(); return; }
  if (e.target.closest("#view-list")) { state.view = "list"; paint(); return; }
  if (e.target.closest("#btn-settings")) { void openSettings(); return; }
  if (e.target.closest("#btn-res-favs")) { void bookFavs(); return; }
  if (e.target.closest("#btn-share")) { openShare(); return; }
  if (e.target.closest("#btn-share-close")) { closeShare(); return; }
  if (e.target.closest("#btn-res-mine")) { void openMine(); return; }
  const unMine = e.target.closest("[data-unres-tk]");
  if (unMine) { void unresMine(unMine.dataset.unresTk, unMine.dataset.td); return; }
  const resNeed = e.target.closest("[data-res-need]");
  if (resNeed) { $("res-card").close(); void openSettings(); return; }
  const resBtn = e.target.closest("[data-res]");
  if (resBtn) {
    const it = state.items.find((x) => x.id === +resBtn.dataset.res);
    if (it) void bookItem(it, false);
    return;
  }
  const unresBtn = e.target.closest("[data-unres]");
  if (unresBtn) {
    const it = state.items.find((x) => x.id === +unresBtn.dataset.unres);
    if (it) void bookItem(it, true);
    return;
  }
  if (e.target.closest("#btn-scan-cam")) { void openScan(); return; }
  if (e.target.closest("#btn-stop-scan")) { $("scan")?.close(); return; }
  if (e.target.closest("#btn-save-ticket")) { savePendingTicket(); return; }
  const showTk = e.target.closest("[data-show-ticket]");
  if (showTk) { void showTicket(showTk.dataset.showTicket); return; }
  const delTk = e.target.closest("[data-del-ticket]");
  if (delTk) { deleteTicket(delTk.dataset.delTicket); return; }
  if (e.target.closest("[data-close]")) { e.target.closest("dialog")?.close(); return; }
  if (e.target.closest("#btn-now")) {
    state.day = festDay(new Date());
    paint();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("now-line")?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }
});

document.addEventListener("keydown", (e) => {
  if (!e.target.closest(".days")) return;
  const tabs = [...$("days").querySelectorAll("[role=tab]")];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
  e.preventDefault();
  const n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  n.focus(); n.click();
});

let resizeT;
let lastWide = wideUi();
addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (!state.items.length) return;
    if (wideUi() !== lastWide) { lastWide = wideUi(); paint(); return; }
    if (state.view === "grid") renderBoard();
  }, 150);
});
$("q").addEventListener("input", () => {
  state.query = $("q").value;
  renderMain();
  syncFiltUi();
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "share-form") return;
  e.preventDefault();
  const via = e.submitter && e.submitter.value === "share" ? "share" : "copy";
  void sendShare(via);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "share-name") syncShareUrl();
});
document.addEventListener("change", (e) => {
  const ntfMins = e.target.closest("[data-notify-mins]");
  if (ntfMins) {
    state.notifyMins = clampMins(ntfMins.value);
    ntfMins.value = state.notifyMins;
    saveSettings();
    void scheduleReminders();
    return;
  }
  const ntfRes = e.target.closest("[data-notify-res]");
  if (ntfRes) {
    state.notifyRes = ntfRes.checked;
    saveSettings();
    void scheduleReminders();
    return;
  }
  const ntfFav = e.target.closest("[data-notify-fav]");
  if (ntfFav) {
    state.notifyFav = ntfFav.checked;
    saveSettings();
    void scheduleReminders();
    return;
  }
  if (e.target.closest("input[data-notify]")) {
    void setNotify(e.target.checked);
    return;
  }
  if (e.target.closest("[data-sound]")) {
    state.soundOn = e.target.checked;
    saveSettings();
    if (!state.soundOn) $("load-audio")?.pause();
    return;
  }
  const resTk = e.target.closest("[data-res-ticket]");
  if (resTk) {
    const tk = state.tickets.find((x) => x.id === resTk.dataset.resTicket);
    if (tk) {
      tk.resOn = resTk.checked;
      saveSettings();
      syncResButtons();
      const openIt = state.items.find((x) => x.id === state.detailId);
      if ($("detail").open && openIt) void refreshResChip(openIt);
    }
    return;
  }
  const rename = e.target.closest("[data-rename]");
  if (rename) {
    const tk = state.tickets.find((x) => x.id === rename.dataset.rename);
    if (tk) {
      const name = rename.value.trim();
      if (name) tk.name = name;
      saveSettings();
    }
    return;
  }
  if (e.target.id === "scan-file" && e.target.files && e.target.files[0]) {
    void scanFile(e.target.files[0]);
    e.target.value = "";
  }
});
$("busy").addEventListener("cancel", (e) => e.preventDefault());
document.addEventListener("pointerdown", unlockLoadAudio, { once: true });
document.addEventListener("keydown", unlockLoadAudio, { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void scheduleReminders();
});
setInterval(placeNow, 30000);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "open-film") goFilm(e.data.id);
  });
}
load();
