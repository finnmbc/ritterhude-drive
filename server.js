const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const CLASS_SPAWNS = {
  KONA:  { lat: 53.18167657056033, lon: 8.739374157976243, headingDeg: 20 },
  BENZ:  { lat: 53.18493709131292, lon: 8.71229577112801, headingDeg: 8.5 },
  BULLI: { lat: 53.18605835934793, lon: 8.745079683720112, headingDeg: 90 },
};

// playerId -> { id, carKey, lat, lon, heading, speed, gear, t }
const players = new Map();

// carKey -> playerId (Lock)
const classLocks = new Map();

// ws -> playerId
const clients = new Map();

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

// 15 Hz snapshot broadcast
setInterval(() => {
  broadcast({ type: "snapshot", players: snapshot(), serverTime: Date.now() });
}, 1000 / 15);

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(ws, id);

  send(ws, { type: "hello", id });
  send(ws, { type: "class_status", taken: getClassTakenMap() });

  ws.on("message",(raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const pid = clients.get(ws);
    if (!pid) return;

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

      // spieler anlegen
      const sp = CLASS_SPAWNS[carKey];
      const p = {
        id: pid,
        carKey,
        lat: sp.lat,
        lon: sp.lon,
        heading: (sp.headingDeg * Math.PI) / 180,
        speed: 0,
        gear: "D",
        t: Date.now(),
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
      const speed = +msg.speed;

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(heading) || !Number.isFinite(speed)) return;

      p.lat = lat;
      p.lon = lon;
      p.heading = heading;
      p.speed = speed;
      p.gear = msg.gear === "R" ? "R" : "D";
      p.t = Date.now();
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

console.log(`WS server running on ws://localhost:${PORT}`);
