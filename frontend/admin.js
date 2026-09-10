const API='http://127.0.0.1:8000/api';
const TOKEN_KEY='terrain_admin_token';
let terrains=[];
const $=id=>document.getElementById(id);
const token=()=>localStorage.getItem(TOKEN_KEY);

async function api(path,options={}){
  const headers={'Accept':'application/json','Content-Type':'application/json',...(options.headers||{})};
  if(token())headers.Authorization=`Bearer ${token()}`;
  const r=await fetch(`${API}${path}`,{...options,headers});
  if(r.status===401){localStorage.removeItem(TOKEN_KEY);showLogin();throw Error('Session expirée.')}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.message||Object.values(d.errors||{}).flat()[0]||'Une erreur est survenue.');
  return d;
}
function showLogin(){$('loginView').hidden=false;$('dashboardView').hidden=true}
function showDashboard(){$('loginView').hidden=true;$('dashboardView').hidden=false}

$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';try{const r=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,password:$('password').value})});const d=await r.json();if(!r.ok)throw Error(d.message||'Identifiants invalides.');if(d.user?.role!=='admin')throw Error('Ce compte n’a pas les droits administrateur.');localStorage.setItem(TOKEN_KEY,d.token);await boot()}catch(err){$('loginError').textContent=err.message}});
async function boot(){try{const me=await api('/auth/me');if(me.user?.role!=='admin')throw Error();$('welcome').textContent=`Connecté : ${me.user.name}`;showDashboard();await loadTerrains()}catch{$('welcome').textContent='';localStorage.removeItem(TOKEN_KEY);showLogin()}}
async function loadTerrains(){try{const d=await api('/admin/terrains');terrains=d.data||[];$('totalStat').textContent=terrains.length;$('activeStat').textContent=terrains.filter(t=>t.status==='active').length;$('inactiveStat').textContent=terrains.filter(t=>t.status==='inactive').length;$('terrainRows').innerHTML=terrains.length?terrains.map(row).join(''):'<tr><td colspan="6">Aucun terrain enregistré.</td></tr>'}catch(e){$('message').textContent=e.message}}
function row(t){const owner=t.owner?escapeHtml(t.owner.name):'—';return `<tr><td><strong>${escapeHtml(t.name)}</strong></td><td>${escapeHtml(t.quartier)}, ${escapeHtml(t.city)}</td><td>${escapeHtml(t.type)}</td><td>${owner}</td><td><span class="badge ${t.status}">${t.status==='active'?'Actif':'Inactif'}</span></td><td><div class="actions"><button onclick="editTerrain(${t.id})" class="ghost">Modifier</button>${t.status==='active'?`<button onclick="disableTerrain(${t.id})" class="danger">Désactiver</button>`:''}</div></td></tr>`}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}

$('addBtn').onclick=()=>openForm();
$('closeDialog').onclick=$('cancelBtn').onclick=()=>$('terrainDialog').close();
$('addSlotBtn').onclick=()=>addSlotRow();

$('terrainForm').addEventListener('submit',async e=>{
  e.preventDefault();$('formError').textContent='';
  const id=$('terrainId').value;
  const payload={};
  ['name','description','address','quartier','city','phone','image','type','status'].forEach(k=>payload[k]=$(k).value||null);
  ['capacity','owner_id'].forEach(k=>{if($(k).value)payload[k]=Number($(k).value)});
  ['latitude','longitude'].forEach(k=>{if($(k).value)payload[k]=Number($(k).value)});
  try{
    const terrain=await api(id?`/admin/terrains/${id}`:'/admin/terrains',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
    const terrainId=id||terrain.id;
    await saveSlots(terrainId);
    $('terrainDialog').close();$('message').textContent='Terrain et configuration enregistrés.';await loadTerrains();
  }catch(err){$('formError').textContent=err.message}
});

async function saveSlots(terrainId){
  for(const el of document.querySelectorAll('.slot-row')){
    const id=el.dataset.id;
    const start=el.querySelector('.slot-start').value;
    const end=el.querySelector('.slot-end').value;
    const price=el.querySelector('.slot-price').value;
    if(!start||!end||price==='')throw Error('Chaque créneau doit avoir un jour, une heure de début, une heure de fin et un prix.');
    const payload={day_of_week:Number(el.querySelector('.slot-day').value),start_time:start,end_time:end,price:Number(price),is_active:el.querySelector('.slot-active').checked};
    await api(id?`/admin/terrains/${terrainId}/slots/${id}`:`/admin/terrains/${terrainId}/slots`,{method:id?'PUT':'POST',body:JSON.stringify(payload)});
  }
}

const days=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
function addSlotRow(s=null){
  const d=document.createElement('div');d.className='slot-row';if(s?.id)d.dataset.id=s.id;
  d.innerHTML=`<select class="slot-day">${days.map((x,i)=>`<option value="${i+1}" ${Number(s?.day_of_week)===i+1?'selected':''}>${x}</option>`).join('')}</select><input class="slot-start" type="time" value="${s?.start_time?.slice(0,5)||''}"><input class="slot-end" type="time" value="${s?.end_time?.slice(0,5)||''}"><input class="slot-price" type="number" min="0" placeholder="Prix en FCFA" value="${s?.price??''}"><label class="check"><input class="slot-active" type="checkbox" ${s?.is_active!==false?'checked':''}> actif</label><button type="button" class="danger" onclick="removeSlotRow(this)">×</button>`;
  $('slotRows').appendChild(d)
}

async function removeSlotRow(button){
  const row=button.parentElement;const id=row.dataset.id;
  if(id){if(!confirm('Supprimer définitivement ce créneau ?'))return;try{const terrainId=$('terrainId').value;await api(`/admin/terrains/${terrainId}/slots/${id}`,{method:'DELETE'})}catch(e){$('formError').textContent=e.message;return}}
  row.remove();
}

function openForm(t=null){
  $('terrainForm').reset();$('terrainId').value=t?.id||'';$('dialogTitle').textContent=t?'Modifier le terrain':'Ajouter un terrain';
  $('city').value=t?.city||'Dakar';$('type').value=t?.type||'';$('status').value=t?.status||'active';
  ['name','description','address','quartier','phone','image','capacity','owner_id','latitude','longitude'].forEach(k=>{if(t?.[k]!=null)$(k).value=t[k]});
  $('slotRows').innerHTML='';$('slotsPanel').hidden=false;
  if(t?.slots?.length)t.slots.forEach(addSlotRow);
  $('formError').textContent='';$('terrainDialog').showModal()
}
window.editTerrain=id=>openForm(terrains.find(t=>t.id===id));
window.removeSlotRow=removeSlotRow;
window.disableTerrain=async id=>{if(!confirm('Désactiver ce terrain ?'))return;try{await api(`/admin/terrains/${id}`,{method:'DELETE'});$('message').textContent='Terrain désactivé.';await loadTerrains()}catch(e){$('message').textContent=e.message}};
$('logoutBtn').onclick=async()=>{try{await api('/auth/logout',{method:'POST'})}catch{}localStorage.removeItem(TOKEN_KEY);showLogin()};
boot();
