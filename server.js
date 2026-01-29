// server.js ✅ KOPIERFERTIG (ts/vMps/gps/camView im Snapshot + Horn Broadcast)
// ------------------------------------------------------

const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();

// Frontend ausliefern
app.use(express.static(path.join(__dirname, "public")));

// Fallback: immer index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// HTTP Server (Render braucht HTTP)
const server = http.createServer(app);

// WebSocket auf dem gleichen Server
const wss = new WebSocketServer({ server });

// ========= Multiplayer State =========
const CLASS_SPAWNS = {
  KONA: { lat: 53.18167657056033, lon: 8.739374157976243, headingDeg: 20 },
  BENZ: { lat: 53.18493709131292, lon: 8.71229577112801, headingDeg: 8.5 },
  BULLI: { lat: 53.18605835934793, lon: 8.745079683720112, headingDeg: 90 },
};

const players = new Map();    // id -> player
const classLocks = new Map(); // carKey -> id
const clients = new Map();    // ws -> id

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}
function getClassTakenMap() {
  return {
    KONA: classLocks.has("KONA"),
    BENZ: classLocks.has("BENZ"),
    BULLI: classLocks.has("BULLI"),
  };
}
function broadcastClassStatus() {
  broadcast({ type: "class_status", taken: getClassTakenMap() });
}
function snapshot() {
  return Array.from(players.values());
}

// 15 Hz Snapshot
setInterval(() => {
  broadcast({ type: "snapshot", players: snapshot(), serverTime: Date.now() });
}, 1000 / 15);

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(ws, id);

  send(ws, { type: "hello", id });
  send(ws, { type: "class_status", taken: getClassTakenMap() });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const pid = clients.get(ws);
    if (!pid) return;

    // ✅ HUPE: an alle broadcasten (inkl. id + optional lat/lon)
    if (msg.type === "horn") {
      const lat = +msg.lat;
      const lon = +msg.lon;

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        broadcast({ type: "horn", id: pid, lat, lon });
      } else {
        broadcast({ type: "horn", id: pid });
      }
      return;
    }

    if (msg.type === "join_request") {
      const carKey = msg.carKey;

      if (!CLASS_SPAWNS[carKey]) {
        send(ws, { type: "join_denied", reason: "invalid_class" });
        return;
      }

      // schon gejoined?
      const existing = players.get(pid);
      if (existing?.carKey) {
        send(ws, { type: "join_denied", reason: "already_joined", carKey: existing.carKey });
        return;
      }

      // klasse belegt?
      const lockedBy = classLocks.get(carKey);
      if (lockedBy && lockedBy !== pid) {
        send(ws, { type: "join_denied", reason: "class_taken", carKey });
        return;
      }

      // lock setzen
      classLocks.set(carKey, pid);

      const sp = CLASS_SPAWNS[carKey];
      const p = {
        id: pid,
        carKey,
        lat: sp.lat,
        lon: sp.lon,
        heading: (sp.headingDeg * Math.PI) / 180,

        // ✅ NEU: echte Geschwindigkeit (m/s) + Sender-Timestamp + Flags
        vMps: 0,
        ts: Date.now(),
        gps: false,
        camView: "rear",

        gear: "D",

        // optional legacy:
        speed: 0,
        t: Date.now(), // lastSeen server
      };

      players.set(pid, p);

      send(ws, { type: "join_accepted", carKey, spawn: sp });

      broadcast({ type: "player_joined", player: p });
      broadcastClassStatus();
      return;
    }

    if (msg.type === "state") {
      const p = players.get(pid);
      if (!p) return;

      const lat = +msg.lat;
      const lon = +msg.lon;
      const heading = +msg.heading;

      const ts = +msg.ts;       // Epoch ms vom Client (optional)
      const vMps = +msg.vMps;   // echte m/s vom Client (optional)

      // legacy fallback (falls Client noch altes speed sendet)
      const speed = +msg.speed;

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(heading)) return;

      const hasTs = Number.isFinite(ts) && ts > 0;
      const hasVMps = Number.isFinite(vMps);

      p.lat = lat;
      p.lon = lon;
      p.heading = heading;

      p.ts = hasTs ? ts : Date.now();

      if (hasVMps) p.vMps = vMps;
      else if (Number.isFinite(speed)) p.vMps = speed; // ⚠️ nur korrekt, wenn speed=m/s

      p.gps = !!msg.gps;

      if (typeof msg.camView === "string") p.camView = msg.camView;

      p.gear = msg.gear === "R" ? "R" : "D";

      // optional legacy: speed spiegeln
      if (hasVMps) p.speed = vMps;
      else if (Number.isFinite(speed)) p.speed = speed;

      p.t = Date.now(); // lastSeen (server)
      return;
    }
  });

  ws.on("close", () => {
    const pid = clients.get(ws);
    clients.delete(ws);

    const p = pid ? players.get(pid) : null;

    if (p?.carKey) {
      const lockedBy = classLocks.get(p.carKey);
      if (lockedBy === pid) classLocks.delete(p.carKey);
    }

    if (pid && players.has(pid)) {
      players.delete(pid);
      broadcast({ type: "player_left", id: pid });
      broadcastClassStatus();
    }
  });
});

// Render PORT benutzen!
const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP + WS listening on port ${PORT}`);
});
