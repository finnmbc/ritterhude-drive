/* global Cesium */

// =====================================================
// ✅ TOKEN (dein Token)
// =====================================================
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMmQ3Yjg4Yy1kNjM1LTQxNmMtOTY0Ny0zZTQ1Zjc3ZmFmZDkiLCJpZCI6MzgzMTIzLCJpYXQiOjE3NjkzMzAwNjl9.c43M7EsxX_pY7z9RndXbP6y9QiKqR5ST3a7nlT8Tk90";

// alte HUDs entfernen
document.querySelectorAll(".hud").forEach((el) => el.remove());

// =====================================================
// ✅ INPUT-LOCK: während tippen ODER Map offen -> KEINE Keyboard-Aktionen/Steuerung
// (UI-Buttons dürfen aber trotzdem klicken!)
// =====================================================
function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
}
function isMapOpen() {
  const ov = document.getElementById("bigMapOverlay");
  return !!ov && ov.style.display !== "none";
}
function keyboardBlocked() {
  return isTyping() || isMapOpen();
}

// =====================================================
// VIEWER (MAIN)
// =====================================================
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  timeline: false,
  animation: false,
  shouldAnimate: true,
});
viewer.scene.globe.depthTestAgainstTerrain = true;

// ✅ MAIN IMAGERY ohne Labels (keine Straßennamen)
(async () => {
  try {
    if (Cesium.createWorldImageryAsync && Cesium.IonWorldImageryStyle) {
      const imagery = await Cesium.createWorldImageryAsync({
        style: Cesium.IonWorldImageryStyle.AERIAL,
      });
      viewer.imageryLayers.removeAll(true);
      viewer.imageryLayers.addImageryProvider(imagery);
    }
  } catch (e) {
    console.warn("Main Imagery konnte nicht geladen werden:", e);
  }
})();

(async () => {
  try {
    const buildings = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(buildings);
  } catch (e) {
    console.warn("OSM Buildings konnten nicht geladen werden:", e);
  }
})();

// =====================================================
// STARTPUNKT
// =====================================================
const startLat = 53.17992830092991;
const startLon = 8.754863617225599;
const REWE_HEADING_DEG = 45;

// =====================================================
// SPAWNPOINTS
// =====================================================
const SPAWN1 = { lat: 53.18167657056033, lon: 8.739374157976243, headingDeg: 20 }; // KONA
const SPAWN2 = { lat: 53.18493709131292, lon: 8.71229577112801, headingDeg: 8.5 }; // BENZ
const SPAWN3 = { lat: 53.18605835934793, lon: 8.745079683720112, headingDeg: 90 }; // BULLI
const CLASS_SPAWNS = { KONA: SPAWN1, BENZ: SPAWN2, BULLI: SPAWN3 };

// =====================================================
// SPEED
// =====================================================
const SPEED_FEEL_SCALE = 1.125;
const VMAX_KMH = 190.0;

// =====================================================
// MODELLE
// =====================================================
const CAR_KONA_GLB = "2025_hyundai_kona_n_line.glb";
const CAR_BENZ_GLB = "mercedes-amg_e_63_s_w213.glb";
const CAR_BULLI_GLB = "volkswagen_transporter_mk5_t5_2003-2015.glb";

// =====================================================
// PRO-AUTO SETTINGS
// =====================================================
const CAR_CONFIGS = {
  KONA: {
    name: "KONA",
    uri: CAR_KONA_GLB,
    modelScale: 100.0,
    zLift: -0.125,
    yawOffsetDeg: 270,
    camScreenRightOffsetM: 0.0,
    camRearDistBase: 18,
    camRearDistAdd: 7,
    camHeightBase: 5,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -15,
    camPitchAddDeg: 0.5,
    topHeightBase: 55,
    topHeightAdd: 120,
  },
  BENZ: {
    name: "BENZ",
    uri: CAR_BENZ_GLB,
    modelScale: 0.25,
    zLift: -2.5,
    yawOffsetDeg: 90,
    pitchOffsetDeg: -0.25,
    camScreenRightOffsetM: -1.25,
    camRearDistBase: 18,
    camRearDistAdd: 7,
    camHeightBase: 5,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -15,
    camPitchAddDeg: 0.5,
    topHeightBase: 45,
    topHeightAdd: 110,
  },
  BULLI: {
    name: "BULLI",
    uri: CAR_BULLI_GLB,
    modelScale: 0.325,
    zLift: 0.75,
    yawOffsetDeg: 270,
    pitchOffsetDeg: 90,
    rollOffsetDeg: 0,
    camScreenRightOffsetM: 0.0,
    camRearDistBase: 18,
    camRearDistAdd: 7,
    camHeightBase: 5,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -15,
    camPitchAddDeg: 0.5,
    topHeightBase: 45,
    topHeightAdd: 110,
  },
};

// =====================================================
// ✅ NAMEN statt ID
// =====================================================
const PLAYER_NAMES = { KONA: "David", BENZ: "Finn", BULLI: "Tammo" };
function playerLabel(carKey) {
  const n = PLAYER_NAMES[carKey] || "Spieler";
  return `${n} (${carKey})`;
}

// =====================================================
// STATE
// =====================================================
let carLon = startLon;
let carLat = startLat;
let heading = Cesium.Math.toRadians(REWE_HEADING_DEG);
let speed = 0.0;

let activeCarKey = "KONA";
let activeCfg = CAR_CONFIGS[activeCarKey];
let car = null;

// Controls state (nur keyboard)
const keys = {};
window.addEventListener("keydown", (e) => {
  if (keyboardBlocked()) return;
  keys[e.code] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// =====================================================
// ✅ AUDIO: HUPE + RADIO
// =====================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
function playHorn({ volume = 1.0, durationMs = 180 } = {}) {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o1.type = "sawtooth";
  o2.type = "square";
  o1.frequency.value = 440;
  o2.frequency.value = 554.37;
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  o1.connect(g);
  o2.connect(g);
  g.connect(ctx.destination);
  o1.start(now);
  o2.start(now);
  o1.stop(now + durationMs / 1000 + 0.03);
  o2.stop(now + durationMs / 1000 + 0.03);
}
function playHornAt(lat, lon) {
  if (!joinAccepted) return playHorn({ volume: 0.7 });
  const d = haversineMeters(carLat, carLon, lat, lon);
  const vol = Cesium.Math.clamp(1.0 - d / 250.0, 0.0, 1.0);
  if (vol > 0.02) playHorn({ volume: 0.85 * vol });
}

const RADIO_URL =
  "https://deltaradio.streamabc.net/regc-deltaliveshsued-mp3-192-5217032?sABC=69760sq9%230%2348n65pq574n0265p66ps4so725n56s76%23&aw_0_1st.playerid=&amsparams=playerid:;skey:1769344985";

let radio = null;
let radioOn = false;
function ensureRadio() {
  if (radio) return radio;
  radio = new Audio(RADIO_URL);
  radio.crossOrigin = "anonymous";
  radio.volume = 0.25;
  return radio;
}
async function toggleRadio() {
  const r = ensureRadio();
  try {
    if (!radioOn) {
      const p = r.play();
      if (p?.then) await p;
      radioOn = true;
      setMenuHint("Radio: AN");
    } else {
      r.pause();
      radioOn = false;
      setMenuHint("Radio: AUS");
    }
  } catch (err) {
    console.warn("Radio konnte nicht starten:", err);
    setMenuHint("Radio blockiert (Autoplay). Drück Q nochmal.", true);
  }
}

// =====================================================
// HELPERS
// =====================================================
const metersPerDegLat = 111320;
function metersPerDegLon(latDeg) {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}
let carHeight = 0;
let heightReady = false;
let heightTimer = 0;

function getHeightFallback() {
  const c = Cesium.Cartographic.fromDegrees(carLon, carLat);
  const h = viewer.scene.globe.getHeight(c);
  return Number.isFinite(h) ? h : null;
}
async function updateHeight() {
  try {
    const positions = [Cesium.Cartographic.fromDegrees(carLon, carLat)];
    const updated = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
    const h = updated[0].height;
    carHeight = Number.isFinite(h) ? h : (getHeightFallback() ?? 0);
    heightReady = true;
  } catch {
    const fb = getHeightFallback();
    if (fb !== null) {
      carHeight = fb;
      heightReady = true;
    } else {
      heightReady = false;
    }
  }
}
function isStopped() {
  return Math.abs(speed) < 0.25;
}

// =====================================================
// ENTITY CREATE / SPAWN
// =====================================================
function createCarEntity(cfg) {
  return viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(carLon, carLat, 0),
    model: { uri: cfg.uri, minimumPixelSize: 0, scale: cfg.modelScale },
    box: {
      dimensions: new Cesium.Cartesian3(2.2, 5.0, 1.5),
      material: Cesium.Color.RED.withAlpha(0.05),
      outline: true,
      outlineColor: Cesium.Color.BLACK.withAlpha(0.22),
    },
  });
}

