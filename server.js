const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const GAME_FILE = path.join(__dirname, "Green_Valley_Gesamtversion.html");

const players = new Map();
let nextId = 1;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Test-Adresse
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Green Valley Server läuft");
    return;
  }

  // Startseite + Spiel
  if (
    url.pathname === "/" ||
    url.pathname === "" ||
    url.pathname === "/index.html" ||
    url.pathname === "/Green_Valley_Gesamtversion.html"
  ) {
    fs.readFile(GAME_FILE, (err, data) => {
      if (err) {
        console.error("Spiel-Datei konnte nicht geladen werden:", err);
        res.writeHead(500, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        res.end("Spiel-Datei nicht gefunden.");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      });

      res.end(data);
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not Found");
});

const wss = new WebSocket.Server({ server });

function broadcastPlayers() {
  const list = [...players.values()].map(player => ({
    id: player.id,
    x: player.x,
    y: player.y,
    inCity: player.inCity
  }));

  const message = JSON.stringify({
    type: "players",
    players: list
  });

  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  }
}

wss.on("connection", ws => {
  console.log("Neuer Spieler verbunden");

  if (players.size >= 2) {
    ws.send(JSON.stringify({
      type: "full"
    }));

    ws.close();
    return;
  }

  const id = String(nextId++);

  const player = {
    id,
    ws,
    x: 760,
    y: 650,
    inCity: false
  };

  players.set(id, player);

  ws.send(JSON.stringify({
    type: "welcome",
    id
  }));

  broadcastPlayers();

  ws.on("message", raw => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type !== "state") {
        return;
      }

      const current = players.get(id);

      if (!current) {
        return;
      }

      if (Number.isFinite(message.x)) {
        current.x = Math.max(0, Math.min(7200, message.x));
      }

      if (Number.isFinite(message.y)) {
        current.y = Math.max(0, Math.min(4800, message.y));
      }

      current.inCity = Boolean(message.inCity);

      broadcastPlayers();
    } catch (error) {
      console.error("Ungültige Nachricht:", error);
    }
  });

  ws.on("close", () => {
    console.log("Spieler getrennt:", id);
    players.delete(id);
    broadcastPlayers();
  });

  ws.on("error", error => {
    console.error("WebSocket-Fehler:", error);
    players.delete(id);
    broadcastPlayers();
  });
});

server.listen(PORT, () => {
  console.log(`Green Valley Server läuft auf Port ${PORT}`);
});
