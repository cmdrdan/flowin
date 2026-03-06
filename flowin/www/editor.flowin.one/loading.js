'use strict';

const _loadingMessages = [
  'Reticulating splines...',
  'Convincing pixels to cooperate...',
  'Teaching divs to float...',
  'Negotiating with the CSS gods...',
  'Bribing the browser cache...',
  'Untangling spaghetti code...',
  'Polishing every last pixel...',
  'Aligning divs (this is the hard part)...',
  'Converting caffeine to code...',
  'Asking AI very nicely...',
  'Summoning responsive breakpoints...',
  'Herding semicolons...',
  'Inflating the cloud...',
  'Compiling vibes...',
  'Wrangling web fonts...',
  'Calculating z-index infinity...',
  'Centering a div (finally)...',
  'Painting happy little elements...',
  'Consulting the style guide...',
  'Warming up the flexbox...',
  'Generating dopamine...',
  'Deploying good vibes...',
  'Whispering to the API...',
  'Sprinkling semantic HTML...',
  'Optimizing the vibe check...',
  'Feeding the neural hamsters...',
  'Calibrating the awesome meter...',
  'Brewing fresh markup...',
  'Tuning the color palette...',
  'Refactoring the matrix...',
];

let _loadingOverlay = null;
let _loadingInterval = null;
let _loadingMsgIndex = 0;

function _shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showLoading() {
  if (_loadingOverlay) return;

  const shuffled = _shuffled(_loadingMessages);
  _loadingMsgIndex = 0;

  const overlay = document.createElement('div');
  overlay.id = 'flowin-loading-overlay';
  overlay.innerHTML = `
    <div class="flowin-loading-card">
      <div class="flowin-spinner">
        <div class="flowin-spinner-ring"></div>
        <div class="flowin-spinner-ring"></div>
        <div class="flowin-spinner-ring"></div>
        <span class="flowin-spinner-icon">✦</span>
      </div>
      <p class="flowin-loading-msg">${shuffled[0]}</p>
      <div class="flowin-loading-dots"><span>.</span><span>.</span><span>.</span></div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'flowin-loading-style';
  style.textContent = `
    #flowin-loading-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: flowin-fade-in 0.3s ease;
    }
    @keyframes flowin-fade-in { from { opacity: 0; } to { opacity: 1; } }

    .flowin-loading-card {
      background: white; border-radius: 20px; padding: 48px 56px;
      text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.2);
      max-width: 400px; width: 90%;
    }

    .flowin-spinner {
      width: 72px; height: 72px; margin: 0 auto 28px; position: relative;
    }
    .flowin-spinner-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid transparent;
    }
    .flowin-spinner-ring:nth-child(1) {
      border-top-color: #4f46e5;
      animation: flowin-spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }
    .flowin-spinner-ring:nth-child(2) {
      inset: 6px;
      border-right-color: #7c3aed;
      animation: flowin-spin 1.6s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse;
    }
    .flowin-spinner-ring:nth-child(3) {
      inset: 12px;
      border-bottom-color: #a855f7;
      animation: flowin-spin 2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }
    .flowin-spinner-icon {
      position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; font-size: 20px; color: #4f46e5;
      animation: flowin-pulse 2s ease-in-out infinite;
    }
    @keyframes flowin-spin { to { transform: rotate(360deg); } }
    @keyframes flowin-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.6; } }

    .flowin-loading-msg {
      font-size: 1.05rem; font-weight: 600; color: #4f46e5;
      margin: 0 0 8px; min-height: 1.6em;
      animation: flowin-msg-swap 0.4s ease;
    }
    @keyframes flowin-msg-swap {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .flowin-loading-dots { display: flex; justify-content: center; gap: 4px; }
    .flowin-loading-dots span {
      font-size: 1.5rem; color: #a5b4fc; font-weight: bold;
      animation: flowin-bounce 1.4s ease-in-out infinite;
    }
    .flowin-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .flowin-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes flowin-bounce {
      0%,60%,100% { transform: translateY(0); }
      30% { transform: translateY(-8px); }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);
  _loadingOverlay = overlay;

  const msgEl = overlay.querySelector('.flowin-loading-msg');
  _loadingInterval = setInterval(() => {
    _loadingMsgIndex = (_loadingMsgIndex + 1) % shuffled.length;
    msgEl.style.animation = 'none';
    msgEl.offsetHeight; // force reflow
    msgEl.textContent = shuffled[_loadingMsgIndex];
    msgEl.style.animation = 'flowin-msg-swap 0.4s ease';
  }, 3000);
}

function hideLoading() {
  if (_loadingInterval) {
    clearInterval(_loadingInterval);
    _loadingInterval = null;
  }
  if (_loadingOverlay) {
    _loadingOverlay.remove();
    _loadingOverlay = null;
    document.getElementById('flowin-loading-style')?.remove();
  }
}
