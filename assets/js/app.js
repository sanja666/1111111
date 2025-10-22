const DB_NAME = 'ePakalpojumiPlus';
const DB_VERSION = 1;
const STORES = {
  payments: { name: 'payments', keyPath: 'id', indexes: ['userId', 'status'] },
  cases: { name: 'cases', keyPath: 'id', indexes: ['userId', 'status'] },
  services: { name: 'services', keyPath: 'id', indexes: ['userId', 'status'] },
  notices: { name: 'notices', keyPath: 'id', indexes: ['userId', 'severity'] },
  documents: { name: 'documents', keyPath: 'id', indexes: ['userId', 'type'] },
  gameResults: { name: 'gameResults', keyPath: 'id', indexes: ['userId'] },
  logs: { name: 'logs', keyPath: 'id', indexes: [] }
};

const DEFAULT_SERVICES = [
  { code: 'criminal-record', title_lv: 'Izziņa par nesodāmību', title_ru: 'Справка о несудимости', price: 4.99, minDays: 5, maxDays: 20 },
  { code: 'address-change', title_lv: 'Dzīvesvietas maiņa', title_ru: 'Изменение места жительства', price: 12.0, minDays: 7, maxDays: 45 },
  { code: 'passport', title_lv: 'Pase / ID karte', title_ru: 'Паспорт / ID карта', price: 29.99, minDays: 30, maxDays: 90 },
  { code: 'income-proof', title_lv: 'Izziņa par ienākumiem', title_ru: 'Справка о доходах', price: 3.0, minDays: 3, maxDays: 14 },
  { code: 'priority-queue', title_lv: 'Elektroniskā rinda (prioritāte)', title_ru: 'Электронная очередь (приоритет)', price: 1.5, minDays: 1, maxDays: 2 }
];

const DEFAULT_PROBABILITIES = {
  softening: 0.2,
  increase: 0.35,
  postpone: 0.2,
  uiArrest: 0.1,
  refund: 0.05,
  unchanged: 0.1
};

