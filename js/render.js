import { $, esc } from "./util.js";
import { state, t } from "./state.js";
import { renderChrome } from "./render-chrome.js";
import { renderBoard } from "./render-board.js";
import { renderList } from "./render-list.js";
import { resFavsVisible } from "./reservations.js";

function emptyCopy() {
  if (state.query.trim()) return t("emptySearch");
  if (state.onlyFavs && state.sharedFavs) return t("emptyShared");
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

function actionBar() {
  if (state.sharedFavs) {
    return `<div class="res-bar share-bar">
      <p class="share-who" dir="auto">${esc(t("sharedBanner")(state.sharedName))}</p>
      <button type="button" class="btn secondary" id="btn-share-close">${t("shareClose")}</button>
    </div>`;
  }
  if (!state.onlyFavs) return "";
  const book = resFavsVisible() ? `<button type="button" class="btn" id="btn-res-favs">${t("resFavs")}</button>` : "";
  return `<div class="res-bar">${book}<button type="button" class="btn secondary" id="btn-share">${t("share")}</button></div>`;
}

function renderMain() {
  if (state.view === "list") renderList();
  else renderBoard();
  const bar = actionBar();
  if (bar) $("main").insertAdjacentHTML("beforeend", bar);
}

function paint() { renderChrome(); renderMain(); }

function syncResButtons() {
  if (state.onlyFavs) renderMain();
}

export { emptyCopy, emptyAction, renderEmpty, renderMain, paint, syncResButtons };
