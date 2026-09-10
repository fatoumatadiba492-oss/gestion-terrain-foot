const API = 'http://127.0.0.1:8000/api';
const TOKEN_KEY = 'terrain_admin_token';
let terrains = [];

const $ = id => document.getElementById(id);
const token = () => localStorage.getItem(TOKEN_KEY);

async function api(path, options = {}) {
  const headers = {'Accept':'application/json','Content-Type':'application/json', ...(options.headers || {})};
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(`${API}${path}`, {...options, headers});
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); showLogin(); throw new Error('Session expirée.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || Object.values(data.errors || {}).flat()[0] || 'Une erreur est survenue.');
  return data;
}

function showLogin() { $('loginView').hidden=false; $('dashboardView').hidden=true; }
function showDashboard() { $('loginView').hidden=true; $('dashboardView').hidden=false; }

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('loginError').textContent='';
  try {
    const data = await fetch(`${API}/auth/login`, {method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,password:$('password').value})}).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.message || 'Identifiants invalides.'); return d; });
    if (data.user?.role !== 'admin') throw new Error('Ce compte n’a pas les droits administrateur.');
    localStorage.setItem(TOKEN_KEY, data.token); await boot();
  } catch(err) { $('loginError').textContent=err.message; }
});

async function boot() {
  try {
    const me = await api('/auth/me');
    if (me.user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    $('welcome').textContent = `Connecté : ${me.user.name}`;
    showDashboard(); await loadTerrains();
  } catch(err) { localStorage.removeItem(TOKEN_KEY); showLogin(); }
}

async function loadTerrains() {
  try {
    const data = await api('/admin/terrains');
    terrains = data.data || [];
    const total = terrains.length;
    $('totalStat').textContent = total;
    $('activeStat').textContent = terrains.filter(t=>t.status==='active').length;
    $('inactiveStat').textContent = terrains.filter(t=>t.status==='inactive').length;
    $('terrainRows').innerHTML = terrains.length ? terrains.map(row).join('') : `<tr><td colspan="6">Aucun terrain enregistré.</td></tr>`;
    $('message').textContent='';
  } catch(err) { $('message').textContent=err.message; }
}

function row(t) {
  const owner = t.owner ? `${escapeHtml(t.owner.name)}${t.owner.email ? `<small> · ${escapeHtml(t.owner.email)}</small>`:''}` : '—';
  return `<tr><td><strong>${escapeHtml(t.name)}</strong></td><td>${escapeHtml(t.quartier)}, ${escapeHtml(t.city)}</td><td>${escapeHtml(t.type)}</td><td>${owner}</td><td><span class="badge ${t.status}">${t.status==='active'?'Actif':'Inactif'}</span></td><td><div class="actions"><button onclick="editTerrain(${t.id})" class="ghost">Modifier</button>${t.status==='active'?`<button onclick="disableTerrain(${t.id})" class="danger">Désactiver</button>`:''}</div></td></tr>`;
}

function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

$('addBtn').onclick = () => openForm();
$('closeDialog').onclick = $('cancelBtn').onclick = () => $('terrainDialog').close();
$('terrainForm').addEventListener('submit', async e => {
  e.preventDefault(); $('formError').textContent='';
  const id = $('terrainId').value;
  const payload = {};
  ['name','description','address','quartier','city','phone','image','type','status'].forEach(k=>payload[k]=$(k).value || null);
  ['capacity','owner_id'].forEach(k=>{ if($(k).value) payload[k]=Number($(k).value); });
  ['latitude','longitude'].forEach(k=>{ if($(k).value) payload[k]=Number($(k).value); });
  try {
    await api(id ? `/admin/terrains/${id}` : '/admin/terrains', {method:id?'PUT':'POST',body:JSON.stringify(payload)});
    $('terrainDialog').close(); $('message').textContent='Terrain enregistré avec succès.'; await loadTerrains();
  } catch(err) { $('formError').textContent=err.message; }
});

function openForm(t=null) {
  $('terrainForm').reset(); $('terrainId').value=t?.id || ''; $('dialogTitle').textContent=t?'Modifier le terrain':'Ajouter un terrain';
  $('city').value=t?.city || 'Dakar'; $('type').value=t?.type || '5x5'; $('status').value=t?.status || 'active';
  ['name','description','address','quartier','phone','image','capacity','owner_id','latitude','longitude'].forEach(k=>{ if(t?.[k] != null) $(k).value=t[k]; });
  $('formError').textContent=''; $('terrainDialog').showModal();
}

window.editTerrain = id => openForm(terrains.find(t=>t.id===id));
window.disableTerrain = async id => { if(!confirm('Désactiver ce terrain ?')) return; try { await api(`/admin/terrains/${id}`,{method:'DELETE'}); $('message').textContent='Terrain désactivé.'; await loadTerrains(); } catch(err){ $('message').textContent=err.message; } };

$('logoutBtn').onclick = async () => { try { await api('/auth/logout',{method:'POST'}); } catch {} localStorage.removeItem(TOKEN_KEY); showLogin(); };

boot();
