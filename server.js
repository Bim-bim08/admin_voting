// ============================================
// E-Election OSIS - Server
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

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
      'SELECT id, username FROM admins WHERE username = ? AND password = ?',
      [username, password]
    );

    if (rows.length === 0) {
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
// API - Dashboard Stats
// GET /api/admin/stats
// ============================================
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Statistik pemilih dari tabel voters (single query)
    const [voterStats] = await pool.execute(
      `SELECT COUNT(*) AS total_voters,
              SUM(is_voted = 1) AS voted_count,
              SUM(is_voted = 0) AS unvoted_count
       FROM voters`
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
// API - Voters Management
// ============================================

// GET - All voters
app.get('/api/admin/voters', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, identifier, full_name, role, is_voted, voted_at, created_at FROM voters ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Get voters error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pemilih' });
  }
});

// POST - Add voter
app.post('/api/admin/voters', async (req, res) => {
  try {
    const { identifier, full_name, role } = req.body;

    if (!identifier || !full_name) {
      return res.status(400).json({ error: 'Identifier dan Nama harus diisi' });
    }

    const [result] = await pool.execute(
      'INSERT INTO voters (identifier, full_name, role) VALUES (?, ?, ?)',
      [identifier, full_name, role || 'voter']
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

    await conn.beginTransaction();

    // Check if voter exists and has not voted
    const [existing] = await conn.execute(
      'SELECT is_voted FROM voters WHERE id = ?',
      [voter_id]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pemilih tidak ditemukan' });
    }

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
