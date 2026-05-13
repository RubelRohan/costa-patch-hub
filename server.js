const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================== EMAIL CONFIG ======================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rubel.rohan.rr@gmail.com',
    pass: 'egyi qgoj pzrf aool'
  }
});

async function sendBackupEmail(backupFile) {
  try {
    await transporter.sendMail({
      from: '"Costa Patch Hub" <rubel.rohan.rr@gmail.com>',
      to: 'rubel.rohan.rr@gmail.com',
      subject: `✅ Costa Patch Backup - ${new Date().toLocaleDateString()}`,
      html: `
        <h2>Database Backup Successful</h2>
        <p><strong>File:</strong> ${backupFile}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p>All data is safely backed up.</p>
      `
    });
    console.log(`📧 Backup email sent to rubel.rohan.rr@gmail.com`);
  } catch (err) {
    console.error("Email failed:", err.message);
  }
}

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
if (!fs.existsSync('backups')) fs.mkdirSync('backups', { recursive: true });

const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

// ====================== AUTO BACKUP ======================
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `backups/costa_patch_${timestamp}.db`;
  
  fs.copyFile('costa_patch.db', backupFile, async (err) => {
    if (err) {
      console.error('Backup failed:', err);
    } else {
      console.log(`✅ Backup created: ${backupFile}`);
      cleanupOldBackups();
      await sendBackupEmail(backupFile);
    }
  });
}

function cleanupOldBackups() {
  fs.readdir('backups', (err, files) => {
    if (err) return;
    const backups = files.filter(f => f.startsWith('costa_patch_')).sort().reverse();
    backups.slice(7).forEach(file => fs.unlink(`backups/${file}`, () => {}));
  });
}

createBackup();
setInterval(createBackup, 24 * 60 * 60 * 1000); // Daily backup

// ====================== DATABASE ======================
const db = new sqlite3.Database('costa_patch.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, number TEXT, manager TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, storeId INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, storeId INTEGER, manager TEXT, achievements TEXT, challenges TEXT, risks TEXT, opportunities TEXT, solutions TEXT, photo TEXT)`);

  // Seed Data
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row.count === 0) {
      const salt = bcrypt.genSaltSync(10);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ["admin", bcrypt.hashSync("admin", salt), "area", "Rubel Rohan", null]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ["johnsmith", bcrypt.hashSync("1234", salt), "manager", "John Smith", 1]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ["sarahpatel", bcrypt.hashSync("1234", salt), "manager", "Sarah Patel", 2]);
      db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ["michaelbrown", bcrypt.hashSync("1234", salt), "manager", "Michael Brown", 3]);
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

// ====================== ROUTES ======================
app.get('/', (req, res) => res.send('✅ Costa MK Patch Hub is Live with Auto Backup & Email!'));

app.get('/stores', (req, res, next) => {
  db.all("SELECT * FROM stores ORDER BY id", (err, rows) => { if (err) return next(err); res.json(rows); });
});

app.post('/stores', (req, res, next) => {
  const { name, number, manager } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Store name required" });
  db.run("INSERT INTO stores (name, number, manager) VALUES (?, ?, ?)", [name, number, manager], function(err) {
    if (err) return next(err);
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/stores/:id', (req, res, next) => {
  const { name, number, manager } = req.body;
  db.run("UPDATE stores SET name=?, number=?, manager=? WHERE id=?", [name, number, manager, req.params.id], (err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

app.delete('/stores/:id', (req, res, next) => {
  db.run("DELETE FROM stores WHERE id=?", [req.params.id], (err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

app.get('/users', (req, res, next) => {
  db.all("SELECT username, role, name, storeId FROM users", (err, rows) => { if (err) return next(err); res.json(rows); });
});

app.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return next(err);
    if (user && await bcrypt.compare(password, user.password)) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });
});

app.post('/change-password', async (req, res, next) => {
  const { username, oldPassword, newPassword } = req.body;
  db.get("SELECT password FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return next(err);
    if (user && await bcrypt.compare(oldPassword, user.password)) {
      const hash = await bcrypt.hash(newPassword, 10);
      db.run("UPDATE users SET password = ? WHERE username = ?", [hash, username]);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Old password incorrect" });
    }
  });
});

app.post('/entry', upload.single('photo'), (req, res, next) => {
  const { storeId, manager, achievements, challenges, risks, opportunities, solutions } = req.body;
  const photo = req.file ? req.file.filename : null;

  db.run(`INSERT INTO entries (date, storeId, manager, achievements, challenges, risks, opportunities, solutions, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [new Date().toISOString(), storeId, manager, achievements, challenges, risks, opportunities, solutions, photo],
    (err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
});

app.get('/entries', (req, res, next) => {
  db.all("SELECT * FROM entries ORDER BY date DESC", (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
});

app.post('/backup', (req, res) => {
  createBackup();
  res.json({ success: true, message: "Manual backup triggered" });
});

// ====================== ERROR HANDLING ======================
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
};

app.use(errorHandler);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ====================== START SERVER ======================
app.listen(PORT, () => {
  console.log(`🚀 Costa MK Patch Hub running at http://localhost:${PORT}`);
  console.log(`💾 Auto Backup + Email Notification ENABLED`);
  console.log(`📧 Notifications sent to: rubel.rohan.rr@gmail.com`);
});
