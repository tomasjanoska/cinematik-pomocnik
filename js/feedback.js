import { $, esc } from "./util.js";
import { state, t } from "./state.js";

let busyN = 0;

let busyShowTimer = 0;

function playLoadSound() {
  const a = $("load-audio");
  if (!a || !state.soundOn) return;
  a.loop = true;
  a.play().catch(() => {});
}

function busyOn(msg) {
  busyN += 1;
  $("busy-label").textContent = msg || t("load");
  if (busyN !== 1) {
    if ($("busy").open) playLoadSound();
    return;
  }
  clearTimeout(busyShowTimer);
  busyShowTimer = setTimeout(() => {
    if (!busyN) return;
    if (!$("busy").open) $("busy").showModal();
    playLoadSound();
  }, 80);
}

function busyOff() {
  busyN = Math.max(0, busyN - 1);
  if (busyN) return;
  clearTimeout(busyShowTimer);
  busyShowTimer = 0;
  if ($("busy").open) $("busy").close();
  const a = $("load-audio");
  if (!a) return;
  a.pause();
  try { a.currentTime = 0; } catch {}
}

async function withBusy(msg, fn) {
  busyOn(msg);
  try { return await fn(); }
  finally { busyOff(); }
}

function unlockLoadAudio() {
  const a = $("load-audio");
  if (!a || !state.soundOn) return;
  a.play().then(() => { if (!busyN) a.pause(); }).catch(() => {});
}

let toastT = 0;

function hideToast() {
  const box = $("toasts");
  box.innerHTML = "";
  if (box.hidePopover) { try { box.hidePopover(); } catch {} }
}

function toast(msg, act) {
  const box = $("toasts");
  box.innerHTML = `<div class="toast">${esc(msg)}${act ? `<button type="button" id="toast-act">${esc(act.label)}</button>` : ""}</div>`;
  if (act) $("toast-act").onclick = () => { hideToast(); act.run(); };
  if (box.showPopover) { try { if (!box.matches(":popover-open")) box.showPopover(); } catch {} }
  clearTimeout(toastT);
  toastT = setTimeout(hideToast, act ? 7000 : 3000);
}

export { playLoadSound, busyOn, busyOff, withBusy, unlockLoadAudio, hideToast, toast };
