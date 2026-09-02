(() => {
  const apiBase = window.BACKEND_URL || 'http://127.0.0.1:8000';
  const bookableSlots = [
    { time: '08h - 10h', price: 10000 },
    { time: '10h - 12h', price: 10000 },
    { time: '16h - 18h', price: 15000 },
    { time: '18h - 20h', price: 20000 },
    { time: '20h - 22h', price: 20000 },
  ];
  const bookingForm = document.querySelector('#bookingForm');
  const customSearchForm = document.querySelector('#customSearchForm');
  let chosenDate = null;
  let chosenTime = null;
  let chosenAmount = null;
  const errorBox = document.createElement('p');
  errorBox.className = 'mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700';
  errorBox.hidden = true;
  bookingForm?.append(errorBox);

  const toApiTime = value => value.replace('h', ':');
  const showError = message => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  const updateDayLabels = () => {
    document.querySelectorAll('[data-day]').forEach(button => {
      const date = new Date();
      date.setDate(date.getDate() + Number(button.dataset.day));
      button.querySelector('span:first-child').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', '');
    });
  };

  updateDayLabels();

  const checkAvailability = async (date, time) => {
    const response = await fetch(`${apiBase}/api/reservations/availability?date=${encodeURIComponent(date)}&heure=${encodeURIComponent(time)}`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'La disponibilité est momentanément indisponible.');
    return payload;
  };

  const submitReservation = async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    errorBox.hidden = true;

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Préparation du paiement...';

    try {
      const response = await fetch(`${apiBase}/api/reservations`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: document.querySelector('#fullName').value.trim(),
          email: document.querySelector('#email').value.trim(),
          phone: document.querySelector('#phone').value.trim(),
          date: chosenDate,
          heure: chosenTime,
          amount: chosenAmount,
          payment_method: document.querySelector('input[name="payment"]:checked')?.value === 'Wave' ? 'wave_money' : 'orange_money',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat()[0] || 'Impossible de préparer le paiement.');
      if (!payload.payment_url) throw new Error('Le lien de paiement est absent.');
      window.location.assign(payload.payment_url);
    } catch (error) {
      showError(error.message);
      submitButton.disabled = false;
      submitButton.textContent = 'Continuer vers le paiement';
    }
  };

  document.addEventListener('click', event => {
    const dayButton = event.target.closest('[data-day]');
    if (dayButton) {
      chosenDate = null;
      window.setTimeout(() => {
        updateDayLabels();
        refreshSlots();
      }, 0);
      return;
    }

    const slotButton = event.target.closest('.book-slot');
    if (slotButton) {
      const dateLabel = document.querySelector('#selectedDateLabel').textContent;
      const date = [...document.querySelectorAll('[data-day]')].find(button => button.classList.contains('bg-grass-600'));
      const selectedIndex = Number(date?.dataset.day || 0);
      const selected = new Date();
      const mondayOffset = (selected.getDay() + 6) % 7;
      selected.setDate(selected.getDate() - mondayOffset + selectedIndex);
      chosenDate = selected.toISOString().slice(0, 10);
      chosenTime = slots[Number(slotButton.dataset.slot)].time.split(' - ').map(toApiTime).join('-');
      chosenAmount = slots[Number(slotButton.dataset.slot)].price;
    }
  }, true);

  if (bookingForm) {
    const emailField = document.createElement('div');
    emailField.innerHTML = '<label for="email" class="mb-1.5 block text-sm font-semibold text-slate-700">Adresse e-mail</label><input id="email" required type="email" autocomplete="email" placeholder="Ex. nom@example.com" class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-grass-500 focus:ring-4 focus:ring-grass-100" />';
    bookingForm.querySelector('#phone')?.closest('div')?.after(emailField);
    bookingForm.addEventListener('submit', submitReservation, true);
  }

  const refreshSlots = async () => {
    const selectedDay = document.querySelector('.bg-grass-600[data-day]');
    const selectedIndex = Number(selectedDay?.dataset.day || 0);
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + selectedIndex);
    const dateValue = date.toISOString().slice(0, 10);
    await Promise.all(bookableSlots.map(async (slot, index) => {
      const time = slot.time.split(' - ').map(toApiTime).join('-');
      try {
        const payload = await checkAvailability(dateValue, time);
        const button = document.querySelector(`[data-slot="${index}"]`);
        if (!button) return;
        button.disabled = !payload.available;
        button.textContent = payload.available ? 'Réserver' : 'Indisponible';
        button.classList.toggle('bg-slate-200', !payload.available);
        button.classList.toggle('bg-grass-600', payload.available);
      } catch {
        // Le rendu local reste visible si le backend est momentanément indisponible.
      }
    }));
  };

  window.setTimeout(refreshSlots, 0);

  customSearchForm?.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const date = document.querySelector('#customDate').value;
    const start = document.querySelector('#customStart').value;
    const end = document.querySelector('#customEnd').value;
    const result = document.querySelector('#customSearchResult');
    if (!date || !start || !end || end <= start) {
      result.textContent = 'Choisissez une plage horaire valide.';
      return;
    }
    try {
      const payload = await checkAvailability(date, `${start}-${end}`);
      result.className = `mt-4 rounded-xl border p-4 text-sm ${payload.available ? 'border-grass-200 bg-grass-50 text-grass-700' : 'border-orange-200 bg-orange-50 text-orange-800'}`;
      result.innerHTML = payload.available
        ? `<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>Créneau disponible : ${payload.amount.toLocaleString('fr-FR')} FCFA.</span><button type="button" id="bookCustomSlot" class="rounded-xl bg-grass-600 px-4 py-2.5 font-bold text-white hover:bg-grass-700">Réserver maintenant</button></div>`
        : 'Ce créneau est déjà réservé.';
      if (payload.available) {
        chosenDate = date;
        chosenTime = `${start}-${end}`;
        chosenAmount = payload.amount;
        document.querySelector('#bookCustomSlot').addEventListener('click', () => {
          if (typeof showBooking === 'function') showBooking({ day: date, date: dateFromInput(date), time: `${start.replace(':', 'h')} - ${end.replace(':', 'h')}`, price: payload.amount });
        });
      }
    } catch (error) {
      result.className = 'mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700';
      result.textContent = error.message;
    }
  }, true);
})();
