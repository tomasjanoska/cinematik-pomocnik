import { FAV_KEY, SET_KEY } from "./config.js";
import { COPY } from "./copy.js";
import { loadFavs, loadSettings } from "./storage.js";
import { wideUi } from "./util.js";

const boot = loadSettings();

const state = { lang: boot.lang, day: null, items: [], venues: [], sections: [], selSec: new Set(), selVenue: new Set(), favs: loadFavs(), onlyFavs: false, view: wideUi() ? "grid" : "list", query: "", axisStart: 0, tickets: boot.tickets, activeTicketId: boot.activeTicketId, notifyOn: boot.notifyOn, notifyMins: boot.notifyMins, notifyFav: boot.notifyFav, notifyRes: boot.notifyRes, soundOn: boot.soundOn, filmLinks: [], resPub: null, resPass: new Map(), detailId: null, pendingFilm: null };

document.documentElement.lang = state.lang;

function t(key) { return COPY[state.lang][key]; }

function txt(map) {
  if (!map) return "";
  return (state.lang === "en" ? map.English : map.Slovak) || map.Slovak || map.English || "";
}

function saveFavs() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); } catch {}
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
    }));
  } catch {}
}

export { state, t, txt, saveFavs, saveSettings };
