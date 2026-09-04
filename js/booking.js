import { withBusy, toast } from "./feedback.js";
import { $ } from "./util.js";
import { state, t, txt } from "./state.js";
import { resTickets, matchResEvent, resErr, resPost, loadResPub, loadResPass, isReserved, showResLog, refreshResChip, setResMsg } from "./reservations.js";
import { scheduleReminders } from "./reminders.js";
import { openSettings } from "./tickets.js";

async function bookOne(tk, it, unres) {
  const pass = await loadResPass(tk);
  if (!pass.ok) return { tk, ok: false, msg: t("resBadPass") };
  const ev = matchResEvent(it, pass.events);
  if (!ev) return { tk, ok: false, msg: t("resNo") };
  if (!unres && isReserved(pass, ev)) return { tk, ok: true, skip: true, msg: t("resSkip") };
  if (unres && !isReserved(pass, ev)) return { tk, ok: true, skip: true, msg: t("resSkip") };
  const r = await resPost(unres ? "UnreserveTicket" : "ReserveTicket", {
    CheckingId: tk.payload, TicketDateId: ev.TicketDateId, TicketNumberId: pass.tnId,
  });
  state.resPass.delete(tk.payload);
  if (r.Result === 0) return { tk, ok: true, msg: unres ? t("resUnresOk") : t("resOk") };
  return { tk, ok: false, msg: resErr(r.Result) };
}

async function bookItem(it, unres) {
  const tks = resTickets();
  if (!tks.length) { void openSettings(); return; }
  if (unres && !confirm(t("resUnresAsk"))) return;
  const chip = $("res-chip");
  if (chip) { chip.disabled = true; chip.setAttribute("aria-busy", "true"); }
  setResMsg(t("resBusy"));
  const rows = [];
  let ok = 0;
  await withBusy(t("resBusy"), async () => {
    for (const tk of tks) {
      try {
        const r = await bookOne(tk, it, unres);
        if (r.ok && !r.skip) ok += 1;
        rows.push(`${tk.name}: ${r.msg}`);
      } catch {
        rows.push(`${tk.name}: ${t("resFail")}`);
      }
    }
    await refreshResChip(it);
  });
  setResMsg(ok ? (unres ? t("resUnresOk") : t("resOk")) : (rows[0] || t("resFail")));
  if (tks.length > 1) showResLog(rows);
  void scheduleReminders();
}

async function bookFavs() {
  const tks = resTickets();
  const items = state.items.filter((it) => state.favs.has(it.id));
  if (!tks.length) { void openSettings(); return; }
  if (!items.length) return;
  if (!confirm(t("resFavAsk")(items.length, tks.length))) return;
  if ($("btn-res-favs")) $("btn-res-favs").disabled = true;
  const rows = [];
  let ok = 0;
  await withBusy(t("resBusy"), async () => {
    try { await loadResPub(); } catch {}
    for (const it of items.sort((a, b) => a.start - b.start)) {
      const title = txt(it.raw.NameLocalized);
      if (state.resPub && !matchResEvent(it, state.resPub.events)) {
        rows.push(`${title}: ${t("resNo")}`);
        continue;
      }
      for (const tk of tks) {
        try {
          const r = await bookOne(tk, it, false);
          if (r.ok && !r.skip) ok += 1;
          rows.push(`${tk.name} · ${title}: ${r.msg}`);
        } catch {
          rows.push(`${tk.name} · ${title}: ${t("resFail")}`);
        }
      }
    }
  });
  if ($("btn-res-favs")) $("btn-res-favs").disabled = false;
  toast(ok ? t("resOk") : t("resFail"));
  showResLog(rows);
  void scheduleReminders();
}

export { bookOne, bookItem, bookFavs };
