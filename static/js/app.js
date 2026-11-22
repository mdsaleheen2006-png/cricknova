// ========================================================
// CRICKNOVA CORE APP SHELL & ENGINE
// Dual View (Android / Laptop), OTP Auth, Add Money, PWA & Modals
// ========================================================

var deferredInstallPrompt = null;
var currentMobileBet = {
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

  // If opening Account tab, refresh user profile and transaction feed
  if (tabName === 'account') {
    if (typeof checkAuthStatus === 'function') checkAuthStatus();
    if (typeof loadAccountScreenHistory === 'function') loadAccountScreenHistory();
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

function hasUserSession() {
  const phone = localStorage.getItem('cricknova_user_phone');
  const hasCookie = document.cookie.includes('cricknova_user=');
  return !!(isUserLoggedIn || phone || hasCookie);
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
  } else if (tabName === 'otp') {
    const btn = document.getElementById('tab-btn-otp');
    const panel = document.getElementById('auth-panel-otp');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    const stepMobile = document.getElementById('otp-login-step-mobile');
    const stepVerify = document.getElementById('otp-login-step-verify');
    if (stepMobile) stepMobile.style.display = 'block';
    if (stepVerify) stepVerify.style.display = 'none';
    document.getElementById('otp-only-mobile')?.focus();
  } else if (tabName === 'forgot') {
    const btn = document.getElementById('tab-btn-forgot');
    const panel = document.getElementById('auth-panel-forgot');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    const stepInput = document.getElementById('forgot-step-input');
    const stepVerify = document.getElementById('forgot-step-verify');
    if (stepInput) stepInput.style.display = 'block';
    if (stepVerify) stepVerify.style.display = 'none';
    document.getElementById('forgot-identifier')?.focus();
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

// 1. LOGIN WITH PASSWORD (MOBILE OR EMAIL)
async function handlePasswordLogin(e) {
  e.preventDefault();
  const ident = (document.getElementById('pwd-login-mobile').value || '').trim();
  const password = (document.getElementById('pwd-login-password').value || '').trim();

  if (!ident) {
    alert('Please enter your mobile number or email address');
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
      body: JSON.stringify({ identifier: ident, mobile: ident, email: ident, password: password })
    });
    const data = await res.json();
    if (res.ok) {
      const userKey = String(data.mobile || data.email || ident);
      localStorage.setItem('cricknova_user_phone', userKey);
      document.cookie = `cricknova_user=${encodeURIComponent(userKey)}; path=/; max-age=31536000; SameSite=Lax`;
      alert(`✅ ${data.message || 'Login successful!'}`);
      closeLoginModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Login failed'));
      // If user has no password yet, offer switch to OTP tab
      if (data.detail && data.detail.includes('no password set')) {
        switchAuthTab('otp');
        const otpMob = document.getElementById('otp-only-mobile');
        if (otpMob) otpMob.value = ident;
      }
    }
  } catch (err) {
    alert('Network error while logging in: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 LOGIN TO MY ACCOUNT';
  }
}

// 2. LOGIN WITH OTP (MOBILE OR EMAIL)
async function sendOtpOnly() {
  const ident = (document.getElementById('otp-only-mobile').value || '').trim();
  if (!ident) {
    alert('Please enter a valid mobile number or email address');
    return;
  }

  const btn = document.getElementById('btn-otp-only-send');
  btn.disabled = true;
  btn.innerText = 'REQUESTING OTP...';

  try {
    const isEmail = ident.includes('@');
    const endpoint = isEmail ? '/api/auth/email/send-otp' : '/api/auth/send-otp';
    const payload = isEmail ? { email: ident, purpose: 'LOGIN' } : { mobile: ident, purpose: 'LOGIN' };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    btn.innerText = 'REQUEST OTP CODE ✉️';
  }
}

async function completeOtpOnlyLogin() {
  const ident = (document.getElementById('otp-only-mobile').value || '').trim();
  const otp = (document.getElementById('otp-only-code').value || '').trim();
  const newPwd = (document.getElementById('otp-only-new-pwd').value || '').trim();

  if (!otp || otp.length < 4) {
    alert('Please enter the OTP code (Backup: 123456)');
    return;
  }

  const btn = document.getElementById('btn-otp-only-verify');
  btn.disabled = true;
  btn.innerText = 'VERIFYING...';

  try {
    const isEmail = ident.includes('@');
    const endpoint = isEmail ? '/api/auth/email/verify-otp' : '/api/auth/verify-otp';
    const payload = isEmail ? { email: ident, otp: otp, password: newPwd || undefined } : { mobile: ident, otp: otp, new_password: newPwd || undefined };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      const userKey = String(data.mobile || data.email || ident);
      localStorage.setItem('cricknova_user_phone', userKey);
      document.cookie = `cricknova_user=${encodeURIComponent(userKey)}; path=/; max-age=31536000; SameSite=Lax`;
      alert(`✅ ${data.message || 'Login successful!'}`);
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

// 3. FORGOT PASSWORD (MOBILE OR EMAIL)
async function sendForgotOtp() {
  const ident = (document.getElementById('forgot-identifier').value || '').trim();
  if (!ident) {
    alert('Please enter your registered mobile number or email address');
    return;
  }

  const btn = document.getElementById('btn-forgot-send');
  btn.disabled = true;
  btn.innerText = 'SENDING RESET OTP...';

  try {
    const isEmail = ident.includes('@');
    const endpoint = isEmail ? '/api/auth/email/send-otp' : '/api/auth/send-otp';
    const payload = isEmail ? { email: ident, purpose: 'RESET' } : { mobile: ident, purpose: 'RESET' };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('forgot-step-input').style.display = 'none';
      document.getElementById('forgot-step-verify').style.display = 'block';
      const codeInp = document.getElementById('forgot-otp');
      codeInp.value = data.test_otp || '123456';
      document.getElementById('forgot-new-pwd')?.focus();
    } else {
      alert('❌ ' + (data.detail || 'Failed to send reset OTP'));
    }
  } catch (err) {
    alert('Network error requesting reset OTP');
  } finally {
    btn.disabled = false;
    btn.innerText = 'SEND RESET OTP 📲';
  }
}

async function completeForgotPassword() {
  const ident = (document.getElementById('forgot-identifier').value || '').trim();
  const otp = (document.getElementById('forgot-otp').value || '').trim();
  const newPwd = (document.getElementById('forgot-new-pwd').value || '').trim();
  const confPwd = (document.getElementById('forgot-confirm-pwd').value || '').trim();

  if (!otp || otp.length < 4) {
    alert('Please enter the OTP code');
    return;
  }
  if (!newPwd || newPwd.length < 6) {
    alert('Password must be at least 6 characters long');
    return;
  }
  if (newPwd !== confPwd) {
    alert('Passwords do not match! Please verify both fields.');
    return;
  }

  const btn = document.getElementById('btn-forgot-submit');
  btn.disabled = true;
  btn.innerText = 'RESETTING PASSWORD...';

  try {
    const isEmail = ident.includes('@');
    const endpoint = isEmail ? '/api/auth/email/reset-password' : '/api/auth/verify-otp';
    const payload = isEmail ? { email: ident, otp: otp, new_password: newPwd } : { mobile: ident, otp: otp, new_password: newPwd };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      const userKey = String(data.mobile || data.email || ident);
      localStorage.setItem('cricknova_user_phone', userKey);
      document.cookie = `cricknova_user=${encodeURIComponent(userKey)}; path=/; max-age=31536000; SameSite=Lax`;
      alert(`✅ Password successfully reset! Logging you in...`);
      closeLoginModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Password reset failed'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🔒 RESET PASSWORD & LOGIN';
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
let activeYouPiDepositSession = null;

async function syncSliceDepositSession() {
  const amountInput = document.getElementById('deposit-amount-input');
  const amount = parseFloat(amountInput ? amountInput.value : 1000) || 1000;

  const displayAmt = document.getElementById('display-deposit-amount');
  if (displayAmt) displayAmt.innerText = '₹' + amount.toLocaleString('en-IN');

  const upiUri = `upi://pay?pa=9693554087@slc&pn=Tarana%20Nasreen&am=${amount.toFixed(2)}&cu=INR`;
  const btnApp = document.getElementById('btn-upi-app-intent');
  if (btnApp) btnApp.href = upiUri;

  try {
    const res = await fetch('/api/user/youpi/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      activeYouPiDepositSession = data;
      const btnHosted = document.getElementById('btn-hosted-checkout');
      if (btnHosted && data.checkout_url) {
        btnHosted.href = data.checkout_url;
      }
      if (btnApp && data.upi_intent_uri) {
        btnApp.href = data.upi_intent_uri;
      }
    }
  } catch (err) {
    console.log('[YouPI session sync notice]:', err.message);
  }
}

function openDepositModal() {
  if (!hasUserSession()) {
    alert('⚠️ Please login to your account to deposit money.');
    openLoginModal('login');
    return;
  }
  const modal = document.getElementById('deposit-modal');
  if (modal) {
    modal.classList.add('active');
    syncSliceDepositSession();
    loadRecentDepositsInModal();
  }
}

async function loadRecentDepositsInModal() {
  const container = document.getElementById('modal-deposit-history-list');
  if (!container) return;
  try {
    const res = await fetch('/api/user/deposit-history');
    if (!res.ok) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:6px; font-size:10.5px;">Sign in to view recent claims.</div>';
      return;
    }
    const data = await res.json();
    const deposits = data.deposits || [];
    if (deposits.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:6px; font-size:10.5px;">No recent deposit claims yet.</div>';
      return;
    }
    let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
    deposits.slice(0, 3).forEach(d => {
      const isApproved = d.status === 'APPROVED';
      const isDeclined = d.status === 'DECLINED';
      const color = isApproved ? '#00e676' : (isDeclined ? '#ef4444' : '#f5a623');
      const bg = isApproved ? 'rgba(0,230,118,0.15)' : (isDeclined ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)');
      const label = isApproved ? '✅ APPROVED' : (isDeclined ? '❌ DECLINED' : '⏳ PENDING REVIEW');
      const utrText = d.utr ? `UTR: ${d.utr}` : 'Verifying against Slice...';
      html += `
        <div style="background:var(--bg-darkest); border:1px solid var(--border-dark); border-radius:5px; padding:7px 10px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:900; color:#fff; font-size:12.5px;">₹${Number(d.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            <div style="font-size:10px; color:#94a3b8; font-family:monospace;">${d.id} • ${utrText}</div>
          </div>
          <span style="font-size:10px; font-weight:800; color:${color}; background:${bg}; border:1px solid ${color}; padding:2px 7px; border-radius:4px;">
            ${label}
          </span>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; font-size:10px; text-align:center;">Failed to load recent requests: ${err.message}</div>`;
  }
}

function closeDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.remove('active');
}

function onDepositAmountChange(val) {
  const amt = parseFloat(val) || 100;
  const displayAmt = document.getElementById('display-deposit-amount');
  if (displayAmt) displayAmt.innerText = '₹' + amt.toLocaleString('en-IN');
  const upiUri = `upi://pay?pa=9693554087@slc&pn=Tarana%20Nasreen&am=${amt.toFixed(2)}&cu=INR`;
  const btnApp = document.getElementById('btn-upi-app-intent');
  if (btnApp) btnApp.href = upiUri;
  syncSliceDepositSession();
}

function setQuickDeposit(amount) {
  const input = document.getElementById('deposit-amount-input');
  if (input) {
    input.value = amount;
    onDepositAmountChange(amount);
  }
}

async function autoExtractUtrFromReceipt(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const statusBox = document.getElementById('ocr-status-box');
  const utrInput = document.getElementById('deposit-utr-input');
  const previewBox = document.getElementById('screenshot-preview-box');
  const previewImg = document.getElementById('screenshot-preview-img');

  // Immediately display thumbnail preview of the screenshot
  if (previewBox && previewImg) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewBox.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  if (statusBox) {
    statusBox.style.display = 'block';
    statusBox.style.background = 'rgba(245, 166, 35, 0.15)';
    statusBox.style.border = '1px solid var(--winbuzz-gold)';
    statusBox.style.color = '#fde68a';
    statusBox.innerHTML = '⏳ <strong>Screenshot attached!</strong> Checking for UTR reference...';
  }

  try {
    // 1. Client-side Tesseract.js if available
    if (window.Tesseract) {
      const res = await Tesseract.recognize(file, 'eng');
      const text = res.data.text;
      const match = text.match(/(?:UTR|UPI Ref|Ref No|Txn ID|Transaction ID)[:\s]*([0-9]{12})/i) || text.match(/\b([0-9]{12})\b/);
      if (match && match[1]) {
        if (utrInput) utrInput.value = match[1];
        if (statusBox) {
          statusBox.style.background = 'rgba(0, 230, 118, 0.15)';
          statusBox.style.border = '1px solid #00e676';
          statusBox.style.color = '#00e676';
          statusBox.innerHTML = `✅ <strong>UTR Auto-Detected:</strong> <code style="font-size: 13px; font-weight: 900; letter-spacing: 1px;">${match[1]}</code>. Ready to submit!`;
        }
        return;
      }
    }

    if (statusBox) {
      statusBox.style.background = 'rgba(0, 230, 118, 0.15)';
      statusBox.style.border = '1px solid #00e676';
      statusBox.style.color = '#00e676';
      statusBox.innerHTML = `📸 <strong>Screenshot Attached!</strong> Click "SUBMIT DEPOSIT CLAIM" below to proceed.`;
    }
  } catch (err) {
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(0, 230, 118, 0.15)';
      statusBox.style.border = '1px solid #00e676';
      statusBox.style.color = '#00e676';
      statusBox.innerHTML = `📸 <strong>Screenshot Attached!</strong> Click "SUBMIT DEPOSIT CLAIM" below to proceed.`;
    }
  }
}

async function submitDepositRequestWithProof() {
  const amountInput = document.getElementById('deposit-amount-input');
  const utrInput = document.getElementById('deposit-utr-input');
  const fileInput = document.getElementById('deposit-receipt-file');
  const btn = document.getElementById('btn-submit-deposit-claim') || document.querySelector('#deposit-modal .btn-deposit');
  const resultBox = document.getElementById('deposit-result-box');

  const amount = parseFloat(amountInput ? amountInput.value : 100) || 100;
  const utr = utrInput ? utrInput.value.trim() : '';
  const hasProofFile = Boolean(fileInput && fileInput.files && fileInput.files[0]);

  if (isNaN(amount) || amount < 100) {
    alert('Please enter a valid deposit amount of at least ₹100');
    return;
  }
  if (!utr && !hasProofFile) {
    alert('Please enter the 12-digit UTR reference or upload your payment receipt screenshot.');
    if (utrInput) utrInput.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'SUBMITTING CLAIM...';
  }

  try {
    const submitPayload = {
      amount: amount,
      utr: utr || `PROOF${Date.now()}`,
      method: 'YouPI Slice UPI',
      notes: 'Customer deposit via Slice UPI (Tarana Nasreen: 9693554087@slc)'
    };
    if (activeYouPiDepositSession && activeYouPiDepositSession.request_id) {
      submitPayload.request_id = activeYouPiDepositSession.request_id;
    }

    if (hasProofFile) {
      const file = fileInput.files[0];
      const b64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
      if (b64) submitPayload.screenshot_base64 = b64;
    }

    const res = await fetch('/api/user/deposit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitPayload)
    });

    let data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      // Handle HTML or text error
    }

    if (res.status === 401) {
      alert('⚠️ Please login first to deposit money into your account.');
      window.location.href = '/login';
      return;
    }

    if (res.ok && data) {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(168, 85, 247, 0.12)';
        resultBox.style.border = '1px solid #a855f7';
        resultBox.style.color = '#e2e8f0';
        resultBox.innerHTML = `
          <div style="font-weight: 900; color: #c084fc; margin-bottom: 4px;">⏳ SLICE UPI CLAIM SUBMITTED (PENDING REVIEW)</div>
          <div>Request ID: <strong style="color: #fff;">${data.request.id}</strong></div>
          <div>Amount: <strong style="color: #c084fc;">₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></div>
          <div>UTR Claim: <code style="color: #fff;">${utr || data.request.utr}</code></div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            Your deposit request is pending verification. If Slice bank alert was captured, YouPI will auto-credit in seconds!
          </div>
        `;
      }
      alert(`✅ Deposit Claim of ₹${amount.toLocaleString('en-IN')} submitted successfully!\n\nStatus: PENDING REVIEW.\nYour deposit is registered and being verified against Slice.`);
      loadRecentDepositsInModal();
    } else {
      const errMsg = (data && (data.detail || data.message)) || `Server returned error status ${res.status}`;
      alert('❌ ' + errMsg);
    }
  } catch (err) {
    alert('Network error submitting deposit: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ SUBMIT DEPOSIT CLAIM';
    }
  }
}

// Backward compatibility alias
const submitDepositRequest = submitDepositRequestWithProof;

// ==================== 6. WITHDRAWAL ====================
function openWithdrawModal() {
  if (!hasUserSession()) {
    alert('⚠️ Please login to your account to withdraw money.');
    openLoginModal('login');
    return;
  }
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

  if (isNaN(amount) || amount < 500) {
    alert('Minimum withdrawal amount is ₹500');
    return;
  }

  try {
    const res = await fetch('/api/user/withdraw-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, destination: dest })
    });
    const data = await res.json();
    if (res.status === 401) {
      alert('Please login to request a withdrawal');
      window.location.href = '/login';
      return;
    }
    if (res.ok) {
      alert(`✅ Withdrawal request of ₹${amount.toLocaleString('en-IN')} submitted!\n\nStatus: PENDING REVIEW.\nFunds are reserved in your wallet while admin processes the manual bank transfer.`);
      closeWithdrawModal();
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Withdrawal failed'));
    }
  } catch (err) {
    alert('Network error during withdrawal: ' + err.message);
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
  if (!hasUserSession()) {
    alert('⚠️ Please login to your account to place bets.');
    openLoginModal('login');
    return;
  }
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
});

