// ========================================================
// CRICKNOVA CORE APP SHELL & ENGINE
// Dual View (Android / Laptop), OTP Auth, Add Money, PWA & Modals
// ========================================================

let deferredInstallPrompt = null;
let currentMobileBet = {
  matchId: null,
  matchName: null,
  runner: null,
  type: 'back',
  odds: 1.95,
  stake: 500
};

// ==================== 1. DUAL PLATFORM VIEW SWITCHER ====================
function initPlatformView() {
  const savedPreview = localStorage.getItem('cricknova_preview_mode');
  if (window.innerWidth > 768 && savedPreview === 'android') {
    document.body.classList.add('mode-android-preview');
    updateToggleBtn(true);
  } else {
    document.body.classList.remove('mode-android-preview');
    updateToggleBtn(false);
  }
}

function togglePlatformView() {
  if (window.innerWidth <= 768) {
    document.body.classList.toggle('force-desktop');
    const isDesktop = document.body.classList.contains('force-desktop');
    alert(isDesktop ? 'Switched to Desktop Site View' : 'Switched to Mobile App View');
  } else {
    document.body.classList.toggle('mode-android-preview');
    const isPreview = document.body.classList.contains('mode-android-preview');
    localStorage.setItem('cricknova_preview_mode', isPreview ? 'android' : 'desktop');
    updateToggleBtn(isPreview);
  }
}

function updateToggleBtn(isPreview) {
  const toggleText = document.getElementById('toggle-text');
  const toggleIcon = document.getElementById('toggle-icon');
  if (isPreview) {
    if (toggleText) toggleText.innerText = 'Laptop View';
    if (toggleIcon) toggleIcon.innerText = '💻';
  } else {
    if (toggleText) toggleText.innerText = 'Android App View';
    if (toggleIcon) toggleIcon.innerText = '📱';
  }
}

