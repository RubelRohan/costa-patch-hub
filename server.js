const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Database
const db = new sqlite3.Database('costa_patch.db');

// ====================== ERROR HANDLING MIDDLEWARE ======================
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ success: false, message: 'Database constraint error' });
  }
  
  if (err.message.includes('ENOENT')) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// ====================== DATABASE SETUP ======================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stores (...)`); // your existing tables
  db.run(`CREATE TABLE IF NOT EXISTS users (...)`);
  db.run(`CREATE TABLE IF NOT EXISTS entries (...)`);

  // Seed default data (same as before)
  // ... (keep your existing seeding code here)
});

// ====================== ROUTES ======================
// Your existing routes here...

app.get('/stores', (req, res, next) => {
  db.all("SELECT * FROM stores ORDER BY id", (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
});

app.post('/stores', (req, res, next) => {
  const { name, number, manager } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Store name is required" });

  db.run("INSERT INTO stores (name, number, manager) VALUES (?, ?, ?)",
    [name, number, manager], function(err) {
      if (err) return next(err);
      res.json({ success: true, id: this.lastID });
    });
});

// ... (keep all your other routes: login, entry, users, etc.)

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

// ====================== GLOBAL ERROR HANDLER ======================
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Costa MK Patch Hub running at http://localhost:${PORT}`);
  console.log(`📁 Database: costa_patch.db`);
  console.log(`🖼️  Photos: /uploads folder`);
});
