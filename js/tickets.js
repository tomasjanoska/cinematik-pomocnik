import { withBusy, toast } from "./feedback.js";
import { $, esc } from "./util.js";
import { COPY } from "./copy.js";
import { QR_SCAN_SRC, QR_DRAW_SRC } from "./config.js";
import { state, t, saveSettings } from "./state.js";
import { syncResButtons } from "./render.js";

let scanner = null;

let pendingQr = null;

function loadScript(src, ready) {
  return new Promise((resolve, reject) => {
    if (ready()) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => (ready() ? resolve() : reject(new Error("lib")));
    el.onerror = () => reject(new Error("net"));
    document.head.appendChild(el);
  });
}

async function stopScan() {
  if (!scanner) return;
  try { await scanner.stop(); } catch {}
  try { scanner.clear(); } catch {}
  scanner = null;
}

async function openSettings() {
  await stopScan();
  pendingQr = null;
  const c = COPY[state.lang];
  const ntfMsg = typeof Notification === "undefined" ? c.notifyNo : Notification.permission === "denied" ? c.notifyDenied : "";
  const list = state.tickets.length
    ? state.tickets.map((tk) => `<div class="ticket-row" data-ticket-row="${esc(tk.id)}">
        <input type="text" data-rename="${esc(tk.id)}" value="${esc(tk.name)}" aria-label="${esc(c.ticketName)}" autocomplete="off">
        <label class="check"><input type="checkbox" data-res-ticket="${esc(tk.id)}"${tk.resOn !== false ? " checked" : ""}> ${esc(c.resUse)}</label>
        <div class="ticket-acts">
          <button type="button" class="ghost" data-show-ticket="${esc(tk.id)}">${c.showTicket}</button>
          <button type="button" class="ghost danger" data-del-ticket="${esc(tk.id)}">${c.deleteTicket}</button>
        </div>
      </div>`).join("")
    : `<p>${c.noTickets}</p>`;
  $("settings").innerHTML = `
    <form method="dialog"><button class="x" value="close" aria-label="${c.close}">×</button></form>
    <div class="panel-body">
      <h2 id="set-title">${c.settings}</h2>
      <section class="panel-sec">
        <h3>${c.langLabel}</h3>
        <div class="seg" role="group" aria-label="${c.langLabel}" style="width: max-content">
          <button type="button" id="lang-sk" aria-pressed="${state.lang === "sk"}">Slovensky</button>
          <button type="button" id="lang-en" aria-pressed="${state.lang === "en"}">English</button>
        </div>
      </section>
      <section class="panel-sec">
        <h3>${c.tickets}</h3>
        <p class="status">${c.ticketsHint}</p>
        <div id="ticket-list">${list}</div>
        <div class="detail-actions">
          <button type="button" class="btn" id="btn-scan-cam">${c.scanQr}</button>
          <label class="btn secondary" for="scan-file">${c.scanFile}</label>
        </div>
        <input id="scan-file" class="sr-file" type="file" accept="image/*">
        <div id="scan-panel" hidden>
          <p id="scan-status" class="status" role="status"></p>
          <div id="qr-box"></div>
          <div class="detail-actions">
            <button type="button" class="btn secondary" id="btn-stop-scan">${c.stopScan}</button>
          </div>
          <div id="scan-save" hidden>
            <label class="lbl" for="new-ticket-name">${c.ticketName}</label>
            <input id="new-ticket-name" type="text" autocomplete="off">
            <button type="button" class="btn" id="btn-save-ticket">${c.saveTicket}</button>
          </div>
        </div>
      </section>
      <section class="panel-sec">
        <h3>${c.notify}</h3>
        <p class="status">${c.notifyHint}</p>
        <label class="check"><input type="checkbox" data-notify${state.notifyOn ? " checked" : ""}> ${esc(c.notifyOn)}</label>
        <label class="lbl" for="notify-mins">${esc(c.notifyMins)}</label>
        <input id="notify-mins" data-notify-mins type="number" min="1" max="180" step="1" value="${state.notifyMins}" inputmode="numeric">
        <label class="check"><input type="checkbox" data-notify-res${state.notifyRes ? " checked" : ""}> ${esc(c.notifyOnRes)}</label>
        <label class="check"><input type="checkbox" data-notify-fav${state.notifyFav ? " checked" : ""}> ${esc(c.notifyOnFav)}</label>
        <p class="status" id="notify-status"${ntfMsg ? "" : " hidden"}>${esc(ntfMsg)}</p>
      </section>
      <section class="panel-sec">
        <h3>${c.sound}</h3>
        <label class="check"><input type="checkbox" data-sound${state.soundOn ? " checked" : ""}> ${esc(c.soundOn)}</label>
      </section>
      <section class="panel-sec">
        <h3>${c.about}</h3>
        <p class="status">${esc(c.disclaimer)}</p>
        <p class="status">${c.foot}<a href="https://cinematik.sk/program?st=1">cinematik.sk/program</a> · ${c.ideas}: <a href="mailto:cmnapady@pocuj.com">cmnapady@pocuj.com</a></p>
      </section>
      <button type="button" class="btn secondary" data-close>${c.close}</button>
    </div>`;
  $("settings").showModal();
}

function revealScan() {
  const panel = $("scan-panel");
  if (!panel) return;
  panel.hidden = false;
  $("scan-save").hidden = true;
  pendingQr = null;
}

