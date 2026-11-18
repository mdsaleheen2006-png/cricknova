// ========================================================
// CRICKNOVA TEEN PATTI & ANDAR BAHAR TABLE ENGINE
// CONNECTED TO AUTHORITATIVE UNIFIED WALLET
// ========================================================

async function placeCasinoBet(game, outcome, stake = 500) {
  const currentBal = typeof window.getCurrentWalletBalance === 'function'
    ? window.getCurrentWalletBalance()
    : (parseFloat((document.getElementById('wallet-balance') && document.getElementById('wallet-balance').dataset.raw) || '0') || 0);

  if (currentBal < stake) {
    alert('Insufficient wallet balance. Please deposit to continue.');
    window.location.href = '/?deposit=1';
    return;
  }

  const resultBox = document.getElementById(`${game}-result`);
  if (resultBox) {
    resultBox.innerText = 'Placing bet...';
  }

  try {
    const betRes = await fetch('/api/casino/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: game,
        amount: stake,
        bet_details: { outcome: outcome }
      })
    });
    const betData = await betRes.json();
    if (!betRes.ok) {
      alert(betData.detail || 'Failed to place casino bet.');
      if (resultBox) resultBox.innerText = '';
      return;
    }

    if (window.bettingEngine) {
      window.bettingEngine.playBeep('place');
    }

    if (resultBox) {
      resultBox.innerText = 'Dealing cards...';
    }

    setTimeout(async () => {
      // 50/50 chance for 1.95x payout
      const won = Math.random() > 0.48;
      const winPayout = won ? Math.round(stake * 1.95) : 0;

      try {
        const settleRes = await fetch('/api/casino/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: game,
            win_amount: winPayout,
            round_id: betData.round_id || `RND-${Date.now()}`
          })
        });
        const settleData = await settleRes.json();

        if (won) {
          if (window.bettingEngine) {
            window.bettingEngine.playBeep('win');
          }
          if (resultBox) {
            resultBox.innerHTML = `<span style="color: var(--color-green); font-weight: 900;">WON ₹${winPayout.toLocaleString('en-IN')}! Result: ${outcome.toUpperCase()}</span>`;
          }
        } else {
          if (resultBox) {
            resultBox.innerHTML = `<span style="color: var(--color-red); font-weight: 900;">LOST ₹${stake}! Opposite won.</span>`;
          }
        }
      } catch (err) {
        console.error('Settle error:', err);
      }
    }, 1200);

  } catch (err) {
    console.error('Casino bet network error:', err);
    alert('Network error while placing bet.');
    if (resultBox) resultBox.innerText = '';
  }
}
