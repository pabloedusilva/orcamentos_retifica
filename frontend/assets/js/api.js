// Minimal API client wrapper for the frontend
(function(){
  // Auto-detect API base - same origin when served from Node.js server
  const defaultBase = window.__API_BASE__ || (
    window.location.origin.includes('localhost') ? window.location.origin : window.location.origin
  );
  const storedBase = localStorage.getItem('apiBase');
  const API_BASE = storedBase || defaultBase;

  function getToken(){ return localStorage.getItem('token') || ''; }
  function setToken(token){ if (token) localStorage.setItem('token', token); else localStorage.removeItem('token'); }
  function isAuthed(){ return !!getToken(); }

  async function apiFetch(path, options = {}){
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = Object.assign({}, options, { headers });
    const res = await fetch(url, opts);
    // Do not auto-redirect on 401 here; allow callers to handle session expiration.
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = (isJson && data && data.error) ? data.error : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function get(path){ return apiFetch(path, { method: 'GET' }); }
  async function post(path, body){ return apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  async function put(path, body){ return apiFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  async function patch(path, body){ return apiFetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  async function del(path){ return apiFetch(path, { method: 'DELETE' }); }

  async function uploadImage(file){
    const form = new FormData();
    form.append('image', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/files/image`, { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {}, body: form });
    if (!res.ok) throw new Error('Falha no upload');
    return res.json(); // { url }
  }

  // Printers API
  async function listPrinters(){ return get('/api/v1/printers'); }
  async function getConnectedPrinter(){ return get('/api/v1/printers/connected'); }
  async function getConnectedPrinterStatus(){ return get('/api/v1/printers/status/connected'); }
  async function connectPrinter(id){ return post(`/api/v1/printers/${id}/connect`, {}); }
  async function disconnectPrinter(id){ return post(`/api/v1/printers/${id}/disconnect`, {}); }
  async function testPrinter(body){ return post('/api/v1/printers/test', body); }
  async function createPrinter(printer){ return post('/api/v1/printers', printer); }
  async function updatePrinter(id, data){ return put(`/api/v1/printers/${id}`, data); }
  async function deletePrinter(id){ return del(`/api/v1/printers/${id}`); }
  async function setDefaultPrinter(id){ return post(`/api/v1/printers/${id}/default`, {}); }

  window.api = { API_BASE, getToken, setToken, isAuthed, get, post, put, patch, del, uploadImage,
    listPrinters, getConnectedPrinter, getConnectedPrinterStatus, connectPrinter, disconnectPrinter, testPrinter, createPrinter, updatePrinter, deletePrinter, setDefaultPrinter };
})();
