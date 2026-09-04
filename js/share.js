import { toast } from "./feedback.js";
import { $, esc } from "./util.js";
import { QR_DRAW_SRC } from "./config.js";
import { state, t, saveSettings } from "./state.js";
import { paint } from "./render.js";
import { loadScript } from "./tickets.js";

function cleanName(s) {
  return String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
}

function parseShare(search) {
  const p = new URLSearchParams(search);
  const who = cleanName(p.get("who") || "");
  const ids = [...new Set((p.get("favs") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 400);
  if (!ids.length) return null;
  return { who, ids: new Set(ids) };
}

function buildShareUrl(name, ids) {
  const u = new URL(location.href);
  u.hash = "";
  u.search = "";
  const list = [...new Set([...ids].filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  u.searchParams.set("favs", list.join(","));
  const who = cleanName(name);
  if (who) u.searchParams.set("who", who);
  return u.href;
}

function applyShare() {
  const parsed = parseShare(location.search);
  if (!parsed) return;
  const known = new Set(state.items.map((it) => it.id));
  const ids = new Set([...parsed.ids].filter((id) => known.has(id)));
  if (!ids.size) return;
  state.sharedFavs = ids;
  state.sharedName = parsed.who;
  state.onlyFavs = true;
  const days = state.items.filter((it) => ids.has(it.id)).map((it) => it.day).sort();
  if (days.includes(state.day)) return;
  if (days[0]) state.day = days[0];
}

function closeShare() {
  state.sharedFavs = null;
  state.sharedName = "";
  const u = new URL(location.href);
  u.searchParams.delete("favs");
  u.searchParams.delete("who");
  history.replaceState(null, "", u.pathname + u.search + u.hash);
  paint();
  $("btn-favs")?.focus();
}

let qrT = 0;
let qrGen = 0;

function syncShareUrl(now) {
  const name = cleanName($("share-name")?.value || "");
  const url = buildShareUrl(name, state.favs);
  const box = $("share-url");
  if (box) box.value = url;
  clearTimeout(qrT);
  const run = () => {
    if (name && name !== state.shareName) {
      state.shareName = name;
      saveSettings();
    }
    void drawShareQr(url);
  };
  if (now) run();
  else qrT = setTimeout(run, 160);
}

async function drawShareQr(url) {
  const host = $("share-qr-box");
  if (!host) return;
  const n = ++qrGen;
  try {
    await loadScript(QR_DRAW_SRC, () => typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function");
    if (n !== qrGen || !$("share-qr-box")) return;
    host.innerHTML = `<canvas id="share-qr" width="280" height="280" role="img" aria-label="${esc(t("shareQr"))}"></canvas>`;
    const canvas = $("share-qr");
    const opts = { width: 280, margin: 2, color: { dark: "#000000", light: "#ffffff" } };
    try {
      await QRCode.toCanvas(canvas, url, { ...opts, errorCorrectionLevel: "M" });
    } catch {
      await QRCode.toCanvas(canvas, url, { ...opts, errorCorrectionLevel: "L" });
    }
  } catch {
    if (n !== qrGen) return;
    host.innerHTML = `<p class="qr-payload">${esc(t("shareQrFail"))}</p>`;
  }
}

function openShare() {
  if (!state.favs.size) { toast(t("shareEmpty")); return; }
  $("share").innerHTML = `
    <form method="dialog"><button class="x" value="close" aria-label="${t("close")}">×</button></form>
    <form class="panel-body" id="share-form">
      <h2 id="share-title">${t("shareTitle")}</h2>
      <p class="status">${t("shareHint")}</p>
      <label class="lbl" for="share-name">${t("shareName")}</label>
      <input id="share-name" name="name" type="text" maxlength="40" required autocomplete="name" placeholder="${esc(t("shareNamePh"))}" value="${esc(state.shareName)}">
      <div class="qr-show" id="share-qr-box"></div>
      <p class="status">${t("shareQrHint")}</p>
      <label class="lbl" for="share-url">${t("shareLink")}</label>
      <input id="share-url" type="text" readonly spellcheck="false" autocomplete="off">
      <div class="detail-actions">
        ${typeof navigator.share === "function" ? `<button type="submit" class="btn" name="via" value="share">${t("shareDo")}</button>` : ""}
        <button type="submit" class="btn${typeof navigator.share === "function" ? " secondary" : ""}" name="via" value="copy">${t("shareCopy")}</button>
      </div>
    </form>`;
  syncShareUrl(true);
  $("share").showModal();
  if (!state.shareName) $("share-name").focus();
  $("share-url").addEventListener("focus", (e) => e.target.select());
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;left:-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy");
}

async function sendShare(via) {
  const name = cleanName($("share-name")?.value || "");
  if (!name) { $("share-name")?.focus(); return; }
  if (!state.favs.size) { toast(t("shareEmpty")); return; }
  state.shareName = name;
  saveSettings();
  const url = buildShareUrl(name, state.favs);
  const box = $("share-url");
  if (box) box.value = url;
  if (via === "share" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: t("shareTitle"), text: t("sharedBanner")(name), url });
      $("share").close();
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  try {
    await copyText(url);
    toast(t("shareCopied"));
  } catch {
    box?.select();
    toast(t("shareFail"));
  }
}

export { parseShare, buildShareUrl, applyShare, closeShare, openShare, syncShareUrl, sendShare, cleanName };
