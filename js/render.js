import { $ } from "./util.js";
import { state, t } from "./state.js";
import { renderChrome } from "./render-chrome.js";
import { renderBoard } from "./render-board.js";
import { renderList } from "./render-list.js";
import { resFavsVisible } from "./reservations.js";

function emptyCopy() {
  if (state.query.trim()) return t("emptySearch");
  if (state.onlyFavs) return t("emptyFav");
  return t("empty");
}

function emptyAction() {
  if (state.query.trim()) return `<button type="button" class="btn secondary" data-clear="q">${t("clearQuery")}</button>`;
  if (state.onlyFavs) return `<button type="button" class="btn secondary" data-go-program>${t("goProgram")}</button>`;
  if (state.selSec.size || state.selVenue.size) return `<button type="button" class="btn secondary" data-clear="all">${t("clearFilters")}</button>`;
  return "";
}

function renderEmpty() {
  $("main").innerHTML = `<div class="msg"><h2>${emptyCopy()}</h2>${emptyAction()}</div>`;
}

function renderMain() {
  if (state.view === "list") renderList();
  else renderBoard();
  if (resFavsVisible()) {
    $("main").insertAdjacentHTML("beforeend", `<div class="res-bar"><button type="button" class="btn" id="btn-res-favs">${t("resFavs")}</button></div>`);
  }
}

function paint() { renderChrome(); renderMain(); }

function syncResButtons() {
  if (state.onlyFavs) renderMain();
}

export { emptyCopy, emptyAction, renderEmpty, renderMain, paint, syncResButtons };