let gear = "D";
let sArmed = false;
let wArmed = false;

async function spawnCar({ lat, lon, carKey, headingDeg = REWE_HEADING_DEG, resetCam = true }) {
  activeCarKey = carKey;
  activeCfg = CAR_CONFIGS[activeCarKey];

  carLat = lat;
  carLon = lon;
  heading = Cesium.Math.toRadians(headingDeg);

  speed = 0;
  gear = "D";
  sArmed = false;
  wArmed = false;

  if (car) viewer.entities.remove(car);
  car = createCarEntity(activeCfg);

  await updateHeight();

  if (resetCam) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(carLon, carLat, 900),
      orientation: { heading: heading, pitch: Cesium.Math.toRadians(-35), roll: 0 },
      duration: 0.6,
    });
  }
}

// =====================================================
// MULTIPLAYER
// =====================================================
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
const ws = new WebSocket(WS_URL);

let wsOpen = false;
let myId = null;

let joinPending = false;
let joinAccepted = false;

let classTaken = { KONA: false, BENZ: false, BULLI: false };

const menuButtons = new Map();
let menuHintEl = null;

function setMenuHint(text, isError = false) {
  if (!menuHintEl) return;
  menuHintEl.textContent = text;
  menuHintEl.style.opacity = "0.9";
  menuHintEl.style.color = isError ? "salmon" : "white";
}
function applyClassStatusToMenu() {
  for (const [carKey, btn] of menuButtons.entries()) {
    const taken = !!classTaken[carKey];
    const disabled = taken || joinPending || joinAccepted || !wsOpen;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? "0.45" : "1";
    btn.style.cursor = disabled ? "not-allowed" : "pointer";
    btn.textContent = btn.dataset.baseLabel + (taken ? "  (BELEGT)" : "");
  }
}
function cfgByKey(carKey) {
  return CAR_CONFIGS[carKey] ?? CAR_CONFIGS.KONA;
}

const remotePlayers = new Map();

function createRemoteCarEntity(cfg, lat, lon, h, groundH = 0) {
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, groundH + (cfg.zLift ?? 0));
  const ent = viewer.entities.add({
    position: pos,
    model: { uri: cfg.uri, minimumPixelSize: 0, scale: cfg.modelScale },
  });

  const modelYawOffset = Cesium.Math.toRadians(cfg.yawOffsetDeg ?? 0);
  const modelPitchOffset = Cesium.Math.toRadians(cfg.pitchOffsetDeg ?? 0);
  const modelRollOffset = Cesium.Math.toRadians(cfg.rollOffsetDeg ?? 0);
  const hpr = new Cesium.HeadingPitchRoll(h + modelYawOffset, modelPitchOffset, modelRollOffset);
  ent.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
  return ent;
}

ws.addEventListener("open", () => {
  wsOpen = true;
  applyClassStatusToMenu();
  if (menuHintEl && !joinAccepted) setMenuHint("Verbunden. Wähle eine Klasse.");
});
ws.addEventListener("close", () => {
  wsOpen = false;
  applyClassStatusToMenu();
  if (menuHintEl && !joinAccepted) setMenuHint("Server getrennt.", true);
});

let playersDirtyForUi = true;

ws.addEventListener("message", async (ev) => {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch {
    return;
  }

  if (msg.type === "hello") {
    myId = msg.id;
    return;
  }

  if (msg.type === "class_status") {
    classTaken = msg.taken || classTaken;
    applyClassStatusToMenu();
    return;
  }

  if (msg.type === "join_denied") {
    joinPending = false;
    applyClassStatusToMenu();
    if (msg.reason === "class_taken") setMenuHint("Diese Klasse ist schon belegt. Wähle eine andere.", true);
    else if (msg.reason === "already_joined") setMenuHint("Du bist schon im Spiel.", true);
    else setMenuHint("Join abgelehnt.", true);
    return;
  }

  if (msg.type === "join_accepted") {
    joinPending = false;
    joinAccepted = true;
    applyClassStatusToMenu();

    const carKey = msg.carKey;
    const sp = msg.spawn;

    await spawnCar({
      lat: sp.lat,
      lon: sp.lon,
      carKey,
      headingDeg: sp.headingDeg,
      resetCam: true,
    });

    const ov = document.getElementById("carSelectOverlay");
    if (ov) ov.remove();
    playersDirtyForUi = true;
    return;
  }

  if (msg.type === "player_left") {
    const rp = remotePlayers.get(msg.id);
    if (rp?.entity) viewer.entities.remove(rp.entity);
    remotePlayers.delete(msg.id);
    playersDirtyForUi = true;

    if (navFollowCarKey) {
      const still = [...remotePlayers.values()].some((x) => x.cfgKey === navFollowCarKey);
      if (!still) {
        navFollowCarKey = null;
        if (navDestMode === "follow") {
          navDest = null;
          navDestMode = null;
        }
      }
    }
    return;
  }

  if (msg.type === "horn") {
    if (msg.id != null && msg.id === myId) return;
    if (Number.isFinite(msg.lat) && Number.isFinite(msg.lon)) playHornAt(msg.lat, msg.lon);
    else playHorn({ volume: 0.35 });
    return;
  }

  if (msg.type === "snapshot") {
    const arr = msg.players || [];
    for (const p of arr) {
      if (!p?.id || p.id === myId) continue;

      const cfg = cfgByKey(p.carKey);

      if (!remotePlayers.has(p.id)) {
        const entity = createRemoteCarEntity(cfg, p.lat, p.lon, p.heading, 0);
        remotePlayers.set(p.id, {
          entity,
          cfgKey: p.carKey,
          target: { ...p },
          curLat: p.lat,
          curLon: p.lon,
          curHeading: p.heading,
        });
        playersDirtyForUi = true;
      } else {
        const rp = remotePlayers.get(p.id);
        if (rp.cfgKey !== p.carKey) {
          viewer.entities.remove(rp.entity);
          rp.entity = createRemoteCarEntity(cfg, p.lat, p.lon, p.heading, 0);
          rp.cfgKey = p.carKey;
          rp.curLat = p.lat;
          rp.curLon = p.lon;
          rp.curHeading = p.heading;
          playersDirtyForUi = true;
        }
        rp.target = { ...p };
      }
    }
  }
});

// =====================================================
// ✅ NAVI / FOLLOW (Toggle = UNFOLLOW) + Ziel löschen wenn UNFOLLOW (nur Follow-Ziel)
// =====================================================
let navDest = null;
let navFollowCarKey = null;
let navDestMode = null; // "manual" | "follow" | null

