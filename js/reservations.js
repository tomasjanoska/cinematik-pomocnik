import { withBusy, toast } from "./feedback.js";
import { $, esc, parseIdt, festDay, clockLabel, locName, fold, stripTag } from "./util.js";
import { COPY } from "./copy.js";
import { EVENT_ID, RES_API } from "./config.js";
import { state, t } from "./state.js";
import { dayHeading } from "./render-list.js";
import { scheduleReminders } from "./reminders.js";

function resTickets() { return state.tickets.filter((tk) => tk.resOn !== false); }

function resFavsVisible() { return !!(state.onlyFavs && !state.sharedFavs && state.favs.size && resTickets().length); }

function namesMatch(a, b) {
  a = fold(stripTag(a)).replace(/^the /, "");
  b = fold(stripTag(b)).replace(/^the /, "");
  if (!a || !b) return false;
  if (a === b) return true;
  if ((a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) >= 10) return true;
  const aw = a.split(" ").filter((w) => w.length > 1);
  const bw = b.split(" ").filter((w) => w.length > 1);
  return aw.filter((w) => bw.includes(w)).length >= 2;
}

function flattenRes(data, ident) {
  const out = [];
  for (const v of data.Venues || []) {
    for (const e of v.Events || []) {
      if (ident && fold(e.TicketIdentifier || "") !== fold(ident)) continue;
      out.push({ ...e, venueName: v.LocationName || v.Name, start: parseIdt(e.StartDate), end: parseIdt(e.EndDate) });
    }
  }
  return out;
}

function sameScreening(it, ev) {
  const nl = it.raw.NameLocalized || {};
  return it.start.getTime() === ev.start.getTime()
    && (namesMatch(nl.English, ev.Name) || namesMatch(nl.Slovak, ev.Name));
}

function matchResEvent(it, events) {
  const hits = events.filter((e) => sameScreening(it, e));
  if (hits.length <= 1) return hits[0] || null;
  const loc = fold(locName(it.loc || {}));
  return hits.find((e) => fold(e.venueName || "").includes(loc) || loc.includes(fold(e.venueName || ""))) || hits[0];
}

function resErr(code) { return t("resR" + code) || t("resFail"); }

