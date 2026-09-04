import { FAV_KEY, SET_KEY, RATE_KEY } from "./config.js";
import { COPY } from "./copy.js";
import { loadFavs, loadSettings, loadMine } from "./storage.js";
import { wideUi } from "./util.js";

const boot = loadSettings();

const state = { lang: boot.lang, day: null, items: [], venues: [], sections: [], selSec: new Set(), selVenue: new Set(), favs: loadFavs(), mine: loadMine(), onlyFavs: false, sharedFavs: null, sharedName: "", shareName: boot.shareName, view: wideUi() ? "grid" : "list", query: "", axisStart: 0, tickets: boot.tickets, activeTicketId: boot.activeTicketId, notifyOn: boot.notifyOn, notifyMins: boot.notifyMins, notifyFav: boot.notifyFav, notifyRes: boot.notifyRes, soundOn: boot.soundOn, filmLinks: [], resPub: null, resPass: new Map(), detailId: null, pendingFilm: null };

document.documentElement.lang = state.lang;

function t(key) { return COPY[state.lang][key]; }

function txt(map) {
  if (!map) return "";
  return (state.lang === "en" ? map.English : map.Slovak) || map.Slovak || map.English || "";
}

function saveFavs() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); } catch {}
}

function saveMine() {
  const o = {};
  for (const [k, v] of state.mine) o[k] = { stars: v.stars, note: v.note };
  try { localStorage.setItem(RATE_KEY, JSON.stringify(o)); } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify({
      lang: state.lang,
      tickets: state.tickets,
      activeTicketId: state.activeTicketId,
      notifyOn: !!state.notifyOn,
      notifyMins: state.notifyMins,
      notifyFav: !!state.notifyFav,
      notifyRes: !!state.notifyRes,
      soundOn: !!state.soundOn,
      shareName: state.shareName,
    }));
  } catch {}
}

export { state, t, txt, saveFavs, saveMine, saveSettings };
