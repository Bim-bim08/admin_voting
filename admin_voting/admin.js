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
const API_BASE_URL = 'https://web-voting-phi.vercel.app';

async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE_URL + url, {
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
    throw new Error(data.message || data.error || `Request gagal (${res.status})`);
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

  async register(username, password) {
    return apiFetch('/api/register', {
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

  // ── Candidates CRUD (public endpoints, shared with voter app) ──
  candidates: {
    async list()  { return apiFetch('/api/candidates'); },
    async add(b)  { return apiFetch('/api/candidates', { method: 'POST', body: JSON.stringify(b) }); },
    async update(id, b) { return apiFetch('/api/candidates', { method: 'PUT', body: JSON.stringify({ ...b, id }) }); },
    async del(id) { return apiFetch(`/api/candidates?id=${id}`, { method: 'DELETE' }); },
  },

  // ── Alias: paslon → candidates (same table, different naming) ──
  paslon: {
    async list()  { return apiFetch('/api/candidates'); },
    async add(b)  { return apiFetch('/api/candidates', { method: 'POST', body: JSON.stringify(b) }); },
    async update(id, b) { return apiFetch('/api/candidates', { method: 'PUT', body: JSON.stringify({ ...b, id }) }); },
    async del(id) { return apiFetch(`/api/candidates?id=${id}`, { method: 'DELETE' }); },
  },

  // ── Voters CRUD + Reset + Search ──
  voters: {
    async list()  { return apiFetch('/api/admin/voters'); },
    async search(params) {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.kelas)  qs.set('kelas', params.kelas);
      if (params.page)   qs.set('page', params.page);
      if (params.limit)  qs.set('limit', params.limit);
      return apiFetch('/api/admin/voters?' + qs.toString());
    },
    async add(b)  { return apiFetch('/api/admin/voters', { method: 'POST', body: JSON.stringify(b) }); },
    async del(id) { return apiFetch(`/api/admin/voters/${id}`, { method: 'DELETE' }); },
    async reset(id) { return apiFetch(`/api/admin/voters/${id}/reset`, { method: 'PUT' }); },
  },

  // ── Voting Status ──
  votingStatus: {
    async get()    { return apiFetch('/api/admin/voting-status'); },
    async set(s)   { return apiFetch('/api/admin/voting-status', { method: 'POST', body: JSON.stringify({ voting_status: s }) }); },
  },

  // ── Public Voter API (for DPT table) ──
  publicVoters: {
    async list() { return apiFetch('/api/voters'); },
  },

  // ── Public Candidates API (full CRUD, for paslon page) ──
  publicCandidates: {
    async list()     { return apiFetch('/api/candidates'); },
    async add(b)     { return apiFetch('/api/candidates', { method: 'POST', body: JSON.stringify(b) }); },
    async update(id, b) { return apiFetch('/api/candidates', { method: 'PUT', body: JSON.stringify({ ...b, id }) }); },
    async del(id)    { return apiFetch(`/api/candidates?id=${id}`, { method: 'DELETE' }); },
  },

  // ── Public Stats API (for Dashboard) ──
  async publicStats() {
    return apiFetch('/api/stats');
  },
};