async function resGet(path, params) {
  const u = new URL(RES_API + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
  const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function resPost(path, body) {
  const res = await fetch(RES_API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function loadResPub() {
  if (state.resPub && Date.now() - state.resPub.at < 120000) return state.resPub;
  const data = await resGet("FetchReservationData", { EventId: EVENT_ID, Language: state.lang === "en" ? 2 : 1 });
  const seen = new Set();
  const events = [];
  for (const e of flattenRes(data, null)) {
    const k = e.start.getTime() + "|" + fold(e.Name) + "|" + fold(e.venueName);
    if (seen.has(k)) continue;
    seen.add(k);
    events.push(e);
  }
  state.resPub = { at: Date.now(), events };
  return state.resPub;
}

async function loadResPass(tk) {
  const id = tk.payload;
  const prev = state.resPass.get(id);
  if (prev && Date.now() - prev.at < 12000) return prev;
  const data = await resGet("FetchReservationData", { EventId: EVENT_ID, CheckingId: id, Language: state.lang === "en" ? 2 : 1 });
  const tns = (data.UserData && data.UserData.TicketNumbers) || [];
  const row = tns.find((x) => x.CheckingId === id) || tns[0];
  const rec = {
    at: Date.now(), data, ok: !!row,
    ident: row ? row.TicketIdentifier : "",
    tnId: row ? row.TicketNumberId : null,
    events: flattenRes(data, row ? row.TicketIdentifier : "\0"),
  };
  state.resPass.set(id, rec);
  return rec;
}

function reservedEvents(pass) {
  const ids = new Set(((pass.data && pass.data.UserTickets) || []).map((u) => u.TicketDateId));
  return pass.events.filter((e) => ids.has(e.TicketDateId)).sort((a, b) => a.start - b.start);
}

function matchSchedule(ev) {
  return state.items.find((it) => sameScreening(it, ev));
}

function isReserved(pass, ev) {
  return ((pass.data && pass.data.UserTickets) || []).some((u) => u.TicketDateId === ev.TicketDateId);
}

function resCardHtml(title, body) {
  return `
    <form method="dialog"><button class="x" value="close" aria-label="${t("close")}">×</button></form>
    <div class="panel-body">
      <h2 id="res-title" tabindex="-1">${title}</h2>
      ${body}
    </div>`;
}

function showResLog(rows) {
  $("res-card").innerHTML = resCardHtml(t("resLog"), `
      <ul class="res-log">${rows.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <button type="button" class="btn secondary" data-close>${t("close")}</button>`);
  $("res-card").showModal();
  $("res-title").focus();
}

async function openMine() {
  const c = COPY[state.lang];
  if (!state.tickets.length) {
    $("res-card").innerHTML = resCardHtml(c.resMine, `
      <p class="status">${c.resNoPass}</p>
      <div class="detail-actions">
        <button type="button" class="btn" data-res-need>${c.addTicket}</button>
        <button type="button" class="btn secondary" data-close>${c.close}</button>
      </div>`);
    $("res-card").showModal();
    return;
  }
  $("res-card").innerHTML = resCardHtml(c.resMine, `<p class="status">${c.load}</p>`);
  $("res-card").showModal();
  $("res-title").focus();
  await withBusy(c.load, async () => {
    for (const tk of state.tickets) state.resPass.delete(tk.payload);
    await Promise.allSettled(state.tickets.map(loadResPass));
  });
  if (!$("res-card").open) return;
  let body = "";
  for (const tk of state.tickets) {
    const pass = state.resPass.get(tk.payload);
    const evs = pass && pass.ok ? reservedEvents(pass) : [];
    body += `<h3>${esc(tk.name)}</h3>`;
    if (!pass || !pass.ok) body += `<p class="status">${c.resBadPass}</p>`;
    else if (!evs.length) body += `<p class="status">${c.resMineEmpty}</p>`;
    else body += evs.map((e) => {
      const it = matchSchedule(e);
      return `<div class="list-item" style="--sec:var(--accent)">
        <button type="button" class="block-hit list-hit"${it ? ` data-res-open="${it.id}"` : " disabled"}>
          <span class="when">${clockLabel(e.start)}</span>
          <span><span class="n">${esc(e.Name)}</span><span class="sub">${esc(dayHeading(festDay(e.start)))} · ${esc(e.venueName || "")}</span></span>
        </button>
        <button type="button" class="ghost" data-unres-tk="${esc(tk.id)}" data-td="${e.TicketDateId}">${c.resUnres}</button>
      </div>`;
    }).join("");
  }
  $("res-card").innerHTML = resCardHtml(c.resMine, `${body}<button type="button" class="btn secondary" data-close>${c.close}</button>`);
  $("res-title").focus();
}

async function unresMine(tkId, td) {
  const tk = state.tickets.find((x) => x.id === tkId);
  if (!tk) return;
  const r = await withBusy(t("resBusy"), async () => {
    const pass = await loadResPass(tk);
    const out = await resPost("UnreserveTicket", { CheckingId: tk.payload, TicketDateId: Number(td), TicketNumberId: pass.tnId });
    state.resPass.delete(tk.payload);
    return out;
  });
  if (r.Result !== 0) { toast(resErr(r.Result)); return; }
  void scheduleReminders();
  void openMine();
}

/* Reservation controls in the detail modal: labelled by action, state shown as text beside them. */
function resArea(it) {
  const pub = state.resPub && matchResEvent(it, state.resPub.events);
  if (!pub) return "";
  const tks = resTickets();
  if (!tks.length) {
    return `<button type="button" class="btn secondary" data-res-need>${t("resNeed")}</button><p class="res-hint">${t("resNeedHint")}</p>`;
  }
  let reserved = 0, known = 0;
  for (const tk of tks) {
    const pass = state.resPass.get(tk.payload);
    if (!pass || !pass.ok) continue;
    known += 1;
    const ev = matchResEvent(it, pass.events);
    if (ev && isReserved(pass, ev)) reserved += 1;
  }
  const cap = pub.TicketsRemaining > 9900 ? "" : ` · ${t("resFree")(pub.TicketsRemaining)}`;
  const who = tks.length === 1 ? esc(tks[0].name) : t("resPasses")(tks.length);
  if (known && reserved === tks.length) {
    return `<span class="res-state">${t("resDone")}</span>
      <button type="button" class="btn secondary" id="res-chip" data-unres="${it.id}">${t("resUnres")}</button>
      <p class="res-hint">${who}${cap}</p>`;
  }
  const extra = reserved ? ` ${reserved}/${tks.length}` : "";
  return `<button type="button" class="btn" id="res-chip" data-res="${it.id}">${t("resBtn")}${extra}</button>
    <p class="res-hint">${who}${cap}</p>`;
}

/* Favourite is the primary button only when no reservation button is available. */
function syncDetailPrimary() {
  const fav = $("detail").querySelector(".detail-actions [data-fav]");
  const hasPrimary = !!$("res-area")?.querySelector(".btn:not(.secondary)");
  if (fav) fav.classList.toggle("secondary", hasPrimary);
}

async function refreshResChip(it) {
  await withBusy(t("load"), async () => {
    try { await loadResPub(); } catch {}
    await Promise.allSettled(resTickets().map((tk) => loadResPass(tk)));
  });
  const area = $("res-area");
  if (!area || !$("detail").open) return;
  area.innerHTML = resArea(it);
  syncDetailPrimary();
}

function setResMsg(text) {
  const el = $("res-msg");
  if (!el) { if (text) toast(text); return; }
  el.hidden = !text;
  el.textContent = text || "";
}

export { resTickets, resFavsVisible, namesMatch, flattenRes, sameScreening, matchResEvent, resErr, resGet, resPost, loadResPub, loadResPass, reservedEvents, matchSchedule, isReserved, resCardHtml, showResLog, openMine, unresMine, resArea, syncDetailPrimary, refreshResChip, setResMsg };
