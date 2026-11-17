// ========================================================
// WINBUZZ PRO APP SHELL & UTILITIES
// IST Clock, Match Search, Category Filter, Desk Tabs & Modals
// ========================================================

// 1. LIVE IST CLOCK (REAL-TIME SECONDS)
function startLiveClock() {
  const clockEl = document.getElementById('live-ist-clock');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    // Format: 17 Nov 2026, 16:42:15 IST
    const options = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    };
    clockEl.innerText = now.toLocaleString('en-IN', options) + ' IST';
  }
  update();
  setInterval(update, 1000);
}

// 2. LIVE SEARCH FILTER
function searchMatches(query) {
  const q = query.trim().toLowerCase();
  const rows = document.querySelectorAll('.exchange-match-row');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    if (text.includes(q)) {
      row.style.display = 'grid';
    } else {
      row.style.display = 'none';
    }
  });
}

// 3. CATEGORY / SPORT FILTER TABS
function filterSportCategory(cat, btnElement) {
  const tabBtns = document.querySelectorAll('.filter-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const rows = document.querySelectorAll('.exchange-match-row');
  rows.forEach(row => {
    const sport = row.dataset.sport || 'cricket';
    if (cat === 'all' || sport === cat) {
      row.style.display = 'grid';
    } else {
      row.style.display = 'none';
    }
  });
}

// 3B. VIEW SWITCHER (LIVE vs UPCOMING vs RESULTS)
function switchViewTab(viewName) {
  const viewBtns = document.querySelectorAll('.view-tab-btn');
  viewBtns.forEach(b => b.classList.remove('active'));

  const activeBtn = document.getElementById(`view-btn-${viewName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const liveView = document.getElementById('view-live-container');
  const upcomingView = document.getElementById('view-upcoming-container');
  const resultsView = document.getElementById('view-results-container');

  if (viewName === 'live') {
    if (liveView) liveView.style.display = 'block';
    if (upcomingView) upcomingView.style.display = 'none';
    if (resultsView) resultsView.style.display = 'none';
  } else if (viewName === 'upcoming') {
    if (liveView) liveView.style.display = 'none';
    if (upcomingView) upcomingView.style.display = 'block';
    if (resultsView) resultsView.style.display = 'none';
  } else if (viewName === 'results') {
    if (liveView) liveView.style.display = 'none';
    if (upcomingView) upcomingView.style.display = 'none';
    if (resultsView) resultsView.style.display = 'block';
  }
}

// 4. RIGHT SIDEBAR DESK TABS (BET SLIP vs OPEN BETS)
function switchDeskTab(tabName) {
  const tabBtns = document.querySelectorAll('.desk-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const slipContainer = document.getElementById('betslip-container');
  const openContainer = document.getElementById('open-bets-container');
  const radarContainer = document.getElementById('radar-container');

  if (tabName === 'betslip') {
    if (slipContainer) slipContainer.style.display = 'block';
    if (openContainer) openContainer.style.display = 'none';
    if (radarContainer) radarContainer.style.display = 'none';
  } else if (tabName === 'openbets') {
    if (slipContainer) slipContainer.style.display = 'none';
    if (openContainer) openContainer.style.display = 'block';
    if (radarContainer) radarContainer.style.display = 'none';
  } else if (tabName === 'radar') {
    if (slipContainer) slipContainer.style.display = 'none';
    if (openContainer) openContainer.style.display = 'none';
    if (radarContainer) radarContainer.style.display = 'block';
  }
}

// 5. ONE-CLICK BETTING TOGGLE
function toggleOneClickBet(enabled) {
  localStorage.setItem('winbuzz_one_click', enabled ? 'true' : 'false');
  const toast = document.createElement('div');
  toast.className = 'balance-toast credit';
  toast.innerText = enabled ? '1-CLICK BET ON' : '1-CLICK BET OFF';
  document.querySelector('.wallet-chip').appendChild(toast);
  setTimeout(() => toast.remove(), 1200);
}

// 6. MODALS
function openDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.add('active');
}

function closeDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.remove('active');
}

function openWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.classList.add('active');
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.classList.remove('active');
}

function setQuickDeposit(amount) {
  const input = document.getElementById('deposit-amount-input');
  if (input) input.value = amount;
}

async function submitDeposit() {
  const input = document.getElementById('deposit-amount-input');
  const amount = parseFloat(input.value) || 1000;

  try {
    const res = await fetch('/api/user/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, method: 'UPI Instant QR' })
    });
    const data = await res.json();
    if (res.ok) {
      if (window.bettingEngine) {
        window.bettingEngine.updateWalletUI(data.balance, 0, amount);
        window.bettingEngine.playBeep('win');
      }
      closeDepositModal();
    } else {
      alert(data.detail || 'Deposit failed');
    }
  } catch (e) {
    alert('Deposit error');
  }
}

async function submitWithdraw() {
  const input = document.getElementById('withdraw-amount-input');
  const amount = parseFloat(input.value) || 1000;

  try {
    const res = await fetch('/api/user/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, method: 'Bank Transfer' })
    });
    const data = await res.json();
    if (res.ok) {
      if (window.bettingEngine) {
        window.bettingEngine.updateWalletUI(data.balance, 0, -amount);
        window.bettingEngine.playBeep('place');
      }
      closeWithdrawModal();
    } else {
      alert(data.detail || 'Withdrawal failed');
    }
  } catch (e) {
    alert('Withdrawal error');
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