// ==================== 7. TRANSACTION HISTORY (DEPOSIT & WITHDRAWAL) ====================
let historyPollingTimer = null;
let currentHistoryTab = 'all';

function openHistoryModal(tab = 'all') {
  closeDepositModal();
  closeWithdrawModal();
  const modal = document.getElementById('history-modal');
  if (modal) {
    modal.classList.add('active');
    currentHistoryTab = tab;
    switchHistoryTab(tab, false);
    if (!historyPollingTimer) {
      historyPollingTimer = setInterval(() => {
        if (modal.classList.contains('active')) {
          switchHistoryTab(currentHistoryTab, true);
        } else {
          clearInterval(historyPollingTimer);
          historyPollingTimer = null;
        }
      }, 4000);
    }
  }
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.remove('active');
  if (historyPollingTimer) {
    clearInterval(historyPollingTimer);
    historyPollingTimer = null;
  }
}

async function switchHistoryTab(tab, isSilent = false) {
  currentHistoryTab = tab;
  const allBtn = document.getElementById('tab-btn-all-history');
  const depBtn = document.getElementById('tab-btn-deposit-history');
  const wthBtn = document.getElementById('tab-btn-withdraw-history');
  const container = document.getElementById('history-list-container');
  const loading = document.getElementById('history-loading');
  if (!isSilent && loading) loading.style.display = 'block';
  if (!isSilent && container) container.innerHTML = '';

  const phone = localStorage.getItem('cricknova_user_phone') || '';

  // Tab button styling
  [
    { btn: allBtn, active: tab === 'all' },
    { btn: depBtn, active: tab === 'deposit' },
    { btn: wthBtn, active: tab === 'withdraw' }
  ].forEach(({ btn, active }) => {
    if (btn) {
      btn.style.color = active ? '#fff' : '#94a3b8';
      btn.style.borderBottom = active ? '2px solid var(--winbuzz-gold)' : 'none';
    }
  });

  if (tab === 'all') {
    try {
      const url = phone ? `/api/user/transactions?phone=${encodeURIComponent(phone)}` : '/api/user/transactions';
      const res = await fetch(url);
      const data = await res.json();
      if (loading) loading.style.display = 'none';

      if (data.user_balance !== undefined) {
        const balHdr = document.getElementById('wallet-balance');
        const balMob = document.getElementById('android-wallet-val');
        const balAcc = document.getElementById('account-bal-val');
        if (balHdr) balHdr.innerText = '₹' + Number(data.user_balance).toLocaleString('en-IN', {minimumFractionDigits: 2});
        if (balMob) balMob.innerText = Number(data.user_balance).toLocaleString('en-IN', {maximumFractionDigits: 0});
        if (balAcc) balAcc.innerText = '₹' + Number(data.user_balance).toLocaleString('en-IN', {minimumFractionDigits: 2});
      }

      const txs = data.transactions || [];
      if (txs.length === 0) {
        if (container) container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#64748b; font-size:12px;">No transactions recorded in your ledger yet. Play games or deposit to view activity!</div>';
        return;
      }

      let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
      txs.forEach(t => {
        const typeStr = (t.type || 'TRANSACTION').toUpperCase();
        const isCredit = typeStr.includes('WIN') || typeStr.includes('DEPOSIT') || typeStr.includes('REFUND') || (t.amount > 0 && !typeStr.includes('BET') && !typeStr.includes('WITHDRAW'));
        const sign = isCredit ? '+' : '-';
        const amtColor = isCredit ? '#00e676' : '#f87171';

        let badgeLabel = '✅ COMPLETED';
        let badgeBg = 'rgba(0,230,118,0.12)';
        let badgeColor = '#00e676';

        if (t.status === 'PENDING') {
          badgeLabel = '⏳ PENDING';
          badgeBg = 'rgba(245,166,35,0.15)';
          badgeColor = '#f5a623';
        } else if (t.status === 'DECLINED' || t.status === 'FAILED') {
          badgeLabel = '❌ FAILED';
          badgeBg = 'rgba(239,68,68,0.15)';
          badgeColor = '#ef4444';
        }

        let icon = '⚡';
        if (typeStr.includes('CRICKET')) icon = '🏏';
        else if (typeStr.includes('CASINO') || typeStr.includes('ROULETTE') || typeStr.includes('JHANDI')) icon = '🎰';
        else if (typeStr.includes('AVIATOR')) icon = '✈️';
        else if (typeStr.includes('WITHDRAW')) icon = '💳';
        else if (typeStr.includes('DEPOSIT')) icon = '💰';

        const absAmt = Math.abs(Number(t.amount || 0));

        html += `
          <div style="background:var(--bg-darkest); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-family:monospace; color:var(--winbuzz-gold); font-weight:800; font-size:11px;">
                ${icon} ${typeStr.replace('_', ' ')}
              </span>
              <span style="font-size:10px; padding:2px 7px; border-radius:4px; font-weight:800; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor};">
                ${badgeLabel}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:14px; font-weight:900; color:${amtColor}; font-family:'JetBrains Mono', monospace;">
                ${sign}₹${absAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}
              </span>
              <span style="font-size:10.5px; color:#94a3b8;">${t.created_at || t.timestamp || ''}</span>
            </div>
            ${t.game_or_market || t.description ? `<div style="font-size:11px; color:#cbd5e1; margin-top:3px;">${t.game_or_market || t.description}</div>` : ''}
            ${t.ref_id ? `<div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:2px;">Ref: ${t.ref_id}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
      if (container) container.innerHTML = html;
    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (container) container.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center;">Failed to load transactions: ${e.message}</div>`;
    }
  } else if (tab === 'deposit') {
    try {
      const url = phone ? `/api/user/deposit-history?phone=${encodeURIComponent(phone)}` : '/api/user/deposit-history';
      const res = await fetch(url);
      const data = await res.json();
      if (loading) loading.style.display = 'none';

      // Update live wallet balance if returned
      if (data.user_balance !== undefined) {
        const balHdr = document.getElementById('wallet-balance');
        const balMob = document.getElementById('android-wallet-val');
        const balAcc = document.getElementById('account-bal-val');
        if (balHdr) balHdr.innerText = '₹' + Number(data.user_balance).toLocaleString('en-IN', {minimumFractionDigits: 2});
        if (balMob) balMob.innerText = Number(data.user_balance).toLocaleString('en-IN', {maximumFractionDigits: 0});
        if (balAcc) balAcc.innerText = '₹' + Number(data.user_balance).toLocaleString('en-IN', {minimumFractionDigits: 2});
      }

      const deposits = data.deposits || [];
      if (deposits.length === 0) {
        if (container) container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#64748b; font-size:12px;">No deposit requests found yet.</div>';
        return;
      }
      let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
      deposits.forEach(d => {
        const isApproved = d.status === 'APPROVED';
        const isDeclined = d.status === 'DECLINED';
        const badgeColor = isApproved ? '#00e676' : (isDeclined ? '#ef4444' : '#f5a623');
        const badgeBg = isApproved ? 'rgba(0,230,118,0.15)' : (isDeclined ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)');
        const badgeLabel = isApproved ? '✅ APPROVED & CREDITED' : (isDeclined ? '❌ DECLINED' : '⏳ PENDING VERIFICATION');
        html += `
          <div style="background:var(--bg-darkest); border:1px solid ${isApproved ? 'rgba(0,230,118,0.3)' : 'var(--border-dark)'}; border-radius:6px; padding:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-family:monospace; color:var(--winbuzz-gold); font-weight:800;">${d.id || 'DEP'}</span>
              <span style="font-size:10.5px; padding:2px 8px; border-radius:4px; font-weight:800; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor};">
                ${badgeLabel}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:15px; font-weight:900; color:#fff;">₹${Number(d.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              <span style="font-size:11px; color:#94a3b8;">${d.created_at || ''}</span>
            </div>
            <div style="font-size:11px; color:#94a3b8; font-family:monospace;">
              Ref/UTR: <span style="color:#e2e8f0; font-weight:700;">${d.utr || '—'}</span>
            </div>
            <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
              Payee: ${d.receiving_payee || 'Tarana Nasreen'} (${d.receiving_vpa || '9693554087@slc'})
            </div>
            ${d.approved_at ? `<div style="font-size:10.5px; color:#00e676; margin-top:4px; font-weight:700;">Credited to Wallet on ${d.approved_at}</div>` : ''}
            ${d.decline_reason ? `<div style="font-size:10.5px; color:#ef4444; margin-top:4px;">Notice: ${d.decline_reason}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
      if (container) container.innerHTML = html;
    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (container) container.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center;">Failed to load deposits: ${e.message}</div>`;
    }
  } else {
    try {
      const url = phone ? `/api/user/withdrawal-history?phone=${encodeURIComponent(phone)}` : '/api/user/withdrawal-history';
      const res = await fetch(url);
      const data = await res.json();
      if (loading) loading.style.display = 'none';
      const wths = data.withdrawals || [];
      if (wths.length === 0) {
        if (container) container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#64748b; font-size:12px;">No withdrawal requests found yet.</div>';
        return;
      }
      let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
      wths.forEach(w => {
        const isPaid = (w.status === 'PAID' || w.status === 'COMPLETED');
        const isDeclined = w.status === 'DECLINED';
        const badgeColor = isPaid ? '#00e676' : (isDeclined ? '#ef4444' : '#f5a623');
        const badgeBg = isPaid ? 'rgba(0,230,118,0.15)' : (isDeclined ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)');
        const badgeLabel = isPaid ? '✅ PAID TO BANK' : (isDeclined ? '❌ DECLINED' : '⏳ PENDING PAYOUT');
        html += `
          <div style="background:var(--bg-darkest); border:1px solid ${isPaid ? 'rgba(0,230,118,0.3)' : 'var(--border-dark)'}; border-radius:6px; padding:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-family:monospace; color:var(--winbuzz-gold); font-weight:800;">${w.id || 'WTH'}</span>
              <span style="font-size:10.5px; padding:2px 8px; border-radius:4px; font-weight:800; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor};">
                ${badgeLabel}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:15px; font-weight:900; color:#fff;">₹${Number(w.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              <span style="font-size:11px; color:#94a3b8;">${w.created_at || ''}</span>
            </div>
            <div style="font-size:11px; color:#94a3b8;">
              Account: <span style="color:#e2e8f0; font-family:monospace;">${w.bank_account_masked || 'Bank'}</span> (${w.bank_holder_name || ''})
            </div>
            ${w.payout_bank_utr ? `<div style="font-size:11px; color:#00e676; margin-top:3px; font-family:monospace; font-weight:700;">Bank Transfer UTR: ${w.payout_bank_utr}</div>` : ''}
            ${w.decline_reason ? `<div style="font-size:10.5px; color:#ef4444; margin-top:4px;">Reason: ${w.decline_reason}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
      if (container) container.innerHTML = html;
    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (container) container.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center;">Failed to load withdrawals: ${e.message}</div>`;
    }
  }
}

// Modal backdrop click handler
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ==================== 8. ACCOUNT SCREEN LIVE STATEMENT & SESSION PERSISTENCE ====================
async function loadAccountScreenHistory(phoneOverride = null) {
  const container = document.getElementById('account-screen-history-list');
  if (!container) return;
  const phone = phoneOverride || localStorage.getItem('cricknova_user_phone') || '';
  const txUrl = phone ? `/api/user/transactions?phone=${encodeURIComponent(phone)}` : '/api/user/transactions';

  try {
    const res = await fetch(txUrl);
    if (res.ok) {
      const data = await res.json();
      const txs = data.transactions || [];
      if (txs.length > 0) {
        let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
        txs.slice(0, 6).forEach(t => {
          const typeStr = (t.type || 'TRANSACTION').toUpperCase();
          const isCredit = typeStr.includes('WIN') || typeStr.includes('DEPOSIT') || typeStr.includes('REFUND') || (t.amount > 0 && !typeStr.includes('BET') && !typeStr.includes('WITHDRAW'));
          const sign = isCredit ? '+' : '-';
          const amtColor = isCredit ? '#00e676' : '#f87171';
          const absAmt = Math.abs(Number(t.amount || 0));

          let icon = '⚡';
          if (typeStr.includes('CRICKET')) icon = '🏏';
          else if (typeStr.includes('CASINO') || typeStr.includes('ROULETTE') || typeStr.includes('JHANDI')) icon = '🎰';
          else if (typeStr.includes('AVIATOR')) icon = '✈️';
          else if (typeStr.includes('WITHDRAW')) icon = '💳';
          else if (typeStr.includes('DEPOSIT')) icon = '💰';

          html += `
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:6px; padding:10px; font-size:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-family:monospace; color:var(--winbuzz-gold); font-weight:800; font-size:11px;">
                  ${icon} ${typeStr.replace('_', ' ')}
                </span>
                <span style="font-size:10px; font-weight:800; color:#00e676; background:rgba(0,230,118,0.12); padding:2px 7px; border-radius:3px;">
                  ${t.status || 'COMPLETED'}
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:900; color:${amtColor}; font-family:'JetBrains Mono', monospace;">
                  ${sign}₹${absAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </span>
                <span style="font-size:10.5px; color:#94a3b8;">${t.created_at || t.timestamp || ''}</span>
              </div>
              ${t.game_or_market || t.description ? `<div style="font-size:10.5px; color:#cbd5e1; margin-top:2px;">${t.game_or_market || t.description}</div>` : ''}
            </div>
          `;
        });
        html += '</div>';
        container.innerHTML = html;
        return;
      }
    }

    // Fallback to deposit-history
    const depUrl = phone ? `/api/user/deposit-history?phone=${encodeURIComponent(phone)}` : '/api/user/deposit-history';
    const depRes = await fetch(depUrl);
    if (!depRes.ok) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:10px;">Please login to view your transaction statement.</div>';
      return;
    }
    const depData = await depRes.json();
    const deposits = depData.deposits || [];
    if (deposits.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:12px;">No transactions registered yet.</div>';
      return;
    }
    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    deposits.forEach(d => {
      const isApproved = d.status === 'APPROVED';
      const isDeclined = d.status === 'DECLINED';
      const color = isApproved ? '#00e676' : (isDeclined ? '#ef4444' : '#f5a623');
      const bg = isApproved ? 'rgba(0,230,118,0.15)' : (isDeclined ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)');
      const label = isApproved ? '✅ APPROVED & CREDITED' : (isDeclined ? '❌ DECLINED' : '⏳ PENDING REVIEW');
      const utrText = d.utr ? `UTR: ${d.utr}` : 'Verifying with Slice...';
      html += `
        <div style="background:rgba(255,255,255,0.03); border:1px solid ${isApproved ? 'rgba(0,230,118,0.3)' : 'var(--border-dark)'}; border-radius:6px; padding:10px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-family:monospace; color:var(--winbuzz-gold); font-weight:800;">${d.id}</span>
            <span style="font-size:10px; font-weight:800; color:${color}; background:${bg}; border:1px solid ${color}; padding:2px 7px; border-radius:3px;">
              ${label}
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:900; color:#fff;">₹${Number(d.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            <span style="font-size:10.5px; color:#94a3b8;">${d.created_at || ''}</span>
          </div>
          <div style="font-size:10.5px; color:#cbd5e1; font-family:monospace; margin-top:3px;">
            ${utrText}
          </div>
          ${d.approved_at ? `<div style="font-size:10px; color:#00e676; margin-top:2px; font-weight:700;">Credited to Wallet on ${d.approved_at}</div>` : ''}
          ${d.decline_reason ? `<div style="font-size:10px; color:#ef4444; margin-top:2px;">${d.decline_reason}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; font-size:11px; text-align:center;">Failed to load statement: ${err.message}</div>`;
  }
}

async function doQuickAccountLogin() {
  const phone = document.getElementById('quick-login-phone')?.value.trim();
  const pwd = document.getElementById('quick-login-pwd')?.value.trim();
  if (!phone) return alert('Please enter your mobile number');
  if (!pwd) return alert('Please enter your password');

  try {
    const res = await fetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: phone, password: pwd })
    });
    const data = await res.json();
    if (res.ok) {
      const userMob = String(data.mobile || phone).replace(/\D/g, '').slice(-10);
      localStorage.setItem('cricknova_user_phone', userMob);
      document.cookie = `cricknova_user=${userMob}; path=/; max-age=31536000; SameSite=Lax`;
      alert('🎉 ' + data.message);
      window.location.reload();
    } else {
      alert('❌ ' + (data.detail || 'Login failed'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

function lookupClaimsByPhone() {
  const phone = prompt('Enter your 10-digit mobile number to view your deposit claims:');
  if (!phone) return;
  loadAccountScreenHistory(phone.trim());
}

// Automatic silent session recovery on page load (Mobile WebView & Desktop)
document.addEventListener('DOMContentLoaded', () => {
  const savedPhone = localStorage.getItem('cricknova_user_phone');
  if (savedPhone) {
    if (!document.cookie.includes('cricknova_user=')) {
      document.cookie = `cricknova_user=${savedPhone}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const guestBox = document.getElementById('account-login-box') || document.querySelector('.btn-login-hdr');
    const userBadge = document.querySelector('.user-badge-header') || document.getElementById('account-phone-val');
    if (!userBadge && guestBox) {
      fetch('/api/auth/silent-restore?phone=' + encodeURIComponent(savedPhone))
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success') {
            document.cookie = `cricknova_user=${data.mobile || savedPhone}; path=/; max-age=31536000; SameSite=Lax`;
            window.location.reload();
          } else if (data.status === 'error' && data.message && data.message.includes('Blocked')) {
            localStorage.removeItem('cricknova_user_phone');
            document.cookie = 'cricknova_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
            alert('⛔ Account is Blocked by Admin');
            window.location.reload();
          }
        }).catch(() => {});
    }
  }
  loadAccountScreenHistory();
});

// Explicit Global Window Exports for Inline HTML Onclick Handlers
window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;
window.switchHistoryTab = switchHistoryTab;
window.loadAccountScreenHistory = loadAccountScreenHistory;
window.doQuickAccountLogin = doQuickAccountLogin;
window.lookupClaimsByPhone = lookupClaimsByPhone;
