// ============================================
// E-Election OSIS - Server
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const BCRYPT_ROUNDS = 10;

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Admin Dashboard (admin_voting folder)
app.use('/admin', express.static(path.join(__dirname, 'admin_voting')));

// ============================================
// Database Connection Pool
// ============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_e_election',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database connected successfully');

    // Auto-create admin table if it does not exist
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table "admin" is ready');

    // Auto-create voting_settings table if it does not exist
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS voting_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(50) NOT NULL UNIQUE,
        setting_value VARCHAR(50) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);    // Ensure default voting_status row exists
    await conn.execute(
      `INSERT IGNORE INTO voting_settings (setting_key, setting_value)
       VALUES ('voting_status', 'Belum Dimulai')`
    );
    console.log('✅ Table "voting_settings" is ready');

    // Auto-create paslon table if it does not exist
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS paslon (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nomor_urut INT NOT NULL,
        nama_ketua VARCHAR(150) NOT NULL,
        nama_wakil VARCHAR(150),
        visi TEXT,
        misi TEXT,
        foto TEXT
      )
    `);
    console.log('✅ Table "paslon" is ready');

    // Auto-add kelas column to voters table if missing
    try {
      await conn.execute(`ALTER TABLE voters ADD COLUMN kelas VARCHAR(50) DEFAULT NULL AFTER full_name`);
      console.log('✅ Column "kelas" added to voters table');
    } catch (e) {
      // Column already exists — ignore duplicate column error
      if (e.errno !== 1060) throw e;
    }

    conn.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️  Server will run without database. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env');
  }
}

// ============================================
// ROUTES - Landing
// ============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// Redirect /admin to login page
app.get('/admin', (req, res) => {
  res.redirect(302, '/admin/login.html');
});

// Admin page routes — serve HTML files from admin_voting/
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_voting', 'dashboard.html'));
});
app.get('/admin/paslon', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_voting', 'paslon.html'));
});
app.get('/admin/dpt', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_voting', 'dpt.html'));
});

// Redirect /register to register page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'register.html'));
});

// ============================================
// API - Admin Login
// POST /api/admin/login
// ============================================
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password harus diisi' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, password FROM admin WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    res.json({
      success: true,
      message: 'Login berhasil',
      admin: { id: rows[0].id, username: rows[0].username },
    });
  } catch (err) {
    console.error('Login error:', err.message || err);
    console.error('Full error details:', err);
    res.status(401).json({ message: 'Username atau password salah' });
  }
});

// ============================================
// API - Register Admin
// POST /api/register
// ============================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password harus diisi' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username minimal 3 karakter' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter' });
    }

    // Ensure admin table exists before inserting
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if username already exists
    const [existing] = await pool.execute(
      'SELECT id FROM admin WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.execute(
      'INSERT INTO admin (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.status(201).json({ success: true, message: 'Registrasi berhasil' });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// API - Voting Status
// GET  /api/admin/voting-status  — read current status
// POST /api/admin/voting-status  — update status (admin only)
// ============================================
app.get('/api/admin/voting-status', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_value FROM voting_settings WHERE setting_key = 'voting_status'"
    );
    const status = rows.length > 0 ? rows[0].setting_value : 'Belum Dimulai';
    res.json({ voting_status: status });
  } catch (err) {
    console.error('Get voting status error:', err);
    res.status(500).json({ message: 'Gagal mengambil status pemilihan' });
  }
});

app.post('/api/admin/voting-status', async (req, res) => {
  try {
    const { voting_status } = req.body;
    const allowed = ['Belum Dimulai', 'Berlangsung', 'Ditutup'];
    if (!voting_status || !allowed.includes(voting_status)) {
      return res.status(400).json({
        message: `Status harus salah satu dari: ${allowed.join(', ')}`,
      });
    }
    await pool.execute(
      `INSERT INTO voting_settings (setting_key, setting_value)
       VALUES ('voting_status', ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [voting_status, voting_status]
    );
    res.json({ success: true, message: `Status pemilihan diubah ke "${voting_status}"`, voting_status });
  } catch (err) {
    console.error('Set voting status error:', err);
    res.status(500).json({ message: 'Gagal mengubah status pemilihan' });
  }
});