const SESSION_DURATION = 60 * 1000;
const RANDOM_FINE_MIN = 60 * 1000;
const RANDOM_FINE_MAX = 180 * 1000;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const formatMoney = amount => `€${Number(amount).toFixed(2)}`;
let currentLocale = 'lv-LV';
const formatDate = date => new Intl.DateTimeFormat(currentLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(date instanceof Date ? date : new Date(date));
const generateId = prefix => `${prefix || 'ID'}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

class DataStore {
  constructor() {
    this.dbPromise = this.init();
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        Object.values(STORES).forEach(store => {
          if (!db.objectStoreNames.contains(store.name)) {
            const objectStore = db.createObjectStore(store.name, { keyPath: store.keyPath });
            store.indexes.forEach(index => objectStore.createIndex(index, index, { unique: false }));
          }
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async withStore(name, mode, callback) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const store = tx.objectStore(name);
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(name, indexName, query) {
    return this.withStore(name, 'readonly', store => {
      return new Promise((resolve, reject) => {
        const source = indexName ? store.index(indexName) : store;
        const req = query !== undefined ? source.getAll(query) : source.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  }

  async get(name, id) {
    return this.withStore(name, 'readonly', store => {
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  async put(name, value) {
    const record = { ...value };
    if (!record.id) {
      record.id = generateId(name.slice(0, 3).toUpperCase());
    }
    return this.withStore(name, 'readwrite', store => {
      store.put(record);
      return record;
    });
  }

  async delete(name, key) {
    return this.withStore(name, 'readwrite', store => {
      store.delete(key);
    });
  }
}

const db = new DataStore();

const state = {
  translations: {},
  lang: 'lv',
  user: null,
  sessionTimer: null,
  sessionTimeout: null,
  randomFineTimer: null,
  serviceTick: null,
  caseTick: null,
  uiArrestTimer: null,
  probabilities: { ...DEFAULT_PROBABILITIES },
  sections: ['services', 'payments', 'cases', 'casino', 'documents', 'profile', 'admin'],
  serviceCatalog: [...DEFAULT_SERVICES],
  currentSection: 'services'
};

const logger = async (message) => {
  const entry = { id: generateId('LOG'), message, ts: Date.now() };
  await db.put('logs', entry);
  renderLogs();
};

async function loadTranslations() {
  const response = await fetch('assets/data/lang.json');
  state.translations = await response.json();
}

function t(path) {
  const parts = path.split('.');
  let current = state.translations[state.lang] || {};
  for (const part of parts) {
    if (!current) break;
    current = current[part];
  }
  return current || path;
}

function setLanguage(lang) {
  state.lang = lang;
  currentLocale = lang === 'ru' ? 'ru-RU' : 'lv-LV';
  localStorage.setItem('demo-lang', lang);
  document.documentElement.lang = lang;
  $$('button.lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });
  applyTranslations();
  renderAll();
}

function applyTranslations() {
  $('.app-title').textContent = t('appTitle');
  $('#footer-notice').textContent = t('footerNotice');

  $('#login-title').textContent = t('login.title');
  $('#login-demo h2').textContent = t('login.demo');
  $('#login-smart h2').textContent = t('login.smartId');
  $('#login-esign h2').textContent = t('login.eSign');
  $('#login-sms h2').textContent = t('login.sms');
  $(`[for="demo-user"]`).textContent = t('login.user');
  $(`[for="demo-pass"]`).textContent = t('login.password');
  $('#demo-form button').textContent = t('login.confirm');
  $('#smart-form button').textContent = t('login.confirm');
  $('#esign-form button').textContent = t('login.approve');
  $('#sms-form button').textContent = t('login.sendCode');

  $('#services-title').textContent = t('services.title');
  $('#services-processing').textContent = t('services.processing');

  $('#payments-title').textContent = t('payments.title');
  $('#payments-open').textContent = t('payments.open');
  $('#payments-history').textContent = t('payments.history');
  $('#btn-topup').textContent = t('payments.topUp');
  $('#btn-withdraw').textContent = t('payments.withdraw');

  $('#cases-title').textContent = t('cases.title');
  $('#casino-title').textContent = t('casino.title');
  $('#tab-roulette').textContent = t('casino.roulette');
  $('#tab-lottery').textContent = t('casino.lottery');
  $('#tab-double').textContent = t('casino.double');
  $('#casino-history').textContent = t('casino.history');

  $('#documents-title').textContent = t('documents.title');
  $('#documents-receipts').textContent = t('documents.receipts');
  $('#documents-notices').textContent = t('documents.notices');

  $('#profile-title').textContent = t('profile.title');
  $(`[for="profile-name"]`).textContent = t('profile.name');
  $(`[for="profile-surname"]`).textContent = t('profile.surname');
  $(`[for="profile-pk"]`).textContent = t('profile.pk');
  $(`[for="profile-address"]`).textContent = t('profile.address');
  $(`[for="profile-email"]`).textContent = t('profile.email');
  $(`[for="profile-phone"]`).textContent = t('profile.phone');
  $('#profile-balance-label').textContent = t('profile.balance');
  $('#profile-topup').textContent = t('profile.topUp');
  $('#profile-withdraw').textContent = t('profile.withdraw');
  $('#profile-save').textContent = t('profile.save');

  $('#admin-title').textContent = t('admin.title');
  $('#admin-prob').textContent = t('admin.probabilities');
  $('#admin-triggers').textContent = t('admin.triggers');
  $('#admin-generate-fine').textContent = t('admin.generateFine');
  $('#admin-create-case').textContent = t('admin.createCase');
  $('#admin-force-hearing').textContent = t('admin.forceHearing');
  $('#admin-lift-arrest').textContent = t('admin.liftArrest');
  $('#admin-reset').textContent = t('admin.reset');
  $('#admin-service-editor').textContent = t('admin.serviceEditor');
  $('#admin-logs').textContent = t('admin.logs');
}

function setupNavigation() {
  const nav = $('#main-nav');
  nav.innerHTML = '';
  const items = [
    { id: 'services', label: t('nav.services') },
    { id: 'payments', label: t('nav.payments') },
    { id: 'cases', label: t('nav.cases') },
    { id: 'casino', label: t('nav.casino') },
    { id: 'documents', label: t('nav.documents') },
    { id: 'profile', label: t('nav.profile') }
  ];
  if (state.user?.role === 'administrators') {
    items.push({ id: 'admin', label: t('nav.admin') });
  }
  items.forEach((item, idx) => {
    const button = document.createElement('button');
    button.textContent = item.label;
    button.dataset.section = item.id;
    button.type = 'button';
    const isActive = item.id === state.currentSection || (!state.currentSection && idx === 0);
    button.classList.toggle('active', isActive);
    if (item.id === 'casino' && isUIArrested()) {
      button.disabled = true;
      button.title = state.lang === 'lv' ? 'Administratīvais arests ierobežo piekļuvi' : 'Административный арест ограничивает доступ';
    }
    button.addEventListener('click', () => showSection(item.id));
    nav.appendChild(button);
  });
}

function showSection(id) {
  state.currentSection = id;
  state.sections.forEach(section => {
    const el = document.getElementById(section);
    if (el) {
      el.classList.toggle('active', section === id);
    }
    const navBtn = document.querySelector(`nav button[data-section="${section}"]`);
    if (navBtn) {
      navBtn.classList.toggle('active', section === id);
    }
  });
  if (id === 'casino') {
    renderCasino();
  }
  if (id === 'admin') {
    renderAdmin();
  }
}

function showToast(message, severity = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.severity = severity;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(16px)';
    setTimeout(() => toast.remove(), 250);
  }, 4200);
}

function openModal({ title, content, actions }) {
  const modalRoot = $('#modal-root');
  modalRoot.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    modal.appendChild(h3);
  }
  if (content) {
    if (typeof content === 'string') {
      const div = document.createElement('div');
      div.innerHTML = content;
      modal.appendChild(div);
    } else {
      modal.appendChild(content);
    }
  }
  const footer = document.createElement('div');
  footer.style.marginTop = '1rem';
  footer.style.display = 'flex';
  footer.style.gap = '0.5rem';
  footer.style.justifyContent = 'flex-end';
  (actions || []).forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.className = action.variant === 'outline' ? 'outline' : 'primary';
    btn.addEventListener('click', () => {
      if (action.onClick) {
        const result = action.onClick();
        if (result instanceof Promise) {
          result.then(value => {
            if (value !== false) closeModal();
          }).catch(console.error);
          return;
        }
        if (result === false) {
          return;
        }
      }
      closeModal();
    });
    footer.appendChild(btn);
  });
  modal.appendChild(footer);
  modalRoot.appendChild(modal);
  modalRoot.classList.add('active');
  modalRoot.addEventListener('click', e => {
    if (e.target === modalRoot) closeModal();
  }, { once: true });
}

function closeModal() {
  const modalRoot = $('#modal-root');
  modalRoot.classList.remove('active');
  modalRoot.innerHTML = '';
}

function updateSessionInfo() {
  if (!state.user) {
    $('#session-info').textContent = '';
    return;
  }
  const expires = state.user.sessionExpiresAt;
  const remaining = expires - Date.now();
  if (remaining <= 0) {
    logout();
    return;
  }
  const seconds = Math.floor(remaining / 1000);
  $('#session-info').textContent = `${state.user.name || state.user.username} · ${seconds}s`;
}

function startSessionTimer() {
  clearInterval(state.sessionTimer);
  state.sessionTimer = setInterval(updateSessionInfo, 1000);
}

function scheduleSessionExpiry() {
  if (!state.user) return;
  clearTimeout(state.sessionTimeout);
  const expiresIn = state.user.sessionExpiresAt - Date.now();
  state.sessionTimeout = setTimeout(() => {
    showToast(t('login.logout'), 'warn');
    logout();
  }, expiresIn);
}

function logout() {
  clearInterval(state.sessionTimer);
  clearTimeout(state.sessionTimeout);
  clearTimeout(state.randomFineTimer);
  state.sessionTimer = null;
  state.sessionTimeout = null;
  state.randomFineTimer = null;
  state.user = null;
  state.currentSection = 'services';
  localStorage.removeItem('demo-user');
  $('#session-info').textContent = '';
  showSection('login');
  $('#login').classList.add('active');
  state.sections.forEach(section => {
    if (section !== 'login') {
      const el = document.getElementById(section);
      if (el) el.classList.remove('active');
    }
  });
  $('#main-nav').innerHTML = '';
  $('#system-banner').classList.remove('active');
}

function persistUser() {
  if (!state.user) return;
  localStorage.setItem('demo-user', JSON.stringify(state.user));
}

async function handleDemoLogin(form) {
  const username = form.username.value.trim();
  const password = form.password.value.trim();
  if (!username || !password) return;
  if (password !== '1234') {
    showToast('Nepareiza parole', 'warn');
    return;
  }
  let role = 'iedzivotajs';
  if (username.toLowerCase() === 'admin') {
    role = 'administrators';
  }
  const storedProfile = JSON.parse(localStorage.getItem(`profile-${username}`) || 'null');
  const user = storedProfile || {
    id: username,
    username,
    role,
    name: username === 'admin' ? 'Valsts Operators' : 'Demo Lietotājs',
    surname: username === 'admin' ? 'Administrators' : 'Iedzīvotājs',
    pk: '010199-12345',
    address: 'Brīvības iela 1, Rīga',
    email: 'demo@example.lv',
    phone: '+37120001234',
    balance: 0,
    settings: { lang: state.lang }
  };
  startUserSession(user);
}

function startUserSession(user) {
  const sessionExpiresAt = Date.now() + SESSION_DURATION;
  state.user = { ...user, sessionExpiresAt };
  persistUser();
  $('#login').classList.remove('active');
  setupNavigation();
  showSection('services');
  scheduleSessionExpiry();
  startSessionTimer();
  scheduleRandomFine();
  renderAll();
}

function scheduleRandomFine() {
  clearTimeout(state.randomFineTimer);
  if (!state.user) return;
  const delay = RANDOM_FINE_MIN + Math.random() * (RANDOM_FINE_MAX - RANDOM_FINE_MIN);
  state.randomFineTimer = setTimeout(async () => {
    if (Math.random() < 0.25) {
      await createRandomFine();
    }
    scheduleRandomFine();
  }, delay);
}

async function createRandomFine() {
  if (!state.user) return;
  const amount = Number((1.5 + Math.random() * 3).toFixed(2));
  const payment = await createPayment({
    userId: state.user.id,
    type: 'fine',
    title_lv: 'Administratīvais brīdinājums',
    title_ru: 'Административное предупреждение',
    amount,
    status: 'open',
    basis: 'Administratīvais brīdinājums',
    relatedCaseId: null
  });
  await addNotice({
    userId: state.user.id,
    title_lv: 'Administratīvais brīdinājums',
    title_ru: 'Административное предупреждение',
    body_lv: `Reģistrēts maksājums ${formatMoney(amount)} (${payment.id}).`,
    body_ru: `Зарегистрирован платёж ${formatMoney(amount)} (${payment.id}).`,
    severity: 'warn'
  });
  showToast(`${t('notifications.randomWarning')}: ${formatMoney(amount)}`);
  renderPayments();
}

async function createPayment({ userId, type, title_lv, title_ru, amount, status = 'open', basis, relatedCaseId, meta }) {
  const payment = {
    id: generateId('PMT'),
    userId,
    type,
    title_lv,
    title_ru,
    amount: Number(amount),
    createdAt: Date.now(),
    status,
    basis: basis || '',
    relatedCaseId: relatedCaseId || null,
    meta: meta || {}
  };
  await db.put('payments', payment);
  await logAction(`Maksājums ${payment.id} (${type}) ${formatMoney(amount)} statuss ${status}`);
  return payment;
}

async function updatePayment(payment) {
  await db.put('payments', payment);
  renderPayments();
}

async function getPayments(status) {
  if (!state.user) return [];
  const all = await db.getAll('payments');
  return all.filter(p => p.userId === state.user.id && (!status || p.status === status));
}

async function createCase({ userId, basis, amount, status = 'Izveidots', relatedPaymentId, sanctions = [], docs = [] }) {
  const caseRecord = {
    id: generateCaseId(),
    userId,
    basis,
    amount,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hearingAt: null,
    sanctions,
    docs,
    history: [{ status, ts: Date.now(), note: basis }],
    relatedPaymentId: relatedPaymentId || null
  };
  await db.put('cases', caseRecord);
  await logAction(`Lieta ${caseRecord.id} (${basis}) statuss ${status}`);
  renderCases();
  return caseRecord;
}

function generateCaseId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `L-${datePart}-${seq}`;
}

async function updateCase(caseRecord, note) {
  caseRecord.updatedAt = Date.now();
  if (note) {
    caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note });
  }
  await db.put('cases', caseRecord);
  renderCases();
}

async function getCases() {
  if (!state.user) return [];
  const all = await db.getAll('cases');
  return all.filter(c => c.userId === state.user.id);
}

async function addNotice({ userId, title_lv, title_ru, body_lv, body_ru, severity = 'info', docId }) {
  const notice = {
    id: generateId('NTC'),
    userId,
    title_lv,
    title_ru,
    body_lv,
    body_ru,
    severity,
    docId: docId || null,
    ts: Date.now()
  };
  await db.put('notices', notice);
  renderDocuments();
  return notice;
}

async function addDocument({ userId, type, title, content }) {
  const documentRecord = {
    id: generateId('DOC'),
    userId,
    type,
    title,
    content,
    createdAt: Date.now()
  };
  await db.put('documents', documentRecord);
  renderDocuments();
  return documentRecord;
}

async function logAction(message) {
  await logger(message);
}

async function renderLogs() {
  const container = $('#admin-logs-list');
  if (!container) return;
  const entries = await db.getAll('logs');
  entries.sort((a, b) => b.ts - a.ts);
  container.innerHTML = entries.map(entry => `
    <div class="timeline-item">
      <div><strong>${formatDate(entry.ts)}</strong></div>
      <div>${entry.message}</div>
    </div>
  `).join('');
}

async function renderPayments() {
  if (!state.user) return;
  const openTable = $('#open-payments-table');
  const historyTable = $('#payments-history-table');
  const payments = (await getPayments()).sort((a, b) => b.createdAt - a.createdAt);
  const open = payments.filter(p => p.status === 'open' || p.status === 'processing');
  const history = payments.filter(p => p.status !== 'open' && p.status !== 'processing');
  openTable.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>${state.lang === 'lv' ? 'Apraksts' : 'Описание'}</th>
        <th>${state.lang === 'lv' ? 'Statuss' : 'Статус'}</th>
        <th>${state.lang === 'lv' ? 'Summa' : 'Сумма'}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${open.map(paymentRow).join('') || `<tr><td colspan="5">${state.lang === 'lv' ? 'Nav atvērto maksājumu' : 'Нет открытых платежей'}</td></tr>`}
    </tbody>
  `;
  historyTable.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>${state.lang === 'lv' ? 'Apraksts' : 'Описание'}</th>
        <th>${state.lang === 'lv' ? 'Statuss' : 'Статус'}</th>
        <th>${state.lang === 'lv' ? 'Summa' : 'Сумма'}</th>
        <th>${state.lang === 'lv' ? 'Datums' : 'Дата'}</th>
      </tr>
    </thead>
    <tbody>
      ${history.map(historyRow).join('') || `<tr><td colspan="5">${state.lang === 'lv' ? 'Nav ierakstu' : 'Нет записей'}</td></tr>`}
    </tbody>
  `;
  updateBalanceDisplay();
  const withdrawButtons = ['#btn-withdraw', '#profile-withdraw'];
  withdrawButtons.forEach(sel => {
    const btn = document.querySelector(sel);
    if (btn) btn.disabled = isUIArrested();
  });
}

function paymentRow(payment) {
  const description = state.lang === 'lv' ? payment.title_lv : payment.title_ru;
  const canPay = (state.user.balance || 0) >= payment.amount && payment.status === 'open' && !isUIArrested();
  const payButton = `<button class="primary" data-action="pay" data-id="${payment.id}" ${canPay ? '' : 'disabled'}>${t('payments.pay')}</button>`;
  const payLaterDisabled = payment.status !== 'open' || isUIArrested();
  const payLaterButton = `<button class="outline" data-action="later" data-id="${payment.id}" ${payLaterDisabled ? 'disabled' : ''}>${t('payments.payLater')}</button>`;
  return `
    <tr>
      <td>${payment.id}</td>
      <td>${description}</td>
      <td>${t(`payments.status.${payment.status === 'processing' ? 'processing' : 'open'}`)}</td>
      <td>${formatMoney(payment.amount)}</td>
      <td style="display:flex;gap:0.5rem;">${payButton}${payLaterButton}</td>
    </tr>
  `;
}

function historyRow(payment) {
  const description = state.lang === 'lv' ? payment.title_lv : payment.title_ru;
  return `
    <tr>
      <td>${payment.id}</td>
      <td>${description}</td>
      <td>${t(`payments.status.${payment.status}`) || payment.status}</td>
      <td>${formatMoney(payment.amount)}</td>
      <td>${formatDate(payment.createdAt)}</td>
    </tr>
  `;
}

async function renderServices() {
  if (!state.user) return;
  const list = $('#services-list');
  list.innerHTML = '';
  state.serviceCatalog.forEach(service => {
    const card = document.createElement('div');
    card.className = 'card';
    const title = state.lang === 'lv' ? service.title_lv : service.title_ru;
    card.innerHTML = `
      <h3>${title}</h3>
      <p>${t('services.price')}: ${formatMoney(service.price)}</p>
      <p>${t('services.deadline')}: ${service.minDays}-${service.maxDays} ${state.lang === 'lv' ? 'dienas' : 'дней'}</p>
      <button class="primary" data-service="${service.code}" ${isUIArrested() && service.code !== 'priority-queue' ? 'disabled' : ''}>${t('services.order')}</button>
    `;
    card.querySelector('button').addEventListener('click', () => orderService(service));
    list.appendChild(card);
  });
  renderServiceOrders();
}

async function orderService(service) {
  if (service.code === 'priority-queue') {
    state.user.priorityBoostUntil = Date.now() + 6 * 60 * 60 * 1000;
    persistUser();
  }
  let minDays = service.minDays;
  let maxDays = service.maxDays;
  if (service.code !== 'priority-queue' && state.user.priorityBoostUntil && state.user.priorityBoostUntil > Date.now()) {
    minDays = Math.max(1, Math.round(minDays * 0.7));
    maxDays = Math.max(minDays, Math.round(maxDays * 0.7));
  }
  const payment = await createPayment({
    userId: state.user.id,
    type: 'service',
    title_lv: service.title_lv,
    title_ru: service.title_ru,
    amount: service.price,
    status: 'open',
    basis: `Pakalpojuma ${service.code} pasūtījums`
  });
  const order = {
    id: generateId('SRV'),
    userId: state.user.id,
    code: service.code,
    title_lv: service.title_lv,
    title_ru: service.title_ru,
    price: service.price,
    status: 'new',
    createdAt: Date.now(),
    minDays,
    maxDays,
    history: [{ status: 'new', ts: Date.now() }]
  };
  await db.put('services', order);
  await addNotice({
    userId: state.user.id,
    title_lv: 'Pakalpojuma rēķins',
    title_ru: 'Счёт за услугу',
    body_lv: `Saglabāts rēķins ${payment.id} (${service.title_lv}).`,
    body_ru: `Сформирован счёт ${payment.id} (${service.title_ru}).`,
    severity: 'info'
  });
  showToast(`${service.title_lv} - ${formatMoney(service.price)}`);
  renderPayments();
  renderServiceOrders();
}

async function renderServiceOrders() {
  const container = $('#service-orders');
  const orders = await db.getAll('services');
  const userOrders = orders.filter(o => o.userId === state.user.id).sort((a, b) => b.createdAt - a.createdAt);
  if (!userOrders.length) {
    container.innerHTML = `<p>${state.lang === 'lv' ? 'Nav pasūtījumu' : 'Нет заказов'}</p>`;
    return;
  }
  container.innerHTML = userOrders.map(order => {
    const title = state.lang === 'lv' ? order.title_lv : order.title_ru;
    const deadlineText = `${order.minDays}-${order.maxDays} ${state.lang === 'lv' ? 'dienas' : 'дней'}`;
    const statusMap = {
      new: { lv: 'Jauns', ru: 'Новый' },
      processing: { lv: 'Apstrādē', ru: 'Обработка' },
      review: { lv: 'Pārskatīšanā', ru: 'Рассмотрение' },
      prepared: { lv: 'Sagatavots', ru: 'Подготовлено' },
      closed: { lv: 'Slēgts', ru: 'Закрыто' }
    };
    const statusLabel = statusMap[order.status]?.[state.lang] || order.status;
    return `
      <div class="card" style="margin-bottom:1rem;">
        <strong>${title}</strong>
        <div>${state.lang === 'lv' ? 'Statuss' : 'Статус'}: ${statusLabel}</div>
        <div>${t('services.deadline')}: ${deadlineText}</div>
      </div>
    `;
  }).join('');
}

async function renderCases() {
  if (!state.user) return;
  const container = $('#cases-container');
  const cases = await getCases();
  if (!cases.length) {
    container.innerHTML = `<p>${t('cases.noCases')}</p>`;
    return;
  }
  container.innerHTML = '';
  cases.sort((a, b) => b.createdAt - a.createdAt);
  cases.forEach(caseRecord => {
    const card = document.createElement('div');
    card.className = 'card case-card';
    const title = `${caseRecord.id} · ${caseRecord.basis}`;
    card.innerHTML = `
      <h3>${title}</h3>
      <div>${state.lang === 'lv' ? 'Summa' : 'Сумма'}: ${formatMoney(caseRecord.amount)}</div>
      <div>${state.lang === 'lv' ? 'Statuss' : 'Статус'}: ${caseRecord.status}</div>
      <div>${state.lang === 'lv' ? 'Izveidots' : 'Создано'}: ${formatDate(caseRecord.createdAt)}</div>
      ${caseRecord.hearingAt ? `<div>${state.lang === 'lv' ? 'Sēde' : 'Заседание'}: ${formatDate(caseRecord.hearingAt)}</div>` : ''}
      <div class="actions" style="margin:1rem 0;display:flex;gap:0.5rem;">
        <button class="outline" data-case="${caseRecord.id}" data-action="appeal" ${isUIArrested() ? 'disabled' : ''}>${t('cases.appeal')}</button>
      </div>
      <div class="timeline">
        ${caseRecord.history.map(item => `<div class="timeline-item"><div><strong>${formatDate(item.ts)}</strong></div><div>${item.status}</div><div>${item.note || ''}</div></div>`).join('')}
      </div>
    `;
    const appealBtn = card.querySelector('[data-action="appeal"]');
    appealBtn.addEventListener('click', () => openAppealModal(caseRecord));
    container.appendChild(card);
  });
}
function openAppealModal(caseRecord) {
  const textarea = document.createElement('textarea');
  textarea.placeholder = t('cases.appealPlaceholder');
  openModal({
    title: t('cases.appeal'),
    content: textarea,
    actions: [
      { label: 'OK', variant: 'primary', onClick: async () => {
        await addNotice({
          userId: state.user.id,
          title_lv: 'Apelācija reģistrēta',
          title_ru: 'Апелляция зарегистрирована',
          body_lv: textarea.value || 'Apelācija saņemta.',
          body_ru: textarea.value || 'Апелляция получена.',
          severity: 'info'
        });
        caseRecord.status = 'Apelācija reģistrēta';
        caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: textarea.value });
        await updateCase(caseRecord);
        setTimeout(async () => {
          caseRecord.status = Math.random() < 0.1 ? 'Apelācija daļēji apmierināta' : 'Apelācija noraidīta';
          caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: 'Apelācijas rezultāts' });
          await updateCase(caseRecord);
        }, 1000 * (10 + Math.random() * 110));
      } }
    ]
  });
}

async function renderCasino() {
  const container = $('#casino-content');
  if (isUIArrested()) {
    container.innerHTML = `<div class="card">${state.lang === 'lv' ? 'Kazino piekļuve ierobežota administratīvā aresta laikā.' : 'Доступ к казино ограничен на период административного ареста.'}</div>`;
    return;
  }
  const activeTab = document.querySelector('.tabs button.active')?.dataset.tab || 'roulette';
  if (activeTab === 'roulette') {
    container.innerHTML = `
      <div class="card">
        <p>${state.lang === 'lv' ? 'Rulete ar sešiem sektoriem. Rezultāts ietekmēs maksājumus un lietas.' : 'Рулетка с шестью секторами. Результат влияет на платежи и дела.'}</p>
        <button class="primary" id="roulette-spin">${t('casino.spin')}</button>
      </div>
    `;
    $('#roulette-spin').addEventListener('click', () => playRoulette());
  } else if (activeTab === 'lottery') {
    container.innerHTML = `
      <div class="card">
        <p>${state.lang === 'lv' ? 'Biļetes cena 1€.' : 'Цена билета 1€.'}</p>
        <button class="primary" id="lottery-play">${t('casino.play')}</button>
      </div>
    `;
    $('#lottery-play').addEventListener('click', () => playLottery());
  } else {
    container.innerHTML = `
      <div class="card">
        <label>${t('casino.bet')}</label>
        <input id="double-bet" type="number" min="1" step="0.5" value="1" />
        <button class="primary" id="double-play">${t('casino.play')}</button>
      </div>
    `;
    $('#double-play').addEventListener('click', () => playDouble());
  }
  renderCasinoHistory();
}

async function renderCasinoHistory() {
  const list = $('#casino-history-list');
  const results = await db.getAll('gameResults');
  const filtered = results.filter(r => r.userId === state.user?.id).sort((a, b) => b.ts - a.ts);
  list.innerHTML = filtered.map(result => `
    <div class="timeline-item">
      <div><strong>${formatDate(result.ts)}</strong> · ${result.game}</div>
      <div>${result.outcome}</div>
      <div>${result.deltaBalance ? formatMoney(result.deltaBalance) : ''}</div>
    </div>
  `).join('');
}

async function recordGameResult(result) {
  await db.put('gameResults', { id: generateId('GAME'), ...result, ts: Date.now() });
  renderCasinoHistory();
}

function isUIArrested() {
  if (!state.user?.uiArrestUntil) return false;
  return state.user.uiArrestUntil > Date.now();
}

function imposeUIArrest(durationMs, reason) {
  state.user.uiArrestUntil = Date.now() + durationMs;
  persistUser();
  renderProfile();
  showBanner(`${t('notifications.uiArrest')} ${formatDate(state.user.uiArrestUntil)}`);
  logAction(`UI arests: ${reason}`);
  setupNavigation();
  renderCasino();
}

function liftUIArrest() {
  state.user.uiArrestUntil = null;
  persistUser();
  hideBanner();
  renderProfile();
  setupNavigation();
  renderCasino();
}

function showBanner(message) {
  const banner = $('#system-banner');
  banner.textContent = message;
  banner.classList.add('active');
}

function hideBanner() {
  const banner = $('#system-banner');
  banner.classList.remove('active');
  banner.textContent = '';
}

async function adjustBalance(amount, type = 'adjustment') {
  const current = Number(state.user.balance || 0);
  state.user.balance = Number((current + amount).toFixed(2));
  persistUser();
  if (amount !== 0) {
    await logAction(`Bilance ${formatMoney(amount)} (${type})`);
  }
  updateBalanceDisplay();
}

function updateBalanceDisplay() {
  const el = $('#profile-balance');
  if (el) {
    el.textContent = formatMoney(state.user?.balance || 0);
  }
}

function renderProfile() {
  if (!state.user) return;
  $('#profile-name').value = state.user.name || '';
  $('#profile-surname').value = state.user.surname || '';
  $('#profile-pk').value = state.user.pk || '';
  $('#profile-address').value = state.user.address || '';
  $('#profile-email').value = state.user.email || '';
  $('#profile-phone').value = state.user.phone || '';
  updateBalanceDisplay();
  const arrestBadge = $('#ui-arrest');
  if (isUIArrested()) {
    arrestBadge.classList.remove('hidden');
    arrestBadge.textContent = `${t('profile.adminArrest')}: ${formatDate(state.user.uiArrestUntil)}`;
    showBanner(`${t('notifications.uiArrest')} ${formatDate(state.user.uiArrestUntil)}`);
  } else {
    arrestBadge.classList.add('hidden');
    hideBanner();
  }
}

async function renderDocuments() {
  if (!state.user) return;
  const receipts = $('#receipt-list');
  const noticesEl = $('#notice-list');
  const docs = (await db.getAll('documents')).filter(d => d.userId === state.user.id && d.type === 'receipt');
  const notices = (await db.getAll('notices')).filter(n => n.userId === state.user.id);
  receipts.innerHTML = docs.length ? docs.map(doc => `
    <div class="card">
      <div>${doc.title}</div>
      <small>${formatDate(doc.createdAt)}</small>
      <button class="outline" data-doc="${doc.id}">${t('documents.download')}</button>
    </div>
  `).join('') : `<p>${state.lang === 'lv' ? 'Nav kvitanču' : 'Нет квитанций'}</p>`;
  noticesEl.innerHTML = notices.length ? notices.map(notice => `
    <div class="card">
      <strong>${state.lang === 'lv' ? notice.title_lv : notice.title_ru}</strong>
      <p>${state.lang === 'lv' ? notice.body_lv : notice.body_ru}</p>
      <small>${formatDate(notice.ts)}</small>
    </div>
  `).join('') : `<p>${state.lang === 'lv' ? 'Nav paziņojumu' : 'Нет уведомлений'}</p>`;
  receipts.querySelectorAll('button[data-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const doc = await db.get('documents', btn.dataset.doc);
      downloadDocument(doc);
    });
  });
}

function downloadDocument(doc) {
  const blob = new Blob([doc.content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderAll() {
  if (!state.user) return;
  setupNavigation();
  renderServices();
  renderPayments();
  renderCases();
  renderCasino();
  renderDocuments();
  renderProfile();
  if (state.user.role === 'administrators') {
    renderAdmin();
  }
}

function renderAdmin() {
  const container = $('#probability-controls');
  if (!container) return;
  container.innerHTML = '';
  Object.entries(state.probabilities).forEach(([key, value]) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '1rem';
    wrapper.innerHTML = `
      <label>${key}</label>
      <input type="range" min="0" max="1" step="0.05" value="${value}" data-prob="${key}" />
      <span>${Math.round(value * 100)}%</span>
    `;
    const range = wrapper.querySelector('input');
    const span = wrapper.querySelector('span');
    range.addEventListener('input', () => {
      state.probabilities[key] = Number(range.value);
      span.textContent = `${Math.round(range.value * 100)}%`;
      localStorage.setItem('demo-probabilities', JSON.stringify(state.probabilities));
    });
    container.appendChild(wrapper);
  });
  renderLogs();
  renderServiceEditor();
}

function renderServiceEditor() {
  const editor = $('#service-editor');
  if (!editor) return;
  editor.innerHTML = state.serviceCatalog.map(service => `
    <div class="card">
      <div><strong>${service.code}</strong></div>
      <div>${service.title_lv} / ${service.title_ru}</div>
      <div>${formatMoney(service.price)}</div>
      <button class="outline" data-edit="${service.code}">Edit</button>
    </div>
  `).join('');
  editor.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openServiceEditModal(btn.dataset.edit));
  });
}

function openServiceEditModal(code) {
  const service = state.serviceCatalog.find(s => s.code === code);
  if (!service) return;
  const form = document.createElement('form');
  form.innerHTML = `
    <label>LV</label>
    <input name="lv" value="${service.title_lv}" />
    <label>RU</label>
    <input name="ru" value="${service.title_ru}" />
    <label>${t('services.price')}</label>
    <input name="price" type="number" min="0" step="0.01" value="${service.price}" />
  `;
  openModal({
    title: service.code,
    content: form,
    actions: [
      { label: 'Saglabāt', onClick: () => {
        service.title_lv = form.lv.value;
        service.title_ru = form.ru.value;
        service.price = Number(form.price.value);
        localStorage.setItem('demo-services', JSON.stringify(state.serviceCatalog));
        renderServices();
        logAction(`Pakalpojums ${code} labots`);
      } }
    ]
  });
}

async function handlePay(paymentId) {
  const payment = await db.get('payments', paymentId);
  if (!payment) return;
  if ((state.user.balance || 0) < payment.amount) {
    showToast('Nepietiek līdzekļu', 'warn');
    return;
  }
  await adjustBalance(-payment.amount, 'payment');
  payment.status = 'paid';
  payment.meta.paidAt = Date.now();
  await updatePayment(payment);
  const receiptContent = `<!DOCTYPE html><html lang="${state.lang}"><head><meta charset="utf-8"><title>Kvīts ${payment.id}</title><style>body{font-family:Segoe UI,Roboto,sans-serif;padding:2rem;color:#1f1f1f;}h1{color:#591f2a;}table{width:100%;margin-top:1rem;border-collapse:collapse;}td{padding:0.5rem;border-bottom:1px solid #ddd;}</style></head><body><h1>ePakalpojumi+ DEMO</h1><p>${state.lang === 'lv' ? 'Kvitance par maksājumu' : 'Квитанция об оплате'}</p><table><tr><td>ID</td><td>${payment.id}</td></tr><tr><td>${state.lang === 'lv' ? 'Datums' : 'Дата'}</td><td>${new Date().toLocaleString()}</td></tr><tr><td>${state.lang === 'lv' ? 'Summa' : 'Сумма'}</td><td>${formatMoney(payment.amount)}</td></tr><tr><td>${state.lang === 'lv' ? 'Statuss' : 'Статус'}</td><td>${t('payments.status.paid')}</td></tr></table><p style="margin-top:2rem;">eParaksts+ DEMO</p></body></html>`;
  await addDocument({
    userId: state.user.id,
    type: 'receipt',
    title: `Kvīts ${payment.id}`,
    content: receiptContent
  });
  await addNotice({
    userId: state.user.id,
    title_lv: 'Maksājums reģistrēts',
    title_ru: 'Платёж зарегистрирован',
    body_lv: t('notifications.paymentRecorded'),
    body_ru: t('notifications.paymentRecorded'),
    severity: 'info'
  });
  showToast(t('notifications.paymentRecorded'));
  renderPayments();
  if (payment.relatedCaseId) {
    const caseRecord = await db.get('cases', payment.relatedCaseId);
    if (caseRecord) {
      caseRecord.status = 'Izpilde';
      caseRecord.history.push({ status: 'Izpilde', ts: Date.now(), note: 'Maksājums veikts' });
      await updateCase(caseRecord);
      setTimeout(async () => {
        caseRecord.status = 'Slēgts';
        caseRecord.history.push({ status: 'Slēgts', ts: Date.now(), note: 'Lieta noslēgta' });
        await updateCase(caseRecord);
      }, 1000 * (10 + Math.random() * 40));
    }
  }
}

async function handlePayLater(paymentId) {
  const payment = await db.get('payments', paymentId);
  if (!payment) return;
  payment.status = 'processing';
  await updatePayment(payment);
  const caseRecord = await createCase({
    userId: state.user.id,
    basis: payment.basis || 'Neapmaksāts pakalpojums',
    amount: payment.amount,
    status: 'Nosūtīts tiesai',
    relatedPaymentId: payment.id
  });
  caseRecord.hearingAt = Date.now() + 30 * 24 * 3600 * 1000;
  caseRecord.history.push({ status: 'Nosūtīts tiesai', ts: Date.now(), note: t('notifications.caseSent') });
  await updateCase(caseRecord);
  await addNotice({
    userId: state.user.id,
    title_lv: 'Tiesas ielūgums',
    title_ru: 'Судебная повестка',
    body_lv: t('notifications.caseSent'),
    body_ru: t('notifications.caseSent'),
    severity: 'warn',
    docId: caseRecord.id
  });
  showToast(t('notifications.caseSent'));
}

function initEventListeners() {
  $('#demo-form').addEventListener('submit', e => {
    e.preventDefault();
    handleDemoLogin(e.target);
  });
  $('#smart-form').addEventListener('submit', e => {
    e.preventDefault();
    const content = document.createElement('div');
    content.innerHTML = `<p>${t('login.smartPrompt')}</p><p>${t('login.enterCode')}: <strong>3841</strong></p>`;
    openModal({
      title: 'Smart-ID',
      content,
      actions: [
        { label: '1234', onClick: () => {
          showToast(t('login.codeAccepted'));
          const user = {
            id: 'smart-id',
            username: $('#smart-name').value,
            role: 'iedzivotajs',
            name: $('#smart-name').value.split(' ')[0] || 'Smart',
            surname: $('#smart-name').value.split(' ')[1] || 'ID',
            pk: $('#smart-pk').value,
            address: 'Deklarētā adrese nav pievienota',
            email: 'smart@example.lv',
            phone: '+37120001234',
            balance: 0,
            settings: { lang: state.lang }
          };
          startUserSession(user);
        } }
      ]
    });
  });
  $('#esign-form').addEventListener('submit', e => {
    e.preventDefault();
    const loader = document.createElement('div');
    loader.textContent = t('login.eSignClient');
    openModal({
      title: 'eParaksts',
      content: loader,
      actions: []
    });
    setTimeout(() => {
      closeModal();
      const user = {
        id: 'esign',
        username: $('#esign-id').value,
        role: 'iedzivotajs',
        name: 'eParaksts',
        surname: 'Lietotājs',
        pk: '120305-67890',
        address: 'Deklarētā adrese nav pievienota',
        email: 'esign@example.lv',
        phone: '+37120001235',
        balance: 0,
        settings: { lang: state.lang }
      };
      startUserSession(user);
    }, 1200);
  });
  $('#sms-form').addEventListener('submit', e => {
    e.preventDefault();
    $('#sms-form .otp').classList.remove('hidden');
    showToast('SMS kods nosūtīts: 0000 / 123456');
  });
  $('#sms-verify').addEventListener('click', () => {
    showToast('Autentifikācija pabeigta');
    const user = {
      id: 'sms',
      username: $('#sms-phone').value,
      role: 'iedzivotajs',
      name: 'SMS',
      surname: 'Lietotājs',
      pk: '311299-00011',
      address: 'Deklarētā adrese nav pievienota',
      email: 'sms@example.lv',
      phone: $('#sms-phone').value,
      balance: 0,
      settings: { lang: state.lang }
    };
    startUserSession(user);
  });
  $('#btn-topup').addEventListener('click', openTopUpModal);
  $('#btn-withdraw').addEventListener('click', openWithdrawModal);
  $('#profile-topup').addEventListener('click', openTopUpModal);
  $('#profile-withdraw').addEventListener('click', openWithdrawModal);
  $('#profile-form').addEventListener('submit', handleProfileSave);
  $('#open-payments-table').addEventListener('click', e => {
    if (!(e.target instanceof HTMLElement)) return;
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.dataset.action === 'pay') {
      handlePay(id);
    } else if (e.target.dataset.action === 'later') {
      handlePayLater(id);
    }
  });
  $$('#casino .tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#casino .tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCasino();
    });
  });
  $$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });
  $('#admin-generate-fine').addEventListener('click', async () => {
    await createRandomFine();
  });
  $('#admin-create-case').addEventListener('click', async () => {
    await createCase({
      userId: state.user.id,
      basis: 'Administratīvais pārkāpums',
      amount: Number((5 + Math.random() * 40).toFixed(2)),
      status: 'Izskatīšanā'
    });
  });
  $('#admin-force-hearing').addEventListener('click', async () => {
    const cases = await getCases();
    const target = cases.find(c => c.status !== 'Slēgts');
    if (target) {
      resolveCase(target);
    }
  });
  $('#admin-lift-arrest').addEventListener('click', () => liftUIArrest());
  $('#admin-reset').addEventListener('click', resetAllData);
}