// ==================== 2. ANDROID BOTTOM NAVIGATION ====================
function switchAndroidTab(tabName) {
  // 1. Update screens
  const screens = document.querySelectorAll('.android-screen');
  screens.forEach(s => s.classList.remove('active'));

  const targetScreen = document.getElementById(`android-screen-${tabName}`);
  if (targetScreen) targetScreen.classList.add('active');

  // 2. Update bottom nav buttons
  const tabs = document.querySelectorAll('.android-bottom-nav .nav-tab');
  tabs.forEach(t => {
    if (t.dataset.tab === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  // If opening Account tab, refresh user profile
  if (tabName === 'account') {
    checkAuthStatus();
  }

  // Scroll to top of Android view
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterAndroidCat(cat, btnElement) {
  const catBtns = document.querySelectorAll('.android-cat-btn');
  catBtns.forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  // Make sure inplay screen is active
  switchAndroidTab('inplay');

  const cards = document.querySelectorAll('.android-match-card');
  cards.forEach(card => {
    const sport = card.dataset.sport || 'cricket';
    if (cat === 'all' || sport === cat) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function filterMobileCasino(cat, btnElement) {
  if (btnElement && btnElement.parentElement) {
    btnElement.parentElement.querySelectorAll('.android-cat-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
  }
  const cards = document.querySelectorAll('#mobile-casino-grid .android-casino-card');
  cards.forEach(card => {
    if (cat === 'all' || card.dataset.cat === cat) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// ==================== 3. LIVE IST CLOCK ====================
function startLiveClock() {
  const clockEl = document.getElementById('live-ist-clock');
  const mClockEl = document.getElementById('android-ist-clock');

  function update() {
    const now = new Date();
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
    const timeStr = now.toLocaleString('en-IN', options) + ' IST';
    if (clockEl) clockEl.innerText = timeStr;
    if (mClockEl) mClockEl.innerText = timeStr.split(',')[1].trim();
  }
  update();
  setInterval(update, 1000);
}

// ==================== 4. CUSTOMER AUTHENTICATION (PASSWORD & REAL SMS OTP) ====================
let authUserMobile = null;
let isUserLoggedIn = false;

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.status === 'success' && data.user) {
      isUserLoggedIn = !!data.authenticated;
      authUserMobile = data.authenticated ? data.user.mobile : null;
      updateAuthUI(data.user, data.authenticated);
    }
  } catch (e) {
    console.error('Error checking auth:', e);
  }
}

function updateAuthUI(user, isAuthenticated) {
  const authLabel = document.getElementById('auth-phone-label');
  const accountPhone = document.getElementById('account-phone-val');
  const balEl = document.getElementById('wallet-balance');
  const expEl = document.getElementById('wallet-exposure');
  const mBalEl = document.getElementById('android-wallet-val');
  const accBalEl = document.getElementById('account-bal-val');
  const accExpEl = document.getElementById('account-exp-val');

  if (isAuthenticated && user && user.mobile) {
    const phoneStr = user.mobile;
    const balStr = `₹${Math.round(user.balance || 0).toLocaleString('en-IN')}`;
    const expStr = `₹${Math.round(user.exposure || 0).toLocaleString('en-IN')}`;

    if (authLabel) authLabel.innerHTML = `📱 ${phoneStr} <span style="color: var(--winbuzz-gold); font-size: 9px; margin-left: 4px;">VIP</span>`;
    if (accountPhone) accountPhone.innerText = phoneStr;
    if (balEl) balEl.innerText = `₹${(user.balance || 0).toFixed(2)}`;
    if (expEl) expEl.innerText = expStr;
    if (mBalEl) mBalEl.innerText = Math.round(user.balance || 0).toLocaleString('en-IN');
    if (accBalEl) accBalEl.innerText = `₹${(user.balance || 0).toFixed(2)}`;
    if (accExpEl) accExpEl.innerText = expStr;
  } else {
    // Guest State
    if (authLabel) authLabel.innerHTML = `👤 Login / Register`;
    if (accountPhone) accountPhone.innerText = 'Guest (Not logged in)';
    if (balEl) balEl.innerText = '₹0.00';
    if (expEl) expEl.innerText = '₹0.00';
    if (mBalEl) mBalEl.innerText = '0';
    if (accBalEl) accBalEl.innerText = '₹0.00';
    if (accExpEl) accExpEl.innerText = '₹0.00';
  }
}

function handleAuthPillClick() {
  if (isUserLoggedIn && authUserMobile) {
    if (document.body.classList.contains('mode-android')) {
      switchAndroidTab('account');
    } else {
      if (confirm(`Logged in as 📱 +91 ${authUserMobile}.\n\nDo you want to sign out / switch to another account?`)) {
        logoutUser();
      }
    }
  } else {
    openLoginModal('login');
  }
}

function openLoginModal(defaultTab = 'login') {
  const modal = document.getElementById('otp-modal');
  if (modal) {
    modal.classList.add('active');
    switchAuthTab(defaultTab);
  }
}

function closeLoginModal() {
  const modal = document.getElementById('otp-modal');
  if (modal) modal.classList.remove('active');
}

function switchAuthTab(tabName) {
  // Update Tab buttons
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));

  // Update Panels
  const panels = document.querySelectorAll('.auth-panel');
  panels.forEach(p => p.classList.remove('active'));

  if (tabName === 'login') {
    const btn = document.getElementById('tab-btn-login');
    const panel = document.getElementById('auth-panel-login');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    document.getElementById('pwd-login-mobile')?.focus();
  } else if (tabName === 'register') {
    const btn = document.getElementById('tab-btn-register');
    const panel = document.getElementById('auth-panel-register');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    document.getElementById('reg-step-mobile').style.display = 'block';
    document.getElementById('reg-step-verify').style.display = 'none';
    document.getElementById('reg-mobile')?.focus();
  } else if (tabName === 'otp' || tabName === 'forgot') {
    const btn = document.getElementById('tab-btn-otp');
    const panel = document.getElementById('auth-panel-otp');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    document.getElementById('otp-login-step-mobile').style.display = 'block';
    document.getElementById('otp-login-step-verify').style.display = 'none';
    document.getElementById('otp-only-mobile')?.focus();
  }
}

function togglePasswordVisibility(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    iconEl.innerText = '🙈';
  } else {
    input.type = 'password';
    iconEl.innerText = '👁️';
  }
}

// 1. LOGIN WITH PASSWORD
async function handlePasswordLogin(e) {
  e.preventDefault();
  const mobile = document.getElementById('pwd-login-mobile').value.trim();
  const password = document.getElementById('pwd-login-password').value.trim();

  if (!mobile || mobile.length !== 10) {
    alert('Please enter a valid 10-digit mobile number');
    return;
  }
  if (!password) {
    alert('Please enter your password');
    return;
  }

  const btn = document.getElementById('btn-login-password-submit');
  btn.disabled = true;
  btn.innerText = 'LOGGING IN...';

  try {
    const res = await fetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile, password: password })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      closeLoginModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Login failed'));
      // If user has no password yet, offer switch to OTP tab
      if (data.detail && data.detail.includes('no password set')) {
        switchAuthTab('otp');
        const otpMob = document.getElementById('otp-only-mobile');
        if (otpMob) otpMob.value = mobile;
      }
    }
  } catch (err) {
    alert('Network error while logging in: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 LOGIN TO MY ACCOUNT';
  }
}

// 2. REGISTER NEW ACCOUNT
async function sendRegisterOtp() {
  const mobile = document.getElementById('reg-mobile').value.trim();
  if (!mobile || mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
    alert('Please enter a valid 10-digit mobile number');
    return;
  }

  const btn = document.getElementById('btn-reg-send-otp');
  btn.disabled = true;
  btn.innerText = 'SENDING OTP TO MOBILE...';

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile, purpose: 'REGISTER' })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.user_exists && data.has_password) {
        alert('ℹ️ This mobile number is already registered with a password! Please login with your password.');
        switchAuthTab('login');
        const mobInp = document.getElementById('pwd-login-mobile');
        if (mobInp) mobInp.value = mobile;
        return;
      }

      document.getElementById('reg-step-mobile').style.display = 'none';
      document.getElementById('reg-step-verify').style.display = 'block';
      const otpInput = document.getElementById('reg-otp');
      otpInput.value = data.test_otp || '123456';
      document.getElementById('reg-password').focus();
    } else {
      alert('❌ ' + (data.detail || 'Failed to send OTP'));
    }
  } catch (err) {
    alert('Network error sending OTP');
  } finally {
    btn.disabled = false;
    btn.innerText = 'SEND OTP TO MOBILE 📲';
  }
}

