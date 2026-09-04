import { withBusy } from "./feedback.js";
import { $, esc, fold, stripPart } from "./util.js";
import { EXT } from "./config.js";
import { state, t } from "./state.js";

const rateCache = new Map();

let rateSeq = 0;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function claimVal(claims, p) {
  const v = ((claims[p] || [])[0] || {}).mainsnak;
  return v && v.datavalue ? v.datavalue.value : null;
}

function p444(claims, org) {
  for (const st of claims.P444 || []) {
    const q = ((((st.qualifiers || {}).P447 || [])[0] || {}).datavalue || {}).value;
    if ((q && q.id) !== org) continue;
    const v = (st.mainsnak && st.mainsnak.datavalue && st.mainsnak.datavalue.value) || "";
    return String(v);
  }
  return "";
}

async function wdFind(titles, year) {
  for (const title of titles) {
    const d = await getJson("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + encodeURIComponent(title) + "&language=en&type=item&limit=8&format=json&origin=*");
    const ids = (d.search || []).map((x) => x.id).filter(Boolean);
    if (!ids.length) continue;
    const e = await getJson("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" + encodeURIComponent(ids.join("|")) + "&props=claims&format=json&origin=*");
    let fallback = null;
    for (const id of ids) {
      const claims = (e.entities[id] || {}).claims || {};
      const imdb = claimVal(claims, "P345");
      const csfd = claimVal(claims, "P2529");
      if (!imdb && !csfd) continue;
      const time = claimVal(claims, "P577");
      const wy = time && time.time ? +time.time.slice(1, 5) : 0;
      const rec = { imdb, csfd, imdbScore: p444(claims, "Q37312"), csfdScore: p444(claims, "Q3561957") };
      if (year && wy && Math.abs(wy - year) > 2) continue;
      if (year && wy && Math.abs(wy - year) <= 2) return rec;
      if (!fallback) fallback = rec;
    }
    if (fallback) return fallback;
  }
  return {};
}

async function cinemetaFind(titles, year) {
  for (const title of titles) {
    const d = await getJson("https://v3-cinemeta.strem.io/catalog/movie/top/search=" + encodeURIComponent(title) + ".json");
    const ft = fold(title);
    const metas = d.metas || [];
    const score = (m) => {
      const n = fold(m.name);
      const y = parseInt(String(m.releaseInfo || m.year || ""), 10) || 0;
      let s = n === ft ? 4 : (n.includes(ft) || ft.includes(n) ? 2 : 0);
      if (year && y && Math.abs(y - year) <= 1) s += 2;
      return s;
    };
    const hit = metas.map((m) => ({ m, s: score(m) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s)[0];
    const id = hit && (hit.m.imdb_id || hit.m.id);
    if (!id || !/^tt\d+$/.test(id)) continue;
    const meta = await getJson("https://cinemeta-live.strem.io/meta/movie/" + id + ".json");
    const rating = meta.meta && meta.meta.imdbRating;
    return { id, rating: rating && rating !== "N/A" ? String(rating) : "" };
  }
  return {};
}

/* With a value it reads as a rating; without one it is plainly a link to search the site. */
function rateChip(label, href, val) {
  return `<a class="rate${val ? "" : " is-link"}" href="${esc(href)}" target="_blank" rel="noopener">${label}${val ? ` <b>${esc(val)}</b>` : EXT}</a>`;
}

function fmtCsfd(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  if (/%/.test(raw)) return raw;
  const n = parseFloat(raw.replace(",", "."));
  if (Number.isFinite(n) && n <= 100) return (Number.isInteger(n) ? n : n.toFixed(1)) + "%";
  return raw;
}

async function wdByImdb(imdbId) {
  if (!/^tt\d+$/.test(imdbId)) return {};
  const query = `SELECT ?csfd ?csfdScore ?imdbScore WHERE {
    ?item wdt:P345 "${imdbId}".
    OPTIONAL { ?item wdt:P2529 ?csfd. }
    OPTIONAL { ?item p:P444 ?c. ?c ps:P444 ?csfdScore. ?c pq:P447 wd:Q3561957. }
    OPTIONAL { ?item p:P444 ?i. ?i ps:P444 ?imdbScore. ?i pq:P447 wd:Q37312. }
  } LIMIT 1`;
  const d = await getJson("https://query.wikidata.org/sparql?query=" + encodeURIComponent(query) + "&format=json");
  const b = ((d.results || {}).bindings || [])[0] || {};
  const lit = (k) => (b[k] && b[k].value) || "";
  return { imdb: imdbId, csfd: lit("csfd"), csfdScore: lit("csfdScore"), imdbScore: lit("imdbScore") };
}

async function lookupRatings(q) {
  const titles = [...new Set([q.orig, q.en, q.sk].map(stripPart).filter((x) => x.length > 1))];
  const qstr = q.orig || q.en || q.sk;
  const im = await cinemetaFind(titles, q.year).catch(() => ({}));
  let wd = {};
  if (im.id) wd = await wdByImdb(im.id).catch(() => ({}));
  if (!wd.csfd) {
    const byName = await wdFind(titles, q.year).catch(() => ({}));
    wd = {
      imdb: wd.imdb || byName.imdb,
      csfd: wd.csfd || byName.csfd,
      csfdScore: wd.csfdScore || byName.csfdScore,
      imdbScore: wd.imdbScore || byName.imdbScore,
    };
  }
  const imdbId = im.id || wd.imdb || "";
  let imdb = im.rating || "";
  if (!imdb && wd.imdbScore) imdb = String(wd.imdbScore).replace(/\s*\/\s*10\s*$/, "");
  if (!imdb && imdbId && !im.rating) {
    try {
      const meta = await getJson("https://cinemeta-live.strem.io/meta/movie/" + imdbId + ".json");
      const r = meta.meta && meta.meta.imdbRating;
      if (r && r !== "N/A") imdb = String(r);
    } catch {}
  }
  return { q: qstr, imdbId, imdb, csfdId: wd.csfd || "", csfd: fmtCsfd(wd.csfdScore) };
}

function matchFilmRow(q) {
  const sk = fold(stripPart(q.sk));
  const en = fold(stripPart(q.en));
  return (state.filmLinks || []).find((f) => (sk && fold(f.sk) === sk) || (en && f.en && fold(f.en) === en));
}

async function fillRatings(it, meta) {
  const seq = ++rateSeq;
  const box = $("ratings");
  if (!box) return;
  const names = it.raw.NameLocalized || {};
  const q = { en: names.English || "", sk: names.Slovak || "", orig: meta.orig || "", year: meta.year || 0 };
  const key = [q.orig, q.en, q.sk, q.year].join("|");
  const render = (d) => {
    if (seq !== rateSeq || !$("ratings")) return;
    const qenc = encodeURIComponent(d.q || q.en || q.sk);
    const imdbHref = d.imdbHref || (d.imdbId ? "https://www.imdb.com/title/" + d.imdbId + "/" : "https://www.imdb.com/find/?q=" + qenc);
    const csfdHref = d.csfdHref || (d.csfdId ? "https://www.csfd.cz/film/" + d.csfdId : "https://www.csfd.cz/hledat/?q=" + qenc);
    $("ratings").innerHTML = rateChip("IMDb", imdbHref, d.imdb) + rateChip("ČSFD", csfdHref, d.csfd);
  };
  if (rateCache.has(key)) { render(rateCache.get(key)); return; }
  try {
    const d = await withBusy(t("rateWait"), async () => {
      const row = matchFilmRow(q);
      if (row && (row.imdb || row.csfd)) {
        const imdbId = ((row.imdb || "").match(/tt\d+/) || [])[0] || "";
        let rating = "";
        if (imdbId) {
          try {
            const live = await getJson("https://cinemeta-live.strem.io/meta/movie/" + imdbId + ".json");
            const r = live.meta && live.meta.imdbRating;
            if (r && r !== "N/A") rating = String(r);
          } catch {}
        }
        return { q: q.orig || q.en || q.sk, imdb: rating, csfd: "", imdbHref: row.imdb, csfdHref: row.csfd };
      }
      return lookupRatings(q);
    });
    rateCache.set(key, d);
    render(d);
  } catch {
    if (seq !== rateSeq || !$("ratings")) return;
    const qenc = encodeURIComponent(q.orig || q.en || q.sk);
    $("ratings").innerHTML = rateChip("IMDb", "https://www.imdb.com/find/?q=" + qenc, "") + rateChip("ČSFD", "https://www.csfd.cz/hledat/?q=" + qenc, "");
  }
}

export { getJson, claimVal, p444, wdFind, cinemetaFind, rateChip, fmtCsfd, wdByImdb, lookupRatings, matchFilmRow, fillRatings };