async function openTopUpModal() {
  if (!state.user) return;
  const form = document.createElement('form');
  form.innerHTML = `
    <label>Kartes īpašnieks</label>
    <input name="holder" required placeholder="Vārds Uzvārds" />
    <label>Kartes numurs</label>
    <input name="number" required placeholder="5454 5454 5454 5454" pattern="[0-9 ]{16,19}" />
    <label>Derīga līdz</label>
    <input name="expiry" required placeholder="12/29" />
    <label>CVV</label>
    <input name="cvv" required placeholder="123" pattern="[0-9]{3}" />
    <label>Summa</label>
    <input name="amount" type="number" min="1" step="0.5" value="10" />
  `;
  openModal({
    title: t('payments.topUp'),
    content: form,
    actions: [
      { label: t('login.confirm'), onClick: async () => {
        const amount = Number(form.amount.value);
        await adjustBalance(amount, 'deposit');
        await createPayment({
          userId: state.user.id,
          type: 'deposit',
          title_lv: 'Bilances papildinājums',
          title_ru: 'Пополнение баланса',
          amount,
          status: 'paid',
          meta: { method: 'card' }
        });
        renderPayments();
      } }
    ]
  });
}

async function openWithdrawModal() {
  if (!state.user) return;
  const content = document.createElement('div');
  content.innerHTML = `<p>${state.lang === 'lv' ? 'Pieprasījums tiks apstrādāts demo režīmā.' : 'Запрос будет обработан в демонстрационном режиме.'}</p>`;
  openModal({
    title: t('payments.withdraw'),
    content,
    actions: [
      { label: t('login.confirm'), onClick: async () => {
        if ((state.user.balance || 0) < 1) {
          showToast('Nepietiek līdzekļu (min 1€)', 'warn');
          return false;
        }
        await adjustBalance(-1, 'withdraw-commission');
        const payment = await createPayment({
          userId: state.user.id,
          type: 'withdraw',
          title_lv: 'Izmaksas pieprasījums',
          title_ru: 'Запрос на вывод',
          amount: 1,
          status: 'processing'
        });
        setTimeout(async () => {
          payment.status = 'rejected';
          payment.meta.reason = 'Demo režīms';
          await updatePayment(payment);
          showToast('Izmaksa atteikta (demo)');
        }, 1000 * (10 + Math.random() * 20));
      } }
    ]
  });
}