async function completeRegistration() {
  const mobile = document.getElementById('reg-mobile').value.trim();
  const otp = document.getElementById('reg-otp').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const confirmPwd = document.getElementById('reg-password-confirm').value.trim();

  if (!otp || otp.length < 4) {
    alert('Please enter the 6-digit OTP code');
    return;
  }
  if (!password || password.length < 6) {
    alert('Password must be at least 6 characters long');
    return;
  }
  if (password !== confirmPwd) {
    alert('Passwords do not match! Please check and re-type.');
    return;
  }

  const btn = document.getElementById('btn-reg-complete');
  btn.disabled = true;
  btn.innerText = 'CREATING ACCOUNT...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobile,
        otp: otp,
        password: password
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`🎉 ${data.message}\nYour account is verified and password is saved securely!`);
      closeLoginModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Registration failed'));
    }
  } catch (err) {
    alert('Network error during registration: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '✓ VERIFY OTP & CREATE ACCOUNT';
  }
}

// 3. LOGIN WITH OTP ONLY / FORGOT PASSWORD
async function sendOtpOnly() {
  const mobile = document.getElementById('otp-only-mobile').value.trim();
  if (!mobile || mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
    alert('Please enter a valid 10-digit mobile number');
    return;
  }

  const btn = document.getElementById('btn-otp-only-send');
  btn.disabled = true;
  btn.innerText = 'REQUESTING OTP...';

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile, purpose: 'LOGIN' })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('otp-login-step-mobile').style.display = 'none';
      document.getElementById('otp-login-step-verify').style.display = 'block';
      const codeInp = document.getElementById('otp-only-code');
      codeInp.value = data.test_otp || '123456';
      codeInp.focus();
    } else {
      alert('❌ ' + (data.detail || 'Failed to send OTP'));
    }
  } catch (err) {
    alert('Network error requesting OTP');
  } finally {
    btn.disabled = false;
    btn.innerText = 'REQUEST OTP CODE 📲';
  }
}

