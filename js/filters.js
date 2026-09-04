import { $, esc, wideUi, clockLabel, locName, fold, secColor } from "./util.js";
import { state, t, txt } from "./state.js";
import { dayHeading } from "./render-list.js";

function filtCount() { return (state.query.trim() ? 1 : 0) + state.selSec.size + state.selVenue.size; }

function matchesQuery(it) {
  const q = fold(state.query.trim());
  if (!q) return true;
  const names = it.raw.NameLocalized || {};
  const hay = fold([names.Slovak, names.English, locName(it.loc), it.section].join(" "));
  return hay.includes(q);
}

function visibleItems() {
  const allDays = state.view === "list" && !!state.query.trim();
  return state.items.filter((it) =>
    (allDays || it.day === state.day) &&
    (state.selSec.size === 0 || state.selSec.has(it.section)) &&
    (state.selVenue.size === 0 || state.selVenue.has(String(it.locationId))) &&
    (!state.onlyFavs || (state.sharedFavs || state.favs).has(it.id)) &&
    matchesQuery(it)
  );
}

function syncFiltUi() {
  const n = filtCount();
  $("filt-sum").textContent = t("filters");
  $("filt-n").hidden = !n;
  $("filt-n").textContent = n;
  $("filt-open").dataset.on = String(n > 0);
  $("filt-clear").hidden = !n;
  $("filt-done").textContent = t("showN")(visibleItems().length);
  document.querySelectorAll("[data-clear='sec']").forEach((b) => { b.hidden = !state.selSec.size; });
  document.querySelectorAll("[data-clear='ven']").forEach((b) => { b.hidden = !state.selVenue.size; });
  renderQHits();
}

/* Phones: show matches inside the filter sheet while typing, since the list is hidden behind it. */
function renderQHits() {
  const box = $("q-hits");
  const q = state.query.trim();
  if (wideUi() || !q) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = state.items.filter(matchesQuery).sort((a, b) => a.start - b.start).slice(0, 12);
  box.hidden = false;
  box.innerHTML = hits.length
    ? hits.map((it) => `<button type="button" class="q-hit" data-id="${it.id}" style="--sec:${secColor(it.section)}">
        <span class="n">${esc(txt(it.raw.NameLocalized))}</span>
        <span class="sub">${esc(dayHeading(it.day))} · ${clockLabel(it.start)} · ${esc(locName(it.loc || {}))}</span>
      </button>`).join("")
    : `<p class="status">${t("emptySearch")}</p>`;
}

/* One filter DOM: inline in the header on wide screens, inside the full-screen sheet on phones. */
function placeFilters() {
  const wide = wideUi();
  const host = wide ? $("filt-inline") : $("filt-sheet-body");
  const body = $("filt-body");
  if (body.parentNode !== host) host.appendChild(body);
  $("filt-inline").hidden = !wide;
  if (wide && $("filt-sheet").open) $("filt-sheet").close();
}

function chips(list, key, sel, colorFn, counts) {
  return list.map((item) => {
    const id = item.id ?? item;
    const name = item.name ?? item;
    const on = sel.has(String(id));
    const color = colorFn ? `style="--sec:${colorFn(name)}"` : "";
    const dot = colorFn ? `<span class="dot" ${color}></span>` : "";
    const n = counts.get(String(id)) || 0;
    return `<button type="button" class="chip" data-${key}="${esc(String(id))}" aria-pressed="${on}">${dot}<span class="chip-t">${esc(name)}</span><span class="cnt${n ? "" : " is-zero"}">${n}</span></button>`;
  }).join("");
}

function filterGroup(id, label, key, body) {
  $(id).hidden = !body;
  $(id).innerHTML = body
    ? `<div class="grp-head"><span class="lbl">${label}</span><button type="button" class="lnk" data-clear="${key}" hidden>${t("clearSel")}</button></div><div class="opts">${body}</div>`
    : "";
}

function dayCounts(pick) {
  const m = new Map();
  for (const it of state.items) {
    if (it.day !== state.day) continue;
    const k = String(pick(it));
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

export { filtCount, matchesQuery, visibleItems, syncFiltUi, renderQHits, placeFilters, chips, filterGroup, dayCounts };
