'use strict';

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://midulrekmtkdbipyiexy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZHVscmVrbXRrZGJpcHlpZXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDg4MzAsImV4cCI6MjA5MjE4NDgzMH0.0XecU4IIwWnBKNzPq0-YrXlwD79FVcTphWwXffubDlQ';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, storageKey: 'spendmind_auth', autoRefreshToken: true },
}) : null;
let sbUser = null;

// ── Supabase sync helpers ─────────────────────────────────────────────────────
async function sbSyncEntries(e) {
  if (!sbUser || !sb) return;
  try {
    await sb.from('entries').delete().eq('user_id', sbUser.id);
    if (e.length) {
      await sb.from('entries').insert(e.map(en => ({
        id: en.id, user_id: sbUser.id, type: en.type || 'expense', category: en.category,
        description: en.description, amount: en.amount, date: en.date,
        payment: en.payment, recurring_id: en.recurringId || null,
      })));
    }
  } catch (err) { console.warn('sbSyncEntries:', err.message); }
}

async function sbSyncCategories(c) {
  if (!sbUser || !sb) return;
  try {
    await sb.from('categories').delete().eq('user_id', sbUser.id);
    const rows = [
      ...c.expense.map(cat => ({ user_id: sbUser.id, type: 'expense', value: cat.value, label: cat.label })),
      ...c.income.map(cat  => ({ user_id: sbUser.id, type: 'income',  value: cat.value, label: cat.label })),
    ];
    if (rows.length) await sb.from('categories').insert(rows);
  } catch (err) { console.warn('sbSyncCategories:', err.message); }
}

async function sbSyncBudgets(b) {
  if (!sbUser || !sb) return;
  try {
    await sb.from('budgets').delete().eq('user_id', sbUser.id);
    const rows = Object.entries(b).map(([cat, amt]) => ({ user_id: sbUser.id, category: cat, amount: amt }));
    if (rows.length) await sb.from('budgets').insert(rows);
  } catch (err) { console.warn('sbSyncBudgets:', err.message); }
}

async function sbSyncRecurrings(r) {
  if (!sbUser || !sb) return;
  try {
    await sb.from('recurring_expenses').delete().eq('user_id', sbUser.id);
    if (r.length) {
      await sb.from('recurring_expenses').insert(r.map(re => ({
        id: re.id, user_id: sbUser.id, type: re.type, category: re.category,
        description: re.description, amount: re.amount, payment: re.payment,
        day_of_month: re.dayOfMonth,
      })));
    }
  } catch (err) { console.warn('sbSyncRecurrings:', err.message); }
}

// ── Load all data from Supabase after login ───────────────────────────────────
async function loadFromSupabase() {
  if (!sbUser || !sb) return;
  try {
    showToast('Syncing…');
    const [{ data: eRows }, { data: cRows }, { data: bRows }, { data: rRows }] = await Promise.all([
      sb.from('entries').select('*').eq('user_id', sbUser.id),
      sb.from('categories').select('*').eq('user_id', sbUser.id),
      sb.from('budgets').select('*').eq('user_id', sbUser.id),
      sb.from('recurring_expenses').select('*').eq('user_id', sbUser.id),
    ]);

    // Entries
    if (eRows && eRows.length > 0) {
      entries = eRows.map(r => ({
        id: r.id, type: r.type, category: r.category,
        description: r.description, amount: parseFloat(r.amount),
        date: r.date, payment: r.payment,
        ...(r.recurring_id ? { recurringId: r.recurring_id } : {}),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } else if (entries.length > 0) {
      await sbSyncEntries(entries); // upload local data to Supabase
    }

    // Categories
    if (cRows && cRows.length > 0) {
      const exp = cRows.filter(r => r.type === 'expense').map(r => ({ value: r.value, label: r.label }));
      const inc = cRows.filter(r => r.type === 'income').map(r  => ({ value: r.value, label: r.label }));
      categories = { expense: exp, income: inc };
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    } else {
      await sbSyncCategories(categories);
    }

    // Budgets
    if (bRows && bRows.length > 0) {
      budgets = Object.fromEntries(bRows.map(r => [r.category, parseFloat(r.amount)]));
      localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
    } else if (Object.keys(budgets).length > 0) {
      await sbSyncBudgets(budgets);
    }

    // Recurring
    if (rRows && rRows.length > 0) {
      recurrings = rRows.map(r => ({
        id: r.id, type: r.type, category: r.category, description: r.description,
        amount: parseFloat(r.amount), payment: r.payment, dayOfMonth: r.day_of_month,
      }));
      localStorage.setItem(RECURRING_KEY, JSON.stringify(recurrings));
    } else if (recurrings.length > 0) {
      await sbSyncRecurrings(recurrings);
    }

    populateCategorySelect(typeInput.value);
    render();
    showToast('✓ Synced');
  } catch (err) {
    console.error('Supabase sync error:', err);
    showToast('Sync failed — using local data');
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────
let STORAGE_KEY    = 'broketracker_entries';
let BUDGET_KEY     = 'spendmind_budgets';
let CATEGORIES_KEY = 'spendmind_categories';
let RECURRING_KEY  = 'spendmind_recurring';
let AUTOLOG_KEY    = 'spendmind_autolog';
const PINS_KEY     = 'spendmind_registered_pins';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveEntries(e) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(e));
  sbSyncEntries(e);
}

function loadBudgets() {
  try { return JSON.parse(localStorage.getItem(BUDGET_KEY)) || {}; }
  catch { return {}; }
}
function saveBudgets(b) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(b));
  sbSyncBudgets(b);
}

function loadCategories() {
  try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || null; }
  catch { return null; }
}
function saveCategories(c) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(c));
  sbSyncCategories(c);
}

function loadRecurrings() {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY)) || []; }
  catch { return []; }
}
function saveRecurrings(r) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(r));
  sbSyncRecurrings(r);
}

function getRegisteredPins() {
  try { return JSON.parse(localStorage.getItem(PINS_KEY)) || []; }
  catch { return []; }
}
function registerPin(pin) {
  const pins = getRegisteredPins();
  if (!pins.includes(pin)) { pins.push(pin); localStorage.setItem(PINS_KEY, JSON.stringify(pins)); }
}

function activatePin(pin) {
  STORAGE_KEY    = `broketracker_entries_${pin}`;
  BUDGET_KEY     = `spendmind_budgets_${pin}`;
  CATEGORIES_KEY = `spendmind_categories_${pin}`;
  RECURRING_KEY  = `spendmind_recurring_${pin}`;
  AUTOLOG_KEY    = `spendmind_autolog_${pin}`;
  entries    = loadEntries();
  budgets    = loadBudgets();
  recurrings = loadRecurrings();
  const saved = loadCategories();
  categories = saved || { expense: DEFAULT_EXPENSE_CATS.map(c=>({...c})), income: DEFAULT_INCOME_CATS.map(c=>({...c})) };
}

let budgets    = {};
let categories = { expense: [], income: [] };
let recurrings = [];

// ── Default categories (seeds for new accounts only) ─────────────────────────
const DEFAULT_EXPENSE_CATS = [
  { value: 'Food',             label: '🍜 Food' },
  { value: 'Groceries',        label: '🛒 Groceries' },
  { value: 'Coffee',           label: '☕ Coffee' },
  { value: 'Drinks / Bars',    label: '🍻 Drinks / Bars' },
  { value: 'Transport',        label: '🚇 Transport' },
  { value: 'Online Shopping',  label: '📦 Online Shopping' },
  { value: 'Subscriptions',    label: '📱 Subscriptions' },
  { value: 'Entertainment',    label: '🎬 Entertainment' },
  { value: 'Travel',           label: '✈️ Travel' },
  { value: 'Gifts',            label: '🎁 Gifts' },
  { value: 'Health',           label: '💊 Health' },
  { value: 'Investments',      label: '📈 Investments' },
  { value: 'Misc',             label: '💸 Misc' },
];

const DEFAULT_INCOME_CATS = [
  { value: 'Salary',        label: '💼 Salary' },
  { value: 'Freelance',     label: '🖥️ Freelance' },
  { value: 'Gift Received', label: '🎀 Gift Received' },
  { value: 'Reimbursement', label: '🔄 Reimbursement' },
  { value: 'Other Income',  label: '💰 Other Income' },
];

// ── Category icon lookup (works for built-in + custom categories) ─────────────
function getIcon(categoryValue) {
  const all = [...(categories.expense || []), ...(categories.income || [])];
  const match = all.find(c => c.value === categoryValue);
  if (match) {
    // Extract first emoji/character from label (e.g. "🍜 Food" → "🍜")
    const parts = match.label.split(' ');
    if (parts.length > 1) return parts[0];
  }
  return '💸';
}

// ── Chart palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  '#5B8DEF','#FB7185','#34D399','#FBB040','#22D3EE',
  '#A78BFA','#F97316','#06B6D4','#84CC16','#EC4899',
  '#14B8A6','#F59E0B','#60A5FA','#C084FC','#4ADE80','#FB923C',
];

// ── State ─────────────────────────────────────────────────────────────────────
let entries = [];

// ── Active month state ────────────────────────────────────────────────────────
const _now = new Date();
let activeYear  = _now.getFullYear();
let activeMonth = _now.getMonth(); // 0-indexed

function getViewEntries() {
  return entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === activeYear && d.getMonth() === activeMonth;
  });
}

function monthLabel() {
  return new Date(activeYear, activeMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form            = document.getElementById('entry-form');
const descInput       = document.getElementById('entry-description');
const categorySelect  = document.getElementById('entry-category');
const amountInput     = document.getElementById('entry-amount');
const dateInput       = document.getElementById('entry-date');
const paymentInput    = document.getElementById('entry-payment');
const typeInput       = document.getElementById('entry-type');
const typeBtns        = document.querySelectorAll('.type-btn');
const payBtns         = document.querySelectorAll('.pay-btn');
const payViaRow       = document.getElementById('pay-via-row');
const btnAdd          = document.getElementById('btn-add');
const transactionList = document.getElementById('transaction-list');
const emptyState      = document.getElementById('empty-state');
const filterCategory  = document.getElementById('filter-category');
const filterPayment   = document.getElementById('filter-payment');
const clearAllBtn     = document.getElementById('clear-all');

// Summary
const totalSpentEl      = document.getElementById('total-spent');
const totalCreditEl     = document.getElementById('total-credit');
const highestDayAmtEl   = document.getElementById('highest-day-amt');
const highestDayLblEl   = document.getElementById('highest-day-label');
const highestWeekAmtEl  = document.getElementById('highest-week-amt');
const highestWeekLblEl  = document.getElementById('highest-week-label');

// ── Edit mode ────────────────────────────────────────────────────────────────
let editingId = null;

function enterEditMode(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  // Fill type
  const isIncome = entry.type === 'income';
  typeInput.value = entry.type;
  typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === entry.type));
  populateCategorySelect(entry.type);

  // Fill fields
  categorySelect.value = entry.category;
  descInput.value      = (entry.description !== entry.category) ? entry.description : '';
  amountInput.value    = entry.amount;
  dateInput.value      = entry.date;
  paymentInput.value   = entry.payment;
  payBtns.forEach(b => b.classList.toggle('active', b.dataset.pay === entry.payment));
  payViaRow.style.display = isIncome ? 'none' : '';

  // Update UI
  btnAdd.textContent = isIncome ? 'Update Income' : 'Update Expense';
  document.getElementById('cancel-edit').style.display = 'block';
  document.getElementById('recurring-toggle-row').style.display = 'none';
  form.classList.add('form--editing');
  form.closest('.form-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelEditMode() {
  editingId = null;
  form.reset();
  dateInput.value = new Date().toISOString().split('T')[0];
  typeInput.value = 'expense';
  typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === 'expense'));
  paymentInput.value = 'cash';
  payBtns.forEach(b => b.classList.toggle('active', b.dataset.pay === 'cash'));
  payViaRow.style.display = '';
  populateCategorySelect('expense');
  btnAdd.textContent = 'Add Expense';
  document.getElementById('cancel-edit').style.display = 'none';
  document.getElementById('recurring-toggle-row').style.display = '';
  form.classList.remove('form--editing');
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('sm-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sm-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('toast--show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('toast--show'), 3500);
}