async function handleProfileSave(event) {
  event.preventDefault();
  state.user.name = $('#profile-name').value;
  state.user.surname = $('#profile-surname').value;
  state.user.pk = $('#profile-pk').value;
  state.user.address = $('#profile-address').value;
  state.user.email = $('#profile-email').value;
  state.user.phone = $('#profile-phone').value;
  persistUser();
  localStorage.setItem(`profile-${state.user.id}`, JSON.stringify(state.user));
  showToast(t('notifications.profileSaved'));
  await createDataProcessingFine();
}

async function createDataProcessingFine() {
  const amount = Number((3 + Math.random() * 6).toFixed(2));
  const payment = await createPayment({
    userId: state.user.id,
    type: 'fine',
    title_lv: 'Nepareiza datu apstrāde',
    title_ru: 'Неправильная обработка данных',
    amount,
    status: 'open',
    basis: 'Datu apstrādes pārkāpums'
  });
  await addNotice({
    userId: state.user.id,
    title_lv: 'Datu apstrādes sods',
    title_ru: 'Штраф за обработку данных',
    body_lv: t('notifications.fineRegistered'),
    body_ru: t('notifications.fineRegistered'),
    severity: 'warn',
    docId: payment.id
  });
  showToast(t('notifications.fineRegistered'));
  renderPayments();
}