// ============================================
// API - Quick Count (public)
// GET /api/quick-count
// Hanya mengembalikan data jika status = 'Ditutup'
// atau jika request datang dari session admin yang valid.
// ============================================
app.get('/api/quick-count', async (req, res) => {
  try {
    const [statusRows] = await pool.execute(
      "SELECT setting_value FROM voting_settings WHERE setting_key = 'voting_status'"
    );
    const status = statusRows.length > 0 ? statusRows[0].setting_value : 'Belum Dimulai';

    // Check if request is from an admin (by verifying admin query param or header)
    const adminToken = req.headers['x-admin-token'] || req.query.admin_token;
    let isAdmin = false;
    if (adminToken) {
      try {
        const [adminRows] = await pool.execute(
          'SELECT id FROM admin WHERE id = ?',
          [adminToken]
        );
        isAdmin = adminRows.length > 0;
      } catch (_) { /* ignore */ }
    }

    if (status !== 'Ditutup' && !isAdmin) {
      return res.status(403).json({
        message: 'Hasil quick count belum tersedia. Status pemilihan saat ini: ' + status,
      });
    }

    const [candidates] = await pool.execute(
      `SELECT id, candidate_number, chairman_name, vice_chairman_name,
              vision_mission, photo_url, vote_count
       FROM candidates ORDER BY candidate_number ASC`
    );

    const [voterStats] = await pool.execute(
      `SELECT COUNT(*) AS total_voters,
              SUM(is_voted = 1) AS voted_count
       FROM voters WHERE role = 'voter'`
    );

    const totalVotesCast = candidates.reduce((sum, c) => sum + (c.vote_count || 0), 0);

    res.json({
      voting_status: status,
      total_voters: voterStats[0].total_voters,
      total_votes_cast: totalVotesCast,
      candidates,
    });
  } catch (err) {
    console.error('Quick count error:', err);
    res.status(500).json({ message: 'Gagal mengambil data quick count' });
  }
});

// ============================================
// API - Dashboard Stats
// GET /api/admin/stats
// ============================================
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Statistik pemilih dari tabel voters — exclude admin accounts
    const [voterStats] = await pool.execute(
      `SELECT COUNT(*) AS total_voters,
              SUM(is_voted = 1) AS voted_count,
              SUM(is_voted = 0) AS unvoted_count
       FROM voters WHERE role = 'voter'`
    );
    const totalVoters = voterStats[0].total_voters;
    const totalVoted = voterStats[0].voted_count || 0;
    const totalNotVoted = voterStats[0].unvoted_count || 0;

    // Perolehan suara langsung dari tabel candidates (no votes table)
    const [candidateVotes] = await pool.execute(
      `SELECT id, candidate_number, CONCAT(chairman_name, ' & ', vice_chairman_name) AS name, vote_count
       FROM candidates ORDER BY candidate_number ASC`
    );

    // Total votes cast — sum of all candidates' vote_count
    const totalVotesCast = candidateVotes.reduce((sum, c) => sum + (c.vote_count || 0), 0);

    res.json({
      total_voters: totalVoters,
      total_voted: totalVoted,
      total_not_voted: totalNotVoted,
      total_votes_cast: totalVotesCast,
      candidates: candidateVotes,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Gagal mengambil statistik' });
  }
});

// ============================================
// API - CRUD Candidates
// ============================================

// GET all candidates
app.get('/api/admin/candidates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, candidate_number, chairman_name, vice_chairman_name,
              vision_mission, photo_url, vote_count
       FROM candidates ORDER BY candidate_number ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get candidates error:', err);
    res.status(500).json({ error: 'Gagal mengambil data kandidat' });
  }
});

// POST - Add candidate
app.post('/api/admin/candidates', async (req, res) => {
  try {
    const { chairman_name, vice_chairman_name, vision_mission, photo_url } = req.body;

    if (!chairman_name || !vice_chairman_name || !vision_mission) {
      return res.status(400).json({ error: 'Nama ketua, wakil ketua, dan visi-misi harus diisi' });
    }

    const [result] = await pool.execute(
      'INSERT INTO candidates (chairman_name, vice_chairman_name, vision_mission, photo_url) VALUES (?, ?, ?, ?)',
      [chairman_name, vice_chairman_name, vision_mission, photo_url || null]
    );

    res.status(201).json({
      success: true,
      message: 'Kandidat berhasil ditambahkan',
      id: result.insertId,
    });
  } catch (err) {
    console.error('Add candidate error:', err);
    res.status(500).json({ error: 'Gagal menambahkan kandidat' });
  }
});