// ── Auto-log recurring expenses ───────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function autoLogRecurrings() {
  if (!recurrings.length) return;
  const now      = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  if (localStorage.getItem(AUTOLOG_KEY) === monthKey) return;

  const todayNum = now.getDate();
  let logged = 0;

  recurrings.forEach(r => {
    const maxDay = daysInMonth(now.getFullYear(), now.getMonth());
    const day    = Math.min(r.dayOfMonth, maxDay);
    if (day > todayNum) return; // not yet due this month

    // Skip if already logged for this month
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const alreadyLogged = entries.some(e => e.recurringId === r.id && e.date.startsWith(monthPrefix));
    if (alreadyLogged) return;

    const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    entries.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      type:        r.type,
      description: r.description,
      category:    r.category,
      amount:      r.amount,
      date:        dateStr,
      payment:     r.payment,
      recurringId: r.id,
    });
    logged++;
  });

  if (logged > 0) {
    saveEntries(entries);
    showToast(`${logged} recurring expense${logged > 1 ? 's' : ''} auto-logged for ${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`);
  }
  localStorage.setItem(AUTOLOG_KEY, monthKey);
}

// ── Format ────────────────────────────────────────────────────────────────────
function fmt(n) {
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + '₹' + abs;
}
function fmtShort(n) {
  if (n >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(1) + 'L';
  if (n >= 1_000)    return '₹' + (n / 1_000).toFixed(1) + 'k';
  return '₹' + n.toLocaleString('en-IN');
}

// ── Populate category dropdown ────────────────────────────────────────────────
function populateCategorySelect(type) {
  const cats = type === 'income' ? categories.income : categories.expense;
  categorySelect.innerHTML = '<option value="" disabled selected>Select category</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.value; opt.textContent = c.label;
    categorySelect.appendChild(opt);
  });
}

