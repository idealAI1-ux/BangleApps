const Storage = require("Storage");
const locale = require("locale");
const SETTINGS_FILE = "prayertimes.settings.json";
const LOCATION_FILE = "mylocation.json";

const METHODS = {
  MWL: { fajr: 18, isha: 17 },
  ISNA: { fajr: 15, isha: 15 },
  Egypt: { fajr: 19.5, isha: 17.5 },
  Makkah: { fajr: 18.5, isha: 90 },
  Karachi: { fajr: 18, isha: 18 }
};

function loadSettings() {
  let s = Storage.readJSON(SETTINGS_FILE, 1) || {};
  if (!s.method) s.method = "MWL";
  if (!s.asr) s.asr = 1;
  return s;
}

function loadLocation() {
  let loc = Storage.readJSON(LOCATION_FILE, 1) || {};
  if (typeof loc.lat === "number" && typeof loc.lon === "number") return loc;
  return { lat: 40.7128, lon: -74.0060, location: "New York" };
}

function rad(d) { return d * Math.PI / 180; }
function deg(r) { return r * 180 / Math.PI; }
function dayOfYear(d) {
  return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86400000);
}
function normMin(m) {
  m = Math.round(m) % 1440;
  return m < 0 ? m + 1440 : m;
}
function fmt(m) {
  if (m === undefined || isNaN(m)) return "--:--";
  m = normMin(m);
  return ("0" + Math.floor(m / 60)).substr(-2) + ":" + ("0" + (m % 60)).substr(-2);
}
function clockMinutes(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function sunData(date, lat, lon) {
  let n = dayOfYear(date);
  let gamma = 2 * Math.PI / 365 * (n - 1);
  let eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  let decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  let tz = -date.getTimezoneOffset() / 60;
  return {
    decl: decl,
    noon: 720 - 4 * lon - eqTime + tz * 60,
    latRad: rad(lat)
  };
}

function hourAngleMinutes(sd, altitudeDeg) {
  let alt = rad(altitudeDeg);
  let c = (Math.sin(alt) - Math.sin(sd.latRad) * Math.sin(sd.decl)) /
    (Math.cos(sd.latRad) * Math.cos(sd.decl));
  if (c < -1 || c > 1) return undefined;
  return deg(Math.acos(c)) * 4;
}

function prayerTimes(date, loc, settings) {
  let method = METHODS[settings.method] || METHODS.MWL;
  let sd = sunData(date, loc.lat, loc.lon);
  let sunriseDiff = hourAngleMinutes(sd, -0.833);
  let fajrDiff = hourAngleMinutes(sd, -method.fajr);
  let ishaByAngle = method.isha < 24;
  let ishaDiff = ishaByAngle ? hourAngleMinutes(sd, -method.isha) : undefined;
  let latDec = Math.abs(sd.latRad - sd.decl);
  let asrAltitude = deg(Math.atan(1 / (settings.asr + Math.tan(latDec))));
  let asrDiff = hourAngleMinutes(sd, asrAltitude);
  let sunset = sunriseDiff === undefined ? undefined : sd.noon + sunriseDiff;

  return {
    Fajr: fajrDiff === undefined ? undefined : sd.noon - fajrDiff,
    Sunrise: sunriseDiff === undefined ? undefined : sd.noon - sunriseDiff,
    Dhuhr: sd.noon,
    Asr: asrDiff === undefined ? undefined : sd.noon + asrDiff,
    Maghrib: sunset,
    Isha: ishaByAngle ? (ishaDiff === undefined ? undefined : sd.noon + ishaDiff) :
      (sunset === undefined ? undefined : sunset + method.isha)
  };
}

let settings = loadSettings();
let loc = loadLocation();
let view = 0;
let drawTimeout;

function orderedTimes(date) {
  let today = prayerTimes(date, loc, settings);
  let tomorrow = prayerTimes(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1), loc, settings);
  let rows = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map(n => [n, today[n]]);
  rows.push(["Fajr", tomorrow.Fajr === undefined ? undefined : tomorrow.Fajr + 1440]);
  return rows;
}

function nextPrayer(now, rows) {
  for (let i = 0; i < rows.length; i++) {
    if (typeof rows[i][1] === "number" && !isNaN(rows[i][1]) && rows[i][1] >= now) return rows[i];
  }
  return undefined;
}

function drawList(date, times) {
  let y = Bangle.appRect.y + 8;
  g.setFontAlign(0, -1).setFont("6x8", 2);
  g.drawString(locale.date(date, 0), g.getWidth() / 2, y);
  y += 24;
  g.setFont("6x8", 2);
  ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach(name => {
    g.setFontAlign(-1, -1).drawString(name, 8, y);
    g.setFontAlign(1, -1).drawString(fmt(times[name]), g.getWidth() - 8, y);
    y += 22;
  });
}

function drawNext(date, times) {
  let nowMin = clockMinutes(date);
  let np = nextPrayer(nowMin, orderedTimes(date));
  if (!np) np = ["Dhuhr", times.Dhuhr];
  let left = np[1] - nowMin;
  let h = Math.floor(left / 60);
  let m = left % 60;
  let y = Bangle.appRect.y + 10;

  g.setFontAlign(0, -1).setFont("6x8", 2);
  g.drawString(locale.dow(date, 0).substr(0, 3).toUpperCase() + " " + locale.date(date, 0), g.getWidth() / 2, y);
  y += 28;
  g.setFont("Vector", 38);
  g.drawString(fmt(nowMin), g.getWidth() / 2, y);
  y += 52;
  g.setFont("6x8", 2);
  g.drawString(np[0] + " in", g.getWidth() / 2, y);
  y += 23;
  g.setFont("Vector", 30);
  g.drawString(("0" + h).substr(-2) + ":" + ("0" + m).substr(-2), g.getWidth() / 2, y);
  y += 42;
  g.setFont("6x8", 1);
  g.drawString((loc.location || "Location") + "  " + settings.method, g.getWidth() / 2, y);
}

function draw() {
  let date = new Date();
  let times = prayerTimes(date, loc, settings);
  g.reset().clearRect(Bangle.appRect);
  if (view) drawList(date, times);
  else drawNext(date, times);
  if (drawTimeout) clearTimeout(drawTimeout);
  drawTimeout = setTimeout(function() {
    drawTimeout = undefined;
    draw();
  }, 60000 - (Date.now() % 60000));
}

function toggleView() {
  view = view ? 0 : 1;
  draw();
}

Bangle.loadWidgets();
Bangle.setUI({ mode: "custom", touch: toggleView, btn: toggleView, swipe: toggleView });
draw();
setTimeout(Bangle.drawWidgets, 0);
