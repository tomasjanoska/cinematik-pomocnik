import { withBusy } from "./feedback.js";
import { $, esc, parseIdt, festDay, personName } from "./util.js";
import { API } from "./config.js";
import { state, t } from "./state.js";
import { paint } from "./render.js";
import { loadResPub } from "./reservations.js";
import { scheduleReminders, goFilm } from "./reminders.js";
import { openSettings } from "./tickets.js";
import { applyShare } from "./share.js";

async function load() {
  $("status").textContent = t("load");
  try {
    await withBusy(t("load"), async () => {
      const [res, linksRes] = await Promise.all([
        fetch(API + "&DataVersion=" + Date.now()),
        fetch("films.json").then((r) => r, () => ({ ok: false })),
      ]);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (linksRes.ok) {
        const links = await linksRes.json();
        state.filmLinks = links.films || [];
      }
      hydrate(data);
      applyShare();
      paint();
    });
    void loadResPub().catch(() => {});
    void scheduleReminders();
    if (state.pendingFilm) goFilm(state.pendingFilm);
    else {
      const nid = new URLSearchParams(location.search).get("n");
      if (nid) goFilm(nid);
    }
    if ($("settings").open) void openSettings();
  } catch (err) {
    $("main").innerHTML = `<div class="msg"><h2>${t("err")}</h2><p>${esc(err.message)}</p><button class="btn" id="retry">${t("retry")}</button></div>`;
    $("retry").onclick = () => {
      $("main").innerHTML = `<div class="skel" id="skel"><i></i><i></i><i></i><i></i></div>`;
      load();
    };
  }
}

function hydrate(data) {
  const people = new Map((data.Persons || []).map((p) => [p.Id, p]));
  const locById = new Map((data.Locations || []).map((l) => [l.Id, l]));
  state.venues = [...(data.Locations || [])];
  const secSet = new Map();
  state.items = (data.Schedules || []).map((s) => {
    const start = parseIdt(s.StartTime);
    const end = parseIdt(s.EndTime);
    const sp = (s.Persons || [])[0];
    const person = sp ? people.get(sp.TicketNumberId) : null;
    const section = person ? personName(person) : "";
    if (section) secSet.set(section, 1);
    return { id: s.Id, raw: s, start, end, loc: locById.get(s.LocationId), locationId: s.LocationId, section, day: festDay(start) };
  });
  state.sections = [...secSet.keys()];
  const days = [...new Set(state.items.map((i) => i.day))].sort();
  const nowKey = festDay(new Date());
  state.day = days.includes(nowKey) ? nowKey : days[0];
}

export { load, hydrate };
