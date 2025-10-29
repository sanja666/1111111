const STORAGE_KEYS = {
  balance: 'ds_balance',
  activePass: 'ds_active_pass',
  purchaseHistory: 'ds_purchase_history',
  lastPrize: 'ds_last_prize',
  discounts: 'ds_discounts',
  blackTrialActive: 'ds_black_trial',
  controllerReports: 'ds_controller_reports',
  ticketsHistory: 'ds_tickets_history',
  alertLevel: 'ds_alert_level'
};

const alertLevels = ['ZAĻŠ', 'DZELTENS', 'SARKANS', 'MELNS'];

const routes = [
  {
    id: 'tram-0',
    name: 'Tramvajs 0: Maxima ⇄ Maxima',
    description: 'Klausies: šis maršruts eksistē tikai excelī, bet mēs simulējam realitāti.',
    delay: 'Vidēji kavējas 6 min, ja vadītājs iestājas meditācijā.',
    mood: 'Šis maršruts domāts tiem, kuriem dzīvē jau tā grūti.',
    coordinates: [
      [55.8745, 26.5361],
      [55.877, 26.5315],
      [55.8802, 26.529],
      [55.883, 26.5318],
      [55.8861, 26.5387]
    ],
    stops: ['Maxima Ziemeļi', 'Cietokšņa sliedes', 'Stacija', 'Centrs', 'Maxima Dienvidi']
  },
  {
    id: 'bus-7a',
    name: 'Autobuss 7A: Centrs → Kāpēc tik tālu',
    description: 'Šoferis brauc kā piedzīvojumu filma, bet tikai līdz 21:00.',
    delay: 'Vidēji kavējas 12 min, vainojam satiksmi un horoskopu.',
    mood: 'Šis maršruts domāts tiem, kuri grib pārdomāt dzīves izvēles pie katras pieturas.',
    coordinates: [
      [55.8719, 26.516],
      [55.8735, 26.5231],
      [55.876, 26.5335],
      [55.8791, 26.5452],
      [55.885, 26.552]
    ],
    stops: ['Centrs', 'Stacija', 'Vienības nams', 'Ķieģeļu rūpnīca', 'Kāpēc tik tālu']
  },
  {
    id: 'bus-12x',
    name: 'Autobuss 12X: Cietoksnis Express',
    description: 'Express režīms, bet viņi nezina, kas ir express.',
    delay: 'Vidēji kavējas 4 min, kad kontrolieris māj ar roku.',
    mood: 'Ja mīli vēsturiskas sienas un risku, šis ir tavs.',
    coordinates: [
      [55.8785, 26.5245],
      [55.8822, 26.5201],
      [55.8854, 26.513],
      [55.8895, 26.508],
      [55.8921, 26.502]
    ],
    stops: ['Centrs', 'Tramvaja muzejs', 'Daugava tilts', 'Cietoksnis']
  },
  {
    id: 'bus-n7',
    name: 'Nakts N7: Tikai pēc 23:00 ja šoferis labā garastāvoklī',
    description: 'Nakts maršruts, kas atkarīgs no Mēness fāzes un šofera miega.',
    delay: 'Vidēji kavējas 25 min, jo šoferis meklē kafiju.',
    mood: 'Sirds vājiem nav ieteicams, bet stāsti no šī brauciena kļūst par leģendām.',
    coordinates: [
      [55.8685, 26.5152],
      [55.872, 26.5287],
      [55.8762, 26.542],
      [55.8805, 26.5551],
      [55.884, 26.565]
    ],
    stops: ['Depo', 'Centrs', 'Nakts tirgus', 'Cietuma žogs', 'Mystery Gate']
  }
];