// ── Animated counter ─────────────────────────────────────────────────────────
function animateValue(el, target, duration = 1100) {
  const startTime = performance.now();
  const prefix = target < 0 ? '-' : '';
  const abs = Math.abs(target);

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = abs * eased;
    el.textContent = prefix + '₹' + current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  syncMonthLabel();
  dateInput.value = new Date().toISOString().split('T')[0];
  populateCategorySelect('expense');
  autoLogRecurrings();
  render();

  // Recurring checkbox show/hide day picker
  const recurCheck = document.getElementById('recurring-check');
  const recurDayWrap = document.getElementById('recurring-day-wrap');
  recurCheck.addEventListener('change', () => {
    recurDayWrap.style.display = recurCheck.checked ? 'flex' : 'none';
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
function updateSummary() {
  const ve     = getViewEntries();
  const total  = ve.reduce((s, e) => s + e.amount, 0);
  const credit = ve.filter(e => e.payment === 'credit').reduce((s, e) => s + e.amount, 0);

  animateValue(totalSpentEl,  total);
  animateValue(totalCreditEl, credit);

  // Highest day (expenses only)
  const byDay = {};
  ve.filter(e => e.type !== 'income').forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
  const dayEntries = Object.entries(byDay);
  if (dayEntries.length) {
    const [topDate, topAmt] = dayEntries.sort((a, b) => b[1] - a[1])[0];
    animateValue(highestDayAmtEl, topAmt);
    highestDayLblEl.textContent = new Date(topDate + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } else {
    highestDayAmtEl.textContent = '₹0.00';
    highestDayLblEl.textContent = '—';
  }

  // Highest week — expenses only
  const byWeek = {};
  ve.filter(e => e.type !== 'income').forEach(e => {
    const d = new Date(e.date + 'T00:00:00');
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - day);
    const key = mon.toISOString().split('T')[0];
    byWeek[key] = (byWeek[key] || 0) + e.amount;
  });
  const weekEntries = Object.entries(byWeek);
  if (weekEntries.length) {
    const [topWeekMon, topWeekAmt] = weekEntries.sort((a, b) => b[1] - a[1])[0];
    const monDate = new Date(topWeekMon + 'T00:00:00');
    const sunDate = new Date(monDate); sunDate.setDate(monDate.getDate() + 6);
    const fmt2 = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    animateValue(highestWeekAmtEl, topWeekAmt);
    highestWeekLblEl.textContent = `${fmt2(monDate)} – ${fmt2(sunDate)}`;
  } else {
    highestWeekAmtEl.textContent = '₹0.00';
    highestWeekLblEl.textContent = '—';
  }
}

// ── Category filter dropdown ───────────────────────────────────────────────────
function updateCategoryFilter() {
  const existing = new Set(getViewEntries().map(e => e.category));
  const current  = filterCategory.value;
  filterCategory.innerHTML = '<option value="all">All Categories</option>';
  [...existing].sort().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    filterCategory.appendChild(opt);
  });
  if ([...filterCategory.options].some(o => o.value === current)) filterCategory.value = current;
}

// ── Transaction list ──────────────────────────────────────────────────────────
function renderList() {
  const catFilter    = filterCategory.value;
  const payFilter    = filterPayment.value;
  const searchEl     = document.getElementById('search-transactions');
  const searchQuery  = (searchEl ? searchEl.value : '').toLowerCase().trim();

  const filtered = getViewEntries().filter(e => {
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    if (payFilter !== 'all' && e.payment   !== payFilter) return false;
    if (searchQuery) {
      const haystack = `${e.category} ${e.description}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  }).slice().reverse();

  transactionList.querySelectorAll('.transaction-item').forEach(el => el.remove());

  if (filtered.length === 0) { emptyState.style.display = 'block'; return; }
  emptyState.style.display = 'none';
  filtered.forEach((e, i) => {
    const li = buildItem(e);
    li.style.animationDelay = `${i * 55}ms`;
    transactionList.appendChild(li);
  });
}

function buildItem(e) {
  const li = document.createElement('li');
  const isIncome = e.type === 'income';
  li.className = 'transaction-item' + (isIncome ? ' income-item' : '');
  li.dataset.id = e.id;

  const icon = getIcon(e.category);
  const payTag = isIncome ? '' : (e.payment === 'credit'
    ? '<span class="tx-pay credit">CC</span>'
    : '<span class="tx-pay cash">UPI</span>');
  const displayDate = new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const amtClass  = isIncome ? 'tx-amount income-amt' : 'tx-amount';
  const amtPrefix = isIncome ? '+' : '';

  li.innerHTML = `
    <div class="tx-icon ${isIncome ? 'income-icon' : ''}">${icon}</div>
    <div class="tx-info">
      <div class="tx-desc" title="${escHtml(e.description)}">${escHtml(e.description)}</div>
      <div class="tx-meta">${escHtml(e.category)} · ${displayDate}</div>
    </div>
    <div class="tx-right">
      <span class="${amtClass}">${amtPrefix}${fmt(e.amount)}</span>
      <div class="tx-row">${payTag}${e.recurringId ? '<span class="tx-recurring" title="Recurring">↻</span>' : ''}<button class="tx-edit" data-id="${e.id}" title="Edit">✎</button><button class="tx-delete" data-id="${e.id}" title="Delete">✕</button></div>
    </div>
  `;
  return li;
}

function escHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Money Intelligence ────────────────────────────────────────────────────────
function updateInsights() {
  const insightsSection = document.getElementById('insights-section');
  const insightsGrid    = document.getElementById('insights-grid');
  const expenses = getViewEntries().filter(e => e.type !== 'income');

  if (expenses.length === 0) { insightsSection.style.display = 'none'; return; }
  insightsSection.style.display = 'block';

  const insights = [];
  const todayD   = new Date(); todayD.setHours(0,0,0,0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const r = n => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── Last month comparison ──────────────────────────────────────────────────
  const prevMonthDate = new Date(activeYear, activeMonth - 1, 1);
  const lastMonthExp  = entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === prevMonthDate.getFullYear() &&
           d.getMonth()    === prevMonthDate.getMonth()    &&
           e.type !== 'income';
  });
  const lastMonthTotal = lastMonthExp.reduce((s, e) => s + e.amount, 0);
  if (lastMonthTotal > 0 && totalSpent > 0) {
    const pct  = Math.round(((totalSpent - lastMonthTotal) / lastMonthTotal) * 100);
    const more = pct > 0;
    const prevLabel = prevMonthDate.toLocaleString('en-IN', { month: 'short' });
    insights.push({
      emoji: more ? '📈' : '📉',
      type:  more ? 'bad' : 'good',
      title: `${Math.abs(pct)}% ${more ? 'more' : 'less'} than ${prevLabel}`,
      sub:   `This month ₹${r(totalSpent)} vs ₹${r(lastMonthTotal)} last month`,
    });
  }

  // ── Daily pace + projection ────────────────────────────────────────────────
  const isCurrentMonth = todayD.getFullYear() === activeYear && todayD.getMonth() === activeMonth;
  if (isCurrentMonth && expenses.length >= 3) {
    const dayOfMonth  = todayD.getDate();
    const daysInMo    = new Date(activeYear, activeMonth + 1, 0).getDate();
    const daysLeft    = daysInMo - dayOfMonth;
    const dailyAvg    = totalSpent / dayOfMonth;
    const projected   = Math.round(dailyAvg * daysInMo);
    insights.push({
      emoji: '🎯',
      type:  'info',
      title: `Spending ₹${r(Math.round(dailyAvg))}/day on average`,
      sub:   `${daysLeft} days left — projected month total: ₹${r(projected)}`,
    });
  }

  // ── Top 3 categories breakdown ────────────────────────────────────────────
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  if (sorted.length >= 1) {
    const top3    = sorted.slice(0, 3);
    const top3Sum = top3.reduce((s, [, v]) => s + v, 0);
    const pct     = Math.round(top3Sum / totalSpent * 100);
    const names   = top3.map(([c, v]) => `${c} ₹${r(v)}`).join(' · ');
    insights.push({
      emoji: getIcon(top3[0][0]),
      type:  'info',
      title: `Top ${top3.length} categories = ${pct}% of spend`,
      sub:   names,
    });
  }

  // ── Biggest single transaction ────────────────────────────────────────────
  if (expenses.length >= 2) {
    const biggest = expenses.reduce((a, b) => a.amount > b.amount ? a : b);
    const bigDate = new Date(biggest.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    insights.push({
      emoji: '💸',
      type:  'warn',
      title: `Biggest purchase: ₹${r(biggest.amount)}`,
      sub:   `${biggest.description || biggest.category} on ${bigDate}`,
    });
  }

  // ── No-spend days ─────────────────────────────────────────────────────────
  if (isCurrentMonth && todayD.getDate() >= 5) {
    const spendDays = new Set(expenses.map(e => e.date)).size;
    const noSpend   = todayD.getDate() - spendDays;
    if (noSpend > 0) {
      insights.push({
        emoji: '🧘',
        type:  'good',
        title: `${noSpend} no-spend day${noSpend > 1 ? 's' : ''} this month`,
        sub:   `You spent on ${spendDays} out of ${todayD.getDate()} days`,
      });
    }
  }

  // ── Unusual spike day ─────────────────────────────────────────────────────
  const dayTotals = {};
  expenses.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount; });
  const dayVals = Object.values(dayTotals);
  if (dayVals.length >= 3) {
    const avg    = dayVals.reduce((s, v) => s + v, 0) / dayVals.length;
    const spikes = Object.entries(dayTotals).filter(([, v]) => v > avg * 2).sort((a, b) => b[1] - a[1]);
    if (spikes.length) {
      const [spikeDate, spikeAmt] = spikes[0];
      const label = new Date(spikeDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      insights.push({
        emoji: '⚡',
        type:  'warn',
        title: `Big spike on ${label} — ₹${r(spikeAmt)}`,
        sub:   `${Math.round(spikeAmt / avg)}× your daily average of ₹${r(Math.round(avg))}`,
      });
    }
  }

  // ── Credit card ratio ─────────────────────────────────────────────────────
  const ccTotal = expenses.filter(e => e.payment === 'credit').reduce((s, e) => s + e.amount, 0);
  if (totalSpent > 0 && ccTotal / totalSpent > 0.55) {
    insights.push({
      emoji: '💳',
      type:  'bad',
      title: `${Math.round(ccTotal / totalSpent * 100)}% on credit card this month`,
      sub:   `₹${r(ccTotal)} charged — watch your CC bill at month end`,
    });
  }

  // ── Budget overruns ───────────────────────────────────────────────────────
  const budgetCats = Object.keys(budgets);
  if (budgetCats.length > 0) {
    const catSpendBudget = {};
    expenses.forEach(e => { catSpendBudget[e.category] = (catSpendBudget[e.category] || 0) + e.amount; });
    const overBudget = budgetCats.filter(c => catSpendBudget[c] > budgets[c]);
    if (overBudget.length > 0) {
      const details = overBudget.slice(0, 2).map(c => `${c} ₹${r(catSpendBudget[c])} / ₹${r(budgets[c])}`).join(' · ');
      insights.unshift({
        emoji: '🚨',
        type:  'bad',
        title: `Over budget in ${overBudget.length} categor${overBudget.length > 1 ? 'ies' : 'y'}`,
        sub:   details + (overBudget.length > 2 ? ` +${overBudget.length - 2} more` : ''),
      });
    }
  }

  insightsGrid.innerHTML = '';
  insights.forEach(ins => {
    const div = document.createElement('div');
    div.className = `insight-card ${ins.type}`;
    div.innerHTML = `
      <div class="insight-emoji">${ins.emoji}</div>
      <div class="insight-body">
        <div class="insight-title">${escHtml(ins.title)}</div>
        <div class="insight-sub">${escHtml(ins.sub)}</div>
      </div>`;
    insightsGrid.appendChild(div);
  });

  // Budget progress bars
  const budgetCatKeys = Object.keys(budgets);
  if (budgetCatKeys.length > 0) {
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.category] = (catSpend[e.category] || 0) + e.amount; });
    const barsDiv = document.createElement('div');
    barsDiv.className = 'budget-bars';
    budgetCatKeys.forEach(cat => {
      const spent  = catSpend[cat] || 0;
      const limit  = budgets[cat];
      const pct    = Math.min(Math.round(spent / limit * 100), 100);
      const cls    = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';
      const row    = document.createElement('div');
      row.className = 'budget-bar-row';
      row.innerHTML = `
        <div class="budget-bar-header">
          <span class="budget-bar-label">${escHtml(cat)}</span>
          <span class="budget-bar-amounts">₹${spent.toLocaleString('en-IN',{maximumFractionDigits:0})} / ₹${limit.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${cls}" style="width:${pct}%"></div>
        </div>`;
      barsDiv.appendChild(row);
    });
    insightsGrid.appendChild(barsDiv);
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
let charts = {};

// ── Timeline chart (current month) ───────────────────────────────────────────
function updateTimelineChart() {
  const year  = activeYear;
  const month = activeMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const _today = new Date();
  const isCurrentMonth = _today.getFullYear() === year && _today.getMonth() === month;
  const lastDay = isCurrentMonth ? _today.getDate() : daysInMonth;

  const days = Array.from({ length: lastDay }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  });

  const byDay = {};
  getViewEntries().filter(e => e.type !== 'income').forEach(e => {
    byDay[e.date] = (byDay[e.date] || 0) + e.amount;
  });

  const data = days.map(d => Math.round((byDay[d] || 0) * 100) / 100);
  const hasData = data.some(v => v > 0);

  if (!showChart('timeline-chart', 'timeline-empty', hasData)) {
    if (charts.timeline) { charts.timeline.destroy(); charts.timeline = null; }
    return;
  }

  // detect spikes (>1.75x avg)
  const nonZero = data.filter(v => v > 0);
  const avg = nonZero.length ? nonZero.reduce((s,v)=>s+v,0) / nonZero.length : 0;
  const bgColors = data.map(v => {
    if (v === 0) return 'rgba(91,141,239,.08)';
    if (v > avg * 1.75) return 'rgba(251,113,133,.85)';
    if (v > avg * 1.2)  return 'rgba(251,176,64,.8)';
    return 'rgba(91,141,239,.75)';
  });
  const borderColors = data.map(v => {
    if (v === 0) return 'transparent';
    if (v > avg * 1.75) return '#FB7185';
    if (v > avg * 1.2)  return '#FBB040';
    return '#5B8DEF';
  });

  const labels = days.map((_, i) => String(i + 1));

  if (charts.timeline) {
    charts.timeline.data.labels = labels;
    charts.timeline.data.datasets[0].data = data;
    charts.timeline.data.datasets[0].backgroundColor = bgColors;
    charts.timeline.data.datasets[0].borderColor = borderColors;
    charts.timeline.update();
    return;
  }

  charts.timeline = new Chart(document.getElementById('timeline-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: bgColors, borderColor: borderColors,
        borderWidth: 1, borderRadius: 4, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          ...DL_TOP,
          display: ctx => {
            const v = ctx.dataset.data[ctx.dataIndex];
            return v > 0 && v >= (avg * 0.5); // only label bars worth calling out
          },
          color: ctx => {
            const v = ctx.dataset.data[ctx.dataIndex];
            if (v > avg * 1.75) return '#FB7185';
            if (v > avg * 1.2)  return '#FBB040';
            return 'rgba(228,232,245,.85)';
          },
        },
        tooltip: {
          callbacks: {
            title: ctx => {
              const d = new Date(year, month, parseInt(ctx[0].label));
              return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
            },
            label: ctx => ctx.parsed.y > 0
              ? ` ₹${ctx.parsed.y.toLocaleString('en-IN', {minimumFractionDigits:2})}${ctx.parsed.y > avg*1.75 ? ' ⚡ spike' : ''}`
              : ' No spending',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(228,232,245,.38)', font: { size: 11 } },
          border: { color: 'transparent' },
        },
        y: {
          grid: { color: 'rgba(91,141,239,.08)' },
          ticks: { color: 'rgba(228,232,245,.38)', callback: v => fmtShort(v) },
          border: { color: 'transparent' },
        },
      },
    },
  });
}

// Register datalabels plugin — disabled globally, enabled per chart
Chart.register(ChartDataLabels);
Chart.defaults.set('plugins.datalabels', { display: false });

const CHART_DEFAULTS = {
  color: 'rgba(228,232,245,.38)',
  borderColor: 'rgba(91,141,239,.08)',
  plugins: { legend: { display: false } },
};

// Shared datalabel style helpers
const DL_BASE = {
  display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
  color: 'rgba(228,232,245,.85)',
  font: { family: 'Inter, sans-serif', size: 11, weight: '600' },
};
const DL_TOP = { // for vertical bars — label above bar
  ...DL_BASE,
  anchor: 'end', align: 'end',
  formatter: v => fmtShort(v),
  offset: 2,
};
const DL_END = { // for horizontal bars — label after bar
  ...DL_BASE,
  anchor: 'end', align: 'right',
  formatter: v => fmtShort(v),
  offset: 4,
  clamp: true,
};

function showChart(canvasId, emptyId, hasData) {
  const canvas = document.getElementById(canvasId);
  const empty  = document.getElementById(emptyId);
  canvas.style.display = hasData ? 'block' : 'none';
  empty.style.display  = hasData ? 'none'  : 'block';
  return hasData;
}

function tooltipINR(ctx) {
  return ' ₹' + ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}
function tooltipINRx(ctx) {
  return ' ₹' + ctx.parsed.x.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// 1. Category breakdown (horizontal bar) — expenses only
function updateCategoryChart() {
  const exp = getViewEntries().filter(e => e.type !== 'income');
  if (!showChart('category-chart', 'cat-empty', exp.length > 0)) {
    if (charts.category) { charts.category.destroy(); charts.category = null; }
    return;
  }
  const totals = {};
  exp.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const sorted  = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const labels  = sorted.map(([c]) => c);
  const data    = sorted.map(([, v]) => Math.round(v * 100) / 100);
  const colors  = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  if (charts.category) {
    Object.assign(charts.category.data, { labels, datasets: [{ ...charts.category.data.datasets[0], data, backgroundColor: colors }] });
    charts.category.update(); return;
  }
  charts.category = new Chart(document.getElementById('category-chart'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 5, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 60 } },
      plugins: {
        legend: { display: false },
        datalabels: { ...DL_END, clip: false },
        tooltip: { callbacks: { label: tooltipINRx } },
      },
      scales: {
        x: { grid: { color: 'rgba(91,141,239,.08)' }, ticks: { color: 'rgba(228,232,245,.38)', callback: v => fmtShort(v) }, border: { color: 'transparent' } },
        y: { grid: { display: false }, ticks: { color: 'rgba(228,232,245,.85)', font: { size: 12 } }, border: { color: 'transparent' } },
      },
    },
  });
}

// 2. Cash vs Credit Card donut — expenses only
function updatePaymentChart() {
  const exp = getViewEntries().filter(e => e.type !== 'income');
  const cash   = exp.filter(e => e.payment !== 'credit').reduce((s, e) => s + e.amount, 0);
  const credit = exp.filter(e => e.payment === 'credit').reduce((s, e) => s + e.amount, 0);
  const hasData = cash + credit > 0;

  if (!showChart('payment-chart', 'pay-empty', hasData)) {
    if (charts.payment) { charts.payment.destroy(); charts.payment = null; }
    return;
  }
  const data   = [Math.round(cash * 100) / 100, Math.round(credit * 100) / 100];
  const labels = ['Cash / UPI', 'Credit Card'];
  const colors = ['#34D399', '#5B8DEF'];

  if (charts.payment) {
    charts.payment.data.datasets[0].data = data;
    charts.payment.update(); return;
  }
  charts.payment = new Chart(document.getElementById('payment-chart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: 'rgba(228,232,245,.85)', padding: 16, font: { size: 13 } } },
        datalabels: {
          display: true,
          color: '#fff',
          font: { family: 'Inter, sans-serif', size: 13, weight: '700' },
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return total > 0 ? Math.round((v / total) * 100) + '%' : '';
          },
        },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` } },
      },
    },
  });
}

