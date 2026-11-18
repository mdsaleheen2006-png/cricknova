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

  // If opening Account tab, refresh user profile and transaction feed
  if (tabName === 'account') {
    checkAuthStatus();
    loadAccountScreenHistory();
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

// ==================== 7. TRANSACTION HISTORY (DEPOSIT & WITHDRAWAL) ====================
let historyPollingTimer = null;
let currentHistoryTab = 'deposit';

function openHistoryModal(tab = 'deposit') {
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
  const depBtn = document.getElementById('tab-btn-deposit-history');
  const wthBtn = document.getElementById('tab-btn-withdraw-history');
  const container = document.getElementById('history-list-container');
  const loading = document.getElementById('history-loading');
  if (!isSilent && loading) loading.style.display = 'block';
  if (!isSilent && container) container.innerHTML = '';

  if (tab === 'deposit') {
    if (depBtn) {
      depBtn.style.color = '#fff';
      depBtn.style.borderBottom = '2px solid var(--winbuzz-gold)';
    }
    if (wthBtn) {
      wthBtn.style.color = '#94a3b8';
      wthBtn.style.borderBottom = 'none';
    }
    try {
      const res = await fetch('/api/user/deposit-history');
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
    if (depBtn) {
      depBtn.style.color = '#94a3b8';
      depBtn.style.borderBottom = 'none';
    }
    if (wthBtn) {
      wthBtn.style.color = '#fff';
      wthBtn.style.borderBottom = '2px solid var(--winbuzz-gold)';
    }
    try {
      const res = await fetch('/api/user/withdrawal-history');
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
  const url = phone ? `/api/user/deposit-history?phone=${encodeURIComponent(phone)}` : '/api/user/deposit-history';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:10px;">Please login to view your transaction statement.</div>';
      return;
    }
    const data = await res.json();
    const deposits = data.deposits || [];
    if (deposits.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:12px;">No deposit requests registered yet.</div>';
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
      if (data.mobile) {
        localStorage.setItem('cricknova_user_phone', data.mobile);
      }
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

// Automatic silent session recovery on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedPhone = localStorage.getItem('cricknova_user_phone');
  if (savedPhone) {
    const phoneHeader = document.getElementById('account-phone-val');
    if (!phoneHeader) {
      fetch('/api/auth/silent-restore?phone=' + encodeURIComponent(savedPhone))
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success') {
            window.location.reload();
          }
        }).catch(() => {});
    }
  }
  loadAccountScreenHistory();
});
});