const plans = [
  {
    id: 'students',
    name: 'STUDENTS',
    price: 9.99,
    perks: ['Neierobežoti braucieni (kamēr semestris nenobeidzas).', 'Moral discount uz kebab.', "Der arī ja tu 'aizmirsu apliecību'."],
    description: 'Oficiāli mēs mīlam studentus, neoficiāli - viņi mīl atlaides.'
  },
  {
    id: 'stress',
    name: 'STRESA DARBS',
    price: 24.99,
    perks: ['Prioritāra iekāpšana tikai ar skatienu.', 'Tiesības stenēt skaļi salonā.', 'Šoferis piedāvā papildu salvetes drāmām.'],
    description: 'Ja tev diena ir ugunsgrēks, vismaz transports lai pakļaujas.'
  },
  {
    id: 'vip',
    name: 'VIP (BOSS)',
    price: 99.99,
    perks: ['Autobuss gaida TEVI.', 'Selfijs ar šoferi 1x mēnesī.', 'Gang pickup pie mājas.', 'Pseidolegāla privātā pietura.'],
    description: 'Šajā līmenī tu esi likums. Nu gandrīz.'
  },
  {
    id: 'black',
    name: 'BLACK TIER: Ēnas līmenis',
    price: 299.99,
    perks: ['Kontrolieri tev sveicina pirmie.', 'Neviens neuzdod jautājumus.', 'Teleportācija? mēs neko neteicām.', 'Ēnu čats ar dispečeri (emoji only).'],
    description: 'Neredzēts līmenis. Legalitātes robeža? aiz miglas.'
  }
];

const wheelSegments = [
  { label: '-10% nākamajai biļetei', color: '#16a34a', action: () => addDiscount({ type: '-10%', createdAt: Date.now() }) },
  { label: '+2 braucieni', color: '#0ea5e9', action: () => addDiscount({ type: '+2 braucieni', createdAt: Date.now() }) },
  { label: '0 😐', color: '#9ca3af', action: () => {} },
  { label: 'Bezmaksas mēnesis? (maybe)', color: '#f59e0b', action: () => addDiscount({ type: 'Bezmaksas mēnesis?', createdAt: Date.now() }) },
  { label: 'Kontrolieris ignorē tevi', color: '#f97316', action: () => addDiscount({ type: 'Kontrolieris ignorē tevi', createdAt: Date.now() }) },
  { label: '+1€ tavā e-kartē', color: '#22c55e', action: () => adjustBalance(1) },
  { label: 'BLACK TIER trial 24h', color: '#111827', action: activateBlackTrial },
  { label: 'Tu esi šoferis tagad (temporāri)', color: '#8b5cf6', action: () => addDiscount({ type: 'Tu esi šoferis tagad', createdAt: Date.now() }) }
];

let state = {};
let mapInstance;
let controllerLayer;
let routeLayer;
let busMarker;
let busAnimation;

