/* global Cesium */

// =====================================================
// 1) TOKEN EINTRAGEN:
// =====================================================
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMmQ3Yjg4Yy1kNjM1LTQxNmMtOTY0Ny0zZTQ1Zjc3ZmFmZDkiLCJpZCI6MzgzMTIzLCJpYXQiOjE3NjkzMzAwNjl9.c43M7EsxX_pY7z9RndXbP6y9QiKqR5ST3a7nlT8Tk90";

// alte HUDs entfernen
document.querySelectorAll(".hud").forEach((el) => el.remove());

// =====================================================
// VIEWER
// =====================================================
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  timeline: false,
  animation: false,
  shouldAnimate: true,
});
viewer.scene.globe.depthTestAgainstTerrain = true;

(async () => {
  const buildings = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildings);
})();

// =====================================================
// STARTPUNKT: REWE (Reset)
// =====================================================
const startLat = 53.17992830092991;
const startLon = 8.754863617225599;

// REWE Heading bleibt wie vorher (45°)
const REWE_HEADING_DEG = 45;

// =====================================================
// SPAWNPOINTS (+ eigener Heading pro Spawn)  -> "KLASSENSPAWNS"
// =====================================================
const SPAWN1 = { lat: 53.18167657056033, lon: 8.739374157976243, headingDeg: 20 };  // KONA
const SPAWN2 = { lat: 53.18493709131292, lon: 8.71229577112801, headingDeg: 8.5 }; // BENZ
const SPAWN3 = { lat: 53.18605835934793, lon: 8.745079683720112, headingDeg: 90 }; // BULLI

const CLASS_SPAWNS = {
  KONA: SPAWN1,
  BENZ: SPAWN2,
  BULLI: SPAWN3,
};

// =====================================================
// SPEED SETTINGS
// =====================================================
const SPEED_FEEL_SCALE = 1.125;
const VMAX_KMH = 190.0;

// =====================================================
// MODELLE (deine Dateien)
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

    modelScale: 30.0,
    minPixel: 450,
    maxScale: 100.0,
    zLift: 0.0,
    yawOffsetDeg: 270,

    camScreenRightOffsetM: 0.125,

    camRearDistBase: 22,
    camRearDistAdd: 7,
    camHeightBase: 12,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -20,
    camPitchAddDeg: 3.0,

    topHeightBase: 55,
    topHeightAdd: 120,
  },

  BENZ: {
    name: "BENZ",
    uri: CAR_BENZ_GLB,

    modelScale: 0.25,
    minPixel: 150,
    maxScale: 0.5,
    zLift: -2.5,
    yawOffsetDeg: 90,

    camScreenRightOffsetM: -1.2,

    camRearDistBase: 22,
    camRearDistAdd: 7,
    camHeightBase: 12,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -20,
    camPitchAddDeg: 3.0,

    topHeightBase: 45,
    topHeightAdd: 110,
  },

  BULLI: {
    name: "BULLI",
    uri: CAR_BULLI_GLB,

    modelScale: 0.25,
    minPixel: 150,
    maxScale: 0.5,
    zLift: 0,
    yawOffsetDeg: 270,
    pitchOffsetDeg: 90,
    rollOffsetDeg: 0,

    camScreenRightOffsetM: 0.0,

    camRearDistBase: 22,
    camRearDistAdd: 7,
    camHeightBase: 12,
    camHeightAdd: 6.0,
    camPitchBaseDeg: -20,
    camPitchAddDeg: 3.0,

    topHeightBase: 45,
    topHeightAdd: 110,
  },
};

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

// Controls state
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.code] = true));
window.addEventListener("keyup", (e) => (keys[e.code] = false));

// =====================================================
// HELPERS
// =====================================================
const metersPerDegLat = 111320;
function metersPerDegLon(latDeg) {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

// Terrain height
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
    model: {
      uri: cfg.uri,
      minimumPixelSize: cfg.minPixel,
      maximumScale: cfg.maxScale,
      scale: cfg.modelScale,
    },
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
      orientation: {
        heading: heading,
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 0.6,
    });
  }
}

// =====================================================
// MULTIPLAYER: Klassen nur 1x (WebSocket)
// =====================================================
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
const ws = new WebSocket(WS_URL);


let wsOpen = false;
let myId = null;

let joinPending = false;
let joinAccepted = false;

let classTaken = { KONA: false, BENZ: false, BULLI: false };

// Buttons im Overlay merken
const menuButtons = new Map(); // carKey -> button
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

// Remote players: id -> object
const remotePlayers = new Map();

