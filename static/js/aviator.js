// ========================================================
// WINBUZZ AVIATOR CRASH GAME (CANVAS ENGINE)
// ========================================================

class AviatorGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.multiplier = 1.00;
    this.gameState = 'IDLE'; // IDLE, FLYING, CRASHED
    this.crashPoint = 2.00;
    this.betActive = false;
    this.stake = 200;
    this.history = [1.45, 2.10, 1.15, 7.82, 1.95, 3.40];
    this.animId = null;

    this.initControls();
    this.startRoundCountdown();
  }

  initControls() {
    const cashoutBtn = document.getElementById('aviator-cashout-btn');
    if (cashoutBtn) {
      cashoutBtn.addEventListener('click', () => this.cashout());
    }

    const betBtn = document.getElementById('aviator-bet-btn');
    if (betBtn) {
      betBtn.addEventListener('click', () => this.toggleBet());
    }
  }

  startRoundCountdown() {
    this.gameState = 'WAITING';
    this.multiplier = 1.00;
    let secondsLeft = 4;

    const timer = setInterval(() => {
      this.drawWaiting(secondsLeft);
      secondsLeft--;
      if (secondsLeft < 0) {
        clearInterval(timer);
        this.startFlight();
      }
    }, 1000);
  }

  async startFlight() {
    this.gameState = 'FLYING';
    this.multiplier = 1.00;
    // Weighted crash point generator
    const r = Math.random();
    if (r < 0.2) this.crashPoint = 1.05 + Math.random() * 0.4; // early crash
    else if (r < 0.7) this.crashPoint = 1.5 + Math.random() * 2.5; // mid
    else this.crashPoint = 4.0 + Math.random() * 12.0; // high flyer

    if (this.betActive) {
      try {
        const betRes = await fetch('/api/casino/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: 'aviator',
            amount: this.stake,
            bet_details: { stake: this.stake }
          })
        });
        const betData = await betRes.json();
        if (!betRes.ok) {
          this.betActive = false;
          this.updateCashoutButton(false);
          const btn = document.getElementById('aviator-bet-btn');
          if (btn) {
            btn.innerText = 'BET ₹' + this.stake;
            btn.style.background = 'var(--color-green)';
          }
          alert(betData.detail || 'Insufficient wallet balance for Aviator bet.');
        } else {
          this.currentRoundId = betData.round_id || `AV-${Date.now()}`;
          this.updateCashoutButton(true);
        }
      } catch (err) {
        console.error('Aviator bet error:', err);
      }
    }

    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.multiplier = +(1.0 + Math.pow(elapsed * 0.75, 1.8)).toFixed(2);

      if (this.multiplier >= this.crashPoint) {
        this.triggerCrash();
        return;
      }

      this.drawFlight();
      this.updateLiveMultiplierDisplay();
      this.animId = requestAnimationFrame(animate);
    };

    this.animId = requestAnimationFrame(animate);
  }

  async triggerCrash() {
    cancelAnimationFrame(this.animId);
    this.gameState = 'CRASHED';
    this.history.unshift(this.multiplier);
    if (this.history.length > 8) this.history.pop();
    this.updateHistoryBadges();

    if (this.betActive) {
      this.betActive = false;
      this.updateCashoutButton(false);
      try {
        await fetch('/api/casino/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: 'aviator',
            win_amount: 0,
            round_id: this.currentRoundId || `AV-${Date.now()}`
          })
        });
      } catch (e) {}
    }

    this.drawCrashed();
    setTimeout(() => this.startRoundCountdown(), 2500);
  }

  async cashout() {
    if (!this.betActive || this.gameState !== 'FLYING') return;
    this.betActive = false;
    const winAmount = Math.round(this.stake * this.multiplier);

    try {
      await fetch('/api/casino/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: 'aviator',
          win_amount: winAmount,
          round_id: this.currentRoundId || `AV-${Date.now()}`
        })
      });
    } catch (e) {
      console.error('Aviator cashout error:', e);
    }

    if (window.bettingEngine) {
      window.bettingEngine.playBeep('win');
    }

    this.updateCashoutButton(false);
    alert(`⚡ AVIATOR CASH OUT! Multiplier: ${this.multiplier}x. Won: ₹${winAmount.toLocaleString('en-IN')}`);
  }

  toggleBet() {
    if (this.gameState === 'FLYING') return;
    this.betActive = !this.betActive;
    const btn = document.getElementById('aviator-bet-btn');
    if (btn) {
      btn.innerText = this.betActive ? 'CANCEL BET' : 'BET ₹200';
      btn.style.background = this.betActive ? '#dc2626' : '#22c55e';
    }
  }

  updateCashoutButton(enabled) {
    const btn = document.getElementById('aviator-cashout-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    if (enabled) {
      btn.innerText = `CASH OUT ₹${Math.round(this.stake * this.multiplier)}`;
    } else {
      btn.innerText = 'CASH OUT';
    }
  }

  updateLiveMultiplierDisplay() {
    const disp = document.getElementById('aviator-mult-display');
    if (disp) disp.innerText = `${this.multiplier.toFixed(2)}x`;
    if (this.betActive) {
      const btn = document.getElementById('aviator-cashout-btn');
      if (btn) btn.innerText = `CASH OUT ₹${Math.round(this.stake * this.multiplier)}`;
    }
  }

  updateHistoryBadges() {
    const container = document.getElementById('aviator-history');
    if (!container) return;
    container.innerHTML = this.history.map(m => {
      const color = m >= 2.0 ? '#a855f7' : (m >= 1.5 ? '#3b82f6' : '#94a3b8');
      return `<span style="background: rgba(255,255,255,0.08); color: ${color}; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">${m.toFixed(2)}x</span>`;
    }).join('');
  }

  drawWaiting(seconds) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`NEXT ROUND IN ${seconds}s`, w / 2, h / 2 - 20);

    // Progress bar
    this.ctx.fillStyle = '#ffb800';
    this.ctx.fillRect(w / 4, h / 2 + 10, (w / 2) * (1 - seconds / 4), 6);
  }

  drawFlight() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Dark grid background
    this.ctx.fillStyle = '#090f1d';
    this.ctx.fillRect(0, 0, w, h);

    // Grid lines
    this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Flight curve
    const progress = Math.min(1.0, (this.multiplier - 1.0) / 4.0);
    const planeX = 40 + progress * (w - 120);
    const planeY = h - 40 - Math.pow(progress, 1.4) * (h - 100);

    // Curve line & glow
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(30, h - 30);
    this.ctx.quadraticCurveTo(w * 0.4, h - 30, planeX, planeY);
    this.ctx.stroke();

    // Red Airplane Icon
    this.ctx.save();
    this.ctx.translate(planeX, planeY);
    this.ctx.rotate(-0.35);
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = '28px sans-serif';
    this.ctx.fillText('✈️', 0, 0);
    this.ctx.restore();
  }

  drawCrashed() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = '900 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FLEW AWAY!', w / 2, h / 2);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('aviator-canvas')) {
    window.aviatorGame = new AviatorGame('aviator-canvas');
  }
});