async function playRoulette() {
  if (!state.user) return;
  const sectors = [
    { label_lv: 'Atmaksa 50%', label_ru: 'Возврат 50%', effect: async () => adjustNearestDebt(-0.5), chance: 0.08 },
    { label_lv: 'Atlaide 10%', label_ru: 'Скидка 10%', effect: async () => adjustNearestDebt(-0.1), chance: 0.12 },
    { label_lv: 'Papildparāds', label_ru: 'Доп. долг', effect: async () => await createExtraDebt(), chance: 0.3 },
    { label_lv: 'Tiesa (lieta)', label_ru: 'Суд (дело)', effect: async () => await createCasinoCase(), chance: 0.1 },
    { label_lv: 'Aizkavēšana', label_ru: 'Отсрочка', effect: async () => await postponeNearestCase(), chance: 0.2 },
    { label_lv: 'Nekas', label_ru: 'Ничего', effect: async () => Promise.resolve(), chance: 0.2 }
  ];
  const rand = Math.random();
  let cumulative = 0;
  let result = sectors[sectors.length - 1];
  for (const sector of sectors) {
    cumulative += sector.chance;
    if (rand <= cumulative) {
      result = sector;
      break;
    }
  }
  await result.effect();
  await recordGameResult({
    userId: state.user.id,
    game: state.lang === 'lv' ? 'Rulete' : 'Рулетка',
    outcome: state.lang === 'lv' ? result.label_lv : result.label_ru,
    deltaBalance: 0
  });
  showToast(state.lang === 'lv' ? result.label_lv : result.label_ru);
}