function clearNav() {
  navDest = null;
  navFollowCarKey = null;
  navDestMode = null;
}
function setNavDestination(lat, lon) {
  navFollowCarKey = null;
  navDest = { lat, lon };
  navDestMode = "manual";
}
function toggleFollow(carKey) {
  if (!carKey) return;

  if (navFollowCarKey === carKey) {
    // UNFOLLOW
    navFollowCarKey = null;
    if (navDestMode === "follow") {
      navDest = null; // ✅ Ziel entfernen beim Unfollow
      navDestMode = null;
    }
  } else {
    // FOLLOW
    navFollowCarKey = carKey;
    navDestMode = "follow";
  }

  playersDirtyForUi = true;
}

// =====================================================
// ✅ START-MENU
// =====================================================
function showCarSelectMenu() {
  if (document.getElementById("carSelectOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "carSelectOverlay";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.68)";
  overlay.style.zIndex = "10001";
  overlay.style.userSelect = "none";

  const panel = document.createElement("div");
  panel.style.width = "min(540px, 92vw)";
  panel.style.borderRadius = "18px";
  panel.style.padding = "18px";
  panel.style.background = "rgba(16,16,16,0.88)";
  panel.style.border = "1px solid rgba(255,255,255,0.14)";
  panel.style.boxShadow = "0 20px 70px rgba(0,0,0,0.6)";
  panel.style.color = "white";
  panel.style.font = "600 15px/1.35 system-ui, Arial";

  const title = document.createElement("div");
  title.textContent = "Ritterhude Drive";
  title.style.fontSize = "22px";
  title.style.marginBottom = "8px";

  const sub = document.createElement("div");
  sub.textContent = "Wähle eine Klasse. Jede Klasse kann nur einmal vergeben werden.";
  sub.style.opacity = "0.85";
  sub.style.marginBottom = "14px";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "1fr";
  grid.style.gap = "10px";

  menuButtons.clear();

  menuHintEl = document.createElement("div");
  menuHintEl.style.marginTop = "12px";
  menuHintEl.style.opacity = ".75";
  menuHintEl.style.fontSize = "12px";
  menuHintEl.textContent = wsOpen ? "Verbunden. Wähle eine Klasse." : "Verbinde zum Server…";

  function makeBtn(label, carKey) {
    const btn = document.createElement("button");
    btn.dataset.baseLabel = label;
    btn.textContent = label;
    btn.style.width = "100%";
    btn.style.padding = "12px 14px";
    btn.style.borderRadius = "14px";
    btn.style.border = "1px solid rgba(255,255,255,0.18)";
    btn.style.background = "rgba(255,255,255,0.08)";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.font = "800 15px system-ui, Arial";

    btn.onclick = () => {
      if (joinPending || joinAccepted) return;
      if (!wsOpen) return setMenuHint("Server nicht verbunden…", true);
      if (classTaken[carKey]) return setMenuHint("Diese Klasse ist schon belegt.", true);

      joinPending = true;
      setMenuHint("Reserviere Klasse…");
      applyClassStatusToMenu();
      ws.send(JSON.stringify({ type: "join_request", carKey }));
    };

    menuButtons.set(carKey, btn);
    applyClassStatusToMenu();
    return btn;
  }

  grid.appendChild(makeBtn("David (Kona)", "KONA"));
  grid.appendChild(makeBtn("Finn (Benz)", "BENZ"));
  grid.appendChild(makeBtn("Tammo (Bulli)", "BULLI"));

  const hint = document.createElement("div");
  hint.innerHTML = `<div style="margin-top:12px; opacity:.75; font-size:12px;">
      Steuerung: W/A/S/D • Kamera: Pfeile halten • REWE: <b>R</b> • Hupe: <b>E</b> • Radio: <b>Q</b> • Map: <b>M</b><br>
      Minimap: Klick = große Map öffnen
    </div>`;

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(hint);
  panel.appendChild(menuHintEl);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  applyClassStatusToMenu();
}
showCarSelectMenu();

// =====================================================
// CAMERA VIEWS (Pfeile halten)
// =====================================================
const DEFAULT_CAM_VIEW = "rear";
let camView = DEFAULT_CAM_VIEW;
let camHold = null;

function setHoldFromArrow(code) {
  if (code === "ArrowDown") return "front";
  if (code === "ArrowUp") return "top";
  if (code === "ArrowLeft") return "left";
  if (code === "ArrowRight") return "right";
  return null;
}

let camDistCur = 22;
let camHeightCur = 12;
let camPitchDegCur = -20;
let topHeightCur = 55;

window.addEventListener("keydown", (e) => {
  if (keyboardBlocked()) return;
  if (e.code.startsWith("Arrow")) e.preventDefault();
  const v = setHoldFromArrow(e.code);
  if (v) {
    camHold = v;
    camView = v;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code.startsWith("Arrow")) e.preventDefault();
  const v = setHoldFromArrow(e.code);
  if (v && camHold === v) {
    camHold = null;
    camView = DEFAULT_CAM_VIEW;
  }
});

// =====================================================
// HUD
// =====================================================
const hudControls = document.createElement("div");
hudControls.style.position = "absolute";
hudControls.style.left = "12px";
hudControls.style.top = "12px";
hudControls.style.padding = "10px 12px";
hudControls.style.borderRadius = "12px";
hudControls.style.background = "rgba(0,0,0,0.55)";
hudControls.style.color = "white";
hudControls.style.font = "600 14px/1.3 system-ui, Arial";
hudControls.style.zIndex = "9999";
hudControls.style.userSelect = "none";
hudControls.innerHTML =
  `W/A/S/D = Fahren<br>Pfeile = Kamera halten<br>R = REWE<br>E = Hupe<br>Q = Radio<br>M = Map/Navi`;
document.body.appendChild(hudControls);

const hudSpeed = document.createElement("div");
hudSpeed.style.position = "absolute";
hudSpeed.style.left = "50%";
hudSpeed.style.bottom = "18px";
hudSpeed.style.transform = "translateX(-50%)";
hudSpeed.style.padding = "10px 14px";
hudSpeed.style.borderRadius = "12px";
hudSpeed.style.background = "rgba(0,0,0,0.55)";
hudSpeed.style.color = "white";
hudSpeed.style.font = "600 18px/1.1 system-ui, Arial";
hudSpeed.style.zIndex = "9999";
hudSpeed.style.userSelect = "none";
hudSpeed.textContent = "0 km/h";
document.body.appendChild(hudSpeed);

// ✅ Player-Liste oben rechts (FOLLOW/UNFOLLOW only; ZENTRIEREN hier entfernt)
const hudPlayers = document.createElement("div");
hudPlayers.style.position = "absolute";
hudPlayers.style.right = "14px";
hudPlayers.style.top = "12px";
hudPlayers.style.padding = "10px 12px";
hudPlayers.style.borderRadius = "12px";
hudPlayers.style.background = "rgba(0,0,0,0.55)";
hudPlayers.style.color = "white";
hudPlayers.style.font = "700 13px/1.25 system-ui, Arial";
hudPlayers.style.zIndex = "9999";
hudPlayers.style.userSelect = "none";
hudPlayers.innerHTML = "Spieler: –";
document.body.appendChild(hudPlayers);

// =====================================================
// MINIMAP (nur anzeigen + klicken -> große Map)
// =====================================================
const miniDiv = document.createElement("div");
miniDiv.id = "miniMap";
miniDiv.style.position = "absolute";
miniDiv.style.right = "14px";
miniDiv.style.bottom = "14px";
miniDiv.style.width = "260px";
miniDiv.style.height = "180px";
miniDiv.style.borderRadius = "14px";
miniDiv.style.overflow = "hidden";
miniDiv.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
miniDiv.style.zIndex = "9998";
miniDiv.style.border = "1px solid rgba(255,255,255,0.12)";
miniDiv.style.pointerEvents = "auto";
document.body.appendChild(miniDiv);

const miniViewer = new Cesium.Viewer("miniMap", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  timeline: false,
  animation: false,
  shouldAnimate: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  infoBox: false,
  selectionIndicator: false,
  fullscreenButton: false,
  vrButton: false,
});
miniViewer.scene.globe.depthTestAgainstTerrain = true;

miniViewer.scene.screenSpaceCameraController.enableRotate = false;
miniViewer.scene.screenSpaceCameraController.enableTilt = false;
miniViewer.scene.screenSpaceCameraController.enableTranslate = false;
miniViewer.scene.screenSpaceCameraController.enableZoom = false;
miniViewer.scene.screenSpaceCameraController.enableLook = false;

(async () => {
  try {
    if (Cesium.createWorldImageryAsync && Cesium.IonWorldImageryStyle) {
      const road = await Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.ROAD });
      miniViewer.imageryLayers.removeAll(true);
      miniViewer.imageryLayers.addImageryProvider(road);
    }
  } catch (e) {
    console.warn("Minimap ROAD Layer konnte nicht geladen werden:", e);
  }
})();

