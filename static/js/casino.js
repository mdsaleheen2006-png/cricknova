// ========================================================
// WINBUZZ TEEN PATTI & ANDAR BAHAR TABLE ENGINE
// ========================================================

function placeCasinoBet(game, outcome, stake = 500) {
  const currentBal = parseFloat(document.getElementById('wallet-balance').dataset.raw || 50000);
  if (currentBal < stake) {
    alert('Insufficient balance');
    return;
  }

  // Deduct stake instantly
  if (window.bettingEngine) {
    window.bettingEngine.updateWalletUI(currentBal - stake, 0, -stake);
    window.bettingEngine.playBeep('place');
  }

  const resultBox = document.getElementById(`${game}-result`);
  if (resultBox) {
    resultBox.innerText = 'Dealing cards...';
  }

  setTimeout(() => {
    // 50/50 chance for 1.95x payout
    const won = Math.random() > 0.48;
    if (won) {
      const winPayout = Math.round(stake * 1.95);
      if (window.bettingEngine) {
        window.bettingEngine.updateWalletUI(currentBal - stake + winPayout, 0, winPayout);
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
  }, 1200);
}
