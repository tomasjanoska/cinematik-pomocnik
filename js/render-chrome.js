import { $, esc, wideUi, parts, festDay, locName, secColor } from "./util.js";
import { COPY } from "./copy.js";
import { state } from "./state.js";
import { syncFiltUi, placeFilters, chips, filterGroup, dayCounts } from "./filters.js";

function renderChrome() {
  const c = COPY[state.lang];
  const days = [...new Set(state.items.map((i) => i.day))].sort();
  $("app-name").textContent = c.name;
  $("disclaimer").textContent = c.disclaimer;
  $("foot").innerHTML = c.foot + `<a href="https://cinematik.sk/program?st=1">cinematik.sk/program</a> · ${c.ideas}: <a href="mailto:cmnapady@pocuj.com">cmnapady@pocuj.com</a>`;
  document.title = c.name;
  const wide = wideUi();
  const todayKey = festDay(new Date());
  $("days").innerHTML = days.map((key) => {
    const d = new Date(key + "T12:00:00Z");
    const p = parts(d);
    const dow = (wide ? c.days : c.daysShort)[d.getUTCDay()];
    const today = key === todayKey;
    return `<button type="button" role="tab" id="tab-${key}" class="${today ? "is-today" : ""}" aria-selected="${key === state.day}" aria-controls="board" data-day="${key}" aria-label="${esc(c.days[d.getUTCDay()])} ${p.d}. ${p.m}.${today ? ` (${c.today})` : ""}">
      <span class="dow">${dow}</span>
      <span class="dom">${p.d}. ${p.m}.</span>
    </button>`;
  }).join("");
  requestAnimationFrame(() => {
    const scroller = $("days");
    const onDay = scroller.querySelector("[aria-selected='true']");
    if (!onDay) return;
    scroller.scrollLeft = Math.max(0, onDay.offsetLeft - (scroller.clientWidth - onDay.offsetWidth) / 2);
  });
  $("now-label").textContent = c.now;
  $("btn-now").hidden = !days.includes(festDay(new Date()));
  $("program-label").textContent = c.program;
  $("btn-program").setAttribute("aria-pressed", !state.onlyFavs);
  $("fav-label").textContent = state.sharedFavs && state.onlyFavs ? c.sharedBanner(state.sharedName) : c.favs;
  $("btn-favs").setAttribute("aria-pressed", state.onlyFavs);
  $("res-mine-label").textContent = c.resMine;
  $("view-grid").textContent = c.grid;
  $("view-list").textContent = c.list;
  $("view-grid").setAttribute("aria-pressed", state.view === "grid");
  $("view-list").setAttribute("aria-pressed", state.view === "list");
  $("q-label").textContent = c.search;
  $("q").placeholder = c.searchPh;
  $("btn-settings").setAttribute("aria-label", c.settings);
  $("filt-title").textContent = c.filters;
  $("filt-clear").textContent = c.clearAll;
  $("filt-close").setAttribute("aria-label", c.close);
  filterGroup("sec-filters", c.sections, "sec", chips(state.sections, "sec", state.selSec, secColor, dayCounts((it) => it.section)));
  const venues = state.venues.map((v) => ({ id: String(v.Id), name: locName(v) }));
  filterGroup("ven-filters", c.venues, "ven", venues.length ? chips(venues, "ven", state.selVenue, null, dayCounts((it) => it.locationId)) : "");
  placeFilters();
  syncFiltUi();
}

export { renderChrome };
