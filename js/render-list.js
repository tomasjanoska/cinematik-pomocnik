import { $, esc, parts, clockLabel, locName, secColor } from "./util.js";
import { COPY } from "./copy.js";
import { STAR } from "./config.js";
import { state, t, txt } from "./state.js";
import { visibleItems } from "./filters.js";
import { renderEmpty } from "./render.js";

function dayHeading(key) {
  const d = new Date(key + "T12:00:00Z");
  const p = parts(d);
  return `${COPY[state.lang].days[d.getUTCDay()]} ${p.d}. ${p.m}.`;
}

function renderList() {
  const items = visibleItems().sort((a, b) => a.start - b.start || a.end - b.end);
  $("status").textContent = COPY[state.lang].films(items.length);
  if (!items.length) {
    renderEmpty();
    return;
  }
  const q = state.query.trim();
  const showDays = state.onlyFavs || !!q;
  let lastDay = "";
  const html = items.map((it) => {
    const title = txt(it.raw.NameLocalized);
    const on = state.favs.has(it.id);
    const st = clockLabel(it.start), en = clockLabel(it.end);
    let head = "";
    if (showDays && it.day !== lastDay) {
      lastDay = it.day;
      head = `<div class="list-day">${esc(dayHeading(it.day))}</div>`;
    }
    return `${head}<div class="list-item" style="--sec:${secColor(it.section)}">
      <button type="button" class="block-hit list-hit" data-id="${it.id}" aria-label="${st}–${en}, ${esc(title)}, ${esc(locName(it.loc || {}))}">
        <span class="when">${st}<br>${en}</span>
        <span>
          <span class="n">${esc(title)}</span>
          <span class="sub">${esc(locName(it.loc || {}))} · ${esc(it.section)}</span>
        </span>
      </button>
      <button type="button" class="fav" data-fav="${it.id}" aria-pressed="${on}" aria-label="${on ? t("favRemove") : t("favAdd")}">${STAR}</button>
    </div>`;
  }).join("");
  $("main").innerHTML = `<div class="list" id="board">${html}</div>`;
}

export { dayHeading, renderList };