// 3. Daily spending — last 30 days
function updateDailyChart() {
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
  const expByDay = {};
  getViewEntries().filter(e => e.type !== 'income').forEach(e => { expByDay[e.date] = (expByDay[e.date] || 0) + e.amount; });
  const data = days.map(d => Math.round((expByDay[d] || 0) * 100) / 100);
  const hasData = data.some(v => v > 0);

  if (!showChart('daily-chart', 'daily-empty', hasData)) {
    if (charts.daily) { charts.daily.destroy(); charts.daily = null; }
    return;
  }
  const labels = days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });

  if (charts.daily) {
    charts.daily.data.labels = labels;
    charts.daily.data.datasets[0].data = data;
    charts.daily.update(); return;
  }
  charts.daily = new Chart(document.getElementById('daily-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#5B8DEF',
        backgroundColor: 'rgba(91,141,239,.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#5B8DEF',
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { callbacks: { label: tooltipINR } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(228,232,245,.38)', maxTicksLimit: 10 }, border: { color: 'transparent' } },
        y: { grid: { color: 'rgba(91,141,239,.08)' }, ticks: { color: 'rgba(228,232,245,.38)', callback: v => fmtShort(v) }, border: { color: 'transparent' } },
      },
    },
  });
}

// 4. Weekly spending — last 8 weeks
function updateWeeklyChart() {
  // Build last 8 ISO Mon–Sun weeks
  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0
  const thisMonday = new Date(today); thisMonday.setDate(today.getDate() - dayOfWeek);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const mon = new Date(thisMonday); mon.setDate(thisMonday.getDate() - (7 * (7 - i)));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { mon, sun, key: mon.toISOString().split('T')[0] };
  });

  const byWeek = {};
  getViewEntries().filter(e => e.type !== 'income').forEach(e => {
    const d = new Date(e.date + 'T00:00:00');
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    const key = mon.toISOString().split('T')[0];
    byWeek[key] = (byWeek[key] || 0) + e.amount;
  });

  const data   = weeks.map(w => Math.round((byWeek[w.key] || 0) * 100) / 100);
  const labels = weeks.map(w => {
    const fmt2 = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${fmt2(w.mon)}`;
  });
  const hasData = data.some(v => v > 0);

  if (!showChart('weekly-chart', 'weekly-empty', hasData)) {
    if (charts.weekly) { charts.weekly.destroy(); charts.weekly = null; }
    return;
  }

  const colors = data.map(v => v === Math.max(...data) && v > 0 ? '#FB7185' : '#5B8DEF');

  if (charts.weekly) {
    charts.weekly.data.labels = labels;
    charts.weekly.data.datasets[0].data = data;
    charts.weekly.data.datasets[0].backgroundColor = colors;
    charts.weekly.update(); return;
  }
  charts.weekly = new Chart(document.getElementById('weekly-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: colors, borderRadius: 6, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: DL_TOP,
        tooltip: { callbacks: { label: tooltipINR } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(228,232,245,.38)' }, border: { color: 'transparent' } },
        y: { grid: { color: 'rgba(91,141,239,.08)' }, ticks: { color: 'rgba(228,232,245,.38)', callback: v => fmtShort(v) }, border: { color: 'transparent' } },
      },
    },
  });
}

// ── Full render ───────────────────────────────────────────────────────────────
function render() {
  updateSummary();
  updateCategoryFilter();
  renderList();
  updateInsights();
  updateTimelineChart();
  updateCategoryChart();
  updatePaymentChart();
  updateDailyChart();
  updateWeeklyChart();
}

// ── Type toggle (Expense / Income) ───────────────────────────────────────────
typeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    typeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    typeInput.value = btn.dataset.type;
    categorySelect.value = '';
    populateCategorySelect(btn.dataset.type);
    const isIncome = btn.dataset.type === 'income';
    btnAdd.textContent = isIncome ? 'Add Income' : 'Add Expense';
  });
});

// ── Payment toggle ────────────────────────────────────────────────────────────
payBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    payBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    paymentInput.value = btn.dataset.pay;
  });
});

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat(amountInput.value);
  if (!amount || amount <= 0) { amountInput.focus(); return; }

  const entryData = {
    type:        typeInput.value,
    description: descInput.value.trim() || categorySelect.value,
    category:    categorySelect.value,
    amount:      Math.round(amount * 100) / 100,
    date:        dateInput.value,
    payment:     paymentInput.value,
  };

  if (editingId) {
    const idx = entries.findIndex(en => en.id === editingId);
    if (idx !== -1) entries[idx] = { ...entries[idx], ...entryData };
    cancelEditMode();
  } else {
    const newEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      ...entryData,
    };
    entries.push(newEntry);

    // Save as recurring if toggled
    const recurCheck = document.getElementById('recurring-check');
    if (recurCheck && recurCheck.checked) {
      const dayInput = document.getElementById('recurring-day');
      const day = parseInt(dayInput ? dayInput.value : 1) || 1;
      recurrings.push({
        id:          newEntry.id + '_r',
        type:        entryData.type,
        description: entryData.description,
        category:    entryData.category,
        amount:      entryData.amount,
        payment:     entryData.payment,
        dayOfMonth:  Math.min(Math.max(day, 1), 28),
      });
      saveRecurrings(recurrings);
      recurCheck.checked = false;
      document.getElementById('recurring-day-wrap').style.display = 'none';
      showToast('Saved as recurring — will auto-log every month.');
    }

    descInput.value      = '';
    categorySelect.value = '';
    amountInput.value    = '';
    descInput.focus();
  }
  saveEntries(entries);
  render();
});

// ── Edit / Delete (event delegation) ─────────────────────────────────────────
transactionList.addEventListener('click', e => {
  const editBtn = e.target.closest('.tx-edit');
  if (editBtn) { enterEditMode(editBtn.dataset.id); return; }
  const delBtn = e.target.closest('.tx-delete');
  if (!delBtn) return;
  entries = entries.filter(en => en.id !== delBtn.dataset.id);
  saveEntries(entries);
  render();
});

document.getElementById('cancel-edit').addEventListener('click', cancelEditMode);

// ── Filters + Search ──────────────────────────────────────────────────────────
filterCategory.addEventListener('change', renderList);
filterPayment.addEventListener('change', renderList);
document.getElementById('search-transactions').addEventListener('input', renderList);

// ── Clear all ─────────────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', () => {
  if (!entries.length || !confirm('Delete all entries? This cannot be undone.')) return;
  entries = []; saveEntries(entries); render();
});

// ── Bulk Import ───────────────────────────────────────────────────────────────
function getKnownCategories() {
  return [...categories.expense, ...categories.income].map(c => c.value);
}

const importOverlay  = document.getElementById('import-overlay');
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const importPreview  = document.getElementById('import-preview');
const previewMeta    = document.getElementById('preview-meta');
const previewBody    = document.getElementById('preview-body');
const importErrors   = document.getElementById('import-errors');
const confirmImport  = document.getElementById('confirm-import');

let pendingRows = []; // valid parsed rows ready to import

// Open / close
document.getElementById('open-import').addEventListener('click', () => {
  importOverlay.classList.add('active');
  resetImportModal();
});
document.getElementById('close-import').addEventListener('click', closeImport);
document.getElementById('cancel-import').addEventListener('click', closeImport);
importOverlay.addEventListener('click', e => { if (e.target === importOverlay) closeImport(); });

function closeImport() {
  importOverlay.classList.remove('active');
  resetImportModal();
}

function resetImportModal() {
  fileInput.value = '';
  importPreview.style.display = 'none';
  importErrors.textContent = '';
  previewBody.innerHTML = '';
  confirmImport.disabled = true;
  pendingRows = [];
  dropZone.classList.remove('drop-zone--active');
}

// Drag & drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone--active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--active'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drop-zone--active');
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) parseFile(fileInput.files[0]); });

// Template download
document.getElementById('download-template').addEventListener('click', () => {
  const rows = [
    ['Date', 'Category', 'Note', 'Amount', 'Paid Via'],
    ['26/03/2026', 'Coffee', 'Morning coffee', 150, 'Cash/UPI'],
    ['26/03/2026', 'Metro', '', 35, 'Cash/UPI'],
    ['25/03/2026', 'Online Shopping', 'Amazon order', 899, 'Credit Card'],
    ['24/03/2026', 'Food - Office', 'Lunch', 220, 'Cash/UPI'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [12, 22, 20, 10, 14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, 'BrokeTracker_Template.xlsx');
});

// ── Parse file (CSV or XLSX) ──────────────────────────────────────────────────
function parseFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      processRows(raw);
    } catch (err) {
      showImportError('Could not read file: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

// ── Process raw rows ──────────────────────────────────────────────────────────
function processRows(raw) {
  if (raw.length < 2) { showImportError('File appears empty.'); return; }

  // Find header row (first row containing "date" or "amount" case-insensitive)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const joined = raw[i].join('|').toLowerCase();
    if (joined.includes('date') || joined.includes('amount')) { headerIdx = i; break; }
  }

  const headers = raw[headerIdx].map(h => String(h).trim().toLowerCase());
  const col = name => headers.findIndex(h => h.includes(name));

  const iDate   = col('date');
  const iCat    = col('cat');
  const iNote   = Math.max(col('note'), col('desc'));
  const iAmt    = col('amount') >= 0 ? col('amount') : col('amt');
  const iPay    = Math.max(col('paid'), col('pay'), col('method'));

  if (iDate < 0 || iAmt < 0) {
    showImportError('Could not find required columns (Date, Amount). Check your file matches the template.');
    return;
  }

  const valid = [], errors = [];

  raw.slice(headerIdx + 1).forEach((row, i) => {
    if (row.every(c => String(c).trim() === '')) return; // skip blank rows

    const rawDate = String(row[iDate] || '').trim();
    const rawAmt  = String(row[iAmt]  || '').trim();
    const rawCat  = iCat  >= 0 ? String(row[iCat]  || '').trim() : '';
    const rawNote = iNote >= 0 ? String(row[iNote] || '').trim() : '';
    const rawPay  = iPay  >= 0 ? String(row[iPay]  || '').trim() : '';

    const date = parseDate(rawDate);
    const amount = parseFloat(rawAmt.replace(/[₹,\s]/g, ''));

    if (!date) { errors.push(`Row ${i + 2}: invalid date "${rawDate}"`); return; }
    if (!amount || amount <= 0) { errors.push(`Row ${i + 2}: invalid amount "${rawAmt}"`); return; }

    const category = matchCategory(rawCat);
    const payment  = matchPayment(rawPay);

    valid.push({
      id:          crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + i,
      type:        'expense',
      date,
      category,
      description: rawNote || category,
      amount:      Math.round(amount * 100) / 100,
      payment,
    });
  });

  pendingRows = valid;
  renderPreview(valid, errors);
}

function parseDate(raw) {
  if (!raw) return null;
  // Excel serial number
  if (/^\d{4,5}$/.test(raw)) {
    const d = XLSX.SSF.parse_date_code(Number(raw));
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
  // Try native parse
  const dt = new Date(raw);
  if (!isNaN(dt)) return dt.toISOString().split('T')[0];
  return null;
}

function matchCategory(raw) {
  if (!raw) return 'Misc';
  const lower = raw.toLowerCase();
  return getKnownCategories().find(c => c.toLowerCase() === lower) || raw || 'Misc';
}

function matchPayment(raw) {
  const lower = (raw || '').toLowerCase();
  if (['credit', 'cc', 'credit card', 'card', 'creditcard'].some(k => lower.includes(k))) return 'credit';
  return 'cash';
}

// ── Render preview table ──────────────────────────────────────────────────────
function renderPreview(valid, errors) {
  importPreview.style.display = 'block';
  previewBody.innerHTML = '';

  valid.forEach(r => {
    const tr = document.createElement('tr');
    const displayDate = new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    tr.innerHTML = `
      <td>${displayDate}</td>
      <td>${escHtml(r.category)}</td>
      <td class="muted">${escHtml(r.description !== r.category ? r.description : '')}</td>
      <td class="amt">₹${r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td><span class="tx-pay ${r.payment}">${r.payment === 'credit' ? 'CC' : 'UPI'}</span></td>
      <td><button class="preview-remove" data-id="${r.id}">✕</button></td>
    `;
    previewBody.appendChild(tr);
  });

  previewMeta.textContent = `${valid.length} row${valid.length !== 1 ? 's' : ''} ready to import${errors.length ? ` · ${errors.length} skipped` : ''}`;
  importErrors.textContent = errors.join('\n');
  confirmImport.disabled = valid.length === 0;
}

// Remove individual preview rows
document.getElementById('preview-body').addEventListener('click', e => {
  const btn = e.target.closest('.preview-remove');
  if (!btn) return;
  pendingRows = pendingRows.filter(r => r.id !== btn.dataset.id);
  btn.closest('tr').remove();
  previewMeta.textContent = `${pendingRows.length} row${pendingRows.length !== 1 ? 's' : ''} ready to import`;
  confirmImport.disabled = pendingRows.length === 0;
});

// Confirm import
confirmImport.addEventListener('click', () => {
  entries.push(...pendingRows);
  saveEntries(entries);
  render();
  closeImport();
});

function showImportError(msg) {
  importPreview.style.display = 'block';
  previewBody.innerHTML = '';
  previewMeta.textContent = '0 rows ready';
  importErrors.textContent = msg;
  confirmImport.disabled = true;
}

// ── Month navigation ──────────────────────────────────────────────────────────
function syncMonthLabel() {
  document.getElementById('month-label').textContent = monthLabel();
  // disable next if we're already on current month
  const now = new Date();
  document.getElementById('next-month').disabled =
    activeYear === now.getFullYear() && activeMonth === now.getMonth();
}

document.getElementById('prev-month').addEventListener('click', () => {
  activeMonth--;
  if (activeMonth < 0) { activeMonth = 11; activeYear--; }
  // destroy charts so they re-render cleanly for new month
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};
  syncMonthLabel();
  render();
});

document.getElementById('next-month').addEventListener('click', () => {
  const now = new Date();
  if (activeYear === now.getFullYear() && activeMonth === now.getMonth()) return;
  activeMonth++;
  if (activeMonth > 11) { activeMonth = 0; activeYear++; }
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};
  syncMonthLabel();
  render();
});

// ── Budget Modal ──────────────────────────────────────────────────────────────
const budgetOverlay = document.getElementById('budget-overlay');
const budgetList    = document.getElementById('budget-list');

function openBudgetModal() {
  budgetOverlay.classList.add('active');
  budgetList.innerHTML = '';
  categories.expense.forEach(cat => {
    const icon = getIcon(cat.value);
    const current = budgets[cat.value] || '';
    const item = document.createElement('div');
    item.className = 'budget-item';
    item.innerHTML = `
      <div class="budget-item-icon">${icon}</div>
      <div class="budget-item-label">${cat.value}</div>
      <input type="number" min="0" step="100" placeholder="No limit"
        value="${current}" data-cat="${cat.value}" />
    `;
    budgetList.appendChild(item);
  });
}

document.getElementById('open-budget').addEventListener('click', openBudgetModal);
document.getElementById('close-budget').addEventListener('click', () => budgetOverlay.classList.remove('active'));
document.getElementById('cancel-budget').addEventListener('click', () => budgetOverlay.classList.remove('active'));
budgetOverlay.addEventListener('click', e => { if (e.target === budgetOverlay) budgetOverlay.classList.remove('active'); });

document.getElementById('save-budgets').addEventListener('click', () => {
  budgetList.querySelectorAll('input[data-cat]').forEach(inp => {
    const val = parseFloat(inp.value);
    if (val > 0) budgets[inp.dataset.cat] = val;
    else delete budgets[inp.dataset.cat];
  });
  saveBudgets(budgets);
  budgetOverlay.classList.remove('active');
  render();
});

// ── PIN Lock ──────────────────────────────────────────────────────────────────
function startPinFlow() {
  const SESSION_KEY = 'spendmind_session_pin';
  const pinScreen   = document.getElementById('pin-screen');
  const pinBox      = document.querySelector('.pin-box');
  const pinLabel    = document.getElementById('pin-label');
  const pinDots     = document.querySelectorAll('#pin-dots span');
  const pinError    = document.getElementById('pin-error');

  let input         = '';
  let confirmBuffer = '';
  let isConfirming  = false;

  // If already unlocked this session, boot straight in
  const sessionPin = sessionStorage.getItem(SESSION_KEY);
  if (sessionPin) {
    activatePin(sessionPin);
    pinScreen.classList.add('hidden');
    init();
    if (sbUser) loadFromSupabase(); // always sync from Supabase on load
    return;
  }

  pinLabel.textContent = 'Enter your PIN';

  function migrateOldData(pin) {
    const oldEntries = localStorage.getItem('broketracker_entries');
    const oldBudgets = localStorage.getItem('spendmind_budgets');
    const newEKey    = `broketracker_entries_${pin}`;
    const newBKey    = `spendmind_budgets_${pin}`;
    if (oldEntries && !localStorage.getItem(newEKey)) localStorage.setItem(newEKey, oldEntries);
    if (oldBudgets && !localStorage.getItem(newBKey)) localStorage.setItem(newBKey, oldBudgets);
  }

  function migrateCategories(pin) {
    const catKey = `spendmind_categories_${pin}`;
    if (localStorage.getItem(catKey)) return; // already set, don't overwrite

    // Check if this account has existing entries — if so, build category list from them
    const entriesKey = `broketracker_entries_${pin}`;
    const existingEntries = JSON.parse(localStorage.getItem(entriesKey) || '[]');
    if (existingEntries.length > 0) {
      // Build category list from actual entry data so nothing is lost
      const expenseCatValues = [...new Set(
        existingEntries.filter(e => e.type !== 'income').map(e => e.category).filter(Boolean)
      )];
      const incomeCatValues = [...new Set(
        existingEntries.filter(e => e.type === 'income').map(e => e.category).filter(Boolean)
      )];
      const knownIcons = {
        'Food - Office':'🍱','Food - Me':'🍜','Food - PG':'🍽️','Food - Friends':'🫂',
        'Groceries':'🛒','Coffee':'☕','Drinks / Bars':'🍻','Metro':'🚇','Auto':'🚗',
        'Online Shopping':'📦','Subscriptions':'📱','Entertainment':'🎬','Travel':'✈️',
        'Gifts':'🎁','Skincare / Medicals':'💊','Investments':'📈','Mom':'🫶','Misc':'💸',
        'Salary':'💼','Freelance':'🖥️','Gift Received':'🎀','Reimbursement':'🔄','Other Income':'💰',
      };
      const tocat = (v, fallback) => ({ value: v, label: `${knownIcons[v] || fallback} ${v}` });
      localStorage.setItem(catKey, JSON.stringify({
        expense: expenseCatValues.map(v => tocat(v, '💸')),
        income:  incomeCatValues.map(v => tocat(v, '💰')),
      }));
    } else {
      // Brand new account — use generic defaults
      localStorage.setItem(catKey, JSON.stringify({
        expense: DEFAULT_EXPENSE_CATS.map(c => ({...c})),
        income:  DEFAULT_INCOME_CATS.map(c => ({...c})),
      }));
    }
  }

  function unlock(pin) {
    migrateOldData(pin);
    migrateCategories(pin);
    sessionStorage.setItem(SESSION_KEY, pin);
    activatePin(pin);
    pinScreen.classList.add('hidden');
    init();
    // If connected to Supabase, load fresh data from cloud
    if (sbUser) loadFromSupabase();
  }

  function updateDots() {
    pinDots.forEach((d, i) => d.classList.toggle('filled', i < input.length));
  }

  function shake() {
    pinBox.classList.remove('shake');
    void pinBox.offsetWidth;
    pinBox.classList.add('shake');
  }

  function reset(label) {
    input = '';
    updateDots();
    pinError.textContent = '';
    if (label) pinLabel.textContent = label;
  }

  function handleDigit(digit) {
    if (input.length >= 4) return;
    input += digit;
    updateDots();
    if (input.length < 4) return;

    const registeredPins = getRegisteredPins();

    if (isConfirming) {
      // Confirming a brand-new PIN
      if (input === confirmBuffer) {
        registerPin(input);
        unlock(input);
      } else {
        shake();
        confirmBuffer = '';
        isConfirming = false;
        pinError.textContent = "PINs didn't match — let's try again";
        reset('Create a PIN (4 digits)');
      }
      return;
    }

    if (registeredPins.includes(input)) {
      // Existing account — log in
      unlock(input);
    } else if (registeredPins.length === 0) {
      // No accounts yet — start setup
      confirmBuffer = input;
      isConfirming  = true;
      reset('Confirm your PIN');
    } else {
      // Accounts exist but this PIN is new — offer to create
      confirmBuffer = input;
      isConfirming  = true;
      pinError.textContent = 'New PIN — confirm to create your account';
      reset('Confirm your PIN');
    }
  }

  document.querySelectorAll('.pin-key[data-v]').forEach(btn => {
    btn.addEventListener('click', () => handleDigit(btn.dataset.v));
  });

  document.getElementById('pin-clear').addEventListener('click', () => {
    if (isConfirming) { isConfirming = false; confirmBuffer = ''; reset('Enter your PIN'); return; }
    input = input.slice(0, -1);
    updateDots();
    pinError.textContent = '';
  });

  document.addEventListener('keydown', e => {
    if (pinScreen.classList.contains('hidden')) return;
    if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
    if (e.key === 'Backspace') {
      if (isConfirming) { isConfirming = false; confirmBuffer = ''; reset('Enter your PIN'); return; }
      input = input.slice(0, -1);
      updateDots();
      pinError.textContent = '';
    }
  });
} // end startPinFlow

// ── Interactive beam + cursor glow ───────────────────────────────────────────
(function () {
  const beam       = document.getElementById('orb-beam');
  const beamSpread = document.getElementById('orb-beam-spread');
  const glow       = document.getElementById('cursor-glow');

  let glowTargetX   = -9999;
  let glowTargetY   = -9999;
  let glowCurrentX  = glowTargetX;
  let glowCurrentY  = glowTargetY;
  let entered       = false;

  // Beam stays at fixed X, only moves vertically
  let beamTargetY   = 0;
  let beamCurrentY  = 0;

  document.addEventListener('mousemove', e => {
    beamTargetY  = e.clientY;
    glowTargetX  = e.clientX;
    glowTargetY  = e.clientY;
    if (!entered) {
      entered = true;
      glow.style.opacity = '1';
    }
  });

  document.addEventListener('mouseleave', () => {
    entered = false;
    glow.style.opacity = '0';
  });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    // Beam drifts up/down only, stays at 9% left
    beamCurrentY = lerp(beamCurrentY, beamTargetY, 0.045);
    if (beam)       beam.style.top       = (beamCurrentY - window.innerHeight * 0.15) + 'px';
    if (beamSpread) beamSpread.style.top = (beamCurrentY - 350) + 'px';

    // Cursor glow follows mouse freely
    glowCurrentX = lerp(glowCurrentX, glowTargetX, 0.1);
    glowCurrentY = lerp(glowCurrentY, glowTargetY, 0.1);
    if (glow) {
      glow.style.left = glowCurrentX + 'px';
      glow.style.top  = glowCurrentY + 'px';
    }

    requestAnimationFrame(tick);
  }

  tick();
})();

// ── Categories Modal ──────────────────────────────────────────────────────────
(function () {
  const overlay   = document.getElementById('categories-overlay');
  const catList   = document.getElementById('cat-list');
  const nameInput = document.getElementById('cat-name-input');
  const emojiInput= document.getElementById('cat-emoji-input');
  const addBtn    = document.getElementById('cat-add-btn');
  const tabs      = document.querySelectorAll('.cat-tab');

  let activeType = 'expense';

  function renderCatList() {
    catList.innerHTML = '';
    const list = categories[activeType] || [];
    if (list.length === 0) {
      catList.innerHTML = '<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:12px;">No categories yet. Add one below!</p>';
      return;
    }
    list.forEach((cat, idx) => {
      const emoji = cat.label.split(' ')[0];
      const item  = document.createElement('div');
      item.className = 'cat-item';
      item.innerHTML = `
        <span class="cat-item-emoji">${emoji}</span>
        <span class="cat-item-name" data-idx="${idx}">${cat.value}</span>
        <button class="cat-rename" data-idx="${idx}" title="Rename">✎</button>
        <button class="cat-delete" data-idx="${idx}" title="Delete">✕</button>`;
      catList.appendChild(item);
    });

    catList.querySelectorAll('.cat-rename').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx  = parseInt(btn.dataset.idx);
        const cat  = categories[activeType][idx];
        const nameEl = btn.closest('.cat-item').querySelector('.cat-item-name');
        const oldName = cat.value;
        const emoji   = cat.label.split(' ')[0];

        // Replace name span with input
        const input = document.createElement('input');
        input.type  = 'text';
        input.value = oldName;
        input.className = 'cat-rename-input';
        nameEl.replaceWith(input);
        btn.style.display = 'none';
        input.focus();
        input.select();

        function commitRename() {
          const newName = input.value.trim();
          if (newName && newName !== oldName) {
            // Update category
            categories[activeType][idx] = { value: newName, label: `${emoji} ${newName}` };
            // Update any entries using old name
            entries.forEach(entry => { if (entry.category === oldName) entry.category = newName; });
            // Update budgets
            if (budgets[oldName] !== undefined) { budgets[newName] = budgets[oldName]; delete budgets[oldName]; saveBudgets(budgets); }
            saveCategories(categories);
            saveEntries(entries);
            populateCategorySelect(document.querySelector('.type-btn.active')?.dataset.type || 'expense');
          }
          renderCatList();
        }
        input.addEventListener('blur',    commitRename);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = oldName; input.blur(); } });
      });
    });

    catList.querySelectorAll('.cat-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const cat = categories[activeType][idx];
        const inUse = entries.some(e => e.category === cat.value);
        if (inUse && !confirm(`"${cat.value}" is used in existing entries. Delete anyway?`)) return;
        // Clean up any budget set for this category
        delete budgets[cat.value];
        saveBudgets(budgets);
        categories[activeType].splice(idx, 1);
        saveCategories(categories);
        renderCatList();
        populateCategorySelect(document.querySelector('.type-btn.active')?.dataset.type || 'expense');
      });
    });

    catList.querySelectorAll('.cat-item').forEach((item, idx) => {
      item.addEventListener('click', e => {
        if (e.target.closest('.cat-delete')) return;
        const cat = categories[activeType][idx];
        nameInput.value = cat.value;
        emojiCycleIndex = 0;
        const suggestions = getAllSuggestions(cat.value);
        emojiInput.value = cat.label.split(' ')[0] || suggestions[0] || '😀';
        nameInput.focus();
        // Highlight the selected pill
        catList.querySelectorAll('.cat-item').forEach(i => i.classList.remove('cat-item--selected'));
        item.classList.add('cat-item--selected');
      });
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeType = tab.dataset.type;
      renderCatList();
    });
  });

  addBtn.addEventListener('click', () => {
    const name  = nameInput.value.trim();
    const emoji = emojiInput.value.trim() || '💸';
    emojiCycleIndex = 0;
    if (!name) { nameInput.focus(); return; }
    const duplicate = categories[activeType].some(c => c.value.toLowerCase() === name.toLowerCase());
    if (duplicate) { nameInput.style.borderColor = 'var(--rose)'; setTimeout(() => nameInput.style.borderColor = '', 1500); return; }
    categories[activeType].push({ value: name, label: `${emoji} ${name}` });
    saveCategories(categories);
    nameInput.value  = '';
    emojiInput.value = '';
    renderCatList();
    populateCategorySelect(document.querySelector('.type-btn.active')?.dataset.type || 'expense');
  });

  // Emoji auto-suggest as user types
  let emojiCycleIndex = 0;

  const EMOJI_MAP = [
    // Specific food variants first — order matters!
    { keys: ['food - pg','food pg'], emoji: '🍽️' },
    { keys: ['food - me','food me'], emoji: '🍜' },
    { keys: ['food - office','food office','office food','office lunch'], emoji: '🍱' },
    { keys: ['food - friends','food friends','friends food'], emoji: '🫂' },
    { keys: ['food'], emoji: '🥘' },  // generic food fallback
    { keys: ['eat','meal','lunch','dinner','breakfast','snack','restaurant'], emoji: '🍴' },
    { keys: ['mom','mum','mother'], emoji: '🫶' },
    { keys: ['family','parents','dad','papa'], emoji: '👨‍👩‍👧' },
    { keys: ['grocery','groceries','supermarket','vegetables','fruits'], emoji: '🛒' },
    { keys: ['coffee','cafe','starbucks','tea'], emoji: '☕' },
    { keys: ['drink','bar','alcohol','beer','wine','pub','nightout','night out'], emoji: '🍻' },
    { keys: ['metro','subway','train','transit','public transport'], emoji: '🚇' },
    { keys: ['auto','cab','taxi','uber','ola','rickshaw'], emoji: '🚗' },
    { keys: ['transport','commute','travel local','bus'], emoji: '🚌' },
    { keys: ['shopping','online','amazon','flipkart','myntra','order'], emoji: '📦' },
    { keys: ['subscription','netflix','spotify','prime','streaming','app'], emoji: '📱' },
    { keys: ['entertainment','movie','film','concert','event','outing'], emoji: '🎬' },
    { keys: ['travel','trip','flight','hotel','vacation','holiday'], emoji: '✈️' },
    { keys: ['gift','present','birthday'], emoji: '🎁' },
    { keys: ['skincare','medical','medicine','doctor','pharmacy','health','gym','fitness','wellness'], emoji: '💊' },
    { keys: ['investment','mutual fund','stocks','sip','trading','saving'], emoji: '📈' },
    { keys: ['rent','housing','house','home','pg rent','accommodation'], emoji: '🏠' },
    { keys: ['electricity','water','gas','utility','bill','internet','wifi'], emoji: '💡' },
    { keys: ['salary','income','pay','wage'], emoji: '💼' },
    { keys: ['freelance','consulting','project'], emoji: '🖥️' },
    { keys: ['reimbursement','refund','claim'], emoji: '🔄' },
    { keys: ['misc','other','miscellaneous','general'], emoji: '💸' },
    { keys: ['petrol','fuel','parking'], emoji: '⛽' },
    { keys: ['books','course','education','learning','school','college'], emoji: '📚' },
    { keys: ['phone','mobile','recharge'], emoji: '📞' },
    { keys: ['clothes','clothing','fashion','shoes','accessories'], emoji: '👗' },
    { keys: ['haircut','salon','spa','grooming'], emoji: '💇' },
    { keys: ['dog','pet','vet'], emoji: '🐾' },
    { keys: ['charity','donation'], emoji: '🤝' },
  ];

  function getAllSuggestions(name) {
    const lower = name.toLowerCase().trim();
    if (!lower) return [];
    const results = [];
    for (const { keys, emoji } of EMOJI_MAP) {
      if (keys.some(k => lower.includes(k) || k.includes(lower))) {
        if (!results.includes(emoji)) results.push(emoji);
      }
    }
    // Always have a few fallbacks
    ['✨','🔖','📌','💡','🎯'].forEach(e => { if (!results.includes(e)) results.push(e); });
    return results;
  }

  nameInput.addEventListener('input', () => {
    emojiCycleIndex = 0;
    const suggestions = getAllSuggestions(nameInput.value);
    emojiInput.value = suggestions[0] || '😀';
  });

  document.getElementById('cat-emoji-refresh').addEventListener('click', () => {
    const suggestions = getAllSuggestions(nameInput.value);
    emojiCycleIndex = (emojiCycleIndex + 1) % suggestions.length;
    emojiInput.value = suggestions[emojiCycleIndex];
  });

  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

  document.getElementById('open-categories').addEventListener('click', () => {
    activeType = 'expense';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.type === 'expense'));
    nameInput.value  = '';
    emojiInput.value = '';
    emojiCycleIndex  = 0;
    renderCatList();
    overlay.classList.add('active');
  });

  document.getElementById('close-categories').addEventListener('click',  () => overlay.classList.remove('active'));
  document.getElementById('cancel-categories').addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
})();

// ── Recurring modal ───────────────────────────────────────────────────────────
(function () {
  const overlay = document.getElementById('recurring-overlay');
  const list    = document.getElementById('recurring-list');

  function renderRecurringList() {
    list.innerHTML = '';
    if (!recurrings.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:16px 0;">No recurring expenses yet.<br/>Add one from the form — tick "Repeat every month".</p>';
      return;
    }
    recurrings.forEach((r, idx) => {
      const icon = getIcon(r.category);
      const row  = document.createElement('div');
      row.className = 'recurring-item';
      row.innerHTML = `
        <div class="recurring-icon">${icon}</div>
        <div class="recurring-info">
          <div class="recurring-name">${escHtml(r.description)}</div>
          <div class="recurring-meta">${escHtml(r.category)} · Day ${r.dayOfMonth} each month · ${fmt(r.amount)}</div>
        </div>
        <button class="recurring-delete" data-idx="${idx}" title="Remove">✕</button>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.recurring-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        recurrings.splice(idx, 1);
        saveRecurrings(recurrings);
        renderRecurringList();
      });
    });
  }

  document.getElementById('open-recurring').addEventListener('click', () => {
    renderRecurringList();
    overlay.classList.add('active');
  });

  document.getElementById('close-recurring').addEventListener('click',  () => overlay.classList.remove('active'));
  document.getElementById('cancel-recurring').addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
})();