const miniCross = document.createElement("div");
miniCross.style.position = "absolute";
miniCross.style.left = "50%";
miniCross.style.top = "50%";
miniCross.style.width = "10px";
miniCross.style.height = "10px";
miniCross.style.transform = "translate(-50%,-50%)";
miniCross.style.borderRadius = "50%";
miniCross.style.border = "2px solid rgba(255,255,255,0.85)";
miniCross.style.boxShadow = "0 0 10px rgba(0,0,0,0.45)";
miniCross.style.pointerEvents = "none";
miniDiv.appendChild(miniCross);

// ✅ Minimap Ziel: wenn außerhalb -> Pfeil am Rand; wenn drin -> Zielpunkt (plus grüner Pfeil zeigt auf Auto)
const miniNav = { destEnt: null, arrowEl: null };
(function initMiniNavArrow() {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = "50%";
  el.style.top = "50%";
  el.style.width = "0";
  el.style.height = "0";
  el.style.borderLeft = "8px solid transparent";
  el.style.borderRight = "8px solid transparent";
  el.style.borderBottom = "14px solid rgba(255,255,255,0.95)";
  el.style.filter = "drop-shadow(0 2px 6px rgba(0,0,0,0.55))";
  el.style.transform = "translate(-50%,-50%) rotate(0rad)";
  el.style.pointerEvents = "none";
  el.style.display = "none";
  miniDiv.appendChild(el);
  miniNav.arrowEl = el;
})();

miniDiv.addEventListener("click", (e) => {
  e.preventDefault();
  if (isTyping()) return;
  toggleBigMap(true);
});
miniDiv.addEventListener("contextmenu", (e) => e.preventDefault());

// Minimap Zoom
let miniAutoZoom = true;
let miniHeightCur = 360;
let miniManualHeight = 360;
const MINI_MIN_H = 180;
const MINI_MAX_H = 1600;

function isPlusKey(e) {
  return e.key === "+" || e.code === "NumpadAdd";
}
function isMinusKey(e) {
  return e.key === "-" || e.code === "NumpadSubtract";
}
function isUmlautA(e) {
  return e.key === "ä" || e.key === "Ä" || e.code === "Quote";
}

// =====================================================
// ✅ GROßE MAP (Buttons sollen 1x reichen → kein UI-Neurender mitten im Klick)
// =====================================================
let mapOverlay = null;
let mapViewer = null;
let mapMsg = null;
let mapSearchInput = null;

const mapEntities = { me: null, dest: null };
const mapRemoteEntities = new Map(); // carKey -> entity

function centerBigMapOn(lat, lon, height = 1400) {
  if (!mapViewer) return;
  mapViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
    duration: 0.35,
  });
}
function centerBigMapOnCarKey(carKey) {
  if (!mapViewer) return;

  if (carKey === activeCarKey) {
    centerBigMapOn(carLat, carLon, 1400);
    return;
  }
  const rp = [...remotePlayers.values()].find((x) => x.cfgKey === carKey);
  if (rp) centerBigMapOn(rp.curLat, rp.curLon, 1400);
}