async function startCam() {
  revealScan();
  const status = $("scan-status");
  if (!status || !$("qr-box")) return;
  status.textContent = t("scanLib");
  try {
    await withBusy(t("scanLib"), () => loadScript(QR_SCAN_SRC, () => typeof Html5Qrcode === "function"));
  } catch {
    status.textContent = t("scanFail");
    return;
  }
  const host = location.hostname;
  const ok = location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
  if (!ok) {
    status.textContent = t("scanNeedHttps");
    return;
  }
  await stopScan();
  scanner = new Html5Qrcode("qr-box", { verbose: false });
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 220, height: 220 } },
      (text) => { onScanned(text); },
      () => {}
    );
    status.textContent = "";
  } catch {
    status.textContent = t("scanFail");
    scanner = null;
  }
}

async function decodeQrFile(file) {
  if (typeof BarcodeDetector === "function") {
    try {
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      const bmp = await createImageBitmap(file);
      const found = await det.detect(bmp);
      if (typeof bmp.close === "function") bmp.close();
      if (found[0] && found[0].rawValue) return found[0].rawValue;
    } catch {}
  }
  await loadScript(QR_SCAN_SRC, () => typeof Html5Qrcode === "function");
  await stopScan();
  scanner = new Html5Qrcode("qr-box", { verbose: false });
  const text = await scanner.scanFile(file, true);
  await stopScan();
  return text;
}

async function scanFile(file) {
  revealScan();
  const status = $("scan-status");
  if (!status) return;
  status.textContent = t("scanLib");
  await stopScan();
  try {
    const text = await withBusy(t("scanLib"), () => decodeQrFile(file));
    if (!String(text || "").trim()) throw new Error("empty");
    onScanned(text);
  } catch {
    status.textContent = t("scanNoQr");
    scanner = null;
  }
}

function onScanned(text) {
  const payload = String(text || "").trim();
  if (!payload) return;
  pendingQr = payload;
  void stopScan();
  const save = $("scan-save");
  const status = $("scan-status");
  const name = $("new-ticket-name");
  if (save) save.hidden = false;
  if (status) status.textContent = t("scanOk");
  if (name) {
    name.value = `${t("ticketSel")} ${state.tickets.length + 1}`;
    name.focus();
    name.select();
  }
}

function savePendingTicket() {
  if (!pendingQr) return;
  const name = ($("new-ticket-name")?.value || "").trim() || `${t("ticketSel")} ${state.tickets.length + 1}`;
  const id = (crypto.randomUUID && crypto.randomUUID()) || ("t" + Date.now());
  state.tickets.push({ id, name, payload: pendingQr, addedAt: Date.now(), resOn: true });
  state.activeTicketId = id;
  pendingQr = null;
  saveSettings();
  syncResButtons();
  void openSettings();
  toast(t("ticketSaved"));
}

/* Deleting is immediate but undoable from the toast; the QR would otherwise have to be re-scanned. */
function deleteTicket(id) {
  const idx = state.tickets.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const tk = state.tickets[idx];
  const wasActive = state.activeTicketId === id;
  state.tickets.splice(idx, 1);
  if (wasActive) state.activeTicketId = state.tickets[0]?.id || null;
  saveSettings();
  syncResButtons();
  if ($("settings").open) void openSettings();
  toast(t("ticketDeleted"), { label: t("undo"), run: () => {
    state.tickets.splice(Math.min(idx, state.tickets.length), 0, tk);
    if (wasActive) state.activeTicketId = tk.id;
    saveSettings();
    syncResButtons();
    if ($("settings").open) void openSettings();
  } });
}

function setActiveTicket(id) {
  if (!state.tickets.some((tk) => tk.id === id)) return;
  state.activeTicketId = id;
  saveSettings();
  document.querySelectorAll("[data-ticket-row]").forEach((row) => {
    row.classList.toggle("is-on", row.dataset.ticketRow === id);
  });
}

async function showTicket(id) {
  const tk = state.tickets.find((x) => x.id === (id || state.activeTicketId));
  if (!tk) return;
  setActiveTicket(tk.id);
  const reopen = $("settings").open;
  if (reopen) $("settings").close();
  const card = $("ticket-card");
  card.innerHTML = `
    <form method="dialog"><button class="x" value="close" aria-label="${t("close")}">×</button></form>
    <div class="panel-body">
      <h2 id="tc-title" tabindex="-1">${esc(tk.name)}</h2>
      <div class="qr-show"><canvas id="qr-canvas" width="280" height="280"></canvas></div>
      <button type="button" class="btn secondary" data-close>${t("close")}</button>
    </div>`;
  card.showModal();
  $("tc-title").focus();
  const canvas = $("qr-canvas");
  try {
    await withBusy(t("load"), async () => {
      await loadScript(QR_DRAW_SRC, () => typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function");
      await QRCode.toCanvas(canvas, String(tk.payload), { width: 280, margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
    });
  } catch {
    /* No remote fallback: the pass must never leave the phone except to Inviton. */
    const box = card.querySelector(".qr-show");
    if (box) box.innerHTML = `<p class="qr-payload">${esc(t("qrFail"))}<br><b>${esc(tk.payload)}</b></p>`;
  }
  if (reopen) card.addEventListener("close", () => { void openSettings(); }, { once: true });
}

$("settings").addEventListener("close", () => { void stopScan(); pendingQr = null; });

export { loadScript, stopScan, openSettings, revealScan, startCam, decodeQrFile, scanFile, onScanned, savePendingTicket, deleteTicket, setActiveTicket, showTicket };
