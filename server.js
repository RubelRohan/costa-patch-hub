const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create folders
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
if (!fs.existsSync('backups')) fs.mkdirSync('backups', { recursive: true });

// Serve Static Files (Important)
app.use(express.static(__dirname));

// Multer
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

// ====================== DATABASE & BACKUP (simplified for now) ======================
const db = new sqlite3.Database('costa_patch.db');

// Auto Backup
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFile('costa_patch.db', `backups/costa_patch_${timestamp}.db`, () => {
    console.log("✅ Backup created");
  });
}
createBackup();
setInterval(createBackup, 24*60*60*1000);

// ====================== ROUTES ======================
app.get('/', (req, res) => res.send('✅ Costa MK Patch Hub Backend Running!'));

app.get('/stores', (req, res) => { /* your stores route */ });
app.post('/stores', (req, res) => { /* ... */ });
app.put('/stores/:id', (req, res) => { /* ... */ });
app.delete('/stores/:id', (req, res) => { /* ... */ });

app.get('/users', (req, res) => { /* ... */ });
app.post('/login', async (req, res) => { /* ... */ });
app.post('/change-password', async (req, res) => { /* ... */ });

app.post('/entry', upload.single('photo'), (req, res) => { /* ... */ });
app.get('/entries', (req, res) => { /* ... */ });

// ====================== IMPORTANT: SERVE FRONTEND ======================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Keep Render awake
setInterval(async () => {
  try {
    await fetch('https://costa-mk-patch-managers-insights.onrender.com');
    console.log('Keep-alive ping sent');
  } catch (e) {}
}, 14 * 60 * 1000); // every 14 minutes

// ====================== START ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend should now be served at https://costa-mk-patch.onrender.com`);
});
