// ========================================================
// CRICKNOVA LIVE EXCHANGE & ODDS STREAMING ENGINE
// Real-Time In-Play Odds, Cricbuzz Scores & Smart Auto-Refresh
// ========================================================

class LiveOddsEngine {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 2000;
    this.cachedPrices = {};
    this.lastMsgTime = Date.now();
    this.pollingTimer = null;
    this.isPollingActive = false;

    this.initWebSocket();
    this.startStaleDataMonitor();
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/odds`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[CrickNova Engine] Connected to Live Sports Provider Stream');
        this.stopPollingFallback();
        this.updateConnectionStatus(true, 'ONLINE');
        this.hideStaleBanner();
      };

      this.ws.onmessage = (event) => {
        this.lastMsgTime = Date.now();
        this.hideStaleBanner();

        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ODDS_TICK' || data.type === 'INITIAL_STATE') {
            this.handleDataSync(data);
          } else if (data.type === 'NEW_BET_ACTIVITY') {
            window.dispatchEvent(new CustomEvent('cricknova:new_bet_activity', { detail: data }));
          }
        } catch (err) {
          console.error('[CrickNova Engine] Error parsing WS data', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('[CrickNova Engine] WS Disconnected. Switching to Polling Fallback & Retrying in 2s...');
        this.updateConnectionStatus(false, 'RECONNECTING');
        this.startPollingFallback();
        setTimeout(() => this.initWebSocket(), this.reconnectInterval);
      };

      this.ws.onerror = (err) => {
        console.error('[CrickNova Engine] WS Error', err);
        this.startPollingFallback();
        try { this.ws.close(); } catch(e) {}
      };
    } catch (e) {
      this.startPollingFallback();
      setTimeout(() => this.initWebSocket(), this.reconnectInterval);
    }
  }

  startPollingFallback() {
    if (this.isPollingActive) return;
    this.isPollingActive = true;
    console.log('[CrickNova Engine] ⚡ Auto-Polling Fallback Engaged (2.5s interval)');

    const poll = async () => {
      if (!this.isPollingActive) return;
      try {
        const curMatchId = window.CURRENT_MATCH_ID;
        if (curMatchId) {
          const res = await fetch(`/api/match/${curMatchId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.match) {
              this.updateMatchDetailPage(data.match);
              this.updateConnectionStatus(true, 'POLLING', data.last_updated);
              if (data.user_bets && typeof window.syncMatchBetsUI === 'function') {
                window.syncMatchBetsUI(data);
              }
            }
          }
        } else {
          const res = await fetch('/api/matches');
          if (res.ok) {
            const matches = await res.json();
            this.handleDataSync({ matches: matches, feed_status: 'POLLING', last_updated: new Date().toLocaleTimeString() });
          }
        }
      } catch (err) {
        console.warn('[CrickNova Engine] Polling error:', err);
      } finally {
        if (this.isPollingActive) {
          this.pollingTimer = setTimeout(poll, 2500);
        }
      }
    };

    poll();
  }

  stopPollingFallback() {
    this.isPollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  startStaleDataMonitor() {
    setInterval(() => {
      const elapsed = Date.now() - this.lastMsgTime;
      if (elapsed > 10000 && !this.isPollingActive) {
        this.startPollingFallback();
      }
    }, 4000);
  }

  showStaleBanner(msg) {
    let banner = document.getElementById('stale-feed-banner');
    if (banner) {
      banner.style.display = 'block';
      const msgEl = banner.querySelector('.stale-msg');
      if (msgEl) msgEl.innerText = msg;
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
      el.style.backgroundColor = isLive ? '#00e676' : '#f59e0b';
      el.title = isLive ? 'Live Odds Streaming' : 'Syncing...';
    });

    const feedLabel = document.getElementById('provider-feed-badge');
    if (feedLabel) {
      const timeStr = lastUpdated || new Date().toLocaleTimeString();
      if (isLive && feedStatus === 'ONLINE') {
        feedLabel.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00e676; margin-right:4px; box-shadow:0 0 8px #00e676;"></span> FEED: LIVE (zplay1.co) • ${timeStr}`;
        feedLabel.style.color = '#00e676';
      } else if (isLive && feedStatus === 'POLLING') {
        feedLabel.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#facc15; margin-right:4px;"></span> FEED: AUTO-POLL (2.5s) • ${timeStr}`;
        feedLabel.style.color = '#facc15';
      } else {
        feedLabel.innerHTML = `🟡 SYNCING: Reconnecting...`;
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

    // If currently on Match Detail page, update detail directly!
    const curMatchId = window.CURRENT_MATCH_ID;
    if (curMatchId) {
      const curMatch = matches.find(m => String(m.id) === String(curMatchId));
      if (curMatch) {
        this.updateMatchDetailPage(curMatch);
      }
    }

    // Update Homepage match rows
    matches.forEach(m => {
      this.updateOrInsertMatch(m);
    });
  }

  updateMatchDetailPage(m) {
    const matchId = String(m.id);

    // 1. Update Match Score
    const scoreEls = document.querySelectorAll(`.match-score-${matchId}`);
    scoreEls.forEach(el => {
      if (m.score && el.innerText !== m.score) {
        el.innerText = m.score;
        this.triggerFlash(el, 'flash-up');
      }
    });

    // 2. Update Last Balls Over Display
    if (m.last_balls && m.last_balls.length > 0) {
      const ballsContainers = document.querySelectorAll(`.balls-container-${matchId}`);
      ballsContainers.forEach(container => {
        let html = '';
        m.last_balls.forEach(ball => {
          let cls = 'dot';
          if (ball === '4') cls = 'four';
          else if (ball === '6') cls = 'six';
          else if (ball === 'W') cls = 'wicket';
          html += `<div class="ball-circle ${cls}">${ball}</div>`;
        });
        container.innerHTML = html;
      });
    }

    // 3. Update Batters at Crease Table
    if (m.batters && m.batters.length > 0) {
      m.batters.forEach((bat, idx) => {
        const row = document.getElementById(`batter-row-${idx}`);
        if (row) {
          const rEl = row.querySelector('.bat-runs');
          const bEl = row.querySelector('.bat-balls');
          const sEl = row.querySelector('.bat-sr');
          if (rEl && String(rEl.innerText) !== String(bat.runs)) {
            rEl.innerText = bat.runs;
            this.triggerFlash(rEl, 'flash-up');
          }
          if (bEl) bEl.innerText = bat.balls;
          if (sEl) sEl.innerText = bat.sr;
        }
      });
    }

    // 4. Update Match Odds Boxes
    if (m.match_odds) {
      m.match_odds.forEach(r => {
        const rClean = r.runner.replace(/[^a-zA-Z0-9]/g, '_');
        const isSusp = (m.status === 'SUSPENDED') || (r.status === 'SUSPENDED');

        const backPrice = (r.back && r.back[0]) ? r.back[0].price : 0;
        const backSize = (r.back && r.back[0]) ? r.back[0].size : 0;
        const layPrice = (r.lay && r.lay[0]) ? r.lay[0].price : 0;
        const laySize = (r.lay && r.lay[0]) ? r.lay[0].size : 0;

        this.applyOddsBoxUpdate(`box-back-${matchId}-${rClean}`, backPrice, backSize, isSusp, `${matchId}_${r.runner}_back`, r.runner, 'back');
        this.applyOddsBoxUpdate(`box-lay-${matchId}-${rClean}`, layPrice, laySize, isSusp, `${matchId}_${r.runner}_lay`, r.runner, 'lay');

        // Dynamic Cashout recalculation
        if (layPrice > 1.0) {
          this.updateDynamicCashout(matchId, r.runner, layPrice);
        }
      });
    }

    // 5. Update Bookmaker Boxes
    if (m.bookmaker) {
      m.bookmaker.forEach(bm => {
        const bmClean = bm.runner.replace(/[^a-zA-Z0-9]/g, '_');
        const isSusp = (m.status === 'SUSPENDED') || (bm.status === 'SUSPENDED');
        const backPrice = (bm.back && bm.back[0]) ? bm.back[0].price : 0;
        const layPrice = (bm.lay && bm.lay[0]) ? bm.lay[0].price : 0;

        this.applyOddsBoxUpdate(`box-bm-back-${matchId}-${bmClean}`, backPrice, bm.rate_back, isSusp, `${matchId}_bm_${bm.runner}_back`, bm.runner, 'back');
        this.applyOddsBoxUpdate(`box-bm-lay-${matchId}-${bmClean}`, layPrice, bm.rate_lay, isSusp, `${matchId}_bm_${bm.runner}_lay`, bm.runner, 'lay');
      });
    }
  }

  applyOddsBoxUpdate(elementId, newPrice, newSize, isSuspended, cacheKey, runnerName, betType) {
    const box = document.getElementById(elementId);
    if (!box) return;

    const prevPrice = this.cachedPrices[cacheKey] || newPrice;
    const priceEl = box.querySelector('.odds-price');
    const sizeEl = box.querySelector('.odds-size');

    if (isSuspended || newPrice <= 0) {
      box.classList.add('suspended');
      if (priceEl) priceEl.innerText = isSuspended ? 'SUSP' : '-';
      if (sizeEl) sizeEl.innerText = '';
    } else {
      box.classList.remove('suspended');
      if (priceEl) priceEl.innerText = newPrice.toFixed(2);
      if (sizeEl) {
        if (typeof newSize === 'number') {
          sizeEl.innerText = (newSize / 1000).toFixed(0) + 'k';
        } else if (newSize) {
          sizeEl.innerText = newSize;
        }
      }

      // Flash Green (Up) or Red (Down)
      if (newPrice > prevPrice && prevPrice > 0) {
        this.triggerFlash(box, 'flash-up');
        this.notifyBetSlipOddsChange(runnerName, betType, newPrice, 'up');
      } else if (newPrice < prevPrice && newPrice > 0) {
        this.triggerFlash(box, 'flash-down');
        this.notifyBetSlipOddsChange(runnerName, betType, newPrice, 'down');
      }
    }

    this.cachedPrices[cacheKey] = newPrice;
    box.dataset.odds = newPrice;
  }

  notifyBetSlipOddsChange(runner, type, newPrice, direction) {
    if (typeof window.handleLiveOddsSlipUpdate === 'function') {
      window.handleLiveOddsSlipUpdate(runner, type, newPrice, direction);
    }
  }

  updateOrInsertMatch(m) {
    const matchId = String(m.id);
    let row = document.getElementById(`match-row-${matchId}`);

    // If row doesn't exist, insert dynamically into Live table
    if (!row) {
      const container = document.querySelector('.matches-list-container');
      if (container) {
        row = document.createElement('div');
        row.className = 'exchange-match-row';
        row.id = `match-row-${matchId}`;
        row.dataset.matchId = matchId;
        row.dataset.sport = m.sport || 'cricket';
        row.innerHTML = this.buildMatchRowHTML(m);
        container.prepend(row);
      }
    }

    // Update Desktop Score
    const scoreEls = document.querySelectorAll(`.match-score-${matchId}`);
    scoreEls.forEach(el => {
      if (m.score && el.innerText !== m.score) {
        el.innerText = m.score;
      }
    });

    // Update Desktop & Mobile Odds Boxes
    if (m.match_odds) {
      m.match_odds.forEach(r => {
        const runnerClean = r.runner.replace(/[^a-zA-Z0-9]/g, '_');
        const isSuspended = (m.status === 'SUSPENDED') || (r.status === 'SUSPENDED');

        const backPrice = (r.back && r.back[0]) ? r.back[0].price : 0;
        const backSize = (r.back && r.back[0]) ? r.back[0].size : 0;
        const layPrice = (r.lay && r.lay[0]) ? r.lay[0].price : 0;
        const laySize = (r.lay && r.lay[0]) ? r.lay[0].size : 0;

        // Desktop
        this.applyOddsBoxUpdate(`box-back-${matchId}-${runnerClean}`, backPrice, backSize, isSuspended, `${matchId}_${r.runner}_back`, r.runner, 'back');
        this.applyOddsBoxUpdate(`box-lay-${matchId}-${runnerClean}`, layPrice, laySize, isSuspended, `${matchId}_${r.runner}_lay`, r.runner, 'lay');

        // Mobile Homepage Boxes
        this.applyMobileOddsBoxUpdate(`box-back-m-${matchId}-${runnerClean}`, backPrice, backSize, isSuspended, `${matchId}_m_${r.runner}_back`);
        this.applyMobileOddsBoxUpdate(`box-lay-m-${matchId}-${runnerClean}`, layPrice, laySize, isSuspended, `${matchId}_m_${r.runner}_lay`);

        if (layPrice > 1.0) {
          this.updateDynamicCashout(matchId, r.runner, layPrice);
        }
      });
    }
  }

  applyMobileOddsBoxUpdate(elementId, newPrice, newSize, isSuspended, cacheKey) {
    const box = document.getElementById(elementId);
    if (!box) return;

    const prevPrice = this.cachedPrices[cacheKey] || newPrice;
    const priceEl = box.querySelector('.m-price');
    const sizeEl = box.querySelector('.m-size');

    if (isSuspended || newPrice <= 0) {
      box.classList.add('suspended');
      if (priceEl) priceEl.innerText = isSuspended ? 'SUSP' : '-';
      if (sizeEl) sizeEl.innerText = '';
    } else {
      box.classList.remove('suspended');
      if (priceEl) priceEl.innerText = newPrice.toFixed(2);
      if (sizeEl && newSize > 0) sizeEl.innerText = (newSize / 1000).toFixed(0) + 'k';

      if (newPrice > prevPrice && prevPrice > 0) {
        this.triggerFlash(box, 'flash-up');
      } else if (newPrice < prevPrice && newPrice > 0) {
        this.triggerFlash(box, 'flash-down');
      }
    }
    this.cachedPrices[cacheKey] = newPrice;
  }

  triggerFlash(element, className) {
    if (!element) return;
    element.classList.remove('flash-up', 'flash-down');
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 500);
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
}

window.liveOddsEngine = new LiveOddsEngine();