function ensureMapOverlay() {
  if (mapOverlay) return;

  mapOverlay = document.createElement("div");
  mapOverlay.id = "bigMapOverlay";
  mapOverlay.style.position = "absolute";
  mapOverlay.style.inset = "0";
  mapOverlay.style.background = "rgba(0,0,0,0.72)";
  mapOverlay.style.zIndex = "10002";
  mapOverlay.style.display = "none";

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.transform = "translate(-50%,-50%)";
  panel.style.width = "min(1100px, 94vw)";
  panel.style.height = "min(720px, 88vh)";
  panel.style.background = "rgba(16,16,16,0.92)";
  panel.style.border = "1px solid rgba(255,255,255,0.14)";
  panel.style.borderRadius = "18px";
  panel.style.boxShadow = "0 20px 70px rgba(0,0,0,0.6)";
  panel.style.overflow = "hidden";

  const topbar = document.createElement("div");
  topbar.style.display = "flex";
  topbar.style.gap = "12px";
  topbar.style.alignItems = "center";
  topbar.style.padding = "16px 12px 14px";
  topbar.style.borderBottom = "1px solid rgba(255,255,255,0.12)";
  topbar.style.color = "white";
  topbar.style.font = "700 14px system-ui, Arial";

  const title = document.createElement("div");
  title.textContent = "Map / Navi (M oder ESC zum Schließen)";
  title.style.opacity = "0.95";
  title.style.flex = "0 0 auto";

  const input = document.createElement("input");
  mapSearchInput = input;
  input.placeholder = "Adresse suchen (z.B. 'Bremen Hbf' oder 'Ritterhude')";
  input.style.flex = "1 1 auto";
  input.style.padding = "10px 12px";
  input.style.borderRadius = "12px";
  input.style.border = "1px solid rgba(255,255,255,0.18)";
  input.style.background = "rgba(255,255,255,0.08)";
  input.style.color = "white";
  input.style.outline = "none";
  input.style.font = "700 14px system-ui, Arial";

  const mkBtn = (label, strong = false) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.padding = "10px 12px";
    b.style.borderRadius = "12px";
    b.style.border = "1px solid rgba(255,255,255,0.18)";
    b.style.background = strong ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)";
    b.style.color = "white";
    b.style.cursor = "pointer";
    b.style.font = "900 14px system-ui, Arial";
    return b;
  };

  const btnSearch = mkBtn("Suchen");
  const btnSet = mkBtn("Ziel hier (Mitte)", true);
  const btnClear = mkBtn("Ziel löschen");
  const btnClose = mkBtn("Schließen");

  topbar.appendChild(title);
  topbar.appendChild(input);
  topbar.appendChild(btnSearch);
  topbar.appendChild(btnSet);
  topbar.appendChild(btnClear);
  topbar.appendChild(btnClose);

  const body = document.createElement("div");
  body.style.position = "absolute";
  body.style.left = "0";
  body.style.right = "0";
  body.style.top = "72px";
  body.style.bottom = "0";
  body.style.display = "grid";
  body.style.gridTemplateColumns = "1fr 320px";

  const mapWrap = document.createElement("div");
  mapWrap.style.position = "relative";
  mapWrap.style.height = "100%";
  mapWrap.style.borderRight = "1px solid rgba(255,255,255,0.10)";

  const mapDiv = document.createElement("div");
  mapDiv.id = "bigMapCesium";
  mapDiv.style.position = "absolute";
  mapDiv.style.inset = "0";
  mapWrap.appendChild(mapDiv);

  const mapCross = document.createElement("div");
  mapCross.style.position = "absolute";
  mapCross.style.left = "50%";
  mapCross.style.top = "50%";
  mapCross.style.width = "14px";
  mapCross.style.height = "14px";
  mapCross.style.transform = "translate(-50%,-50%)";
  mapCross.style.borderRadius = "50%";
  mapCross.style.border = "2px solid rgba(255,255,255,0.85)";
  mapCross.style.boxShadow = "0 0 12px rgba(0,0,0,0.6)";
  mapCross.style.pointerEvents = "none";
  mapWrap.appendChild(mapCross);

  mapMsg = document.createElement("div");
  mapMsg.style.position = "absolute";
  mapMsg.style.left = "12px";
  mapMsg.style.bottom = "12px";
  mapMsg.style.padding = "8px 10px";
  mapMsg.style.borderRadius = "12px";
  mapMsg.style.background = "rgba(0,0,0,0.55)";
  mapMsg.style.border = "1px solid rgba(255,255,255,0.12)";
  mapMsg.style.color = "white";
  mapMsg.style.font = "700 12px system-ui, Arial";
  mapMsg.style.opacity = "0.85";
  mapMsg.textContent = "Ziehen = bewegen • Mausrad = Zoom • „Ziel hier“ setzt Ziel • Follow via Buttons rechts";
  mapWrap.appendChild(mapMsg);

  const side = document.createElement("div");
  side.style.padding = "12px";
  side.style.color = "white";
  side.style.font = "800 13px system-ui, Arial";
  side.style.overflow = "auto";

  const sideTitle = document.createElement("div");
  sideTitle.textContent = "Spieler";
  sideTitle.style.opacity = "0.9";
  sideTitle.style.marginBottom = "10px";

  const sideList = document.createElement("div");
  sideList.id = "bigMapPlayersList";
  sideList.style.display = "grid";
  sideList.style.gap = "8px";

  side.appendChild(sideTitle);
  side.appendChild(sideList);

  body.appendChild(mapWrap);
  body.appendChild(side);

  panel.appendChild(topbar);
  panel.appendChild(body);
  mapOverlay.appendChild(panel);
  document.body.appendChild(mapOverlay);

  mapViewer = new Cesium.Viewer("bigMapCesium", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
    shouldAnimate: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    infoBox: false,
    selectionIndicator: false,
    fullscreenButton: false,
    vrButton: false,
  });
  mapViewer.scene.globe.depthTestAgainstTerrain = true;

  const ctrl = mapViewer.scene.screenSpaceCameraController;
  ctrl.enableRotate = false;
  ctrl.enableTilt = false;
  ctrl.enableLook = false;
  ctrl.enableZoom = true;
  ctrl.enableTranslate = true;

  // ✅ Linke Maustaste ziehen = verschieben
  if (ctrl.translateEventTypes && Cesium.CameraEventType) {
    ctrl.translateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  }

  (async () => {
    try {
      if (Cesium.createWorldImageryAsync && Cesium.IonWorldImageryStyle) {
        const road = await Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.ROAD });
        mapViewer.imageryLayers.removeAll(true);
        mapViewer.imageryLayers.addImageryProvider(road);
      }
    } catch (e) {
      console.warn("Big Map ROAD Layer konnte nicht geladen werden:", e);
    }
  })();

  function refreshBigMapPlayers() {
    const list = document.getElementById("bigMapPlayersList");
    if (!list) return;
    list.innerHTML = "";

    const mkRow = (label, carKey, isMe = false) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.padding = "10px";
      row.style.borderRadius = "12px";
      row.style.border = "1px solid rgba(255,255,255,0.14)";
      row.style.background = "rgba(255,255,255,0.06)";

      const left = document.createElement("div");
      left.textContent = label;
      left.style.font = "900 13px system-ui, Arial";
      left.style.opacity = isMe ? "0.9" : "1";

      const btnCenter = document.createElement("button");
      btnCenter.textContent = "ZENTRIEREN";
      btnCenter.style.padding = "8px 10px";
      btnCenter.style.borderRadius = "12px";
      btnCenter.style.border = "1px solid rgba(255,255,255,0.16)";
      btnCenter.style.background = "rgba(255,255,255,0.08)";
      btnCenter.style.color = "white";
      btnCenter.style.cursor = "pointer";
      btnCenter.style.font = "900 12px system-ui, Arial";
      btnCenter.onclick = () => {
        centerBigMapOnCarKey(isMe ? activeCarKey : carKey);
      };

      const btnFollow = document.createElement("button");
      const isFollow = navFollowCarKey === carKey;
      btnFollow.textContent = isFollow ? "UNFOLLOW" : "FOLLOW";
      btnFollow.style.padding = "8px 10px";
      btnFollow.style.borderRadius = "12px";
      btnFollow.style.border = "1px solid rgba(255,255,255,0.16)";
      btnFollow.style.background = isFollow ? "rgba(255,120,120,0.18)" : "rgba(120,255,120,0.18)";
      btnFollow.style.color = "white";
      btnFollow.style.cursor = isMe ? "not-allowed" : "pointer";
      btnFollow.style.opacity = isMe ? "0.4" : "1";
      btnFollow.style.font = "950 12px system-ui, Arial";
      btnFollow.disabled = isMe;
      btnFollow.onclick = () => {
        toggleFollow(carKey); // ✅ synced mit playerlist
        if (navFollowCarKey) mapMsg.textContent = `FOLLOW: ${playerLabel(navFollowCarKey)}`;
        else mapMsg.textContent = "FOLLOW aus.";
      };

      row.appendChild(left);
      row.appendChild(btnCenter);
      row.appendChild(btnFollow);
      return row;
    };

    if (joinAccepted) list.appendChild(mkRow(`🟦 ${playerLabel(activeCarKey)} (DU)`, activeCarKey, true));

    const seen = new Set();
    for (const [, rp] of remotePlayers) {
      const ck = rp.cfgKey;
      if (!ck || seen.has(ck)) continue;
      seen.add(ck);
      list.appendChild(mkRow(`🟧 ${playerLabel(ck)}`, ck, false));
    }

    if (!seen.size) {
      const none = document.createElement("div");
      none.textContent = "Keine anderen Spieler online.";
      none.style.opacity = "0.75";
      none.style.font = "700 12px system-ui, Arial";
      none.style.marginTop = "6px";
      list.appendChild(none);
    }
  }

  async function geocodeAddress(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Geocoding HTTP " + res.status);
    const data = await res.json();
    if (!data || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }

  async function doSearch() {
    const q = (input.value || "").trim();
    if (!q) return;
    mapMsg.textContent = "Suche…";
    try {
      const hit = await geocodeAddress(q);
      if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) {
        mapMsg.textContent = "Nichts gefunden. Andere Schreibweise probieren.";
        return;
      }
      centerBigMapOn(hit.lat, hit.lon, 1800);
      mapMsg.textContent = "Gefunden. Ziehen/Zoomen und „Ziel hier“ drücken.";
    } catch (e) {
      console.warn("Geocoding failed:", e);
      mapMsg.textContent = "Suche blockiert. Nutze Ziehen/Zoomen und setze Ziel manuell.";
    }
  }

  btnSearch.onclick = doSearch;

  // ✅ ESC in Eingabe: blur (Map bleibt offen)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      input.blur();
      return;
    }
    e.stopPropagation();
  });

  btnSet.onclick = () => {
    const canvas = mapViewer.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    const p = mapViewer.camera.pickEllipsoid(center, mapViewer.scene.globe.ellipsoid);
    if (!p) {
      mapMsg.textContent = "Konnte Mittelpunkt nicht bestimmen (Zoom näher ran).";
      return;
    }
    const c2 = Cesium.Cartographic.fromCartesian(p);
    const lat = Cesium.Math.toDegrees(c2.latitude);
    const lon = Cesium.Math.toDegrees(c2.longitude);

    setNavDestination(lat, lon);
    mapMsg.textContent = `Ziel gesetzt. (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    playersDirtyForUi = true;
  };

  btnClear.onclick = () => {
    clearNav();
    mapMsg.textContent = "Ziel gelöscht.";
    playersDirtyForUi = true;
  };

  btnClose.onclick = () => toggleBigMap(false);

  mapOverlay.__refreshPlayers = refreshBigMapPlayers;
}

function toggleBigMap(force) {
  ensureMapOverlay();
  const show = typeof force === "boolean" ? force : mapOverlay.style.display === "none";
  mapOverlay.style.display = show ? "block" : "none";

  if (show) {
    const lat = joinAccepted ? carLat : startLat;
    const lon = joinAccepted ? carLon : startLon;
    centerBigMapOn(lat, lon, 1600);
    playersDirtyForUi = true;
  }
}

// =====================================================
// ✅ INPUT: Keyboard-Aktionen blocken wenn Map offen/Tippen
// =====================================================
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (isMapOpen() && isTyping()) {
      e.preventDefault();
      document.activeElement?.blur?.();
      return;
    }
    if (isMapOpen()) toggleBigMap(false);
    return;
  }

  if (e.code === "KeyM") {
    if (isTyping()) return;
    toggleBigMap();
    return;
  }

  if (keyboardBlocked()) return;
  if (e.repeat) return;

  if (e.code === "KeyR") {
    if (!joinAccepted) return;
    spawnCar({ lat: startLat, lon: startLon, carKey: activeCarKey, headingDeg: REWE_HEADING_DEG, resetCam: true });
  }

  if (e.code === "KeyE") {
    if (!joinAccepted) return;
    playHorn({ volume: 0.9 });
    if (wsOpen) ws.send(JSON.stringify({ type: "horn", lat: carLat, lon: carLon }));
  }

  if (e.code === "KeyQ") toggleRadio();

  if (isPlusKey(e)) {
    miniAutoZoom = false;
    miniManualHeight = Math.max(MINI_MIN_H, miniManualHeight * 0.85);
  }
  if (isMinusKey(e)) {
    miniAutoZoom = false;
    miniManualHeight = Math.min(MINI_MAX_H, miniManualHeight / 0.85);
  }
  if (isUmlautA(e)) {
    miniAutoZoom = !miniAutoZoom;
    if (!miniAutoZoom) miniManualHeight = miniHeightCur;
  }
});

// =====================================================
// ✅ HUD Playerlist (nur FOLLOW/UNFOLLOW; synced mit M-Map)
// =====================================================
function updatePlayerListHud() {
  const total = (joinAccepted ? 1 : 0) + remotePlayers.size;

  const rows = [];
  rows.push(`<div style="opacity:.9; margin-bottom:6px;">Spieler (${total})</div>`);

  if (joinAccepted) {
    rows.push(`<div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
      <div>🟦 ${playerLabel(activeCarKey)} (DU)</div>
      <div style="opacity:.6; font-size:11px;">&nbsp;</div>
    </div>`);
  } else {
    rows.push(`<div style="opacity:.7">🟦 Du (nicht verbunden)</div>`);
  }

  const seen = new Set();
  for (const [, rp] of remotePlayers) {
    const ck = rp.cfgKey;
    if (!ck || seen.has(ck)) continue;
    seen.add(ck);

    const isFollow = navFollowCarKey === ck;

    rows.push(`<div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
      <div>🟧 ${playerLabel(ck)}</div>
      <button data-follow="${ck}" style="
        padding:6px 8px; border-radius:10px; border:1px solid rgba(255,255,255,0.16);
        background:${isFollow ? "rgba(255,120,120,0.18)" : "rgba(120,255,120,0.18)"};
        color:white; cursor:pointer; font:950 11px system-ui, Arial;
      ">${isFollow ? "UNFOLLOW" : "FOLLOW"}</button>
    </div>`);
  }

  hudPlayers.innerHTML = `<div style="display:grid; gap:6px;">${rows.join("")}</div>`;

  hudPlayers.querySelectorAll("[data-follow]").forEach((btn) => {
    btn.onclick = () => {
      const ck = btn.getAttribute("data-follow");
      if (!ck) return;
      toggleFollow(ck); // ✅ 1x reicht + synced
    };
  });
}

// =====================================================
// MINIMAP ENTITIES
// =====================================================
const miniEntities = { me: null };
const miniRemoteEntities = new Map();
function ensureMiniMe() {
  if (miniEntities.me) return;
  miniEntities.me = miniViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(carLon, carLat, 0),
    point: { pixelSize: 10, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2 },
    label: {
      text: "DU",
      font: "800 11px system-ui",
      pixelOffset: new Cesium.Cartesian2(0, -16),
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

// =====================================================
// DRIVE LOOP + NET SEND + REMOTE SMOOTH
// =====================================================
let lastTime = performance.now();
let netTimer = 0;

// ✅ UI throttles (Buttons bleiben klickbar)
let uiTimer = 0;

function sendMyState() {
  if (!joinAccepted || !car || !wsOpen) return;
  ws.send(JSON.stringify({ type: "state", lat: carLat, lon: carLon, heading: heading, speed: speed, gear: gear }));
}

viewer.scene.postRender.addEventListener(() => {
  if (!car) return;

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // ======= FAHREN (unverändert) =======
  const maxSpeed = (VMAX_KMH / 3.6) * SPEED_FEEL_SCALE;
  const reverseMax = 9.5;
  const engineAccel = (27.78 * SPEED_FEEL_SCALE) / 4.0;
  const brakeDecel = 24.0;
  const rollDecel = 2.0;
  const dragK = 0.0013;

  const pressingW = !!keys["KeyW"];
  const pressingS = !!keys["KeyS"];
  const noPedals = !pressingW && !pressingS;

  if (noPedals && isStopped()) speed = 0;

  if (isStopped()) {
    if (!pressingS) sArmed = true;
    if (!pressingW) wArmed = true;
  } else {
    sArmed = false;
    wArmed = false;
  }

  if (gear === "D") {
    if (isStopped() && sArmed && pressingS) {
      gear = "R";
      sArmed = false;
      wArmed = false;
      speed = 0;
    }
    if (pressingW) speed = Math.max(0, speed) + engineAccel * dt;
    else if (pressingS) speed = Math.max(0, Math.max(0, speed) - brakeDecel * dt);
    else speed = Math.max(0, Math.max(0, speed) - rollDecel * dt);
    speed = Math.min(maxSpeed, Math.max(0, speed));
  } else {
    if (isStopped() && wArmed && pressingW) {
      gear = "D";
      wArmed = false;
      sArmed = false;
      speed = 0;
    }
    if (pressingS) speed = Math.min(0, speed) - engineAccel * dt;
    else if (pressingW) speed = -Math.max(0, Math.max(0, -speed) - brakeDecel * dt);
    else speed = -Math.max(0, Math.max(0, -speed) - rollDecel * dt);
    speed = Math.max(-reverseMax, Math.min(0, speed));
  }

  const vAbs = Math.abs(speed);
  if (vAbs > 0.01) {
    const drag = dragK * vAbs * vAbs;
    const nv = Math.max(0, vAbs - drag * dt);
    speed = Math.sign(speed) * nv;
    if (noPedals && isStopped()) speed = 0;
  }

  const kmhDisplay = (Math.abs(speed) / SPEED_FEEL_SCALE) * 3.6;

  if (kmhDisplay > 1.0) {
    const t = Cesium.Math.clamp(kmhDisplay / VMAX_KMH, 0.0, 1.0);
    const tMid = Cesium.Math.clamp(kmhDisplay / 60.0, 0.0, 1.0);
    const steerLow = 1.15;
    const steerMid = 0.8;
    const steerHigh = 0.3;
    const steerA = steerLow + (steerMid - steerLow) * tMid;
    const steerRate = steerA + (steerHigh - steerA) * t;
    if (keys["KeyA"]) heading -= steerRate * dt * Math.sign(speed || 1);
    if (keys["KeyD"]) heading += steerRate * dt * Math.sign(speed || 1);
  }

  const forwardMeters = speed * dt;
  const dx = Math.sin(heading) * forwardMeters;
  const dy = Math.cos(heading) * forwardMeters;
  carLat += dy / metersPerDegLat;
  carLon += dx / metersPerDegLon(carLat);

  heightTimer += dt;
  if (heightTimer > 0.2) {
    heightTimer = 0;
    updateHeight();
  }
  const groundH = heightReady ? carHeight : (getHeightFallback() ?? 0);

  const pos = Cesium.Cartesian3.fromDegrees(carLon, carLat, groundH + activeCfg.zLift);
  car.position = pos;

  const hpr = new Cesium.HeadingPitchRoll(
    heading + Cesium.Math.toRadians(activeCfg.yawOffsetDeg ?? 0),
    Cesium.Math.toRadians(activeCfg.pitchOffsetDeg ?? 0),
    Cesium.Math.toRadians(activeCfg.rollOffsetDeg ?? 0)
  );
  car.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

  // ======= CAMERA (unverändert) =======
  const tCam = Cesium.Math.clamp(kmhDisplay / VMAX_KMH, 0.0, 1.0);
  const camDistTarget = activeCfg.camRearDistBase + activeCfg.camRearDistAdd * tCam;
  const camHeightTarget = activeCfg.camHeightBase + activeCfg.camHeightAdd * tCam;
  const camPitchDegTarget = activeCfg.camPitchBaseDeg + activeCfg.camPitchAddDeg * tCam;
  const topHeightTarget = activeCfg.topHeightBase + activeCfg.topHeightAdd * tCam;

  const smooth = 0.12;
  camDistCur += (camDistTarget - camDistCur) * smooth;
  camHeightCur += (camHeightTarget - camHeightCur) * smooth;
  camPitchDegCur += (camPitchDegTarget - camPitchDegCur) * smooth;
  topHeightCur += (topHeightTarget - topHeightCur) * smooth;

  const screenOffsetM = activeCfg.camScreenRightOffsetM ?? 0.0;
  const strafeX = Math.cos(heading) * screenOffsetM;
  const strafeY = -Math.sin(heading) * screenOffsetM;

  let camLon = carLon;
  let camLat = carLat;
  let camHeading = heading;
  let camPitch = Cesium.Math.toRadians(camPitchDegCur);
  let camHeight = camHeightCur;

  if (camView === "top") {
    camHeight = topHeightCur;
    camPitch = Cesium.Math.toRadians(-90);
    camHeading = heading;
    camLon = carLon + strafeX / metersPerDegLon(carLat);
    camLat = carLat + strafeY / metersPerDegLat;
  } else {
    let offCX = 0;
    let offCY = 0;
    const sideDist = camDistCur * 0.9;
    if (camView === "rear") {
      offCX = -Math.sin(heading) * camDistCur;
      offCY = -Math.cos(heading) * camDistCur;
      camHeading = heading;
    } else if (camView === "front") {
      offCX = +Math.sin(heading) * camDistCur;
      offCY = +Math.cos(heading) * camDistCur;
      camHeading = heading + Math.PI;
    } else if (camView === "right") {
      offCX = +Math.cos(heading) * sideDist;
      offCY = -Math.sin(heading) * sideDist;
      camHeading = heading - Math.PI / 2;
    } else if (camView === "left") {
      offCX = -Math.cos(heading) * sideDist;
      offCY = +Math.sin(heading) * sideDist;
      camHeading = heading + Math.PI / 2;
    }
    camLon = carLon + (offCX + strafeX) / metersPerDegLon(carLat);
    camLat = carLat + (offCY + strafeY) / metersPerDegLat;
  }

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(camLon, camLat, groundH + camHeight),
    orientation: { heading: camHeading, pitch: camPitch, roll: 0 },
  });

  // ======= MINIMAP CAMERA =======
  let miniHeightTarget;
  if (miniAutoZoom) miniHeightTarget = 260 + 720 * tCam;
  else miniHeightTarget = miniManualHeight;
  miniHeightCur += (miniHeightTarget - miniHeightCur) * 0.18;
  miniHeightCur = Cesium.Math.clamp(miniHeightCur, MINI_MIN_H, MINI_MAX_H);

  miniViewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(carLon, carLat, miniHeightCur),
    orientation: { heading: heading, pitch: Cesium.Math.toRadians(-90), roll: 0 },
  });

  // ======= NETWORK SEND (10 Hz) =======
  netTimer += dt;
  if (netTimer > 0.1) {
    netTimer = 0;
    sendMyState();
  }

  // ======= REMOTE SMOOTH =======
  for (const [id, rp] of remotePlayers) {
    const t = rp.target;
    if (!t) continue;

    const alpha2 = 0.18;
    rp.curLat += (t.lat - rp.curLat) * alpha2;
    rp.curLon += (t.lon - rp.curLon) * alpha2;

    let dh = t.heading - rp.curHeading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    rp.curHeading += dh * alpha2;

    const cfg = cfgByKey(rp.cfgKey);
    const cc = Cesium.Cartographic.fromDegrees(rp.curLon, rp.curLat);
    const gh = viewer.scene.globe.getHeight(cc);
    const groundRemote = Number.isFinite(gh) ? gh : 0;

    const ppos = Cesium.Cartesian3.fromDegrees(rp.curLon, rp.curLat, groundRemote + (cfg.zLift ?? 0));
    rp.entity.position = ppos;

    const rhpr = new Cesium.HeadingPitchRoll(
      rp.curHeading + Cesium.Math.toRadians(cfg.yawOffsetDeg ?? 0),
      Cesium.Math.toRadians(cfg.pitchOffsetDeg ?? 0),
      Cesium.Math.toRadians(cfg.rollOffsetDeg ?? 0)
    );
    rp.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(ppos, rhpr);
  }

  // ✅ FOLLOW: Ziel = Spielerposition (automatisch) + wenn Follow weg -> Ziel weg
  if (navFollowCarKey) {
    const rp = [...remotePlayers.values()].find((x) => x.cfgKey === navFollowCarKey);
    if (rp) {
      navDest = { lat: rp.curLat, lon: rp.curLon };
      navDestMode = "follow";
    } else {
      navFollowCarKey = null;
      if (navDestMode === "follow") {
        navDest = null;
        navDestMode = null;
      }
      playersDirtyForUi = true;
    }
  }

  // ✅ Wenn innerhalb 0.1km -> Ziel löschen (wie "angekommen")
  if (navDest && Number.isFinite(navDest.lat) && Number.isFinite(navDest.lon)) {
    const dArr = haversineMeters(carLat, carLon, navDest.lat, navDest.lon);
    if (dArr <= 100) {
      clearNav();
      playersDirtyForUi = true;
    }
  }

  // ======= MINIMAP MARKERS =======
  ensureMiniMe();
  miniEntities.me.position = Cesium.Cartesian3.fromDegrees(carLon, carLat, 0);
  if (miniEntities.me.label) miniEntities.me.label.text = playerLabel(activeCarKey);

  for (const [id, rp] of remotePlayers) {
    if (!miniRemoteEntities.has(id)) {
      const ent = miniViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(rp.curLon, rp.curLat, 0),
        point: { pixelSize: 9, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2 },
        label: {
          text: playerLabel(rp.cfgKey || "???"),
          font: "800 11px system-ui",
          pixelOffset: new Cesium.Cartesian2(0, -16),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      miniRemoteEntities.set(id, ent);
      playersDirtyForUi = true;
    }
    const ent = miniRemoteEntities.get(id);
    ent.position = Cesium.Cartesian3.fromDegrees(rp.curLon, rp.curLat, 0);
    if (ent.label) ent.label.text = playerLabel(rp.cfgKey || "???");
  }
  for (const [id, ent] of miniRemoteEntities) {
    if (!remotePlayers.has(id)) {
      miniViewer.entities.remove(ent);
      miniRemoteEntities.delete(id);
      playersDirtyForUi = true;
    }
  }

  // ✅ MINIMAP: Zielpunkt anzeigen wenn drin, sonst Pfeil am Rand in Richtung Ziel
  if (navDest && Number.isFinite(navDest.lat) && Number.isFinite(navDest.lon)) {
    if (!miniNav.destEnt) {
      miniNav.destEnt = miniViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(navDest.lon, navDest.lat, 0),
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
          outlineWidth: 2,
        },
      });
    }

    const destCart = Cesium.Cartesian3.fromDegrees(navDest.lon, navDest.lat, 0);
    miniNav.destEnt.position = destCart;
    if (miniNav.destEnt.point) {
      miniNav.destEnt.point.color = navFollowCarKey ? Cesium.Color.LIME : Cesium.Color.YELLOW;
    }

    const win = Cesium.SceneTransforms.wgs84ToWindowCoordinates(miniViewer.scene, destCart);
    const w = miniDiv.clientWidth;
    const h = miniDiv.clientHeight;

    if (win && Number.isFinite(win.x) && Number.isFinite(win.y)) {
      const margin = 8;
      const inside = win.x >= margin && win.x <= w - margin && win.y >= margin && win.y <= h - margin;

      if (inside) {
        // ✅ Ziel ist im Sichtfeld
        miniNav.destEnt.show = true;

        if (navFollowCarKey) {
          // ✅ grüner Pfeil auf das Auto (Center) zeigen lassen
          const cx = w / 2;
          const cy = h / 2;
          const dx2 = cx - win.x;
          const dy2 = cy - win.y;
          const ang = Math.atan2(dy2, dx2) + Math.PI / 2;

          if (miniNav.arrowEl) {
            miniNav.arrowEl.style.display = "block";
            miniNav.arrowEl.style.left = `${win.x}px`;
            miniNav.arrowEl.style.top = `${win.y}px`;
            miniNav.arrowEl.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
            miniNav.arrowEl.style.borderBottomColor = "rgba(180,255,180,0.95)";
          }
        } else {
          if (miniNav.arrowEl) miniNav.arrowEl.style.display = "none";
        }
      } else {
        // ✅ Ziel ist außerhalb -> Randpfeil Richtung Ziel
        miniNav.destEnt.show = false;

        const cx = w / 2;
        const cy = h / 2;
        const dx2 = win.x - cx;
        const dy2 = win.y - cy;

        const maxX = w / 2 - 14;
        const maxY = h / 2 - 14;

        const ax = Math.abs(dx2) < 1e-6 ? 1e-6 : Math.abs(dx2);
        const ay = Math.abs(dy2) < 1e-6 ? 1e-6 : Math.abs(dy2);

        const tEdge = Math.min(maxX / ax, maxY / ay);
        const px = cx + dx2 * tEdge;
        const py = cy + dy2 * tEdge;

        const ang = Math.atan2(dy2, dx2) + Math.PI / 2;

        if (miniNav.arrowEl) {
          miniNav.arrowEl.style.display = "block";
          miniNav.arrowEl.style.left = `${px}px`;
          miniNav.arrowEl.style.top = `${py}px`;
          miniNav.arrowEl.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
          miniNav.arrowEl.style.borderBottomColor = navFollowCarKey
            ? "rgba(180,255,180,0.95)"
            : "rgba(255,255,255,0.95)";
        }
      }
    } else {
      miniNav.destEnt.show = false;
      if (miniNav.arrowEl) miniNav.arrowEl.style.display = "none";
    }
  } else {
    if (miniNav.destEnt) miniNav.destEnt.show = false;
    if (miniNav.arrowEl) miniNav.arrowEl.style.display = "none";
  }

  // ✅ BIG MAP: andere Spieler auf der Karte anzeigen (und Ziel, falls vorhanden)
  if (isMapOpen() && mapViewer) {
    if (!mapEntities.me) {
      mapEntities.me = mapViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(carLon, carLat, 0),
        point: {
          pixelSize: 10,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
          outlineWidth: 2,
        },
        label: {
          text: `${playerLabel(activeCarKey)} (DU)`,
          font: "800 12px system-ui",
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      mapEntities.me.position = Cesium.Cartesian3.fromDegrees(carLon, carLat, 0);
      if (mapEntities.me.label) mapEntities.me.label.text = `${playerLabel(activeCarKey)} (DU)`;
    }

    const alive = new Set();
    for (const [, rp] of remotePlayers) {
      const ck = rp.cfgKey;
      if (!ck) continue;
      alive.add(ck);

      if (!mapRemoteEntities.has(ck)) {
        const ent = mapViewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(rp.curLon, rp.curLat, 0),
          point: {
            pixelSize: 10,
            color: Cesium.Color.ORANGE,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth: 2,
          },
          label: {
            text: playerLabel(ck),
            font: "800 12px system-ui",
            pixelOffset: new Cesium.Cartesian2(0, -18),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        mapRemoteEntities.set(ck, ent);
      } else {
        const ent = mapRemoteEntities.get(ck);
        ent.position = Cesium.Cartesian3.fromDegrees(rp.curLon, rp.curLat, 0);
        if (ent.label) ent.label.text = playerLabel(ck);
      }
    }

    for (const [ck, ent] of mapRemoteEntities) {
      if (!alive.has(ck)) {
        mapViewer.entities.remove(ent);
        mapRemoteEntities.delete(ck);
      }
    }

    if (navDest && Number.isFinite(navDest.lat) && Number.isFinite(navDest.lon)) {
      if (!mapEntities.dest) {
        mapEntities.dest = mapViewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(navDest.lon, navDest.lat, 0),
          point: {
            pixelSize: 10,
            color: navFollowCarKey ? Cesium.Color.LIME : Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth: 2,
          },
          label: {
            text: navFollowCarKey ? `FOLLOW: ${playerLabel(navFollowCarKey)}` : "ZIEL",
            font: "900 12px system-ui",
            pixelOffset: new Cesium.Cartesian2(0, -18),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      } else {
        mapEntities.dest.position = Cesium.Cartesian3.fromDegrees(navDest.lon, navDest.lat, 0);
        if (mapEntities.dest.point) mapEntities.dest.point.color = navFollowCarKey ? Cesium.Color.LIME : Cesium.Color.YELLOW;
        if (mapEntities.dest.label)
          mapEntities.dest.label.text = navFollowCarKey ? `FOLLOW: ${playerLabel(navFollowCarKey)}` : "ZIEL";
      }
    } else if (mapEntities.dest) {
      mapViewer.entities.remove(mapEntities.dest);
      mapEntities.dest = null;
    }
  }

  // ======= HUD TEXT =======
  let navText = "";
  if (navDest) {
    const d = haversineMeters(carLat, carLon, navDest.lat, navDest.lon);
    navText = ` • NAV: ${(d / 1000).toFixed(2)} km`;
  }
  const who = joinAccepted ? playerLabel(activeCarKey) : "Du";
  const followText = navFollowCarKey ? ` • FOLLOW: ${playerLabel(navFollowCarKey)}` : "";
  hudSpeed.textContent = `${Math.round(kmhDisplay)} km/h  •  ${gear} •  ${who}${navText}${followText}`;

  // ✅ UI refresh THROTTLED + sofort bei Dirty
  uiTimer += dt;
  if (playersDirtyForUi || uiTimer > 0.35) {
    uiTimer = 0;
    updatePlayerListHud();
    if (isMapOpen() && mapOverlay?.__refreshPlayers) mapOverlay.__refreshPlayers();
    playersDirtyForUi = false;
  }
});
