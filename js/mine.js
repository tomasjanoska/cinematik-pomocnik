import { $, esc, fold, stripPart } from "./util.js";
import { STAR, RATE_MAX } from "./config.js";
import { state, t, saveMine } from "./state.js";

function filmKey(it) {
  const n = it.raw.NameLocalized || {};
  return fold(stripPart(n.Slovak || n.English || "")) || String(it.id);
}

function rec(it) { return state.mine.get(filmKey(it)) || { stars: 0, note: "" }; }

function put(it, stars, note) {
  const key = filmKey(it);
  const s = Number.isInteger(stars) && stars >= 1 && stars <= 10 ? stars : 0;
  const text = String(note || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, RATE_MAX);
  if (!s && !text) state.mine.delete(key);
  else state.mine.set(key, { stars: s, note: text });
  saveMine();
}

function currentItem() { return state.items.find((x) => x.id === state.detailId); }

function paintStars(stars) {
  const g = $("mine-stars");
  if (!g) return;
  const n = $("mine-n");
  if (n) {
    n.textContent = stars ? String(stars) : "";
    n.hidden = !stars;
  }
  g.querySelectorAll("[data-mine-star]").forEach((b) => {
    const v = +b.dataset.mineStar;
    const sel = stars === v;
    b.classList.toggle("is-on", stars >= v);
    b.setAttribute("aria-checked", sel ? "true" : "false");
    b.tabIndex = (stars ? sel : v === 1) ? 0 : -1;
  });
}

function mineHtml(it) {
  const r = rec(it);
  const early = it.end > Date.now();
  const stars = Array.from({ length: 10 }, (_, i) => {
    const v = i + 1;
    const on = r.stars >= v;
    const sel = r.stars === v;
    const tab = r.stars ? sel : v === 1;
    return `<button type="button" role="radio" data-mine-star="${v}" aria-checked="${sel}" aria-label="${v} / 10" tabindex="${tab ? 0 : -1}" class="${on ? "is-on" : ""}">${STAR}</button>`;
  }).join("");
  return `<details class="mine">
    <summary>${esc(t("myRate"))}<span class="mine-n" id="mine-n"${r.stars ? "" : " hidden"}>${r.stars || ""}</span></summary>
    <div class="mine-body">
      ${early ? `<p class="mine-early" id="mine-early">${esc(t("myRateEarly"))}</p>` : ""}
      <div class="mine-stars" id="mine-stars" role="radiogroup" aria-label="${esc(t("myRate"))}"${early ? ` aria-describedby="mine-early"` : ""}>${stars}</div>
      <label for="mine-note">${esc(t("myRateNote"))}</label>
      <textarea id="mine-note" maxlength="${RATE_MAX}" rows="3" dir="auto" aria-describedby="mine-count">${esc(r.note)}</textarea>
      <p class="mine-count" id="mine-count">${esc(t("myRateCount")(r.note.length))}</p>
    </div>
  </details>`;
}

function onMineStar(n) {
  const it = currentItem();
  if (!it) return;
  const r = rec(it);
  const stars = r.stars === n ? 0 : n;
  put(it, stars, r.note);
  paintStars(stars);
}

function onMineNote(value) {
  const it = currentItem();
  if (!it) return;
  const note = String(value || "").slice(0, RATE_MAX);
  put(it, rec(it).stars, note);
  const el = $("mine-count");
  if (el) el.textContent = t("myRateCount")(note.length);
}

function onMineKey(e) {
  const btn = e.target.closest("[data-mine-star]");
  if (!btn) return;
  const v = +btn.dataset.mineStar;
  const jump = { ArrowRight: v + 1, ArrowLeft: v - 1, ArrowUp: v + 1, ArrowDown: v - 1, Home: 1, End: 10 };
  if (!(e.key in jump)) return;
  e.preventDefault();
  const n = Math.min(10, Math.max(1, jump[e.key]));
  const el = $("mine-stars")?.querySelector(`[data-mine-star="${n}"]`);
  el?.focus();
  const it = currentItem();
  if (!it) return;
  put(it, n, rec(it).note);
  paintStars(n);
}

export { mineHtml, onMineStar, onMineNote, onMineKey };
