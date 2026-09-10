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
    if (!city.dataset.bound) {
      city.addEventListener('change', () => { updateQuartierOptions(); populateTerrainSelect(); renderTerrains(); renderTerrainSlots(); });
      city.dataset.bound = '1';
    }
    if (!quartier.dataset.bound) {
      quartier.addEventListener('change', () => { populateTerrainSelect(); renderTerrains(); renderTerrainSlots(); });
      quartier.dataset.bound = '1';
    }
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
    if (!select.dataset.bound) {
      select.addEventListener('change', () => {
        selectedTerrainId = select.value ? Number(select.value) : null;
        chosenTime = null;
        chosenAmount = null;
        renderTerrainSlots();
        const result = document.querySelector('#customSearchResult');
        if (result) result.classList.add('hidden');
      });
      select.dataset.bound = '1';
    }
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
    const date = document.querySelector('#customDate')?.value;
    const selectedDay = date ? (new Date(`${date}T12:00:00`).getDay() || 7) : null;
    slots = (terrain.slots || []).filter(s => s.is_active !== false && (!selectedDay || Number(s.day_of_week) === selectedDay));
    host.innerHTML = slots.length ? slots.map((s, i) => `<button type="button" class="slot-enter flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-grass-500" data-slot-index="${i}"><span><strong class="block text-slate-900">${selectedDay ? 'Créneau disponible' : ['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][Number(s.day_of_week)] || 'Jour'}</strong><span class="text-sm text-slate-500">${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span></span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('') : `<p class="text-sm text-slate-500 sm:col-span-2">${selectedDay ? 'Aucun créneau configuré pour cette date.' : 'Aucun créneau configuré par l’administration pour ce terrain.'}</p>`;
    host.querySelectorAll('[data-slot-index]').forEach(button => button.addEventListener('click', () => {
      const dateValue = document.querySelector('#customDate')?.value;
      const s = slots[Number(button.dataset.slotIndex)];
      if (!dateValue) { showError('Choisissez d’abord une date.'); return; }
      chosenDate = dateValue; chosenTime = `${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`; chosenAmount = Number(s.price); showBookingIfAvailable();
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
    if (!date) { result.className='mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800'; result.textContent='Choisissez une date.'; result.classList.remove('hidden'); return; }
    if (!selectedTerrainId) { result.className='mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800'; result.textContent='Choisissez un terrain.'; result.classList.remove('hidden'); return; }
    const terrain = terrains.find(t => Number(t.id) === Number(selectedTerrainId));
    const day = new Date(`${date}T12:00:00`).getDay() || 7;
    const daySlots = (terrain?.slots || []).filter(s => Number(s.day_of_week) === day && s.is_active !== false);
    result.className='mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm'; result.classList.remove('hidden');
    result.innerHTML = daySlots.length ? `<div class="font-semibold text-slate-800">Créneaux proposés pour cette date</div><div class="mt-3 grid gap-2 sm:grid-cols-2">${daySlots.map((s,i)=>`<button type="button" class="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-grass-500" data-search-slot="${i}"><span>${formatTime(s.start_time)} - ${formatTime(s.end_time)}</span><strong class="text-grass-700">${formatPrice(s.price)}</strong></button>`).join('')}</div>` : '<span class="text-slate-500">Aucun créneau n’est configuré pour ce jour.</span>';
    result.querySelectorAll('[data-search-slot]').forEach(button => button.addEventListener('click',()=>{const s=daySlots[Number(button.dataset.searchSlot)];chosenDate=date;chosenTime=`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`;chosenAmount=Number(s.price);showBookingIfAvailable();}));
  });

  document.querySelector('#customDate')?.addEventListener('change', () => { chosenDate = document.querySelector('#customDate').value || null; renderTerrainSlots(); });
  if (bookingForm) bookingForm.addEventListener('submit', submitReservation, true);

  function initDate() {
    const input=document.querySelector('#customDate'); if(!input) return;
    const today=new Date(); const value=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10); input.min=value; if(!input.value) input.value=value;
  }

  function installHomepageMotionAndResponsive() {
    const style = document.createElement('style');
    style.textContent = `
      /* Motion refinement: calm, short and intentional. */
      .reveal { transform: translateY(22px); transition: opacity .55s ease, transform .55s ease; }
      .reveal-left { transform: translateX(-28px); }
      .reveal-right { transform: translateX(28px); }
      .delay-1 { transition-delay: .06s; }
      .delay-2 { transition-delay: .12s; }
      .delay-3 { transition-delay: .18s; }
      .hero-bg { transform: scale(1.025); }
      .hero-side { transform: none; }
      @media (max-width: 900px) {
        .container, .hero-grid { width: min(100% - 32px, 1180px); }
        .nav { padding: 12px 0; }
        .nav-inner { gap: 12px; }
        .brand-name { font-size: 19px; }
        .brand small { font-size: 6px; letter-spacing: .25em; }
        .menu { display: block; cursor: pointer; padding: 8px; }
        .mobile-menu { position: fixed; top: 64px; left: 16px; right: 16px; z-index: 60; display: grid; gap: 4px; padding: 12px; background: rgba(4,19,13,.97); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.28); }
        .mobile-menu a { color: white; padding: 12px 10px; border-radius: 9px; font-weight: 700; }
        .mobile-menu a:hover { background: rgba(255,255,255,.08); }
        .hero { min-height: 760px; }
        .hero-grid { padding: 125px 0 54px; }
        .hero h1 { font-size: clamp(44px, 9vw, 68px); }
        .hero-copy { font-size: 15px; max-width: 600px; }
        .hero-search { width: min(620px,100%); }
        .hero-bg { transform: scale(1.025); }
        .section { padding: 88px 0; }
        .story-grid { gap: 44px; }
        .story-visual { min-height: 420px; }
        .search-layout { gap: 38px; }
        .contact-main h2 { max-width: 700px; }
        .reveal, .reveal-left, .reveal-right { transform: translateY(18px); transition-duration: .5s; }
      }
      @media (max-width: 620px) {
        .container, .hero-grid { width: calc(100% - 28px); }
        .brand-ball { width: 34px; height: 34px; font-size: 17px; }
        .brand-name { font-size: 18px; }
        .hero { min-height: 720px; align-items: center; }
        .hero-grid { padding: 100px 0 36px; }
        .hero h1 { font-size: clamp(42px, 13vw, 58px); letter-spacing: -.055em; }
        .hero-copy { font-size: 14px; line-height: 1.6; }
        .hero-search { margin-top: 25px; padding: 6px; border-radius: 14px; }
        .hero-search .search-part { padding: 10px 11px; }
        .search-button { width: 100%; padding: 13px 16px; }
        .section { padding: 68px 0; }
        .section-title { font-size: clamp(34px, 10vw, 46px); }
        .section-head { margin-bottom: 30px; }
        .story-visual { min-height: 330px; }
        .story-tag { left: 18px; bottom: 18px; }
        .story-tag strong { font-size: 22px; }
        .story-copy p { font-size: 15px; line-height: 1.75; }
        .filter-strip { display: grid; grid-template-columns: 1fr; }
        .filter-strip select { width: 100%; }
        .count { margin-left: 0; }
        .search-form { padding: 18px; }
        .configured { margin-top: 18px; padding-top: 18px; }
        .modal { padding: 10px; align-items: flex-end; }
        .modal-card { width: 100%; max-height: 94vh; padding: 22px 18px; border-radius: 18px 18px 4px 4px; }
        .payments { grid-template-columns: 1fr; }
        .footer { padding: 20px 0; }
        .hero-bg { transform: scale(1.02); }
      }
      @media (prefers-reduced-motion: reduce) {
        .reveal, .reveal-left, .reveal-right { transition: none !important; transform: none !important; }
      }
    `;
    document.head.appendChild(style);

    const menuButton = document.querySelector('.menu');
    const nav = document.querySelector('.nav');
    if (menuButton && nav && !document.querySelector('.mobile-menu')) {
      const mobileMenu = document.createElement('nav');
      mobileMenu.className = 'mobile-menu';
      mobileMenu.hidden = true;
      mobileMenu.innerHTML = '<a href="#accueil">Accueil</a><a href="#terrains">Terrains</a><a href="#recherche">Réservations</a><a href="#apropos">À propos</a><a href="#contact">Contact</a>';
      nav.after(mobileMenu);
      menuButton.addEventListener('click', () => { mobileMenu.hidden = !mobileMenu.hidden; menuButton.setAttribute('aria-expanded', String(!mobileMenu.hidden)); });
      mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mobileMenu.hidden = true; }));
    }
  }

  document.addEventListener('DOMContentLoaded', () => { installHomepageMotionAndResponsive(); initDate(); loadTerrains().catch(error => console.error(error)); });
  if (document.readyState !== 'loading') { installHomepageMotionAndResponsive(); initDate(); loadTerrains().catch(error => console.error(error)); }
})();