async function adjustNearestDebt(factor) {
  const payments = await getPayments();
  const target = payments.find(p => p.status === 'open');
  if (!target) return;
  const delta = Number((target.amount * Math.abs(factor)).toFixed(2));
  if (factor < 0) {
    target.amount = Number((target.amount + target.amount * factor).toFixed(2));
    target.history?.push?.({ type: 'discount', value: delta });
  } else {
    target.amount = Number((target.amount + delta).toFixed(2));
  }
  await updatePayment(target);
  showToast(`${target.id}: ${formatMoney(target.amount)}`);
}

async function createExtraDebt() {
  const amount = Number((5 + Math.random() * 20).toFixed(2));
  await createPayment({
    userId: state.user.id,
    type: 'extra',
    title_lv: 'Papildparāds (Kazino)',
    title_ru: 'Дополнительный долг (Казино)',
    amount,
    status: 'open',
    basis: 'Kazino sekas'
  });
  renderPayments();
  trackNegativeOutcome();
}

async function createCasinoCase() {
  const caseRecord = await createCase({
    userId: state.user.id,
    basis: 'Kazino riski',
    amount: Number((10 + Math.random() * 40).toFixed(2)),
    status: 'Nosūtīts tiesai'
  });
  caseRecord.hearingAt = Date.now() + 30 * 24 * 3600 * 1000;
  await updateCase(caseRecord, 'Kazino sekas – lieta nosūtīta tiesai');
  await addNotice({
    userId: state.user.id,
    title_lv: 'Tiesas ielūgums (Kazino)',
    title_ru: 'Судебная повестка (Казино)',
    body_lv: 'Kazino rezultāts izraisīja tiesvedību. Sēde ieplānota pēc 30 dienām.',
    body_ru: 'Итог казино привёл к делу. Заседание назначено через 30 дней.',
    severity: 'warn',
    docId: caseRecord.id
  });
  trackNegativeOutcome();
}

