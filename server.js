const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const upload = multer({ dest: 'uploads/' });

// Database
const db = new sqlite3.Database('costa_patch.db');

// Initialize Tables
db.serialize(() => {
  // Stores Table
  db.run(`CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT,
    manager TEXT
  )`);

  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    storeId INTEGER
  )`);

  // Entries Table
  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    storeId INTEGER,
    manager TEXT,
    achievements TEXT,
    challenges TEXT,
    risks TEXT,
    opportunities TEXT,
    solutions TEXT,
    photo TEXT
  )`);

  // Seed default data
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row.count === 0) {
      const salt = bcrypt.genSaltSync(10);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", 
        ["admin", bcrypt.hashSync("admin", salt), "area", "Rubel Rohan", null]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", 
        ["johnsmith", bcrypt.hashSync("1234", salt), "manager", "John Smith", 1]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", 
        ["sarahpatel", bcrypt.hashSync("1234", salt), "manager", "Sarah Patel", 2]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", 
        ["michaelbrown", bcrypt.hashSync("1234", salt), "manager", "Michael Brown", 3]);
    }
  });

  db.get("SELECT COUNT(*) as count FROM stores", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO stores VALUES (1, 'Milton Keynes - Central', '1234', 'John Smith')");
      db.run("INSERT INTO stores VALUES (2, 'Milton Keynes - Kingston', '5678', 'Sarah Patel')");
      db.run("INSERT INTO stores VALUES (3, 'Bletchley', '9012', 'Michael Brown')");
    }
  });
});

// ====================== STORES CRUD ======================
app.get('/stores', (req, res) => {
  db.all("SELECT * FROM stores ORDER BY id", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/stores', (req, res) => {
  const { name, number, manager } = req.body;
  db.run("INSERT INTO stores (name, number, manager) VALUES (?, ?, ?)",
    [name, number, manager],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

app.put('/stores/:id', (req, res) => {
  const { name, number, manager } = req.body;
  db.run("UPDATE stores SET name=?, number=?, manager=? WHERE id=?",
    [name, number, manager, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.delete('/stores/:id', (req, res) => {
  db.run("DELETE FROM stores WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ====================== USERS CRUD ======================
app.get('/users', (req, res) => {
  db.all("SELECT username, role, name, storeId FROM users", (err, rows) => {
    res.json(rows);
  });
});

app.post('/users', async (req, res) => {
  const { username, password, role, name, storeId } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  
  db.run("INSERT INTO users (username, password, role, name, storeId) VALUES (?, ?, ?, ?, ?)",
    [username, hashed, role, name, storeId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.put('/users/:username', async (req, res) => {
  const { password, role, name, storeId } = req.body;
  let query = "UPDATE users SET role=?, name=?, storeId=?";
  let params = [role, name, storeId];

  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    query += ", password=?";
    params = [role, name, storeId, hashed, req.params.username];
  } else {
    params.push(req.params.username);
  }

  db.run(query + " WHERE username=?", params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/users/:username', (req, res) => {
  db.run("DELETE FROM users WHERE username=?", [req.params.username], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ====================== OTHER ROUTES ======================
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (user && await bcrypt.compare(password, user.password)) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  });
});

app.post('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  db.get("SELECT password FROM users WHERE username = ?", [username], async (err, user) => {
    if (user && await bcrypt.compare(oldPassword, user.password)) {
      const hash = await bcrypt.hash(newPassword, 10);
      db.run("UPDATE users SET password = ? WHERE username = ?", [hash, username]);
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Old password incorrect" });
    }
  });
});

app.post('/entry', upload.single('photo'), (req, res) => {
  const { storeId, manager, achievements, challenges, risks, opportunities, solutions } = req.body;
  const photo = req.file ? req.file.filename : null;

  db.run(`INSERT INTO entries (date, storeId, manager, achievements, challenges, risks, opportunities, solutions, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [new Date().toISOString(), storeId, manager, achievements, challenges, risks, opportunities, solutions, photo],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    });
});

app.get('/entries', (req, res) => {
  db.all("SELECT * FROM entries ORDER BY date DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/weekly-reminder', (req, res) => {
  res.json({ message: "Don't forget to submit your weekly entry by Sunday!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Costa MK Patch Hub v3.1 running at http://localhost:${PORT}`);
  console.log(`📁 Database: costa_patch.db`);
  console.log(`🖼️  Photos saved in /uploads folder`);
});