function initState() {
  const defaults = {
    [STORAGE_KEYS.balance]: 5,
    [STORAGE_KEYS.activePass]: null,
    [STORAGE_KEYS.purchaseHistory]: [],
    [STORAGE_KEYS.lastPrize]: 'nav vēl griezts',
    [STORAGE_KEYS.discounts]: [],
    [STORAGE_KEYS.blackTrialActive]: false,
    [STORAGE_KEYS.controllerReports]: [
      createControllerReport('CENTRS', 3),
      createControllerReport('Stacija', 4)
    ],
    [STORAGE_KEYS.ticketsHistory]: [],
    [STORAGE_KEYS.alertLevel]: 'ZAĻŠ'
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const existing = localStorage.getItem(key);
    if (!existing) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  loadState();
}

function loadState() {
  state.balance = parseFloat(localStorage.getItem(STORAGE_KEYS.balance)) || 0;
  state.activePass = parseJSON(localStorage.getItem(STORAGE_KEYS.activePass));
  state.purchaseHistory = parseJSON(localStorage.getItem(STORAGE_KEYS.purchaseHistory)) || [];
  state.lastPrize = JSON.parse(localStorage.getItem(STORAGE_KEYS.lastPrize) || '"nav vēl griezts"');
  state.discounts = parseJSON(localStorage.getItem(STORAGE_KEYS.discounts)) || [];
  state.blackTrialActive = JSON.parse(localStorage.getItem(STORAGE_KEYS.blackTrialActive) || 'false');
  state.controllerReports = parseJSON(localStorage.getItem(STORAGE_KEYS.controllerReports)) || [];
  state.ticketsHistory = parseJSON(localStorage.getItem(STORAGE_KEYS.ticketsHistory)) || [];
  state.alertLevel = JSON.parse(localStorage.getItem(STORAGE_KEYS.alertLevel) || '"ZAĻŠ"');
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function setState(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  loadState();
  renderAll();
}

function adjustBalance(amount) {
  const newBalance = Math.max(0, +(state.balance + amount).toFixed(2));
  localStorage.setItem(STORAGE_KEYS.balance, JSON.stringify(newBalance));
  loadState();
  renderWallet();
  renderPlans();
  renderActivePass();
}

function addDiscount(discount) {
  const discounts = [...state.discounts, discount];
  localStorage.setItem(STORAGE_KEYS.discounts, JSON.stringify(discounts));
  loadState();
  renderDiscountInfo();
}

function activateBlackTrial() {
  localStorage.setItem(STORAGE_KEYS.blackTrialActive, JSON.stringify(true));
  loadState();
  renderShadowStatus();
}

function createControllerReport(where, danger) {
  const baseLat = 55.874 + (Math.random() - 0.5) * 0.02;
  const baseLng = 26.536 + (Math.random() - 0.5) * 0.02;
  return {
    where,
    danger,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lat: parseFloat(baseLat.toFixed(5)),
    lng: parseFloat(baseLng.toFixed(5))
  };
}

function renderAll() {
  renderWallet();
  renderPlans();
  renderActivePass();
  renderPurchaseHistory();
  renderLastPrize();
  renderDiscountInfo();
  renderShadowStatus();
  renderControllerReports();
  renderAlertLevel();
  renderTickets();
  renderThreatInsights();
}

function renderWallet() {
  const balanceText = `${state.balance.toFixed(2)} €`;
  document.getElementById('wallet-balance').textContent = balanceText;
  document.getElementById('wallet-balance-main').textContent = balanceText;
}

function renderPlans() {
  const container = document.getElementById('plans-grid');
  container.innerHTML = '';
  plans.forEach(plan => {
    const card = document.createElement('div');
    card.className = 'plan-card' + (plan.id === 'black' ? ' black-tier' : '');
    card.innerHTML = `
      <div class="plan-header">
        <h3>${plan.name}</h3>
        <p>${plan.description}</p>
        <strong>${plan.price.toFixed(2)} €/mēn</strong>
      </div>
      <ul>
        ${plan.perks.map(perk => `<li>${perk}</li>`).join('')}
      </ul>
      <button class="btn ${plan.id === 'black' ? '' : 'neon'} buy-plan" data-plan="${plan.id}">Pirkt</button>
    `;
    if (plan.id === 'black') {
      card.querySelector('button').classList.add('neon');
    }
    container.appendChild(card);
  });
  container.querySelectorAll('.buy-plan').forEach(btn => {
    btn.addEventListener('click', () => handlePlanPurchase(btn.dataset.plan));
  });
}

function handlePlanPurchase(planId) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;

  if (state.balance < plan.price) {
    alert('Balanss nepietiekams. Papildini e-karti, ēnu ceļotāj.');
    return;
  }

  adjustBalance(-plan.price);

  const passId = `PASS-${Math.floor(100000 + Math.random() * 900000)}`;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const pass = {
    id: passId,
    name: plan.name,
    price: plan.price,
    perks: plan.perks,
    createdAt: Date.now(),
    validUntil: validUntil.toISOString()
  };

  localStorage.setItem(STORAGE_KEYS.activePass, JSON.stringify(pass));
  const historyEntry = {
    id: passId,
    name: plan.name,
    price: plan.price,
    time: new Date().toISOString()
  };
  const history = [historyEntry, ...state.purchaseHistory].slice(0, 20);
  localStorage.setItem(STORAGE_KEYS.purchaseHistory, JSON.stringify(history));

  if (plan.id === 'black') {
    localStorage.setItem(STORAGE_KEYS.blackTrialActive, JSON.stringify(true));
  }

  alert('Pirkums veiksmīgs ✅');
  loadState();
  renderAll();
}

function generatePseudoQR(size = 12) {
  const chars = ['▓', '░'];
  const grid = document.createElement('div');
  grid.className = 'qr-grid';
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('span');
    cell.textContent = chars[Math.floor(Math.random() * chars.length)];
    grid.appendChild(cell);
  }
  return grid;
}