async function postponeNearestCase() {
  const cases = await getCases();
  const target = cases.find(c => c.status !== 'Slēgts');
  if (!target) return;
  target.hearingAt = (target.hearingAt || Date.now()) + 30 * 24 * 3600 * 1000;
  target.history.push({ status: target.status, ts: Date.now(), note: 'Termiņš pagarināts +30 dienas' });
  await updateCase(target);
}

async function playLottery() {
  if (!state.user) return;
  await adjustBalance(-1, 'lottery-ticket');
  const rand = Math.random();
  let outcome, delta = 0;
  if (rand < 0.15) {
    delta = Number((10 + Math.random() * 40).toFixed(2));
    outcome = state.lang === 'lv' ? `Laimests ${formatMoney(delta)}` : `Выигрыш ${formatMoney(delta)}`;
  } else if (rand < 0.20) {
    delta = Number((51 + Math.random() * 149).toFixed(2));
    outcome = state.lang === 'lv' ? `Liels laimests ${formatMoney(delta)}` : `Крупный выигрыш ${formatMoney(delta)}`;
  } else if (rand < 0.21) {
    delta = Number((200 + Math.random() * 200).toFixed(2));
    outcome = state.lang === 'lv' ? `Mega laimests ${formatMoney(delta)}` : `Большой выигрыш ${formatMoney(delta)}`;
  } else if (rand < 0.31) {
    await createExtraDebt();
    outcome = state.lang === 'lv' ? 'Papildparāds' : 'Дополнительный долг';
  } else {
    outcome = state.lang === 'lv' ? 'Nekas' : 'Ничего';
  }
  if (delta > 0) {
    await adjustBalance(delta, 'lottery-win');
  }
  await recordGameResult({ userId: state.user.id, game: state.lang === 'lv' ? 'Loterija' : 'Лотерея', outcome, deltaBalance: delta });
  if (outcome.includes('Papildparāds') || outcome.includes('долг')) {
    trackNegativeOutcome();
  }
  showToast(outcome);
}
async function playDouble() {
  if (!state.user) return;
  const betInput = $('#double-bet');
  const bet = Number(betInput?.value || 0);
  if (bet <= 0) return;
  await adjustBalance(-bet, 'double-bet');
  if (Math.random() < 0.45) {
    await adjustBalance(bet * 2, 'double-win');
    await recordGameResult({ userId: state.user.id, game: state.lang === 'lv' ? 'Double' : 'Дабл', outcome: 'Win', deltaBalance: bet });
    showToast('Win!');
  } else {
    await createExtraDebt();
    await recordGameResult({ userId: state.user.id, game: state.lang === 'lv' ? 'Double' : 'Дабл', outcome: 'Lose', deltaBalance: -bet });
    showToast('Lose');
    trackNegativeOutcome();
  }
}