// ── Voice Log ─────────────────────────────────────────────────────────────────
(function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn          = document.getElementById('btn-voice');
  const typeWrap     = document.getElementById('voice-type-wrap');
  const textInput    = document.getElementById('voice-text-input');
  const textParseBtn = document.getElementById('voice-text-parse');
  const resultBox    = document.getElementById('voice-result');
  const heardEl      = document.getElementById('voice-heard');
  const parsedEl     = document.getElementById('voice-parsed');
  const confirmBtn   = document.getElementById('voice-confirm');
  const retryBtn     = document.getElementById('voice-retry');
  const dismissBtn   = document.getElementById('voice-dismiss');

  const isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const hasSpeech = !!SpeechRecognition && !isSafari; // Safari mic is unreliable — use text
  const hasMic    = !!SpeechRecognition;               // Safari still has mic as fallback
  let lastParsed  = null;
  let listening   = false;

  // Update button label based on capability
  if (!hasSpeech) {
    btn.textContent = '🎤 Log by Voice';
    btn.title = isSafari
      ? 'Tap 🎤 on your iPhone keyboard to dictate inside the box.'
      : 'Type a quick description — e.g. "Coffee 250 today"';
  }

  // ── Number-word → digit converter ───────────────────────────────────────────
  const _N = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
    ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
    sixteen:16,seventeen:17,eighteen:18,nineteen:19,
    twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
  };
  const _NWORDS = Object.keys(_N).join('|');

  function wordsToDigits(text) {
    // Pass 1: "X thousand/lakh/hundred [Y]"  →  number
    // e.g. "five thousand" → 5000, "twelve hundred fifty" → 1250, "two lakh" → 200000
    text = text.replace(
      new RegExp(`\\b(${_NWORDS})(?:\\s+(${_NWORDS}))?\\s+(thousand|lakh|hundred)(?:\\s+(${_NWORDS})(?:\\s+(${_NWORDS}))?)?\\b`, 'gi'),
      (_, a, b, mult, c, d) => {
        let base = (_N[a.toLowerCase()]||0) + (_N[(b||'').toLowerCase()]||0);
        const m  = mult.toLowerCase();
        let val  = base * (m==='thousand'?1000 : m==='lakh'?100000 : 100);
        val += (_N[(c||'').toLowerCase()]||0) + (_N[(d||'').toLowerCase()]||0);
        return String(val);
      }
    );
    // Pass 2: standalone "tens [ones]"  →  number  ("fifty three" → 53, "twenty" → 20)
    text = text.replace(
      new RegExp(`\\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\\s+(one|two|three|four|five|six|seven|eight|nine))?\\b`, 'gi'),
      (_, tens, ones) => String((_N[tens.toLowerCase()]||0) + (_N[(ones||'').toLowerCase()]||0))
    );
    // Pass 3: remaining single words ("five" → 5, "fifteen" → 15)
    text = text.replace(new RegExp(`\\b(${_NWORDS})\\b`, 'gi'), w => String(_N[w.toLowerCase()]||w));
    return text;
  }

  // ── Parser ──────────────────────────────────────────────────────────────────
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const DAYS   = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  function localDateStr(d) {
    // Use local time components — avoids UTC offset shifting the date (e.g. IST = UTC+5:30)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function resolveDate(day, monIdx, todayD) {
    const candidate = new Date(todayD.getFullYear(), monIdx, day);
    if (candidate > todayD) candidate.setFullYear(todayD.getFullYear() - 1);
    return localDateStr(candidate);
  }

  function parseTranscript(raw) {
    // Convert spoken numbers to digits first ("five thousand" → "5000")
    let text = wordsToDigits(raw.toLowerCase().trim());
    const todayD = new Date(); todayD.setHours(0,0,0,0);
    const result = {
      raw,
      amount:      null,
      category:    '',
      description: '',
      date:        localDateStr(todayD),
      payment:     'cash',
      type:        'expense',
    };

    // ── 1. DATES FIRST (before amount, so "20" in "20th march" isn't eaten as ₹20) ──
    const monPat = MONTHS.join('|');

    if (/\byesterday\b/.test(text)) {
      const d = new Date(todayD); d.setDate(d.getDate() - 1);
      result.date = localDateStr(d);
      text = text.replace(/\byesterday\b/, ' ');

    } else if (/\btoday\b/.test(text)) {
      text = text.replace(/\btoday\b/, ' ');

    } else if (/(\d+)\s*days?\s*ago/.test(text)) {
      const m = text.match(/(\d+)\s*days?\s*ago/);
      const d = new Date(todayD); d.setDate(d.getDate() - parseInt(m[1]));
      result.date = localDateStr(d);
      text = text.replace(m[0], ' ');

    } else if (/\blast\s*week\b/.test(text)) {
      const d = new Date(todayD); d.setDate(d.getDate() - 7);
      result.date = localDateStr(d);
      text = text.replace(/\blast\s*week\b/, ' ');

    } else {
      // Pattern A: "april 18th" / "april 18" / "on april 18th"
      const mA = text.match(new RegExp(`(?:on\\s+)?(?:the\\s+)?(${monPat})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
      // Pattern B: "18th april" / "20th march" / "18th of april"
      const mB = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)\\s*(?:of\\s+)?(${monPat})\\b`));
      // Pattern C: "on the 15th" / "15th" — ordinal suffix required to avoid eating bare amounts
      const mC = text.match(/(?:on\s+(?:the\s+)?)?(\d{1,2})(?:st|nd|rd|th)\b/);
      // Pattern D: day names "friday", "last tuesday"
      const mD = text.match(new RegExp(`\\b(${DAYS.join('|')})\\b`));

      if (mA) {
        const monIdx = MONTHS.indexOf(mA[1]), day = parseInt(mA[2]);
        if (day >= 1 && day <= 31) { result.date = resolveDate(day, monIdx, todayD); text = text.replace(mA[0], ' '); }
      } else if (mB) {
        const day = parseInt(mB[1]), monIdx = MONTHS.indexOf(mB[2]);
        if (day >= 1 && day <= 31) { result.date = resolveDate(day, monIdx, todayD); text = text.replace(mB[0], ' '); }
      } else if (mC) {
        const day = parseInt(mC[1]);
        if (day >= 1 && day <= 31) {
          result.date = localDateStr(new Date(todayD.getFullYear(), todayD.getMonth(), day));
          text = text.replace(mC[0], ' ');
        }
      } else if (mD) {
        const target = DAYS.indexOf(mD[1]);
        const d = new Date(todayD);
        const diff = (d.getDay() - target + 7) % 7 || 7;
        d.setDate(d.getDate() - diff);
        result.date = localDateStr(d);
        text = text.replace(mD[0], ' ');
      }
    }

    // ── 2. Amount (now safe — date numbers already removed) ──
    const amtM = text.match(/(\d+(?:\.\d{1,2})?)\s*(k\b|thousand\b|lakh\b|l\b)?(?:\s*(?:rupees?|rs\.?|₹))?/);
    if (amtM) {
      let amt = parseFloat(amtM[1]);
      const mul = (amtM[2] || '').replace(/\b/g, '');
      if (mul === 'k' || mul === 'thousand') amt *= 1000;
      else if (mul === 'lakh' || mul === 'l') amt *= 100000;
      result.amount = Math.round(amt * 100) / 100;
      text = text.replace(amtM[0], ' ');
    }

    // ── 3. Payment ──
    if (/credit\s*card|\bcc\b/.test(text)) {
      result.payment = 'credit';
      text = text.replace(/credit\s*card|\bcc\b/g, ' ');
    } else if (/\b(cash|upi|gpay|google\s*pay|phonepe|paytm|neft|imps|bhim)\b/.test(text)) {
      result.payment = 'cash';
      text = text.replace(/\b(cash|upi|gpay|google\s*pay|phonepe|paytm|neft|imps|bhim)\b/g, ' ');
    }

    // ── 4. Type ──
    if (/\b(salary|income|received|got paid|freelance|reimbursement|refund|stipend)\b/.test(text)) {
      result.type = 'income';
    }

    // ── 5. Strip filler ──
    text = text
      .replace(/\b(paid|spent|bought|ordered|had|got|for|on|at|the|a|an|of|and|with|by|from|to|is|was|just|rupees?|rs\.?|₹|expense|expenses|purchase)\b/g, ' ')
      .replace(/\s{2,}/g, ' ').trim();

    // ── Category: match user's own categories first (longest wins) ──
    const allCats = [...(categories.expense || []), ...(categories.income || [])];
    let bestCat = null, bestLen = 0;
    allCats.forEach(cat => {
      const key = cat.value.toLowerCase();
      if (text.includes(key) && key.length > bestLen) { bestCat = cat.value; bestLen = key.length; return; }
      key.split(/[\s\-\/]+/).forEach(word => {
        if (word.length >= 3 && text.includes(word) && word.length > bestLen) {
          bestCat = cat.value; bestLen = word.length;
        }
      });
    });

    // ── Fallback hints for popular apps / keywords ──
    if (!bestCat) {
      const HINTS = [
        { keys: ['zomato','swiggy','dunzo','blinkit','food delivery','restaurant','lunch','dinner','breakfast','snack','chai','chai latte'], cat: 'Food' },
        { keys: ['coffee','starbucks','cafe','cafe coffee day','ccd'], cat: 'Coffee' },
        { keys: ['uber','ola','rapido','auto','cab','taxi','metro','bus','local','train','commute'], cat: 'Transport' },
        { keys: ['amazon','flipkart','myntra','meesho','nykaa','ajio','shopping'], cat: 'Online Shopping' },
        { keys: ['netflix','prime','hotstar','spotify','youtube','zee5','jiocinema'], cat: 'Subscriptions' },
        { keys: ['gym','doctor','pharmacy','medicine','chemist','hospital','clinic','health'], cat: 'Health' },
        { keys: ['petrol','fuel','parking'], cat: 'Transport' },
        { keys: ['grocery','vegetables','fruits','bigbasket','zepto','instamart'], cat: 'Groceries' },
        { keys: ['rent','pg','room'], cat: 'Rent' },
        { keys: ['electricity','wifi','internet','gas','water','bill','utility'], cat: 'Utilities' },
      ];
      for (const h of HINTS) {
        if (h.keys.some(k => text.includes(k) || raw.toLowerCase().includes(k))) {
          const match = allCats.find(c => c.value.toLowerCase().includes(h.cat.toLowerCase()));
          if (match) { bestCat = match.value; break; }
        }
      }
    }

    result.category    = bestCat || '';
    result.description = text.replace(/\s+/g, ' ').trim();
    return result;
  }

  // ── Show parsed result card ──────────────────────────────────────────────────
  function showResult(parsed) {
    lastParsed = parsed;
    heardEl.textContent = `"${parsed.raw}"`;
    const dateLabel = new Date(parsed.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    parsedEl.innerHTML = [
      parsed.category ? `<span class="vp-chip cat">${escHtml(parsed.category)}</span>` : `<span class="vp-chip miss">Category?</span>`,
      parsed.amount   ? `<span class="vp-chip amt">₹${parsed.amount.toLocaleString('en-IN')}</span>` : `<span class="vp-chip miss">Amount?</span>`,
      `<span class="vp-chip date">${dateLabel}</span>`,
      `<span class="vp-chip pay">${parsed.payment === 'credit' ? '💳 Credit' : '💵 Cash/UPI'}</span>`,
    ].join('');
    typeWrap.style.display  = 'none';
    resultBox.style.display = 'block';
  }

  // ── Apply parsed to form ─────────────────────────────────────────────────────
  function applyParsed(parsed) {
    if (!parsed) return;
    typeInput.value = parsed.type;
    typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === parsed.type));
    populateCategorySelect(parsed.type);
    payViaRow.style.display = parsed.type === 'income' ? 'none' : '';
    if (parsed.category) categorySelect.value = parsed.category;
    descInput.value    = parsed.description || parsed.category || '';
    if (parsed.amount)  amountInput.value = parsed.amount;
    dateInput.value    = parsed.date;
    paymentInput.value = parsed.payment;
    payBtns.forEach(b => b.classList.toggle('active', b.dataset.pay === parsed.payment));
    resultBox.style.display = 'none';
    if (!parsed.amount) amountInput.focus();
    else if (!parsed.category) categorySelect.focus();
    else amountInput.focus();
  }

  // ── Text fallback (Safari / all browsers) ───────────────────────────────────
  function showTextInput() {
    typeWrap.style.display  = 'flex';
    resultBox.style.display = 'none';
    textInput.value = '';
    const hint = document.getElementById('voice-safari-hint');
    if (hint) hint.style.display = isSafari ? 'block' : 'none';
    textInput.focus();
  }

  function parseFromText() {
    const val = textInput.value.trim();
    if (!val) return;
    showResult(parseTranscript(val));
  }

  textParseBtn.addEventListener('click', parseFromText);
  textInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); parseFromText(); } });

  // ── Chrome/Edge: real mic ────────────────────────────────────────────────────
  if (hasSpeech) {
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      listening = true;
      btn.classList.add('btn-voice--listening');
      btn.textContent = '🎙 Listening…';
      typeWrap.style.display  = 'none';
      resultBox.style.display = 'none';
    };
    rec.onend = () => {
      listening = false;
      btn.classList.remove('btn-voice--listening');
      btn.textContent = '🎤 Log by Voice';
    };
    rec.onerror = e => {
      listening = false;
      btn.classList.remove('btn-voice--listening');
      btn.textContent = '🎤 Log by Voice';
      if (e.error === 'not-allowed') showToast('Mic blocked — allow in browser settings.');
      else if (e.error !== 'aborted') { showToast('Couldn\'t hear clearly — type it instead.'); showTextInput(); }
    };
    rec.onresult = e => showResult(parseTranscript(e.results[0][0].transcript));

    btn.addEventListener('click', () => {
      if (listening) { rec.stop(); return; }
      typeWrap.style.display  = 'none';
      resultBox.style.display = 'none';
      rec.start();
    });

    // retry = listen again on Chrome, show text on Safari
    retryBtn.addEventListener('click', () => { resultBox.style.display = 'none'; rec.start(); });
  } else {
    // Safari / Firefox — text fallback
    btn.addEventListener('click', () => {
      if (typeWrap.style.display === 'flex') { typeWrap.style.display = 'none'; return; }
      showTextInput();
    });
    retryBtn.addEventListener('click', () => { resultBox.style.display = 'none'; showTextInput(); });
  }

  confirmBtn.addEventListener('click', () => applyParsed(lastParsed));
  dismissBtn.addEventListener('click', () => {
    resultBox.style.display = 'none';
    typeWrap.style.display  = 'none';
    lastParsed = null;
  });
})();