async function completeOtpOnlyLogin() {
  const mobile = document.getElementById('otp-only-mobile').value.trim();
  const otp = document.getElementById('otp-only-code').value.trim();
  const newPwd = document.getElementById('otp-only-new-pwd').value.trim();

  if (!otp || otp.length < 4) {
    alert('Please enter the OTP code');
    return;
  }

  const btn = document.getElementById('btn-otp-only-verify');
  btn.disabled = true;
  btn.innerText = 'VERIFYING...';

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobile,
        otp: otp,
        new_password: newPwd || undefined
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      closeLoginModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'OTP verification failed'));
    }
  } catch (err) {
    alert('Network error verifying OTP: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'VERIFY & LOGIN NOW 🚀';
  }
}

async function logoutUser() {
  window.location.href = '/logout';
}

function copyUpiId(upiId) {
  if (!upiId) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(upiId).then(() => {
      alert(`✅ UPI ID Copied!\n${upiId}\n\nOpen PhonePe / Google Pay / Paytm to pay.`);
    }).catch(() => {
      prompt("Copy UPI ID:", upiId);
    });
  } else {
    prompt("Copy UPI ID:", upiId);
  }
}

// ==================== 5. ADD MONEY / DEPOSIT REQUEST ====================
function openDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.add('active');
}

function closeDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.remove('active');
}

function setQuickDeposit(amount) {
  const input = document.getElementById('deposit-amount-input');
  if (input) input.value = amount;
}

async function submitDepositRequest() {
  const amount = parseFloat(document.getElementById('deposit-amount-input').value);
  const method = document.getElementById('deposit-method-input').value;
  const utr = document.getElementById('deposit-utr-input').value.trim();

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid deposit amount');
    return;
  }

  try {
    const res = await fetch('/api/user/deposit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        method: method,
        utr: utr,
        notes: `Customer request via ${method}`
      })
    });
    const data = await res.json();
    if (res.status === 401) {
      alert('⚠️ Please login first to deposit money into your account.');
      window.location.href = '/login';
      return;
    }
    if (res.ok) {
      alert(`✅ Deposit Request of ₹${amount.toLocaleString('en-IN')} submitted successfully!\n\nYour request is pending in Admin Desk. Once Admin verifies, your wallet balance will be credited instantly.`);
      closeDepositModal();
    } else {
      alert('❌ ' + (data.detail || data.message || 'Failed to submit request'));
    }
  } catch (err) {
    alert('Network error submitting deposit request: ' + err.message);
  }
}

// ==================== 6. WITHDRAWAL ====================
function openWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.classList.add('active');
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.classList.remove('active');
}

async function submitWithdraw() {
  const amount = parseFloat(document.getElementById('withdraw-amount-input').value);
  const dest = document.getElementById('withdraw-dest-input').value.trim();

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid withdrawal amount');
    return;
  }

  try {
    const res = await fetch('/api/user/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, method: `Bank/UPI (${dest || 'Default Bank'})` })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ Withdrawal of ₹${amount.toLocaleString('en-IN')} processed successfully!`);
      closeWithdrawModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Withdrawal failed'));
    }
  } catch (err) {
    alert('Network error during withdrawal');
  }
}

// ==================== 7. ANDROID APP DOWNLOAD & PWA INSTALL ====================
function openDownloadModal() {
  const modal = document.getElementById('download-modal');
  if (modal) modal.classList.add('active');
}