let negativeCounter = 0;
function trackNegativeOutcome() {
  negativeCounter += 1;
  if (negativeCounter >= 3 && !isUIArrested()) {
    imposeUIArrest(1000 * 60 * 4, 'Kazino trīs negatīvi pēc kārtas');
    negativeCounter = 0;
  }
  setTimeout(() => negativeCounter = Math.max(0, negativeCounter - 1), 60 * 1000);
}

async function resolveCase(caseRecord) {
  const probs = state.probabilities;
  const rand = Math.random();
  let cumulative = 0;
  const outcomes = [
    { key: 'softening', action: async () => await adjustCaseAmount(caseRecord, -0.3, 'Naudas sods samazināts') },
    { key: 'increase', action: async () => await adjustCaseAmount(caseRecord, 0.5, 'Naudas sods palielināts') },
    { key: 'postpone', action: async () => {
      caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: 'Atlikšana' });
      caseRecord.status = 'Atlikšana';
      caseRecord.hearingAt = Date.now() + 15 * 24 * 3600 * 1000;
      await updateCase(caseRecord);
    } },
    { key: 'uiArrest', action: async () => {
      imposeUIArrest(1000 * 60 * 3, 'Tiesas lēmums');
      caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: 'Administratīvais arests' });
      caseRecord.status = 'Spriedums';
      await updateCase(caseRecord);
    } },
    { key: 'refund', action: async () => {
      await adjustBalance(caseRecord.amount * 0.5, 'refund');
      caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: 'Daļēja atmaksa' });
      caseRecord.status = 'Spriedums';
      await updateCase(caseRecord);
    } },
    { key: 'unchanged', action: async () => {
      caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note: 'Bez izmaiņām' });
      caseRecord.status = 'Spriedums';
      await updateCase(caseRecord);
    } }
  ];
  let selected = outcomes[outcomes.length - 1];
  for (const outcome of outcomes) {
    cumulative += probs[outcome.key] || 0;
    if (rand <= cumulative) {
      selected = outcome;
      break;
    }
  }
  await selected.action();
  setTimeout(async () => {
    caseRecord.status = 'Izpilde';
    caseRecord.history.push({ status: 'Izpilde', ts: Date.now(), note: 'Spriedums izpildē' });
    await updateCase(caseRecord);
    setTimeout(async () => {
      caseRecord.status = 'Slēgts';
      caseRecord.history.push({ status: 'Slēgts', ts: Date.now(), note: 'Lieta noslēgta' });
      await updateCase(caseRecord);
    }, 1000 * (15 + Math.random() * 30));
  }, 1000 * (10 + Math.random() * 30));
}

async function adjustCaseAmount(caseRecord, factor, note) {
  const delta = Number((caseRecord.amount * factor).toFixed(2));
  caseRecord.amount = Number((caseRecord.amount + delta).toFixed(2));
  caseRecord.history.push({ status: caseRecord.status, ts: Date.now(), note });
  caseRecord.status = 'Spriedums';
  await updateCase(caseRecord);
  if (caseRecord.relatedPaymentId) {
    const payment = await db.get('payments', caseRecord.relatedPaymentId);
    if (payment) {
      payment.amount = Number((payment.amount + delta).toFixed(2));
      if (payment.amount < 0) payment.amount = 0;
      await updatePayment(payment);
    }
  }
  if (factor > 0) {
    await createPayment({
      userId: state.user.id,
      type: 'extra',
      title_lv: 'Sodu korekcija',
      title_ru: 'Коррекция штрафа',
      amount: Math.abs(delta),
      status: 'open',
      basis: 'Tiesas spriedums',
      relatedCaseId: caseRecord.id
    });
    renderPayments();
  }
}

async function resetAllData() {
  const dbInstance = await db.dbPromise;
  dbInstance.close();
  await new Promise(resolve => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = resolve;
    deleteRequest.onerror = resolve;
  });
  localStorage.clear();
  location.reload();
}

async function loadPersistedState() {
  const lang = localStorage.getItem('demo-lang');
  if (lang) state.lang = lang;
  const storedProb = JSON.parse(localStorage.getItem('demo-probabilities') || 'null');
  if (storedProb) state.probabilities = storedProb;
  const storedServices = JSON.parse(localStorage.getItem('demo-services') || 'null');
  if (storedServices) state.serviceCatalog = storedServices;
  const storedUser = JSON.parse(localStorage.getItem('demo-user') || 'null');
  if (storedUser) {
    if (storedUser.sessionExpiresAt > Date.now()) {
      startUserSession(storedUser);
    } else {
      localStorage.removeItem('demo-user');
    }
  }
}

function setupIntervals() {
  clearInterval(state.serviceTick);
  clearInterval(state.caseTick);
  state.serviceTick = setInterval(async () => {
    if (!state.user) return;
    const orders = await db.getAll('services');
    orders.filter(o => o.userId === state.user.id).forEach(async order => {
      const flow = ['new', 'processing', 'review', 'prepared', 'closed'];
      const currentIndex = flow.indexOf(order.status);
      if (currentIndex >= 0 && currentIndex < flow.length - 1) {
        if (Math.random() < 0.4) {
          order.status = flow[currentIndex + 1];
          order.history = order.history || [];
          order.history.push({ status: order.status, ts: Date.now() });
          await db.put('services', order);
        }
      }
    });
    renderServiceOrders();
  }, 15000 + Math.random() * 15000);

  state.caseTick = setInterval(async () => {
    if (!state.user) return;
    const cases = await getCases();
    cases.filter(c => c.status !== 'Slēgts').forEach(caseRecord => {
      if (caseRecord.hearingAt && caseRecord.hearingAt < Date.now()) {
        resolveCase(caseRecord);
        caseRecord.hearingAt = Date.now() + 1000 * (30 + Math.random() * 60);
      }
    });
  }, 20000);
}

function bindLanguage() {
  setLanguage(state.lang);
}

async function init() {
  await loadTranslations();
  await loadPersistedState();
  applyTranslations();
  initEventListeners();
  bindLanguage();
  setupIntervals();
}

document.addEventListener('DOMContentLoaded', init);
