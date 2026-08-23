/**
 * admin.js — E-Election OSIS Admin
 *
 * Fetch API module untuk autentikasi, statistik, CRUD paslon & DPT,
 * dan reset status vote.  Semua fungsi melempar Error agar caller
 * bisa menangani dan menampilkan fallback UI.
 */

// ============================================
// Base API Helper
// ============================================
async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr) {
    throw new Error('Gagal terhubung ke server. Periksa koneksi Anda.');
  }

  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error('Respons server tidak valid.');
  }

  if (!res.ok) {
    throw new Error(data.error || `Request gagal (${res.status})`);
  }
  return data;
}

// ============================================
// Admin API Namespace
// ============================================
const AdminAPI = {

  // ── Auth ──
  async login(username, password) {
    return apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    localStorage.removeItem('admin');
    location.href = '/admin/login.html';
  },

  // ── Stats ──
  async stats() {
    return apiFetch('/api/admin/stats');
  },

  // ── Candidates CRUD ──
  candidates: {
    async list()  { return apiFetch('/api/admin/candidates'); },
    async add(b)  { return apiFetch('/api/admin/candidates', { method: 'POST', body: JSON.stringify(b) }); },
    async update(id, b) { return apiFetch(`/api/admin/candidates/${id}`, { method: 'PUT', body: JSON.stringify(b) }); },
    async del(id) { return apiFetch(`/api/admin/candidates/${id}`, { method: 'DELETE' }); },
  },

  // ── Voters CRUD + Reset ──
  voters: {
    async list()  { return apiFetch('/api/admin/voters'); },
    async add(b)  { return apiFetch('/api/admin/voters', { method: 'POST', body: JSON.stringify(b) }); },
    async del(id) { return apiFetch(`/api/admin/voters/${id}`, { method: 'DELETE' }); },
    async reset(id) { return apiFetch(`/api/admin/voters/${id}/reset`, { method: 'PUT' }); },
  },
};