function createRemoteCarEntity(cfg, lat, lon, h, groundH = 0) {
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, groundH + (cfg.zLift ?? 0));
  const ent = viewer.entities.add({
    position: pos,
    model: {
      uri: cfg.uri,
      minimumPixelSize: cfg.minPixel,
      maximumScale: cfg.maxScale,
      scale: cfg.modelScale,
    },
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

    if (msg.reason === "class_taken") {
      setMenuHint("Diese Klasse ist schon belegt. Wähle eine andere.", true);
    } else if (msg.reason === "already_joined") {
      setMenuHint("Du bist schon im Spiel.", true);
    } else {
      setMenuHint("Join abgelehnt.", true);
    }
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
    return;
  }

  if (msg.type === "player_left") {
    const rp = remotePlayers.get(msg.id);
    if (rp?.entity) viewer.entities.remove(rp.entity);
    remotePlayers.delete(msg.id);
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
      } else {
        const rp = remotePlayers.get(p.id);

        if (rp.cfgKey !== p.carKey) {
          viewer.entities.remove(rp.entity);
          rp.entity = createRemoteCarEntity(cfg, p.lat, p.lon, p.heading, 0);
          rp.cfgKey = p.carKey;
          rp.curLat = p.lat;
          rp.curLon = p.lon;
          rp.curHeading = p.heading;
        }

        rp.target = { ...p };
      }
    }
  }
});

