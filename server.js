import express from "express";
import http from "http";
import { Server } from "socket.io";
import {
  TikTokLiveConnection,
  WebcastEvent
} from "tiktok-live-connector";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

let connection = null;
let live = false;
let username = "";

io.on("connection", (socket) => {
  socket.emit("status", { live, username });
});

app.post("/api/connect", async (req, res) => {
  const name = String(req.body.username || "")
    .replace(/^@/, "")
    .trim();

  if (!name) {
    return res.status(400).json({
      error: "TikTok kullanıcı adı gerekli."
    });
  }

  try {
    if (connection) {
      try {
        await connection.disconnect();
      } catch (error) {}
    }

    username = name;
    live = false;

    connection = new TikTokLiveConnection(name, {
      processInitialData: false
    });

    connection.on(WebcastEvent.CONNECT, () => {
      live = true;
      io.emit("status", { live, username });
    });

    connection.on(WebcastEvent.DISCONNECTED, () => {
      live = false;
      io.emit("status", { live, username });
    });

    connection.on(WebcastEvent.FOLLOW, (data) => {
      io.emit("event", {
        type: "Takip",
        user:
          data.user?.uniqueId ||
          data.user?.nickname ||
          "Bilinmeyen",
        detail: "Yeni takipçi",
        count: 1,
        at: new Date().toLocaleTimeString("tr-TR")
      });
    });

    connection.on(WebcastEvent.GIFT, (data) => {
      io.emit("event", {
        type: "Hediye",
        user:
          data.user?.uniqueId ||
          data.user?.nickname ||
          "Bilinmeyen",
        detail:
          data.giftDetails?.giftName ||
          data.giftName ||
          "Hediye",
        count: data.repeatCount || 1,
        at: new Date().toLocaleTimeString("tr-TR")
      });
    });

    await connection.connect();

    res.json({
      ok: true,
      message: "TikTok LIVE bağlantısı deneniyor."
    });

  } catch (error) {
    live = false;
    io.emit("status", { live, username });

    res.status(500).json({
      error: error.message || "TikTok bağlantısı kurulamadı."
    });
  }
});

app.post("/api/disconnect", async (req, res) => {
  try {
    if (connection) {
      await connection.disconnect();
    }
  } catch (error) {}

  connection = null;
  live = false;

  io.emit("status", { live, username });

  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log("TikTok LIVE Printer çalışıyor: " + port);
});
