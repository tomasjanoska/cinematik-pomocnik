import { toast } from "./feedback.js";
import { $, esc, clockLabel, locName, parseMeta } from "./util.js";
import { STAR } from "./config.js";
import { state, t, txt, saveFavs } from "./state.js";
import { syncResButtons } from "./render.js";
import { resArea, syncDetailPrimary, refreshResChip } from "./reservations.js";
import { scheduleReminders } from "./reminders.js";
import { fillRatings } from "./ratings.js";

function openDetail(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  state.detailId = id;
  const s = it.raw;
  const title = txt(s.NameLocalized);
  const desc = txt(s.DescriptionLocalized) || (s.DescriptionLocalized || {}).Slovak || "";
  const meta = parseMeta(desc);
  const img = s.ImageUrl ? `<div class="poster"><img alt="" src="${esc(encodeURI(s.ImageUrl))}"></div>` : "";
  const orig = meta.orig && meta.orig.toLowerCase() !== title.toLowerCase() ? `<p class="orig">${esc(meta.orig)}</p>` : "";
  const runtime = meta.runtime || Math.round((it.end - it.start) / 60000);
  const on = state.favs.has(it.id);
  const trailer = s.VideoUrl
    ? `<a class="lnk lnk-ext" href="${esc(s.VideoUrl)}" target="_blank" rel="noopener">${t("trailer")}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg></a>`
    : "";
  const extra = meta.credits && meta.credits !== meta.synopsis
    ? `<details class="more"><summary>${t("more")}</summary><p class="credits">${esc(meta.credits)}</p></details>` : "";
  $("detail").innerHTML = `
    <form method="dialog"><button class="x" value="close" aria-label="${t("close")}">×</button></form>
    <article>
      ${img}
      <div class="detail-body">
        <div><h2 id="d-title">${esc(title)}</h2>${orig}</div>
        <div class="meta">
          <span><b>${clockLabel(it.start)}–${clockLabel(it.end)}</b></span>
          <span>${esc(locName(it.loc || {}))}</span>
          <span>${runtime}&nbsp;min</span>
          <span>${esc(it.section)}</span>
        </div>
        <div class="ratings" id="ratings" aria-live="polite" aria-label="${t("rateWait")}">
          <span class="rate is-wait">IMDb …</span>
          <span class="rate is-wait">ČSFD …</span>
        </div>
        <p class="status" id="res-msg" hidden></p>
        ${meta.synopsis ? `<p class="syn">${esc(meta.synopsis)}</p>` : ""}
        ${extra}
        <div class="detail-actions">
          <div class="res-area" id="res-area">${resArea(it)}</div>
          <button class="btn secondary" type="button" data-fav="${it.id}" aria-pressed="${on}">${STAR} ${t("favs")}</button>
          ${trailer}
        </div>
      </div>
    </article>`;
  syncDetailPrimary();
  $("detail").showModal();
  void fillRatings(it, meta);
  void refreshResChip(it);
}

function toggleFav(id) {
  if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
  saveFavs();
  const on = state.favs.has(id);
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
    b.setAttribute("aria-pressed", on);
    if (b.classList.contains("fav")) b.setAttribute("aria-label", on ? t("favRemove") : t("favAdd"));
  });
  document.querySelectorAll(`.block[data-id="${id}"]`).forEach((b) => b.classList.toggle("is-fav", on));
  syncResButtons();
  toast(on ? t("favAdded") : t("favRemoved"));
  void scheduleReminders();
}

export { openDetail, toggleFav };
