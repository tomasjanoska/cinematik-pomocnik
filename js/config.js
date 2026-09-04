const EVENT_ID = 21724;

const API = "https://inviton-cdn.azureedge.net/api/v1/EventSchedulePublic?EventId=" + EVENT_ID + "&Type=1&Language=sk";

const RES_API = "https://inviton.eu/api/v1/";

const TZ = "Europe/Bratislava";

const NIGHT_END = 2;

const LANE_GAP = 6;

const ROW_PAD = 8;

const FAV_KEY = "cinematik-favs";

const SET_KEY = "cinematik-settings";

const FIRED_KEY = "cinematik-notified";

const QR_SCAN_SRC = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

const INVITON_SITE = "https://inviton.eu";

const CINEMATIK_SITE = "https://cinematik.sk";

const APP_IOS = "https://apps.apple.com/us/app/cinematik/id1034732619";

const APP_ANDROID = "https://play.google.com/store/apps/details?id=com.inviton.cinematik2015";

const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 14.5 9l6.3.6-4.8 4.1 1.5 6.1L12 16.5 6.5 19.8 8 13.7 3.2 9.6 9.5 9z"/></svg>`;

const EXT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;

export { EVENT_ID, API, RES_API, TZ, NIGHT_END, LANE_GAP, ROW_PAD, FAV_KEY, SET_KEY, FIRED_KEY, QR_SCAN_SRC, INVITON_SITE, CINEMATIK_SITE, APP_IOS, APP_ANDROID, STAR, EXT };
