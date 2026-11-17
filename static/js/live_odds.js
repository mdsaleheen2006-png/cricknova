// ========================================================
// WINBUZZ PRO LIVE SPORTS PROVIDER & ODDS ENGINE
// Genuine In-Play Odds (zplay1.co) & Live Cricbuzz Scores
// ========================================================

class LiveOddsEngine {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 2000;
    this.cachedPrices = {};
    this.lastMsgTime = Date.now();
    this.staleCheckTimer = null;
    this.initWebSocket();
    this.startStaleDataMonitor();
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/odds`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Winbuzz Engine] Connected to Live Sports Provider Stream');
        this.updateConnectionStatus(true);
        this.hideStaleBanner();
      };

      this.ws.onmessage = (event) => {
        this.lastMsgTime = Date.now();
        this.hideStaleBanner();

        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ODDS_TICK' || data.type === 'INITIAL_STATE') {
            this.handleDataSync(data);
          }
        } catch (err) {
          console.error('[Winbuzz Engine] Error parsing WS data', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('[Winbuzz Engine] WS Disconnected. Retrying in 2s...');
        this.updateConnectionStatus(false);
        this.showStaleBanner('Feed disconnected. Reconnecting...');
        setTimeout(() => this.initWebSocket(), this.reconnectInterval);
      };

      this.ws.onerror = (err) => {
        console.error('[Winbuzz Engine] WS Error', err);
        this.ws.close();
      };
    } catch (e) {
      setTimeout(() => this.initWebSocket(), this.reconnectInterval);
    }
  }

  startStaleDataMonitor() {
    setInterval(() => {
      const elapsed = Date.now() - this.lastMsgTime;
      if (elapsed > 12000) { // If no tick for >12s
        this.showStaleBanner('⚠️ Live odds feed delayed. Re-verifying connection...');
      }
    }, 4000);
  }

  showStaleBanner(msg) {
    let banner = document.getElementById('stale-feed-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.querySelector('.stale-msg').innerText = msg;
    }
  }

  hideStaleBanner() {
    let banner = document.getElementById('stale-feed-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  updateConnectionStatus(isLive, feedStatus = 'ONLINE', lastUpdated = '') {
    const indicators = document.querySelectorAll('.ws-status-indicator');
    indicators.forEach(el => {
      el.style.backgroundColor = isLive ? '#00e676' : '#ff1744';
      el.title = isLive ? 'Live Odds Streaming' : 'Reconnecting...';
    });

    const feedLabel = document.getElementById('provider-feed-badge');
    if (feedLabel) {
      if (isLive && feedStatus === 'ONLINE') {
        feedLabel.innerHTML = `🟢 FEED: LIVE (zplay1.co) • ${lastUpdated || 'Active'}`;
        feedLabel.style.color = '#00e676';
      } else {
        feedLabel.innerHTML = `🟡 FEED: ${feedStatus} • Syncing...`;
        feedLabel.style.color = '#f59e0b';
      }
    }
  }

  handleDataSync(payload) {
    const matches = payload.matches || [];
    const feedStatus = payload.feed_status || 'ONLINE';
    const lastUpdated = payload.last_updated || '';

    this.updateConnectionStatus(true, feedStatus, lastUpdated);

    // Update Live Count Badges
    const liveBadges = document.querySelectorAll('.live-inplay-count');
    liveBadges.forEach(b => b.innerText = matches.length);

    // 1. Reconciliation: Remove matches that finished
    const liveIds = new Set(matches.map(m => String(m.id)));
    const existingRows = document.querySelectorAll('.exchange-match-row');
    existingRows.forEach(row => {
      const rowId = row.dataset.matchId;
      if (rowId && !liveIds.has(String(rowId))) {
        // Match ended -> remove from live view
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 400);
      }
    });

    // 2. Update or Insert Matches
    matches.forEach(m => {
      this.updateOrInsertMatch(m);
    });
  }

  updateOrInsertMatch(m) {
    const matchId = String(m.id);
    let row = document.getElementById(`match-row-${matchId}`);

    // If row doesn't exist, insert into Live table dynamically!
    if (!row) {
      const container = document.querySelector('.matches-list-container');
      if (container) {
        row = document.createElement('div');
        row.className = 'exchange-match-row';
        row.id = `match-row-${matchId}`;
        row.dataset.matchId = matchId;
        row.dataset.sport = m.sport || 'cricket';

        // Build 6-column row markup
        row.innerHTML = this.buildMatchRowHTML(m);
        container.prepend(row);
      }
    }

    if (!row) return;

    // Update Score
    const scoreEl = row.querySelector(`.match-score-${matchId}`);
    if (scoreEl && m.score && scoreEl.innerText !== m.score) {
      scoreEl.innerText = m.score;
    }

    // Update Odds Boxes with Green/Red Flash
    if (m.match_odds) {
      m.match_odds.forEach(r => {
        const runnerClean = r.runner.replace(/[^a-zA-Z0-9]/g, '_');
        const isSuspended = (m.status === 'SUSPENDED') || (r.status === 'SUSPENDED');

        // Back Box
        const backKey = `${matchId}_${r.runner}_back`;
        const prevBack = this.cachedPrices[backKey] || (r.back[0] ? r.back[0].price : 0);
        const newBack = r.back[0] ? r.back[0].price : 0;
        const newBackSize = r.back[0] ? r.back[0].size : 0;

        const backBox = document.getElementById(`box-back-${matchId}-${runnerClean}`);
        if (backBox) {
          const priceEl = backBox.querySelector('.odds-price');
          const sizeEl = backBox.querySelector('.odds-size');

          if (isSuspended || newBack === 0) {
            backBox.classList.add('suspended');
            if (priceEl) priceEl.innerText = isSuspended ? 'SUSP' : '-';
            if (sizeEl) sizeEl.innerText = '';
          } else {
            backBox.classList.remove('suspended');
            if (priceEl) priceEl.innerText = newBack.toFixed(2);
            if (sizeEl) sizeEl.innerText = (newBackSize / 1000).toFixed(0) + 'k';

            if (newBack > prevBack && prevBack > 0) {
              this.triggerFlash(backBox, 'flash-up');
            } else if (newBack < prevBack && newBack > 0) {
              this.triggerFlash(backBox, 'flash-down');
            }
          }
        }
        this.cachedPrices[backKey] = newBack;

        // Lay Box
        const layKey = `${matchId}_${r.runner}_lay`;
        const prevLay = this.cachedPrices[layKey] || (r.lay[0] ? r.lay[0].price : 0);
        const newLay = r.lay[0] ? r.lay[0].price : 0;
        const newLaySize = r.lay[0] ? r.lay[0].size : 0;

        const layBox = document.getElementById(`box-lay-${matchId}-${runnerClean}`);
        if (layBox) {
          const priceEl = layBox.querySelector('.odds-price');
          const sizeEl = layBox.querySelector('.odds-size');

          if (isSuspended || newLay === 0) {
            layBox.classList.add('suspended');
            if (priceEl) priceEl.innerText = isSuspended ? 'SUSP' : '-';
            if (sizeEl) sizeEl.innerText = '';
          } else {
            layBox.classList.remove('suspended');
            if (priceEl) priceEl.innerText = newLay.toFixed(2);
            if (sizeEl) sizeEl.innerText = (newLaySize / 1000).toFixed(0) + 'k';

            if (newLay > prevLay && prevLay > 0) {
              this.triggerFlash(layBox, 'flash-up');
            } else if (newLay < prevLay && newLay > 0) {
              this.triggerFlash(layBox, 'flash-down');
            }
          }
        }
        this.cachedPrices[layKey] = newLay;

        // Update Dynamic Cash-Out Payout for open bets on this runner
        if (newLay > 1.0) {
          this.updateDynamicCashout(matchId, r.runner, newLay);
        }
      });
    }

    // Update Batsmen Table if on Match Detail
    if (m.batters && m.batters.length > 0) {
      m.batters.forEach((bat, idx) => {
        const row = document.getElementById(`batter-row-${idx}`);
        if (row) {
          const rEl = row.querySelector('.bat-runs');
          const bEl = row.querySelector('.bat-balls');
          const sEl = row.querySelector('.bat-sr');
          if (rEl) rEl.innerText = bat.runs;
          if (bEl) bEl.innerText = bat.balls;
          if (sEl) sEl.innerText = bat.sr;
        }
      });
    }
  }

  buildMatchRowHTML(m) {
    const odds = m.match_odds || [];
    const r1 = odds[0];
    const r2 = odds.find(r => r.runner !== 'The Draw' && r !== r1) || odds[1];
    const rx = odds.find(r => r.runner === 'The Draw' || r.runner === 'Draw');

    function renderBox(r, type, matchId) {
      if (!r) return '<div class="odds-cell-empty">-</div>';
      const clean = r.runner.replace(/[^a-zA-Z0-9]/g, '_');
      const list = type === 'back' ? r.back : r.lay;
      const price = (list && list[0]) ? list[0].price : 0;
      const size = (list && list[0]) ? list[0].size : 0;
      return `
        <div class="odds-box ${type}"
             id="box-${type}-${matchId}-${clean}"
             data-match-id="${matchId}"
             data-runner="${r.runner}"
             data-type="${type}"
             data-market-type="match_odds">
          <span class="odds-price">${price > 0 ? price.toFixed(2) : '-'}</span>
          <span class="odds-size">${size > 0 ? (size / 1000).toFixed(0) + 'k' : ''}</span>
        </div>
      `;
    }

    return `
      <a href="/match/${m.id}" class="cell-match-info">
        <span class="pin-icon">☆</span>
        <div class="match-details-wrap">
          <div class="match-top-line">
            <span class="live-pill">LIVE</span>
            <span class="league-tag">${m.competition}</span>
          </div>
          <div class="match-title-text">${m.name}</div>
          <div class="match-score-line">
            <span class="match-score-${m.id}">${m.score}</span>
          </div>
        </div>
        <div class="match-feature-icons" style="margin-left: auto;">
          <span>📺</span><span>⚡</span><span>📘</span>
        </div>
      </a>
      <div class="odds-pair">
        ${renderBox(r1, 'back', m.id)}
        ${renderBox(r1, 'lay', m.id)}
      </div>
      <div class="odds-pair">
        ${rx ? renderBox(rx, 'back', m.id) + renderBox(rx, 'lay', m.id) : '<div class="odds-cell-empty" style="grid-column: span 2;">-</div>'}
      </div>
      <div class="odds-pair">
        ${renderBox(r2, 'back', m.id)}
        ${renderBox(r2, 'lay', m.id)}
      </div>
    `;
  }

  triggerFlash(element, className) {
    element.classList.remove('flash-up', 'flash-down');
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 450);
  }

  updateDynamicCashout(matchId, runner, currentLayOdds) {
    const cashoutBtns = document.querySelectorAll(`.cashout-btn[data-match-id="${matchId}"][data-runner="${runner}"]`);
    cashoutBtns.forEach(btn => {
      const origOdds = parseFloat(btn.dataset.origOdds);
      const stake = parseFloat(btn.dataset.stake);
      const payout = Math.round(stake * (origOdds / Math.max(1.01, currentLayOdds)));
      const netProfit = payout - stake;

      const payoutDisplay = btn.querySelector('.cashout-payout');
      if (payoutDisplay) {
        payoutDisplay.innerText = `₹${payout.toLocaleString('en-IN')}`;
      }

      const profitDisplay = btn.querySelector('.cashout-profit');
      if (profitDisplay) {
        profitDisplay.innerText = `(${netProfit >= 0 ? '+' : ''}₹${netProfit.toLocaleString('en-IN')})`;
        profitDisplay.style.color = netProfit >= 0 ? '#00e676' : '#ff1744';
      }
    });
  }
}

window.liveOddsEngine = new LiveOddsEngine();
