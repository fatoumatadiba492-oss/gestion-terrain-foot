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
  const toApiTime = value => value.length === 5 ? value : value.replace('h', ':');
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
    renderTerrainFilters();
    renderTerrains();
  }

  function renderTerrainFilters() {
    const existing = document.querySelector('#terrainFilters');
    if (existing) existing.remove();
    const anchor = document.querySelector('#customSearchForm');
    if (!anchor) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'terrainFilters';
    wrapper.className = 'sm:col-span-2';
    wrapper.innerHTML = `<label for="terrainSelect" class="mb-1.5 block text-sm font-semibold text-slate-700">Terrain</label><select id="terrainSelect" class="search-field w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-grass-500 focus:bg-white focus:ring-4 focus:ring-grass-100"><option value="">Choisissez un terrain</option>${terrains.map(t => `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(t.quartier)}, ${escapeHtml(t.city)}</option>`).join('')}</select>`;
    anchor.prepend(wrapper);
    document.querySelector('#terrainSelect')?.addEventListener('change', event => { selectedTerrainId = event.target.value ? Number(event.target.value) : null; renderTerrainSlots(); });
  }

  function renderTerrains() {
    const host = document.querySelector('#terrainResults');
    if (!host) return;
    host.innerHTML = terrains.length ? terrains.map(t => `<article class="hover-lift rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex items-start justify-between gap-3"><div><h3 class="text-lg font-bold text-slate-900">${escapeHtml(t.name)}</h3><p class="mt-1 text-sm text-slate-500">${escapeHtml(t.quartier)}, ${escapeHtml(t.city)}</p></div><span class="rounded-full bg-grass-50 px-2.5 py-1 text-xs font-bold text-grass-700">${escapeHtml(t.type)}</span></div><p class="mt-3 text-sm text-slate-600">${escapeHtml(t.description || 'Terrain disponible à la réservation.')}</p><button type="button" class="mt-4 w-full rounded-xl bg-grass-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-grass-700" data-select-terrain="${t.id}">Voir les créneaux</button></article>`).join('') : '<p class="text-sm text-slate-500">Aucun terrain disponible pour le moment.</p>';
    host.querySelectorAll('[data-select-terrain]').forEach(button => button.addEventListener('click', () => { selectedTerrainId = Number(button.dataset.selectTerrain); const select = document.querySelector('#terrainSelect'); if (select) select.value = String(selectedTerrainId); renderTerrainSlots(); document.querySelector('#planning')?.scrollIntoView({behavior:'smooth'}); }));
  }

  function renderTerrainSlots() {
    const host = document.querySelector('#configuredSlots');
    if (!host) return;
    const terrain = terrains.find(t => t.id === selectedTerrainId);
    if (!terrain) { host.innerHTML = '<p class="text-sm text-slate-500">Sélectionnez un terrain pour voir ses créneaux.</p>'; return; }
    slots = (terrain.slots || []).filter(s => s.is_active !== false);
    host.innerHTML = slots.length ? slots.map((s, i) => `<button type="button" class="slot-enter flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-grass-500" data-slot-index="${i}"><span><strong class="block text-slate-900">${['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][Number(s.day_of_week)] || 'Jour'}</strong><span class="text-sm text-slate-500">${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span></span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('') : '<p class="text-sm text-slate-500">Aucun créneau configuré par l’administration pour ce terrain.</p>';
    host.querySelectorAll('[data-slot-index]').forEach(button => button.addEventListener('click', () => selectConfiguredSlot(slots[Number(button.dataset.slotIndex)])));
  }

  function selectConfiguredSlot(slot) {
    const date = document.querySelector('#customDate')?.value;
    if (!date) { showError('Choisissez d’abord une date.'); return; }
    chosenDate = date;
    chosenTime = `${formatTime(slot.start_time).replace('h', ':')}-${formatTime(slot.end_time).replace('h', ':')}`;
    chosenAmount = Number(slot.price);
    showBookingIfAvailable();
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
      if (typeof showBooking === 'function') {
        const slotText = chosenTime.replace(':00', 'h').replace('-', ' - ').replace(':00', 'h');
        showBooking({ day: chosenDate, date: dateFromInput(chosenDate), time: slotText, price: chosenAmount, terrainId: selectedTerrainId });
      }
    } catch (error) { showError(error.message); }
  }

  async function submitReservation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    errorBox.hidden = true;
    if (!selectedTerrainId || !chosenDate || !chosenTime) { showError('Sélectionnez un terrain, une date et un créneau.'); return; }
    const submitButton = bookingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Préparation du paiement...';
    try {
      const response = await fetchJson('/api/reservations', { method:'POST', body: JSON.stringify({
        terrain_id: selectedTerrainId,
        name: document.querySelector('#fullName').value.trim(),
        email: document.querySelector('#email').value.trim(),
        phone: document.querySelector('#phone').value.trim(),
        date: chosenDate, heure: chosenTime, amount: chosenAmount,
        payment_method: document.querySelector('input[name="payment"]:checked')?.value === 'Wave' ? 'wave_money' : 'orange_money'
      })});
      if (!response.payment_url) throw new Error('Le lien de paiement est absent.');
      window.location.assign(response.payment_url);
    } catch (error) { showError(error.message); submitButton.disabled = false; submitButton.textContent = 'Continuer vers le paiement'; }
  }

  customSearchForm?.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation(); errorBox.hidden = true;
    const date = document.querySelector('#customDate').value;
    if (!selectedTerrainId) { document.querySelector('#customSearchResult').textContent = 'Choisissez un terrain.'; return; }
    const result = document.querySelector('#customSearchResult');
    result.className = 'mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm';
    try {
      const terrain = terrains.find(t => t.id === selectedTerrainId);
      const day = new Date(`${date}T12:00:00`).getDay() || 7;
      const daySlots = (terrain?.slots || []).filter(s => Number(s.day_of_week) === day && s.is_active !== false);
      result.innerHTML = daySlots.length ? `<div class="font-semibold text-slate-800">Créneaux disponibles configurés par l’administration</div><div id="searchSlots" class="mt-3 grid gap-2">${daySlots.map((s, i) => `<button type="button" class="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-grass-500" data-search-slot="${i}"><span>${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('')}</div>` : 'Aucun créneau n’est configuré pour ce jour.';
      result.querySelectorAll('[data-search-slot]').forEach(button => button.addEventListener('click', async () => { const s = daySlots[Number(button.dataset.searchSlot)]; chosenDate = date; chosenTime = `${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`; chosenAmount = Number(s.price); await showBookingIfAvailable(); }));
    } catch (error) { result.className = 'mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'; result.textContent = error.message; }
  }, true);

  if (bookingForm) {
    const emailField = document.createElement('div');
    emailField.innerHTML = '<label for="email" class="mb-1.5 block text-sm font-semibold text-slate-700">Adresse e-mail</label><input id="email" required type="email" autocomplete="email" placeholder="Ex. nom@example.com" class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-grass-500 focus:ring-4 focus:ring-grass-100" />';
    bookingForm.querySelector('#phone')?.closest('div')?.after(emailField);
    bookingForm.addEventListener('submit', submitReservation, true);
  }

  document.addEventListener('DOMContentLoaded', () => loadTerrains().catch(error => console.error(error)));
  if (document.readyState !== 'loading') loadTerrains().catch(error => console.error(error));
})();