// =====================================================
// ✅ START-MENU: Klasse auswählen (nur 1x global)
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
  panel.style.letterSpacing = "0.2px";

  const title = document.createElement("div");
  title.textContent = "Ritterhude Drive";
  title.style.fontSize = "22px";
  title.style.marginBottom = "8px";

  const sub = document.createElement("div");
  sub.textContent =
    "Wähle eine Klasse. Jede Klasse kann nur einmal vergeben werden.";
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
    btn.style.letterSpacing = "0.2px";

    btn.onmouseenter = () => {
      if (!btn.disabled) btn.style.background = "rgba(255,255,255,0.14)";
    };
    btn.onmouseleave = () => (btn.style.background = "rgba(255,255,255,0.08)");

    btn.onclick = () => {
      if (joinPending || joinAccepted) return;

      if (!wsOpen) {
        setMenuHint("Server nicht verbunden…", true);
        return;
      }

      if (classTaken[carKey]) {
        setMenuHint("Diese Klasse ist schon belegt.", true);
        return;
      }

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
  hint.innerHTML =
    `<div style="margin-top:12px; opacity:.75; font-size:12px;">
      Steuerung: W/A/S/D • Kamera: Pfeile halten • REWE: <b>R</b>
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

// Menü direkt beim Start zeigen (und NICHT automatisch spawnen)
showCarSelectMenu();

// =====================================================
// CAMERA + VIEW MODES (Momentary) + Default HINTEN
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

// Pfeiltasten: View nur solange gedrückt
window.addEventListener("keydown", (e) => {
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
// INPUT: Reset nur über R (REWE)
// =====================================================
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;

  // R = REWE im aktuellen Auto + REWE Heading
  if (e.code === "KeyR") {
    if (!joinAccepted) return; // vor Join kein Reset
    spawnCar({
      lat: startLat,
      lon: startLon,
      carKey: activeCarKey,
      headingDeg: REWE_HEADING_DEG,
      resetCam: true,
    });
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
hudControls.style.letterSpacing = "0.2px";
hudControls.style.zIndex = "9999";
hudControls.style.userSelect = "none";
hudControls.innerHTML =
  `W = Vorwärts<br>A = Links<br>S = Bremsen/Rückwärts<br>D = Rechts<br>R = REWE<br><br>Ä = Auto-Zoom<br>+/- = Minimap-Zoom<br><br>⬇️ = Vorne<br>⬆️ = Oben<br>⬅️ = Links<br>➡️ = Rechts`;
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
hudSpeed.style.letterSpacing = "0.5px";
hudSpeed.style.zIndex = "9999";
hudSpeed.style.userSelect = "none";
hudSpeed.textContent = "0 km/h  •  D";
document.body.appendChild(hudSpeed);

// =========================
// MINIMAP
// =========================
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
miniDiv.style.pointerEvents = "none";
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
      const road = await Cesium.createWorldImageryAsync({
        style: Cesium.IonWorldImageryStyle.ROAD,
      });
      miniViewer.imageryLayers.removeAll(true);
      miniViewer.imageryLayers.addImageryProvider(road);
    } else {
      console.warn("ROAD-Style nicht verfügbar – Minimap nutzt Default-Layer.");
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

// Minimap zoom controls
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

window.addEventListener("keydown", (e) => {
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
// DRIVE LOOP + NETWORK SEND + REMOTE SMOOTH
// =====================================================
let lastTime = performance.now();
let netTimer = 0;

function sendMyState() {
  if (!joinAccepted) return;
  if (!car) return;
  if (!wsOpen) return;

  ws.send(
    JSON.stringify({
      type: "state",
      lat: carLat,
      lon: carLon,
      heading: heading,
      speed: speed,
      gear: gear,
    })
  );
}

viewer.scene.postRender.addEventListener(() => {
  if (!car) return; // noch kein Auto gewählt -> nix fahren

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Params
  const vmaxDisplayKmh = VMAX_KMH;
  const maxSpeed = (vmaxDisplayKmh / 3.6) * SPEED_FEEL_SCALE;
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

    if (pressingW) {
      speed = Math.max(0, speed);
      speed += engineAccel * dt;
    } else if (pressingS) {
      const v = Math.max(0, speed);
      speed = Math.max(0, v - brakeDecel * dt);
      if (isStopped()) speed = 0;
    } else {
      const v = Math.max(0, speed);
      speed = Math.max(0, v - rollDecel * dt);
      if (isStopped()) speed = 0;
    }

    speed = Math.min(maxSpeed, Math.max(0, speed));
  } else {
    if (isStopped() && wArmed && pressingW) {
      gear = "D";
      wArmed = false;
      sArmed = false;
      speed = 0;
    }

    if (pressingS) {
      speed = Math.min(0, speed);
      speed -= engineAccel * dt;
    } else if (pressingW) {
      const v = Math.max(0, -speed);
      const nv = Math.max(0, v - brakeDecel * dt);
      speed = -nv;
      if (isStopped()) speed = 0;
    } else {
      const v = Math.max(0, -speed);
      const nv = Math.max(0, v - rollDecel * dt);
      speed = -nv;
      if (isStopped()) speed = 0;
    }

    speed = Math.max(-reverseMax, Math.min(0, speed));
  }

  const vAbs = Math.abs(speed);
  if (vAbs > 0.01) {
    const drag = dragK * vAbs * vAbs;
    const nv = Math.max(0, vAbs - drag * dt);
    speed = Math.sign(speed) * nv;
    if (noPedals && isStopped()) speed = 0;
  }

  // Steering
  const kmhDisplay = (Math.abs(speed) / SPEED_FEEL_SCALE) * 3.6;

  if (kmhDisplay > 1.0) {
    const t = Cesium.Math.clamp(kmhDisplay / VMAX_KMH, 0.0, 1.0);
    const steerLow = 1.15;
    const steerMid = 0.8;
    const steerHigh = 0.3;

    const tMid = Cesium.Math.clamp(kmhDisplay / 60.0, 0.0, 1.0);
    const steerA = steerLow + (steerMid - steerLow) * tMid;
    const steerRate = steerA + (steerHigh - steerA) * t;

    if (keys["KeyA"]) heading -= steerRate * dt * Math.sign(speed || 1);
    if (keys["KeyD"]) heading += steerRate * dt * Math.sign(speed || 1);
  }

  // Move
  const forwardMeters = speed * dt;
  const dx = Math.sin(heading) * forwardMeters;
  const dy = Math.cos(heading) * forwardMeters;

  const dLat = dy / metersPerDegLat;
  const dLon = dx / metersPerDegLon(carLat);

  carLat += dLat;
  carLon += dLon;

  // Height sampling
  heightTimer += dt;
  if (heightTimer > 0.2) {
    heightTimer = 0;
    updateHeight();
  }
  const groundH = heightReady ? carHeight : (getHeightFallback() ?? 0);

  // Car position
  const pos = Cesium.Cartesian3.fromDegrees(carLon, carLat, groundH + activeCfg.zLift);
  car.position = pos;

  // Car orientation
  const modelYawOffset = Cesium.Math.toRadians(activeCfg.yawOffsetDeg ?? 0);
  const modelPitchOffset = Cesium.Math.toRadians(activeCfg.pitchOffsetDeg ?? 0);
  const modelRollOffset = Cesium.Math.toRadians(activeCfg.rollOffsetDeg ?? 0);

  const hpr = new Cesium.HeadingPitchRoll(heading + modelYawOffset, modelPitchOffset, modelRollOffset);
  car.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

  // Camera dynamics
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

  // Camera placement by view
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

  const camPos = Cesium.Cartesian3.fromDegrees(camLon, camLat, groundH + camHeight);

  viewer.camera.setView({
    destination: camPos,
    orientation: {
      heading: camHeading,
      pitch: camPitch,
      roll: 0,
    },
  });

  // Minimap camera
  let miniHeightTarget;
  if (miniAutoZoom) miniHeightTarget = 260 + 720 * tCam;
  else miniHeightTarget = miniManualHeight;

  miniHeightCur += (miniHeightTarget - miniHeightCur) * 0.18;
  miniHeightCur = Cesium.Math.clamp(miniHeightCur, MINI_MIN_H, MINI_MAX_H);

  miniViewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(carLon, carLat, miniHeightCur),
    orientation: {
      heading: heading,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });

  // HUD
  hudSpeed.textContent = `${Math.round(kmhDisplay)} km/h  •  ${gear} •  CAR: ${activeCfg.name}`;

  // =========================
  // NETWORK SEND (10 Hz)
  // =========================
  netTimer += dt;
  if (netTimer > 0.1) {
    netTimer = 0;
    sendMyState();
  }

  // =========================
  // REMOTE CARS SMOOTH
  // =========================
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

    const myo = Cesium.Math.toRadians(cfg.yawOffsetDeg ?? 0);
    const mpo = Cesium.Math.toRadians(cfg.pitchOffsetDeg ?? 0);
    const mro = Cesium.Math.toRadians(cfg.rollOffsetDeg ?? 0);
    const rhpr = new Cesium.HeadingPitchRoll(rp.curHeading + myo, mpo, mro);

    rp.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(ppos, rhpr);
  }
});
