(() => {
  const apiBase = window.BACKEND_URL || 'http://127.0.0.1:8000';
  const bookingForm = document.querySelector('#bookingForm');
  const customSearchForm = document.querySelector('#customSearchForm');
  let terrains = [];
  let selectedTerrainId = null;
  let chosenDate = null;
  let chosenTime = null;
  let chosenAmount = null;
  let slots = [];

  const errorBox = document.createElement('p');
  errorBox.className = 'mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700';
  errorBox.hidden = true;
  bookingForm?.append(errorBox);

  const showError = message => { errorBox.textContent = message; errorBox.hidden = false; };
  const formatTime = value => String(value || '').slice(0, 5).replace(':', 'h');
  const formatPrice = value => Number(value || 0).toLocaleString('fr-FR') + ' FCFA';
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, { headers: { Accept: 'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat()[0] || 'Une erreur est survenue.');
    return payload;
  }

  async function loadTerrains() {
    const payload = await fetchJson('/api/terrains?per_page=100');
    terrains = payload.data || [];
    populateLocationFilters();
    populateTerrainSelect();
    renderTerrains();
    renderTerrainSlots();
  }

  function populateLocationFilters() {
    const city = document.querySelector('#cityFilter');
    const quartier = document.querySelector('#quartierFilter');
    if (!city || !quartier) return;
    const currentCity = city.value;
    city.innerHTML = '<option value="">Toutes les villes</option>' + [...new Set(terrains.map(t => t.city).filter(Boolean))].sort().map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    city.value = [...city.options].some(o => o.value === currentCity) ? currentCity : '';
    updateQuartierOptions();
    city.addEventListener('change', () => { updateQuartierOptions(); renderTerrains(); populateTerrainSelect(); });
    quartier.addEventListener('change', () => { renderTerrains(); populateTerrainSelect(); });
  }

  function updateQuartierOptions() {
    const city = document.querySelector('#cityFilter');
    const quartier = document.querySelector('#quartierFilter');
    if (!city || !quartier) return;
    const current = quartier.value;
    const values = terrains.filter(t => !city.value || t.city === city.value).map(t => t.quartier).filter(Boolean);
    quartier.innerHTML = '<option value="">Tous les quartiers</option>' + [...new Set(values)].sort().map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    quartier.value = [...quartier.options].some(o => o.value === current) ? current : '';
  }

  function filteredTerrains() {
    const city = document.querySelector('#cityFilter')?.value || '';
    const quartier = document.querySelector('#quartierFilter')?.value || '';
    return terrains.filter(t => (!city || t.city === city) && (!quartier || t.quartier === quartier));
  }

  function populateTerrainSelect() {
    const select = document.querySelector('#terrainSelect');
    if (!select) return;
    const list = filteredTerrains();
    const previous = selectedTerrainId;
    select.innerHTML = '<option value="">Choisissez un terrain</option>' + list.map(t => `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(t.quartier || '')}, ${escapeHtml(t.city || '')}</option>`).join('');
    if (previous && list.some(t => Number(t.id) === Number(previous))) select.value = String(previous);
    else if (list.length === 1) { selectedTerrainId = Number(list[0].id); select.value = String(selectedTerrainId); }
    else selectedTerrainId = select.value ? Number(select.value) : null;
  }

  function renderTerrains() {
    const host = document.querySelector('#terrainResults');
    if (!host) return;
    const list = filteredTerrains();
    const count = document.querySelector('#terrainCount');
    if (count) count.textContent = `${list.length} terrain${list.length > 1 ? 's' : ''}`;
    host.innerHTML = list.length ? list.map(t => {
      const activeSlots = (t.slots || []).filter(s => s.is_active !== false);
      const prices = activeSlots.map(s => Number(s.price)).filter(Number.isFinite).filter(p => p > 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      return `<article class="hover-lift overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div class="h-32 bg-gradient-to-br from-grass-600 to-grass-500 p-5 text-white"><div class="flex items-start justify-between gap-3"><span class="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">${escapeHtml(t.type || 'Terrain')}</span>${activeSlots.length ? '<span class="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-grass-700">Horaires disponibles</span>' : '<span class="rounded-full bg-slate-900/20 px-2.5 py-1 text-xs font-bold">En configuration</span>'}</div><div class="mt-5 text-2xl">⚽</div></div><div class="p-5"><h3 class="text-lg font-extrabold text-slate-900">${escapeHtml(t.name)}</h3><p class="mt-1 text-sm text-slate-500">📍 ${escapeHtml(t.quartier || 'Quartier non renseigné')}, ${escapeHtml(t.city || '')}</p><p class="mt-3 line-clamp-2 text-sm text-slate-600">${escapeHtml(t.description || 'Terrain disponible à la réservation.')}</p><div class="mt-4 flex items-center justify-between gap-3"><span class="text-sm font-bold text-grass-700">${minPrice !== null ? 'À partir de ' + formatPrice(minPrice) : 'Prix à venir'}</span><span class="text-xs text-slate-400">${activeSlots.length} créneau${activeSlots.length > 1 ? 'x' : ''}</span></div><button type="button" class="mt-4 w-full rounded-xl bg-grass-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-grass-700" data-select-terrain="${t.id}">Choisir ce terrain</button></div></article>`;
    }).join('') : '<div class="md:col-span-2 lg:col-span-3 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">Aucun terrain ne correspond à votre recherche.</div>';
    host.querySelectorAll('[data-select-terrain]').forEach(button => button.addEventListener('click', () => {
      selectedTerrainId = Number(button.dataset.selectTerrain);
      const select = document.querySelector('#terrainSelect');
      if (select) select.value = String(selectedTerrainId);
      renderTerrainSlots();
      document.querySelector('#recherche')?.scrollIntoView({behavior:'smooth'});
    }));
  }

  function renderTerrainSlots() {
    const host = document.querySelector('#configuredSlots');
    if (!host) return;
    const terrain = terrains.find(t => Number(t.id) === Number(selectedTerrainId));
    if (!terrain) { host.innerHTML = '<p class="text-sm text-slate-500 sm:col-span-2">Sélectionnez un terrain pour voir ses créneaux.</p>'; return; }
    slots = (terrain.slots || []).filter(s => s.is_active !== false);
    const dayNames = ['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    host.innerHTML = slots.length ? slots.map((s, i) => `<button type="button" class="slot-enter flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-grass-500" data-slot-index="${i}"><span><strong class="block text-slate-900">${dayNames[Number(s.day_of_week)] || 'Jour'}</strong><span class="text-sm text-slate-500">${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span></span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('') : '<p class="text-sm text-slate-500 sm:col-span-2">Aucun créneau configuré par l’administration pour ce terrain.</p>';
    host.querySelectorAll('[data-slot-index]').forEach(button => button.addEventListener('click', () => {
      const date = document.querySelector('#customDate')?.value;
      const s = slots[Number(button.dataset.slotIndex)];
      if (!date) { showError('Choisissez d’abord une date.'); return; }
      const selectedDay = new Date(`${date}T12:00:00`).getDay() || 7;
      if (Number(s.day_of_week) !== selectedDay) { showError('Ce créneau est configuré pour un autre jour. Choisissez une date correspondante.'); return; }
      chosenDate = date; chosenTime = `${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`; chosenAmount = Number(s.price); showBookingIfAvailable();
    }));
  }

  async function checkAvailability(date, time, terrainId) {
    const query = new URLSearchParams({date, heure: time, terrain_id: String(terrainId)});
    return fetchJson(`/api/reservations/availability?${query}`);
  }

  async function showBookingIfAvailable() {
    if (!selectedTerrainId || !chosenDate || !chosenTime) return;
    try {
      const payload = await checkAvailability(chosenDate, chosenTime, selectedTerrainId);
      if (!payload.available) { showError('Ce créneau est déjà réservé.'); return; }
      chosenAmount = Number(payload.amount);
      const terrain = terrains.find(t => Number(t.id) === Number(selectedTerrainId));
      if (typeof showBooking === 'function') showBooking({ terrainName: terrain?.name, day: chosenDate, date: dateFromInput(chosenDate), time: chosenTime.replace(/:/g,'h').replace('-', ' - '), price: chosenAmount, terrainId: selectedTerrainId });
    } catch (error) { showError(error.message); }
  }

  async function submitReservation(event) {
    event.preventDefault(); event.stopImmediatePropagation(); errorBox.hidden = true;
    if (!selectedTerrainId || !chosenDate || !chosenTime) { showError('Sélectionnez un terrain, une date et un créneau.'); return; }
    const submitButton = bookingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Préparation du paiement...';
    try {
      const response = await fetchJson('/api/reservations', { method:'POST', body: JSON.stringify({ terrain_id:selectedTerrainId, name:document.querySelector('#fullName').value.trim(), email:document.querySelector('#email').value.trim(), phone:document.querySelector('#phone').value.trim(), date:chosenDate, heure:chosenTime, amount:chosenAmount, payment_method:document.querySelector('input[name="payment"]:checked')?.value === 'Wave' ? 'wave_money' : 'orange_money' })});
      if (!response.payment_url) throw new Error('Le lien de paiement est absent.');
      window.location.assign(response.payment_url);
    } catch (error) { showError(error.message); submitButton.disabled = false; submitButton.textContent = 'Continuer vers le paiement'; }
  }

  customSearchForm?.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation(); errorBox.hidden = true;
    const date = document.querySelector('#customDate').value;
    const result = document.querySelector('#customSearchResult');
    if (!selectedTerrainId) { result.className='mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800'; result.textContent='Choisissez un terrain.'; result.classList.remove('hidden'); return; }
    const terrain = terrains.find(t => Number(t.id) === Number(selectedTerrainId));
    const day = new Date(`${date}T12:00:00`).getDay() || 7;
    const daySlots = (terrain?.slots || []).filter(s => Number(s.day_of_week) === day && s.is_active !== false);
    result.className='mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm'; result.classList.remove('hidden');
    result.innerHTML = daySlots.length ? `<div class="font-semibold text-slate-800">Créneaux proposés pour cette date</div><div class="mt-3 grid gap-2 sm:grid-cols-2">${daySlots.map((s,i)=>`<button type="button" class="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-grass-500" data-search-slot="${i}"><span>${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('')}</div>` : '<span class="text-slate-500">Aucun créneau n’est configuré pour ce jour.</span>';
    result.querySelectorAll('[data-search-slot]').forEach(button=>button.addEventListener('click',()=>{const s=daySlots[Number(button.dataset.searchSlot)];chosenDate=date;chosenTime=`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`;chosenAmount=Number(s.price);showBookingIfAvailable();}));
  });

  if (bookingForm) bookingForm.addEventListener('submit', submitReservation, true);

  function initDate() {
    const input=document.querySelector('#customDate'); if(!input) return;
    const today=new Date(); const value=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10); input.min=value; if(!input.value) input.value=value;
  }

  document.addEventListener('DOMContentLoaded', () => { initDate(); loadTerrains().catch(error => console.error(error)); });
  if (document.readyState !== 'loading') { initDate(); loadTerrains().catch(error => console.error(error)); }
})();