function closeDownloadModal() {
  const modal = document.getElementById('download-modal');
  if (modal) modal.classList.remove('active');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const pwaBtn = document.getElementById('btn-pwa-install');
  if (pwaBtn) {
    pwaBtn.style.display = 'block';
  }
});

async function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      alert('CrickNova App installed to your device!');
    }
    deferredInstallPrompt = null;
  } else {
    alert('To add to your Android Home Screen:\n1. Tap the ⋮ (Menu) icon in your browser\n2. Select "Add to Home screen" or "Install App"');
  }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}

// ==================== 8. MOBILE SLIDING BET SLIP ====================
function openMobileBetSlip(matchId, matchName, runner, type, price, marketType = 'match_odds') {
  currentMobileBet = {
    matchId: matchId,
    matchName: matchName,
    runner: runner,
    type: type,
    odds: parseFloat(price) || 1.95,
    stake: 500,
    marketType: marketType || 'match_odds'
  };

  const sheet = document.getElementById('mobile-betslip-sheet');
  const matchEl = document.getElementById('sheet-match-name');
  const runnerEl = document.getElementById('sheet-runner-name');
  const badgeEl = document.getElementById('sheet-bet-badge');
  const oddsInput = document.getElementById('sheet-odds-input');
  const stakeInput = document.getElementById('sheet-stake-input');

  if (matchEl) matchEl.innerText = matchName;
  if (runnerEl) runnerEl.innerText = runner;
  if (badgeEl) {
    badgeEl.innerText = type.toUpperCase();
    badgeEl.className = `bet-badge ${type}`;
  }
  if (oddsInput) oddsInput.value = currentMobileBet.odds.toFixed(2);
  if (stakeInput) stakeInput.value = currentMobileBet.stake;

  calculateSheetProfit();
  if (sheet) sheet.classList.add('sheet-open');
}

function closeMobileBetSlip() {
  const sheet = document.getElementById('mobile-betslip-sheet');
  if (sheet) sheet.classList.remove('sheet-open');
}

function adjustSheetOdds(delta) {
  const oddsInput = document.getElementById('sheet-odds-input');
  let val = (parseFloat(oddsInput.value) || 1.01) + delta;
  if (val < 1.01) val = 1.01;
  oddsInput.value = val.toFixed(2);
  currentMobileBet.odds = val;
  calculateSheetProfit();
}

function adjustSheetStake(delta) {
  const stakeInput = document.getElementById('sheet-stake-input');
  let val = (parseFloat(stakeInput.value) || 500) + delta;
  if (val < 50) val = 50;
  stakeInput.value = Math.round(val);
  currentMobileBet.stake = val;
  calculateSheetProfit();
}

function setSheetStake(amt) {
  const stakeInput = document.getElementById('sheet-stake-input');
  stakeInput.value = amt;
  currentMobileBet.stake = amt;
  calculateSheetProfit();
}

function calculateSheetProfit() {
  const oddsInput = document.getElementById('sheet-odds-input');
  const stakeInput = document.getElementById('sheet-stake-input');
  const calcLabel = document.getElementById('sheet-calc-label');
  const calcVal = document.getElementById('sheet-calc-val');

  const odds = parseFloat(oddsInput.value) || 1.0;
  const stake = parseFloat(stakeInput.value) || 0;

  if (currentMobileBet.type === 'back') {
    const profit = stake * (odds - 1);
    if (calcLabel) calcLabel.innerText = 'Potential Profit:';
    if (calcVal) {
      calcVal.innerText = `₹${profit.toFixed(2)}`;
      calcVal.style.color = 'var(--color-green)';
    }
  } else {
    const liability = stake * (odds - 1);
    if (calcLabel) calcLabel.innerText = 'Liability (Exposure):';
    if (calcVal) {
      calcVal.innerText = `₹${liability.toFixed(2)}`;
      calcVal.style.color = 'var(--color-red)';
    }
  }
}

