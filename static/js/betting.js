// ========================================================
// WINBUZZ BETTING & TURBO CASH-OUT ENGINE
// True Exchange Math (Barabar Zero) + Instant Balance Flow
// ========================================================

class BettingEngine {
  constructor() {
    this.currentBet = null;
    this.audioCtx = null;
    this.initEventListeners();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBeep(type = 'click') {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'win') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'place') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      }
    } catch (e) {
      // Audio not permitted or suspended
    }
  }

  initEventListeners() {
    // Odds Box Clicks
    document.addEventListener('click', (e) => {
      const oddsBox = e.target.closest('.odds-box');
      if (oddsBox) {
        const matchId = oddsBox.dataset.matchId;
        const runner = oddsBox.dataset.runner;
        const type = oddsBox.dataset.type; // back or lay
        const odds = parseFloat(oddsBox.querySelector('.odds-price').innerText);
        const marketType = oddsBox.dataset.marketType || 'match_odds';
        this.openBetSlip(matchId, runner, type, odds, marketType);
      }

      // Quick Chips Clicks
      const chipBtn = e.target.closest('.chip-btn');
      if (chipBtn && this.currentBet) {
        const val = chipBtn.dataset.val;
        if (val === 'MAX') {
          const avail = parseFloat(document.getElementById('wallet-balance').dataset.raw || 50000);
          this.setStake(Math.floor(avail));
        } else {
          const add = parseInt(val, 10);
          this.setStake((this.currentBet.stake || 0) + add);
        }
        this.playBeep('click');
      }

      // Turbo Cashout Clicks
      const cashoutBtn = e.target.closest('.cashout-btn');
      if (cashoutBtn) {
        const betId = cashoutBtn.dataset.betId;
        this.executeTurboCashout(betId, cashoutBtn);
      }
    });
  }

  openBetSlip(matchId, runner, type, odds, marketType = 'match_odds') {
    this.playBeep('click');
    if (typeof switchDeskTab === 'function') {
      switchDeskTab('betslip');
    }
    this.currentBet = {
      matchId: String(matchId),
      runner: runner,
      type: type,
      odds: odds,
      stake: 500, // default ₹500
      marketType: marketType
    };

    const drawer = document.getElementById('betslip-container');
    if (!drawer) return;

    drawer.innerHTML = `
      <div class="betslip-card">
        <div class="betslip-header">
          <span class="betslip-title">BET SLIP • ${this.currentBet.runner}</span>
          <button class="modal-close" onclick="window.bettingEngine.closeBetSlip()">✕</button>
        </div>
        <div class="betslip-body">
          <div class="bet-type-toggle">
            <button class="toggle-btn ${this.currentBet.type === 'back' ? 'back-active' : ''}" onclick="window.bettingEngine.switchType('back')">BACK</button>
            <button class="toggle-btn ${this.currentBet.type === 'lay' ? 'lay-active' : ''}" onclick="window.bettingEngine.switchType('lay')">LAY</button>
          </div>

          <div>
            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700;">ODDS RATE</label>
            <div class="input-stepper" style="margin-top: 4px;">
              <button class="step-btn" onclick="window.bettingEngine.adjustOdds(-0.01)">-</button>
              <input type="number" step="0.01" class="step-input" id="betslip-odds-input" value="${this.currentBet.odds.toFixed(2)}" onchange="window.bettingEngine.setOdds(this.value)">
              <button class="step-btn" onclick="window.bettingEngine.adjustOdds(0.01)">+</button>
            </div>
          </div>

          <div>
            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700;">STAKE (₹)</label>
            <div class="input-stepper" style="margin-top: 4px;">
              <button class="step-btn" onclick="window.bettingEngine.adjustStake(-100)">-</button>
              <input type="number" class="step-input" id="betslip-stake-input" value="${this.currentBet.stake}" onchange="window.bettingEngine.setStake(this.value)">
              <button class="step-btn" onclick="window.bettingEngine.adjustStake(100)">+</button>
            </div>
          </div>

          <div class="quick-chips-row">
            <button class="chip-btn" data-val="100">+100</button>
            <button class="chip-btn" data-val="500">+500</button>
            <button class="chip-btn" data-val="1000">+1K</button>
            <button class="chip-btn" data-val="5000">+5K</button>
            <button class="chip-btn" data-val="10000">+10K</button>
            <button class="chip-btn" data-val="25000">+25K</button>
            <button class="chip-btn" data-val="MAX" style="grid-column: span 2; color: var(--winbuzz-gold);">MAX BET</button>
          </div>

          <div class="bet-summary-box">
            <div>
              <div style="color: var(--text-muted); font-size: 10px;">POTENTIAL PROFIT</div>
              <div class="val-profit" id="betslip-profit">₹0.00</div>
            </div>
            <div style="text-align: right;">
              <div style="color: var(--text-muted); font-size: 10px;">LIABILITY DEDUCTION</div>
              <div class="val-liability" id="betslip-liability">₹0.00</div>
            </div>
          </div>

          <button class="btn-place-bet" id="btn-submit-bet" onclick="window.bettingEngine.submitBet()">
            PLACE BET NOW
          </button>
        </div>
      </div>
    `;

    this.updateSlipCalculations();
  }

  closeBetSlip() {
    this.currentBet = null;
    const drawer = document.getElementById('betslip-container');
    if (drawer) {
      drawer.innerHTML = `
        <div class="betslip-card">
          <div class="betslip-header">
            <span class="betslip-title">BET SLIP</span>
          </div>
          <div class="betslip-empty">Click any Back or Lay odds box to place an exchange bet</div>
        </div>
      `;
    }
  }

  switchType(type) {
    if (!this.currentBet) return;
    this.currentBet.type = type;
    const backBtn = document.querySelector('.toggle-btn:nth-child(1)');
    const layBtn = document.querySelector('.toggle-btn:nth-child(2)');
    if (backBtn && layBtn) {
      backBtn.className = `toggle-btn ${type === 'back' ? 'back-active' : ''}`;
      layBtn.className = `toggle-btn ${type === 'lay' ? 'lay-active' : ''}`;
    }
    this.updateSlipCalculations();
  }

  adjustOdds(delta) {
    if (!this.currentBet) return;
    this.currentBet.odds = Math.max(1.01, +(this.currentBet.odds + delta).toFixed(2));
    const input = document.getElementById('betslip-odds-input');
    if (input) input.value = this.currentBet.odds.toFixed(2);
    this.updateSlipCalculations();
  }

  setOdds(val) {
    if (!this.currentBet) return;
    this.currentBet.odds = Math.max(1.01, +(parseFloat(val) || 1.01).toFixed(2));
    this.updateSlipCalculations();
  }

  adjustStake(delta) {
    if (!this.currentBet) return;
    this.setStake(Math.max(50, (this.currentBet.stake || 0) + delta));
  }

  setStake(val) {
    if (!this.currentBet) return;
    this.currentBet.stake = Math.max(50, parseInt(val, 10) || 50);
    const input = document.getElementById('betslip-stake-input');
    if (input) input.value = this.currentBet.stake;
    this.updateSlipCalculations();
  }

  updateSlipCalculations() {
    if (!this.currentBet) return;
    const stake = this.currentBet.stake;
    const odds = this.currentBet.odds;
    const type = this.currentBet.type;

    let profit = 0;
    let liability = 0;

    if (type === 'back') {
      profit = stake * (odds - 1.0);
      liability = stake;
    } else {
      profit = stake;
      liability = stake * (odds - 1.0);
    }

    const profitEl = document.getElementById('betslip-profit');
    const liabilityEl = document.getElementById('betslip-liability');

    if (profitEl) profitEl.innerText = `+₹${Math.round(profit).toLocaleString('en-IN')}`;
    if (liabilityEl) liabilityEl.innerText = `-₹${Math.round(liability).toLocaleString('en-IN')}`;
  }

  async submitBet() {
    if (!this.currentBet) return;
    const submitBtn = document.getElementById('btn-submit-bet');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'PROCESSING BET...';
    }

    try {
      const res = await fetch('/api/bet/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentBet)
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || 'Failed to place bet');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'PLACE BET NOW';
        }
        return;
      }

      this.playBeep('place');

      // 1. Instant Balance & Exposure UI Update
      this.updateWalletUI(data.balance, data.exposure, -data.bet.liability);

      // 2. Update Runner Book P&L (Barabar Zero Math)
      if (data.book) {
        this.updateRunnerBookUI(data.bet.match_id, data.book);
      }

      // 3. Add to Open Bets UI
      this.addOpenBetToUI(data.bet);

      // 4. Reset betslip
      this.closeBetSlip();

    } catch (err) {
      console.error(err);
      alert('Network error while placing bet');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'PLACE BET NOW';
      }
    }
  }

  async executeTurboCashout(betId, btnElement) {
    if (!confirm('Execute instant Turbo Cash-Out for this bet?')) return;

    btnElement.disabled = true;
    btnElement.innerHTML = '<span>⚡ CASHING OUT...</span>';

    try {
      const res = await fetch('/api/bet/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet_id: betId })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || 'Cashout failed');
        btnElement.disabled = false;
        btnElement.innerHTML = '<span>⚡ TURBO CASH-OUT</span>';
        return;
      }

      this.playBeep('win');

      // 1. Update wallet balance & exposure with floating credit chip
      this.updateWalletUI(data.balance, data.exposure, data.cashout_payout);

      // 2. Update Runner Book
      if (data.book) {
        this.updateRunnerBookUI(btnElement.dataset.matchId, data.book);
      }

      // 3. Remove or mark bet as Cashed out
      const betCard = btnElement.closest('.open-bet-item');
      if (betCard) {
        betCard.style.opacity = '0.6';
        betCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; color: var(--winbuzz-gold);">⚡ CASHED OUT</span>
            <span style="color: var(--color-green); font-weight: 900;">+₹${data.cashout_payout.toLocaleString('en-IN')}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            Net Profit: ${data.net_profit >= 0 ? '+' : ''}₹${data.net_profit.toLocaleString('en-IN')}
          </div>
        `;
      }

    } catch (err) {
      console.error(err);
      alert('Error during cashout');
      btnElement.disabled = false;
    }
  }

  updateWalletUI(newBalance, newExposure, deltaAmount = 0) {
    const balEl = document.getElementById('wallet-balance');
    const expEl = document.getElementById('wallet-exposure');

    if (balEl) {
      balEl.dataset.raw = newBalance;
      balEl.innerText = `₹${Math.round(newBalance).toLocaleString('en-IN')}`;
    }

    if (expEl) {
      expEl.innerText = `₹${Math.round(newExposure).toLocaleString('en-IN')}`;
    }

    // Trigger Floating Toast Chip
    if (deltaAmount !== 0) {
      const chipContainer = document.querySelector('.wallet-chip');
      if (chipContainer) {
        const toast = document.createElement('div');
        toast.className = `balance-toast ${deltaAmount > 0 ? 'credit' : 'deduct'}`;
        toast.innerText = `${deltaAmount > 0 ? '+' : ''}₹${Math.abs(Math.round(deltaAmount)).toLocaleString('en-IN')}`;
        chipContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
      }
    }
  }

  updateRunnerBookUI(matchId, book) {
    for (const [runner, pnl] of Object.entries(book)) {
      const runnerClean = runner.replace(/[^a-zA-Z0-9]/g, '_');
      const pnlEls = document.querySelectorAll(`.pnl-${matchId}-${runnerClean}`);
      pnlEls.forEach(el => {
        let cls = 'zero';
        let prefix = '';
        if (pnl > 0) {
          cls = 'positive';
          prefix = '+';
        } else if (pnl < 0) {
          cls = 'negative';
        }
        el.className = `runner-book-pnl ${cls} pnl-${matchId}-${runnerClean}`;
        el.innerText = `${prefix}₹${pnl.toFixed(2)}`;
      });
    }
  }

  addOpenBetToUI(bet) {
    const container = document.getElementById('open-bets-list');
    if (!container) return;

    // Remove empty notice if present
    const emptyNotice = container.querySelector('.betslip-empty');
    if (emptyNotice) emptyNotice.remove();

    const item = document.createElement('div');
    item.className = 'open-bet-item';
    item.innerHTML = `
      <div class="open-bet-top">
        <span class="bet-badge ${bet.type}">${bet.type.toUpperCase()}</span>
        <span style="font-size: 11px; font-weight: 800; color: #fff;">${bet.runner}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
        <span>Odds: <strong style="color: #fff;">${bet.odds}</strong></span>
        <span>Stake: <strong style="color: #fff;">₹${bet.stake}</strong></span>
        <span>Liab: <strong style="color: var(--color-red);">₹${bet.liability}</strong></span>
      </div>
      <button class="btn-turbo-cashout cashout-btn"
              data-bet-id="${bet.id}"
              data-match-id="${bet.match_id}"
              data-runner="${bet.runner}"
              data-orig-odds="${bet.odds}"
              data-stake="${bet.stake}">
        <span>⚡ TURBO CASH-OUT</span>
        <span class="cashout-payout">₹${bet.stake}</span>
      </button>
    `;

    container.prepend(item);
    const countBadge = document.getElementById('desk-open-count');
    if (countBadge) {
      const items = container.querySelectorAll('.open-bet-item');
      countBadge.innerText = items.length;
    }
  }
}

// Global instance
window.bettingEngine = new BettingEngine();