// PUT - Edit candidate
app.put('/api/admin/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { chairman_name, vice_chairman_name, vision_mission, photo_url } = req.body;

    if (!chairman_name || !vice_chairman_name || !vision_mission) {
      return res.status(400).json({ error: 'Nama ketua, wakil ketua, dan visi-misi harus diisi' });
    }

    const [result] = await pool.execute(
      'UPDATE candidates SET chairman_name = ?, vice_chairman_name = ?, vision_mission = ?, photo_url = ? WHERE id = ?',
      [chairman_name, vice_chairman_name, vision_mission, photo_url || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
    }

    res.json({ success: true, message: 'Kandidat berhasil diperbarui' });
  } catch (err) {
    console.error('Update candidate error:', err);
    res.status(500).json({ error: 'Gagal memperbarui kandidat' });
  }
});

// DELETE - Delete candidate
app.delete('/api/admin/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM candidates WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
    }

    res.json({ success: true, message: 'Kandidat berhasil dihapus' });
  } catch (err) {
    console.error('Delete candidate error:', err);
    res.status(500).json({ error: 'Gagal menghapus kandidat' });
  }
});

// ============================================
// API - CRUD Paslon (new table: paslon)
// ============================================

// Auto-create paslon table on startup
async function ensurePaslonTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS paslon (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nomor_urut INT NOT NULL,
        nama_ketua VARCHAR(150) NOT NULL,
        nama_wakil VARCHAR(150),
        visi TEXT,
        misi TEXT,
        foto TEXT
      )
    `);
    console.log('✅ Table "paslon" is ready');
  } catch (err) {
    console.error('⚠️  Failed to create paslon table:', err.message);
  }
}

// GET all paslon
app.get('/api/paslon', async (req, res) => {
  try {
    await ensurePaslonTable();
    const [rows] = await pool.execute(
      'SELECT id, nomor_urut, nama_ketua, nama_wakil, visi, misi, foto FROM paslon ORDER BY nomor_urut ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET PASLON ERROR:', err);
    res.status(500).json({ error: 'Gagal mengambil data paslon' });
  }
});

// POST - Add paslon
app.post('/api/paslon', async (req, res) => {
  try {
    await ensurePaslonTable();
    const { nomor_urut, nama_ketua, nama_wakil, visi, misi, foto } = req.body;

    if (!nomor_urut || !nama_ketua) {
      return res.status(400).json({ error: 'Nomor urut dan nama ketua harus diisi' });
    }

    const [result] = await pool.execute(
      'INSERT INTO paslon (nomor_urut, nama_ketua, nama_wakil, visi, misi, foto) VALUES (?, ?, ?, ?, ?, ?)',
      [nomor_urut, nama_ketua, nama_wakil || null, visi || null, misi || null, foto || null]
    );

    res.status(201).json({
      success: true,
      message: 'Paslon berhasil ditambahkan',
      id: result.insertId,
    });
  } catch (err) {
    console.error('ADD PASLON ERROR:', err);
    res.status(500).json({ error: 'Gagal menambahkan paslon' });
  }
});

// PUT - Edit paslon
app.put('/api/paslon/:id', async (req, res) => {
  try {
    await ensurePaslonTable();
    const { id } = req.params;
    const { nomor_urut, nama_ketua, nama_wakil, visi, misi, foto } = req.body;

    if (!nomor_urut || !nama_ketua) {
      return res.status(400).json({ error: 'Nomor urut dan nama ketua harus diisi' });
    }

    const [result] = await pool.execute(
      'UPDATE paslon SET nomor_urut = ?, nama_ketua = ?, nama_wakil = ?, visi = ?, misi = ?, foto = ? WHERE id = ?',
      [nomor_urut, nama_ketua, nama_wakil || null, visi || null, misi || null, foto || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paslon tidak ditemukan' });
    }

    res.json({ success: true, message: 'Paslon berhasil diperbarui' });
  } catch (err) {
    console.error('UPDATE PASLON ERROR:', err);
    res.status(500).json({ error: 'Gagal memperbarui paslon' });
  }
});

// DELETE - Delete paslon
app.delete('/api/paslon/:id', async (req, res) => {
  try {
    await ensurePaslonTable();
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM paslon WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paslon tidak ditemukan' });
    }

    res.json({ success: true, message: 'Paslon berhasil dihapus' });
  } catch (err) {
    console.error('DELETE PASLON ERROR:', err);
    res.status(500).json({ error: 'Gagal menghapus paslon' });
  }
});

// ============================================
// API - Voters Management
// ============================================

// GET - All voters (with search, filter kelas, pagination)
app.get('/api/admin/voters', async (req, res) => {
  try {
    const search = req.query.search || '';
    const kelas  = req.query.kelas || '';
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let where = "WHERE role = 'voter'";
    const params = [];

    if (search) {
      where += ' AND (identifier LIKE ? OR full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (kelas) {
      where += ' AND kelas = ?';
      params.push(kelas);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM voters ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT id, identifier, full_name, kelas, role, is_voted, voted_at, created_at
       FROM voters ${where}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Get distinct kelas values for filter dropdown
    const [kelasRows] = await pool.execute(
      "SELECT DISTINCT kelas FROM voters WHERE kelas IS NOT NULL AND kelas != '' AND role = 'voter' ORDER BY kelas"
    );

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      kelas_options: kelasRows.map(r => r.kelas),
    });
  } catch (err) {
    console.error('Get voters error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pemilih' });
  }
});

// POST - Add voter
app.post('/api/admin/voters', async (req, res) => {
  try {
    const { identifier, full_name, role, kelas } = req.body;

    if (!identifier || !full_name) {
      return res.status(400).json({ error: 'Identifier dan Nama harus diisi' });
    }

    const [result] = await pool.execute(
      'INSERT INTO voters (identifier, full_name, role, kelas) VALUES (?, ?, ?, ?)',
      [identifier, full_name, role || 'voter', kelas || null]
    );

    res.status(201).json({
      success: true,
      message: 'Pemilih berhasil ditambahkan',
      id: result.insertId,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Identifier sudah terdaftar' });
    }
    console.error('Add voter error:', err);
    res.status(500).json({ error: 'Gagal menambahkan pemilih' });
  }
});

// PUT - Reset voter vote status
app.put('/api/admin/voters/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      'UPDATE voters SET is_voted = 0, voted_at = NULL WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pemilih tidak ditemukan' });
    }
    res.json({ success: true, message: 'Status vote berhasil direset' });
  } catch (err) {
    console.error('Reset voter error:', err);
    res.status(500).json({ error: 'Gagal mereset status vote' });
  }
});

// DELETE - Delete voter
app.delete('/api/admin/voters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM voters WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pemilih tidak ditemukan' });
    }

    res.json({ success: true, message: 'Pemilih berhasil dihapus' });
  } catch (err) {
    console.error('Delete voter error:', err);
    res.status(500).json({ error: 'Gagal menghapus pemilih' });
  }
});

// ============================================
// API - Voter Vote (for voting page)
// POST /api/vote
// ============================================
app.post('/api/vote', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { voter_id, candidate_id } = req.body;

    if (!voter_id || !candidate_id) {
      return res.status(400).json({ error: 'Voter ID dan Candidate ID harus diisi' });
    }

    // --- VALIDATION 1: Check voting status is 'Berlangsung' ---
    const [statusRows] = await conn.execute(
      "SELECT setting_value FROM voting_settings WHERE setting_key = 'voting_status'"
    );
    const votingStatus = statusRows.length > 0 ? statusRows[0].setting_value : 'Belum Dimulai';

    if (votingStatus !== 'Berlangsung') {
      await conn.rollback();
      return res.status(403).json({
        error: 'Voting tidak dapat dilakukan. Status pemilihan saat ini: ' + votingStatus,
      });
    }

    await conn.beginTransaction();

    // --- VALIDATION 2: Check voter exists ---
    const [existing] = await conn.execute(
      'SELECT id, is_voted FROM voters WHERE id = ?',
      [voter_id]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pemilih tidak ditemukan' });
    }

    // --- VALIDATION 3: Prevent double voting ---
    if (existing[0].is_voted === 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Anda sudah melakukan voting' });
    }

    // Check candidate exists
    const [candidate] = await conn.execute(
      'SELECT id FROM candidates WHERE id = ?',
      [candidate_id]
    );

    if (candidate.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
    }

    // Increment vote_count directly in candidates table (no votes table)
    await conn.execute(
      'UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?',
      [candidate_id]
    );

    // Update voter status
    await conn.execute(
      'UPDATE voters SET is_voted = 1, voted_at = NOW() WHERE id = ?',
      [voter_id]
    );

    await conn.commit();

    res.json({ success: true, message: 'Voting berhasil' });
  } catch (err) {
    await conn.rollback();
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Gagal melakukan voting' });
  } finally {
    conn.release();
  }
});

// ============================================
// Static HTML serving (legacy - kept for backward compat)
// ============================================
app.get('/admin/legacy-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/legacy-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// ============================================
// Wildcard catch-all — non-API routes fall back to login
// ============================================
app.get('*', (req, res) => {
  // If the request is for an API path that wasn't matched, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Endpoint tidak ditemukan' });
  }
  // Otherwise, redirect to login page
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// ============================================
// Start Server
// ============================================
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 E-Election OSIS Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  });
}

// Jalankan server hanya jika tidak di-deploy ke Vercel
if (!process.env.VERCEL) {
  start();
}

module.exports = app;