function renderActivePass() {
  const container = document.getElementById('active-pass-info');
  container.innerHTML = '';
  if (!state.activePass) {
    container.innerHTML = '<p>Nav aktīvas biļetes. Pievienojies ēnu kustībai!</p>';
    return;
  }

  const validUntil = new Date(state.activePass.validUntil);
  const passBlock = document.createElement('div');
  passBlock.innerHTML = `
    <p><strong>ID:</strong> ${state.activePass.id}</p>
    <p><strong>Tips:</strong> ${state.activePass.name}</p>
    <p><strong>Cena:</strong> ${state.activePass.price.toFixed(2)} €</p>
    <p><strong>Derīgs līdz:</strong> ${validUntil.toLocaleDateString()}</p>
    <p><strong>Perki:</strong></p>
  `;
  const perksList = document.createElement('ul');
  perksList.innerHTML = state.activePass.perks.map(perk => `<li>${perk}</li>`).join('');
  passBlock.appendChild(perksList);
  passBlock.appendChild(generatePseudoQR());
  const note = document.createElement('p');
  note.textContent = 'Parādīt kontrolierim (ja gribi piedzīvojumu).';
  passBlock.appendChild(note);
  container.appendChild(passBlock);
}

function renderPurchaseHistory() {
  const list = document.getElementById('purchase-history');
  list.innerHTML = '';
  if (!state.purchaseHistory.length) {
    list.innerHTML = '<li>Nopirkts nekas. Budžets gaida mafijas pieskārienu.</li>';
    return;
  }
  state.purchaseHistory.forEach(item => {
    const date = new Date(item.time);
    const li = document.createElement('li');
    li.innerHTML = `<strong>${date.toLocaleString()}</strong> — ${item.name} (${item.price.toFixed(2)} €) — <code>${item.id}</code>`;
    list.appendChild(li);
  });
}

function renderLastPrize() {
  document.getElementById('last-prize').textContent = state.lastPrize;
}

function renderDiscountInfo() {
  const infoBox = document.getElementById('controller-activity');
  if (!infoBox) return;
  const reportCount = state.controllerReports.length;
  const level = reportCount > 8 ? 'BRĪDINI MAMMU' : reportCount > 4 ? 'augsta vigil' : reportCount > 2 ? 'vidēja' : 'zema';
  infoBox.textContent = level;
}

function renderShadowStatus() {
  const badge = document.getElementById('shadow-status');
  const banner = document.getElementById('black-trial-banner');
  const active = state.blackTrialActive || (state.activePass && state.activePass.id && state.activePass.name.includes('BLACK TIER'));
  if (active) {
    badge.hidden = false;
    banner.hidden = false;
  } else {
    badge.hidden = true;
    banner.hidden = true;
  }
}

function renderControllerReports() {
  const list = document.getElementById('controller-report-list');
  list.innerHTML = '';
  if (!state.controllerReports.length) {
    list.innerHTML = '<li>Viss mierīgi... vai arī kontrolieris slēpjas.</li>';
  } else {
    state.controllerReports.slice().reverse().forEach(report => {
      const li = document.createElement('li');
      li.innerHTML = `[${report.time}] Kontrolieris redzēts pie “${report.where}” (risks ${report.danger}/5)`;
      list.appendChild(li);
    });
  }
  updateControllerLayer();
}

function renderAlertLevel() {
  const display = document.getElementById('alert-level-display');
  const headerPill = document.getElementById('header-alert-pill');
  display.className = `alert-display level-${state.alertLevel}`;
  display.textContent = state.alertLevel;
  headerPill.className = `alert-level-pill level-${state.alertLevel}`;
  headerPill.textContent = `SECURITY: ${state.alertLevel}`;
}

