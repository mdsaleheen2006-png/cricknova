/**
 * CrickNova Unified Real-Time Wallet Client
 * Connects to /ws/wallet and updates all balance readouts instantly on any balance change.
 */
(function() {
  'use strict';

  function formatMoney(amount) {
    var n = Number(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatMoneyRound(amount) {
    var n = Number(amount) || 0;
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function updateDomBalances(balance, available, exposure) {
    var formatted = formatMoney(balance);
    var formattedRound = formatMoneyRound(balance);

    // Update common IDs and Classes
    var targets = [
      '#wallet-balance',
      '#mobile-wallet-val',
      '#account-bal-val',
      '#drawer-balance',
      '#balanceText',
      '#balance',
      '#room-wallet-val',
      '#header-wallet-balance',
      '#betslip-available-bal'
    ];

    targets.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (el.tagName === 'INPUT') {
          el.value = balance;
        } else {
          el.innerText = formatted;
        }
      });
    });

    document.querySelectorAll('.android-wallet-val').forEach(function(el) {
      el.innerText = formattedRound;
    });

    document.querySelectorAll('.wallet-val').forEach(function(el) {
      el.innerText = formatted;
    });

    // Notify custom components (e.g. 3D Jhandi Munda, Aviator, etc.)
    window.dispatchEvent(new CustomEvent('cricknova:wallet_updated', {
      detail: {
        balance: Number(balance),
        available: Number(available !== undefined ? available : balance),
        exposure: Number(exposure || 0)
      }
    }));
  }

  function pollBalanceFallback() {
    fetch('/api/user/wallet', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.status === 'success' && typeof data.balance === 'number') {
          updateDomBalances(data.balance, data.available, data.exposure);
        }
      })
      .catch(function() {});
  }

  var ws = null;
  var reconnectTimer = null;

  function connectWalletSocket() {
    try {
      var protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
      var wsUrl = protocol + location.host + '/ws/wallet';
      ws = new WebSocket(wsUrl);

      ws.onopen = function() {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      ws.onmessage = function(event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg && msg.type === 'WALLET_SYNC' && typeof msg.balance === 'number') {
            updateDomBalances(msg.balance, msg.available, msg.exposure);
          }
        } catch(e) {}
      };

      ws.onclose = function() {
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(connectWalletSocket, 3000);
        }
      };

      ws.onerror = function() {
        try { ws.close(); } catch(e) {}
      };
    } catch(err) {
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(connectWalletSocket, 4000);
      }
    }
  }

  // Periodic safety check every 10 seconds or on window focus
  setInterval(pollBalanceFallback, 10000);
  window.addEventListener('focus', pollBalanceFallback);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      connectWalletSocket();
      pollBalanceFallback();
    });
  } else {
    connectWalletSocket();
    pollBalanceFallback();
  }

  // Expose global updater
  window.CricknovaWallet = {
    update: updateDomBalances,
    refresh: pollBalanceFallback
  };
})();
