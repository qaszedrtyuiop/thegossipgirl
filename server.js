// =========================
// server.js (UPDATED VERSION)
// =========================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = new sqlite3.Database("posts.db");

// DB

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    image TEXT,
    approved INTEGER DEFAULT 0
  )`);
});

// upload images
const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// submit post
app.post("/submit", upload.single("image"), (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;

  db.run("INSERT INTO posts(title, description, image) VALUES(?,?,?)",
    [title, description, image],
    () => res.sendStatus(200)
  );
});

// admin login
app.post("/admin-login", (req, res) => {
  if (req.body.password === "velours") res.json({ ok: true });
  else res.json({ ok: false });
});

// pending posts
app.get("/pending", (req, res) => {
  db.all("SELECT * FROM posts WHERE approved=0 ORDER BY id DESC", (e, rows) => res.json(rows));
});

// approved posts
app.get("/posts", (req, res) => {
  db.all("SELECT * FROM posts WHERE approved=1 ORDER BY id DESC LIMIT 1", (e, rows) => res.json(rows));
});

// approve (replaces previous post automatically)
app.post("/approve/:id", (req, res) => {
  db.run("UPDATE posts SET approved=0 WHERE approved=1", () => {
    db.run("UPDATE posts SET approved=1 WHERE id=?", [req.params.id], () => {
      db.get("SELECT * FROM posts WHERE id=?", [req.params.id], (e, post) => {
        io.emit("new_post", post);
        res.sendStatus(200);
      });
    });
  });
});

// reject post
app.post("/reject/:id", (req, res) => {
  db.run("DELETE FROM posts WHERE id=? AND approved=0", [req.params.id], () => res.sendStatus(200));
});

// delete current published post
app.post("/delete/:id", (req, res) => {
  db.run("DELETE FROM posts WHERE id=?", [req.params.id], () => {
    io.emit("new_post", null);
    res.sendStatus(200);
  });
});

io.on("connection", socket => {
  console.log("user connected");
});

server.listen(3000, () => console.log("http://localhost:3000"));



