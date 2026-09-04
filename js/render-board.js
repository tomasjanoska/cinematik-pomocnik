import { $, esc, wideUi, festDay, minsOnDay, clockLabel, locName, pack, secColor } from "./util.js";
import { COPY } from "./copy.js";
import { LANE_GAP, ROW_PAD, STAR } from "./config.js";
import { state, t, txt } from "./state.js";
import { visibleItems } from "./filters.js";
import { renderEmpty } from "./render.js";

function laneH() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lane-h")) || 72;
}

function pxMin() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--px-min")) || 2.6; }

function renderBoard() {
  const items = visibleItems();
  $("status").textContent = COPY[state.lang].films(items.length);
  if (!items.length) {
    renderEmpty();
    return;
  }
  const PX = pxMin();
  const LH = laneH();
  const byVenue = new Map(state.venues.map((v) => [v.Id, []]));
  for (const it of items) if (byVenue.has(it.locationId)) byVenue.get(it.locationId).push(it);

  let axisStart = Infinity, axisEnd = 26 * 60;
  for (const it of items) {
    axisStart = Math.min(axisStart, minsOnDay(it.start, it.day));
    axisEnd = Math.max(axisEnd, minsOnDay(it.end, it.day));
  }
  axisStart = Math.max(0, Math.floor(axisStart / 60) * 60);
  axisEnd = Math.ceil(axisEnd / 60) * 60;
  state.axisStart = axisStart;
  const width = (axisEnd - axisStart) * PX;

  const hours = [];
  for (let m = axisStart; m < axisEnd; m += 60) {
    const clock = ((m / 60) % 24 + 24) % 24;
    hours.push(`<span class="${m >= 24 * 60 ? "next-cal" : ""}">${String(clock).padStart(2, "0")}:00</span>`);
  }

  const rows = [];
  const gutter = [];
  /* On phones the gutter is hidden and the venue name sits in a strip at the top of each lane. */
  const compact = !wideUi();
  const padTop = compact ? 22 : ROW_PAD;
  const padBot = compact ? 6 : ROW_PAD;
  for (const loc of state.venues) {
    const list = byVenue.get(loc.Id) || [];
    if (!list.length) continue;
    const nLanes = pack(list);
    const h = padTop + padBot + nLanes * LH + (nLanes - 1) * LANE_GAP;
    const blocks = list.map((it) => {
      const a = minsOnDay(it.start, it.day);
      const b = minsOnDay(it.end, it.day);
      const left = (a - axisStart) * PX;
      const w = Math.max((b - a) * PX, 8);
      const top = padTop + it.lane * (LH + LANE_GAP);
      const title = txt(it.raw.NameLocalized);
      const st = clockLabel(it.start), en = clockLabel(it.end);
      const on = state.favs.has(it.id);
      return `<div class="block${w < 110 ? " tight" : ""}${on ? " is-fav" : ""}" data-id="${it.id}"
        style="left:${left}px;width:${w}px;top:${top}px;height:${LH}px;--sec:${secColor(it.section)}">
        <button type="button" class="block-hit" data-id="${it.id}"
          aria-label="${st}–${en}, ${esc(title)}, ${esc(locName(loc))}">
          <span class="inner">
            <span class="t">${st}–${en}</span>
            <span class="n">${esc(title)}</span>
            <span class="s">${esc(it.section)}</span>
          </span>
        </button>
        <button type="button" class="fav" data-fav="${it.id}" aria-pressed="${on}" aria-label="${on ? t("favRemove") : t("favAdd")}">${STAR}</button>
      </div>`;
    }).join("");
    const laneName = compact ? `<span class="lane-name">${esc(locName(loc))} <small>${list.length}</small></span>` : "";
    rows.push(`<div class="lane" style="width:${width}px;height:${h}px">${laneName}${blocks}</div>`);
    gutter.push(`<div class="venue" style="height:${h}px"><strong>${esc(locName(loc))}</strong><small>${list.length}</small></div>`);
  }

  $("main").innerHTML = `<div class="board-split">
    <aside class="gutter" id="gutter">
      <div class="corner">${t("halls")}</div>
      ${gutter.join("")}
    </aside>
    <div class="board" id="board" tabindex="-1">
      <div class="sheet" id="sheet">
        <div class="hour-track" style="width:${width}px">${hours.join("")}</div>
        ${rows.join("")}
        <div class="now-line" id="now-line" hidden></div>
      </div>
    </div>
  </div>`;

  placeNow();
  const board = $("board");
  const side = $("gutter");
  let lock = false;
  const link = (a, b) => {
    a.addEventListener("scroll", () => {
      if (lock) return;
      lock = true;
      b.scrollTop = a.scrollTop;
      if (a === board) pinTitles();
      lock = false;
    }, { passive: true });
  };
  link(board, side);
  link(side, board);
  /* Land on the first screening, or on "now" while today's programme is running. */
  const starts = items.map((it) => minsOnDay(it.start, it.day));
  const nowD = new Date();
  let focus = Math.min(...starts);
  if (festDay(nowD) === state.day) focus = Math.min(Math.max(focus, minsOnDay(nowD, state.day)), Math.max(...starts));
  board.scrollLeft = Math.max(0, (focus - 15 - axisStart) * PX);
  side.style.paddingBottom = Math.max(0, board.offsetHeight - board.clientHeight) + "px";
  pinTitles();
}

function pinTitles() {
  const board = $("board");
  if (!board) return;
  const sl = board.scrollLeft;
  for (const el of board.querySelectorAll(".lane-name")) el.style.transform = sl ? `translateX(${sl}px)` : "";
  for (const el of board.querySelectorAll(".block")) {
    const inner = el.querySelector(".inner");
    if (!inner) continue;
    const left = parseFloat(el.style.left) || 0;
    const under = sl - left;
    const pad = Math.max(0, Math.min(under, el.offsetWidth - 72));
    inner.style.transform = pad ? `translateX(${pad}px)` : "";
  }
}

function placeNow() {
  const line = $("now-line");
  if (!line) return;
  const now = new Date();
  if (festDay(now) !== state.day) { line.hidden = true; return; }
  const x = (minsOnDay(now, state.day) - state.axisStart) * pxMin();
  line.style.left = x + "px";
  line.hidden = x < 0;
}

export { laneH, pxMin, renderBoard, pinTitles, placeNow };