function renderTickets() {
  const list = document.getElementById('ticket-history');
  list.innerHTML = '';
  if (!state.ticketsHistory.length) {
    list.innerHTML = '<li>Ziņojumu vēl nav. Vai visi ir apmierināti? neticam.</li>';
    return;
  }
  state.ticketsHistory.slice().reverse().forEach(ticket => {
    const li = document.createElement('li');
    li.innerHTML = `[${ticket.time}] <strong>${ticket.id}</strong>: ${ticket.where} — ${ticket.text}`;
    list.appendChild(li);
  });
}

function renderThreatInsights() {
  const routesSpan = document.getElementById('top-complaint-routes');
  const stopSpan = document.getElementById('danger-stop');
  const reasonSpan = document.getElementById('top-complaint-reason');

  const routeCounts = {};
  const stopCounts = {};
  const reasonCounts = {};

  state.ticketsHistory.forEach(ticket => {
    const segments = ticket.where.split('/').map(s => s.trim());
    const routeName = segments[0] || 'Nezināms maršruts';
    const stopName = segments[1] || 'Neprecizēts punkts';
    routeCounts[routeName] = (routeCounts[routeName] || 0) + 1;
    stopCounts[stopName] = (stopCounts[stopName] || 0) + 1;
    const reasonKey = ticket.text.split(' ').slice(0, 3).join(' ');
    reasonCounts[reasonKey] = (reasonCounts[reasonKey] || 0) + 1;
  });

  const topRoute = Object.entries(routeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N7 (default panika)';
  const topStop = Object.entries(stopCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CENTRS';
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'šoferis klausījās techno pārāk skaļi';

  routesSpan.textContent = topRoute;
  stopSpan.textContent = `${topStop} (kontrolieru blīvums ${Math.min(5, state.controllerReports.length)}/5)`;
  reasonSpan.textContent = topReason;
}

function initTabs() {
  const navButtons = document.querySelectorAll('.tab-btn');
  const pages = document.querySelectorAll('.tab-page');
  function showTab(targetId) {
    pages.forEach(page => {
      page.classList.toggle('visible', page.id === targetId);
    });
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === targetId);
    });
    if (targetId === 'tab-map' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 200);
    }
  }
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.target));
  });
  document.querySelectorAll('.quick-actions .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showTab(btn.dataset.target);
      if (btn.dataset.subtarget === 'radar') {
        document.getElementById('radar-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

function initModal() {
  const modal = document.getElementById('balance-modal');
  const input = document.getElementById('balance-input');
  const openButtons = [document.getElementById('add-balance-header'), document.getElementById('add-balance-main')];
  const closeButtons = [document.getElementById('cancel-balance')];
  const confirmButton = document.getElementById('confirm-balance');

  const openModal = () => {
    modal.hidden = false;
    input.value = '';
    input.focus();
  };
  const closeModal = () => {
    modal.hidden = true;
  };
  openButtons.forEach(btn => btn.addEventListener('click', openModal));
  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  confirmButton.addEventListener('click', () => {
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Ievadi summu virs nulles, citādi kontrolieris pasmiesies.');
      return;
    }
    adjustBalance(amount);
    closeModal();
  });
}

function initMap() {
  mapInstance = L.map('map').setView([55.874, 26.536], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap parodija'
  }).addTo(mapInstance);
  controllerLayer = L.layerGroup().addTo(mapInstance);
  routeLayer = L.layerGroup().addTo(mapInstance);

  const stops = [
    { name: 'CENTRS', coords: [55.8746, 26.5369] },
    { name: 'Stacija', coords: [55.8781, 26.5312] },
    { name: 'Cietoksnis', coords: [55.8895, 26.508] },
    { name: 'Vienības nams', coords: [55.8736, 26.5335] },
    { name: 'Nakts tirgus', coords: [55.876, 26.546] },
    { name: 'Mystery Gate', coords: [55.884, 26.565] }
  ];
  stops.forEach(stop => {
    L.marker(stop.coords, { title: stop.name }).addTo(mapInstance).bindPopup(`Pietura: ${stop.name}`);
  });

  updateControllerLayer();
  populateRouteSelect();
}

function updateControllerLayer() {
  if (!controllerLayer) return;
  controllerLayer.clearLayers();
  state.controllerReports.forEach(report => {
    const marker = L.marker([report.lat, report.lng], {
      icon: L.divIcon({
        className: 'controller-icon',
        html: `<div style="background:#ef4444;color:#fff;padding:6px 10px;border-radius:12px;box-shadow:0 8px 20px rgba(239,68,68,0.4);font-weight:700;">⚠️</div>`
      })
    });
    marker.bindPopup(`Kontrolieris pie ${report.where}<br>Risks: ${report.danger}/5`);
    controllerLayer.addLayer(marker);
  });
}

function populateRouteSelect() {
  const select = document.getElementById('route-select');
  select.innerHTML = routes.map(route => `<option value="${route.id}">${route.name}</option>`).join('');
  select.addEventListener('change', () => renderRouteInfo(select.value));
  renderRouteInfo(select.value);
}

function renderRouteInfo(routeId) {
  const route = routes.find(r => r.id === routeId) || routes[0];
  if (!route) return;
  document.getElementById('route-description').textContent = `${route.description} ${route.mood}`;
  document.getElementById('route-delay').textContent = route.delay;
  const stopsList = document.getElementById('route-stops');
  stopsList.innerHTML = route.stops.map(stop => `<li>${stop}</li>`).join('');
  const risk = calculateRouteRisk(route);
  document.getElementById('route-risk').textContent = risk;
  drawRoute(route);
}

function calculateRouteRisk(route) {
  const dangerReports = state.controllerReports.filter(report => route.stops.some(stop => report.where.toLowerCase().includes(stop.toLowerCase())));
  if (!dangerReports.length) {
    return 'Šobrīd mierīgi, bet neatslābsti.';
  }
  const avgDanger = dangerReports.reduce((sum, r) => sum + Number(r.danger || 0), 0) / dangerReports.length;
  return `Konstatētas ${dangerReports.length} aktivitātes. Vidējais risks ${avgDanger.toFixed(1)}/5.`;
}

function drawRoute(route) {
  if (!routeLayer) return;
  routeLayer.clearLayers();
  const polyline = L.polyline(route.coordinates, { color: '#10b981', weight: 5, opacity: 0.7 });
  polyline.addTo(routeLayer);
  mapInstance.fitBounds(polyline.getBounds(), { padding: [30, 30] });
}

function startRouteSimulation() {
  const routeId = document.getElementById('route-select').value;
  const route = routes.find(r => r.id === routeId);
  if (!route) return;
  stopRouteSimulation();

  let index = 0;
  busMarker = L.marker(route.coordinates[0], {
    icon: L.divIcon({
      html: '<div style="background:#10b981;border-radius:50%;padding:10px;box-shadow:0 8px 20px rgba(16,185,129,0.4);">🚌</div>'
    })
  }).addTo(routeLayer);

  const statuses = [
    "pie 'Stacija', kavējas 4 min, šoferis klausās techno",
    "pie 'Vienības nams', pasažieri diskutē par mafijas karti",
    "pie 'Cietoksnis', šoferis skaita pelmeņus",
    "pie 'CENTRS', kontrolieris izliekas neredzam"
  ];

  document.getElementById('route-position').textContent = statuses[0];

  busAnimation = setInterval(() => {
    index = (index + 1) % route.coordinates.length;
    busMarker.setLatLng(route.coordinates[index]);
    document.getElementById('route-position').textContent = statuses[index % statuses.length];
  }, 2000);
}

function stopRouteSimulation() {
  if (busAnimation) {
    clearInterval(busAnimation);
    busAnimation = null;
  }
  if (busMarker) {
    routeLayer.removeLayer(busMarker);
    busMarker = null;
  }
}

function setupRouteControls() {
  document.getElementById('start-route').addEventListener('click', startRouteSimulation);
  document.getElementById('stop-route').addEventListener('click', stopRouteSimulation);
}

function reportController(promptText) {
  const where = prompt(promptText || 'Kur redzēji kontrolieri? (pietura / maršruts)');
  if (!where) return;
  let danger = prompt('Cik bīstami no 1 līdz 5?');
  danger = Math.min(5, Math.max(1, parseInt(danger) || 1));
  const report = createControllerReport(where, danger);
  const reports = [...state.controllerReports, report];
  localStorage.setItem(STORAGE_KEYS.controllerReports, JSON.stringify(reports.slice(-30)));
  loadState();
  renderControllerReports();
  alert('Paldies par ēnu informāciju. Radarā atjaunots.');
}

function initControllerActions() {
  document.getElementById('report-controller').addEventListener('click', () => reportController());
  document.getElementById('report-controller-map').addEventListener('click', () => reportController('Kur redzēji kontrolieri kartē?'));
}

function initAlertLevelControl() {
  document.getElementById('increase-alert').addEventListener('click', () => {
    const currentIndex = alertLevels.indexOf(state.alertLevel);
    const nextIndex = (currentIndex + 1) % alertLevels.length;
    localStorage.setItem(STORAGE_KEYS.alertLevel, JSON.stringify(alertLevels[nextIndex]));
    loadState();
    renderAlertLevel();
  });
}

function initWheel() {
  const wheel = document.getElementById('wheel');
  const segmentAngle = 360 / wheelSegments.length;
  wheelSegments.forEach((segment, index) => {
    const seg = document.createElement('div');
    seg.className = 'segment';
    seg.style.transform = `rotate(${segmentAngle * index}deg) skewY(${90 - segmentAngle}deg)`;
    seg.style.background = segment.color;
    seg.innerHTML = `<span style="transform: skewY(${-(90 - segmentAngle)}deg) rotate(${segmentAngle / 2}deg); display:block;">${segment.label}</span>`;
    wheel.appendChild(seg);
  });

  let spinning = false;
  document.getElementById('spin-wheel').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    const resultIndex = Math.floor(Math.random() * wheelSegments.length);
    const extraSpins = 4;
    const finalRotation = 360 * extraSpins + (360 - resultIndex * segmentAngle - segmentAngle / 2);
    wheel.style.transform = `rotate(${finalRotation}deg)`;

    setTimeout(() => {
      spinning = false;
      const segment = wheelSegments[resultIndex];
      segment.action();
      localStorage.setItem(STORAGE_KEYS.lastPrize, JSON.stringify(segment.label));
      loadState();
      renderLastPrize();
      alert(`Rezultāts: ${segment.label}. Sistēma pierakstīja. Varbūt.`);
    }, 3200);
  });
}

function initTicketForm() {
  const form = document.getElementById('ticket-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get('name');
    const text = formData.get('message');
    const where = formData.get('where');
    const id = `T-${Math.floor(100000 + Math.random() * 900000)}`;
    const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ticket = { id, who: name, text, where, time };
    const tickets = [...state.ticketsHistory, ticket].slice(-40);
    localStorage.setItem(STORAGE_KEYS.ticketsHistory, JSON.stringify(tickets));
    form.reset();
    alert(`Ziņojums saņemts. Saglabā ID: ${id}`);
    loadState();
    renderTickets();
    renderThreatInsights();
  });
}

function initQuickStats() {
  const confiscated = document.getElementById('confiscated-count');
  const count = state.controllerReports.reduce((sum, report) => sum + Number(report.danger || 1), 0) + state.ticketsHistory.length;
  confiscated.textContent = Math.max(5, count);
}

window.addEventListener('DOMContentLoaded', () => {
  initState();
  initTabs();
  initModal();
  initMap();
  initWheel();
  initControllerActions();
  initAlertLevelControl();
  initTicketForm();
  setupRouteControls();
  renderAll();
  initQuickStats();
});