async function submitMobileBet() {
  const oddsInput = document.getElementById('sheet-odds-input');
  const stakeInput = document.getElementById('sheet-stake-input');
  const btn = document.getElementById('sheet-submit-btn');

  const odds = parseFloat(oddsInput.value);
  const stake = parseFloat(stakeInput.value);

  if (isNaN(stake) || stake <= 0) {
    alert('Please enter a valid stake amount');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'PLACING BET...';

  try {
    const res = await fetch('/api/bet/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: currentMobileBet.matchId,
        runner: currentMobileBet.runner,
        type: currentMobileBet.type,
        odds: odds,
        stake: stake,
        market_type: currentMobileBet.marketType || 'match_odds'
      })
    });
    const data = await res.json();
    if (res.status === 401) {
      alert('⚠️ Please login first to place bets on CrickNova!');
      window.location.href = '/login';
      return;
    }
    if (res.ok) {
      alert(`✅ Bet Placed Successfully!\n${currentMobileBet.type.toUpperCase()} on ${currentMobileBet.runner} @ ${odds}`);
      closeMobileBetSlip();
      window.location.reload();
    } else {
      alert('❌ Bet placement failed: ' + (data.detail || 'Unknown error'));
    }
  } catch (err) {
    alert('Network error while placing bet: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'PLACE BET NOW';
  }
}

// ==================== 9. DESKTOP SEARCH & TABS ====================
function searchMatches(query) {
  const q = query.trim().toLowerCase();
  const rows = document.querySelectorAll('.exchange-match-row');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(q) ? 'grid' : 'none';
  });

  const mCards = document.querySelectorAll('.android-match-card');
  mCards.forEach(card => {
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(q) ? 'block' : 'none';
  });
}

function filterSportCategory(cat, btnElement) {
  const tabBtns = document.querySelectorAll('.filter-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const rows = document.querySelectorAll('.exchange-match-row');
  rows.forEach(row => {
    const sport = row.dataset.sport || 'cricket';
    row.style.display = (cat === 'all' || sport === cat) ? 'grid' : 'none';
  });
}

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

function switchDeskTab(tabName) {
  const tabBtns = document.querySelectorAll('.desk-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const slipContainer = document.getElementById('betslip-container');
  const openContainer = document.getElementById('open-bets-container');

  if (tabName === 'betslip') {
    if (slipContainer) slipContainer.style.display = 'block';
    if (openContainer) openContainer.style.display = 'none';
  } else if (tabName === 'openbets') {
    if (slipContainer) slipContainer.style.display = 'none';
    if (openContainer) openContainer.style.display = 'block';
  }
}

// ==================== 10. INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initPlatformView();
  startLiveClock();
  checkAuthStatus();

  // Attach mobile click handlers for odds buttons
  document.querySelectorAll('.m-odds-box').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const matchCard = box.closest('.android-match-card');
      const matchName = matchCard ? (matchCard.querySelector('.android-match-name')?.innerText || 'Live Match') : 'Live Match';
      const matchId = box.dataset.matchId;
      const runner = box.dataset.runner;
      const type = box.dataset.type;
      const price = box.querySelector('.m-price')?.innerText || '1.95';

      if (price !== 'SUSP' && price !== '-') {
        openMobileBetSlip(matchId, matchName, runner, type, price);
      }
    });
  });

  // Attach desktop click handlers for odds buttons
  document.querySelectorAll('.odds-box').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const matchRow = box.closest('.exchange-match-row');
      const matchName = matchRow ? (matchRow.querySelector('.match-name')?.innerText || 'Live Match') : 'Live Match';
      const matchId = box.dataset.matchId;
      const runner = box.dataset.runner;
      const type = box.dataset.type;
      const price = box.querySelector('.odds-price')?.innerText || '1.95';

      if (price !== 'SUSP' && price !== '-') {
        openMobileBetSlip(matchId, matchName, runner, type, price);
      }
    });
  });

  // Modal backdrop click handler
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
});