// ── Service Worker (PWA) ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ── Export Report ─────────────────────────────────────────────────────────────
document.getElementById('export-report').addEventListener('click', async () => {
  const btn = document.getElementById('export-report');
  btn.classList.add('exporting');
  btn.textContent = 'Exporting…';

  // Sections to capture
  const summary   = document.querySelector('.summary');
  const insights  = document.getElementById('insights-section');
  const charts    = document.querySelector('.charts-grid');

  // Build a temporary off-screen container styled for export
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 1100px; padding: 40px;
    background: #090B18;
    font-family: Inter, sans-serif;
    color: #E4E8F5;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:28px;';
  header.innerHTML = `
    <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.5px;">
      <span style="color:#E4E8F5">Spend</span><span style="color:#22D3EE">Mind</span>
    </div>
    <div style="font-size:0.9rem;color:rgba(228,232,245,.5);">
      ${document.getElementById('month-label').textContent} &nbsp;·&nbsp; exported ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
    </div>`;
  wrap.appendChild(header);

  // Rebuild summary cards for export with solid backgrounds
  const cardDefs = [
    { id: 'total-spent',      label: 'Total Spent',    color: '#FB7185', sub: null },
    { id: 'total-credit',     label: 'Credit Card',    color: '#5B8DEF', sub: null },
    { id: 'highest-day-amt',  label: 'Highest Day',    color: '#FBB040', sub: 'highest-day-label' },
    { id: 'highest-week-amt', label: 'Highest Week',   color: '#34D399', sub: 'highest-week-label' },
  ];
  const cardsRow = document.createElement('div');
  cardsRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;';
  cardDefs.forEach(({ id, label, color, sub }) => {
    const amt  = document.getElementById(id)?.textContent  || '₹0.00';
    const subT = sub ? document.getElementById(sub)?.textContent : null;
    const box  = document.createElement('div');
    box.style.cssText = `
      background: #13172b;
      border: 1px solid ${color}44;
      border-top: 2px solid ${color};
      border-radius: 14px;
      padding: 20px 16px 16px;
      text-align: center;
    `;
    box.innerHTML = `
      <div style="font-size:0.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(228,232,245,.45);margin-bottom:10px;">${label}</div>
      <div style="font-size:1.6rem;font-weight:800;color:${color};letter-spacing:-.5px;">${amt}</div>
      ${subT ? `<div style="font-size:0.75rem;color:rgba(228,232,245,.45);margin-top:6px;">${subT}</div>` : ''}
    `;
    cardsRow.appendChild(box);
  });
  wrap.appendChild(cardsRow);

  // Rebuild insights for export — solid styles so glassmorphism doesn't wash out
  if (insights && insights.style.display !== 'none') {
    const insightCards = insights.querySelectorAll('.insight-card');
    if (insightCards.length) {
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:24px;';

      const heading = document.createElement('div');
      heading.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;';
      heading.innerHTML = `
        <span style="font-size:1.3rem;">🧠</span>
        <span style="font-size:0.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#22D3EE;">Money Intelligence</span>`;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';

      insightCards.forEach(card => {
        const emoji = card.querySelector('.insight-emoji')?.textContent || '';
        const title = card.querySelector('.insight-title')?.textContent || '';
        const sub   = card.querySelector('.insight-sub')?.textContent   || '';

        // Pick accent colour based on card type
        let accent = '#5B8DEF';
        if (card.classList.contains('good'))    accent = '#34D399';
        if (card.classList.contains('warn'))    accent = '#FBB040';
        if (card.classList.contains('bad'))     accent = '#FB7185';
        if (card.classList.contains('neutral')) accent = '#A78BFA';

        const box = document.createElement('div');
        box.style.cssText = `
          background: #13172b;
          border: 1px solid ${accent}55;
          border-left: 3px solid ${accent};
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        `;
        box.innerHTML = `
          <span style="font-size:1.3rem;line-height:1;margin-top:2px;">${emoji}</span>
          <div>
            <div style="font-size:0.82rem;font-weight:700;color:#E4E8F5;margin-bottom:4px;line-height:1.3;">${title}</div>
            <div style="font-size:0.75rem;color:rgba(228,232,245,.6);line-height:1.4;">${sub}</div>
          </div>`;
        grid.appendChild(box);
      });

      section.appendChild(grid);
      wrap.appendChild(section);
    }
  }

  // For charts, render each Chart.js canvas as an <img> (avoids cross-origin issues)
  const chartIds = [
    { canvas: 'timeline-chart', empty: 'timeline-empty', title: 'Daily Timeline' },
    { canvas: 'category-chart', empty: 'cat-empty',      title: 'Spending by Category' },
    { canvas: 'payment-chart',  empty: 'pay-empty',      title: 'Cash vs Credit Card' },
    { canvas: 'daily-chart',    empty: 'daily-empty',    title: 'Daily — Last 30 Days' },
    { canvas: 'weekly-chart',   empty: 'weekly-empty',   title: 'Weekly Spending' },
  ];

  const chartsWrap = document.createElement('div');
  chartsWrap.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:20px;';

  // Timeline full width
  const tlCanvas = document.getElementById('timeline-chart');
  if (tlCanvas && tlCanvas.style.display !== 'none') {
    const box = document.createElement('div');
    box.style.cssText = 'grid-column:1/-1; background:rgba(255,255,255,.038); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:20px;';
    box.innerHTML = `<p style="font-size:.8rem;font-weight:700;color:rgba(228,232,245,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Daily Timeline</p>`;
    const img = document.createElement('img');
    img.src = tlCanvas.toDataURL('image/png');
    img.style.cssText = 'width:100%; border-radius:8px;';
    box.appendChild(img);
    chartsWrap.appendChild(box);
  }

  // Rest of charts 2-up
  chartIds.slice(1).forEach(({ canvas, title }) => {
    const el = document.getElementById(canvas);
    if (!el || el.style.display === 'none') return;
    const box = document.createElement('div');
    box.style.cssText = 'background:rgba(255,255,255,.038); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:20px;';
    box.innerHTML = `<p style="font-size:.8rem;font-weight:700;color:rgba(228,232,245,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">${title}</p>`;
    const img = document.createElement('img');
    img.src = el.toDataURL('image/png');
    img.style.cssText = 'width:100%; border-radius:8px;';
    box.appendChild(img);
    chartsWrap.appendChild(box);
  });

  wrap.appendChild(chartsWrap);
  document.body.appendChild(wrap);

  try {
    const canvas = await html2canvas(wrap, {
      backgroundColor: '#090B18',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement('a');
    const month = document.getElementById('month-label').textContent.replace(' ', '-');
    link.download = `SpendMind-${month}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(wrap);
    btn.classList.remove('exporting');
    btn.textContent = '↡ Export';
  }
});

// ── Auth Init ─────────────────────────────────────────────────────────────────
// Decides whether to use Supabase auth or fall back to local-only mode
(async function initAuth() {
  const loginScreen = document.getElementById('login-screen');
  const pinScreen   = document.getElementById('pin-screen');

  // No Supabase available (file:// or CDN blocked) — run purely local
  if (!sb) {
    startPinFlow();
    return;
  }

  // Check for existing Supabase session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    sbUser = session.user;
    startPinFlow();
    return;
  }

  // No session — hide PIN screen, show login
  pinScreen.style.display = 'none';
  loginScreen.style.display = 'flex';

  let isSignUp = false;

  function setMode(signup) {
    isSignUp = signup;
    document.getElementById('login-title').textContent   = signup ? 'Create account' : 'Sign in';
    document.getElementById('login-btn').textContent     = signup ? 'Create Account →' : 'Sign In →';
    document.getElementById('login-switch-btn').textContent = signup ? 'Sign in instead' : 'Create one';
    document.getElementById('login-msg').textContent = '';
    document.getElementById('login-password').autocomplete = signup ? 'new-password' : 'current-password';
  }

  document.getElementById('login-switch-btn').addEventListener('click', () => setMode(!isSignUp));

  document.getElementById('login-btn').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const msgEl    = document.getElementById('login-msg');
    const loginBtn = document.getElementById('login-btn');
    if (!email || !password) { msgEl.textContent = 'Enter email and password.'; return; }
    loginBtn.disabled = true;
    loginBtn.textContent = isSignUp ? 'Creating…' : 'Signing in…';
    msgEl.textContent = '';

    let error;
    if (isSignUp) {
      ({ error } = await sb.auth.signUp({ email, password }));
    } else {
      const { data, error: e } = await sb.auth.signInWithPassword({ email, password });
      error = e;
      if (!error && data.session) {
        sbUser = data.session.user;
        loginScreen.style.display = 'none';
        pinScreen.style.display   = '';
        startPinFlow();
        return;
      }
    }

    if (error) {
      loginBtn.disabled = false;
      loginBtn.textContent = isSignUp ? 'Create Account →' : 'Sign In →';
      msgEl.textContent = error.message.includes('Invalid') ? 'Wrong email or password.' : error.message;
    } else if (isSignUp) {
      // Auto sign-in after sign-up
      const { data } = await sb.auth.signInWithPassword({ email, password });
      if (data?.session) {
        sbUser = data.session.user;
        loginScreen.style.display = 'none';
        pinScreen.style.display   = '';
        startPinFlow();
      }
    }
  });

  ['login-email', 'login-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('login-btn').click();
    });
  });
})();

// ── Boot: triggered by PIN lock after successful unlock ───────────────────────
