'use strict';

const AUTH_API = 'https://api.flowin.one/auth';
const TOKEN_KEY = 'flowin_token';
const USER_KEY = 'flowin_user';
const TURNSTILE_SITE_KEY = window.TURNSTILE_SITE_KEY || '';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function signup(email, password, displayName, turnstileToken) {
  const body = { email, password, display_name: displayName };
  if (turnstileToken) body.turnstile_token = turnstileToken;
  const res = await fetch(`${AUTH_API}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Signup failed');
  setAuth(data.token, data.user);
  return data.user;
}

async function login(email, password) {
  const res = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  setAuth(data.token, data.user);
  return data.user;
}

function logout() {
  clearAuth();
  window.location.reload();
}

function renderAuthUI() {
  const container = document.getElementById('auth-container');
  if (!container) return;

  if (isLoggedIn()) {
    const user = getUser();
    container.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600">${user?.display_name || user?.email || 'User'}</span>
        <a href="/dashboard.html" class="text-sm text-indigo-600 hover:underline">Dashboard</a>
        <button id="logout-btn" class="text-sm text-red-500 hover:underline">Logout</button>
      </div>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    return;
  }

  container.innerHTML = `
    <div id="auth-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <h2 id="auth-title" class="text-2xl font-bold text-indigo-700 mb-6">Sign In</h2>
        <form id="auth-form" class="space-y-4">
          <div id="name-field" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input type="text" id="auth-name" class="w-full border rounded-lg px-3 py-2" placeholder="Your name" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" id="auth-email" class="w-full border rounded-lg px-3 py-2" placeholder="you@example.com" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" id="auth-password" class="w-full border rounded-lg px-3 py-2" placeholder="Min 8 characters" required />
          </div>
          <div id="turnstile-container" class="hidden"></div>
          <p id="auth-error" class="text-red-500 text-sm hidden"></p>
          <button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-semibold">Sign In</button>
        </form>
        <div class="relative flex items-center my-4">
          <div class="flex-1 border-t border-gray-200"></div>
          <span class="px-3 text-xs text-gray-400">or</span>
          <div class="flex-1 border-t border-gray-200"></div>
        </div>
        <a href="${AUTH_API}/google" class="flex items-center justify-center gap-2 w-full border border-gray-300 rounded-lg py-2 hover:bg-gray-50 transition text-sm font-medium text-gray-700">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </a>
        <p class="text-center text-sm text-gray-500 mt-4">
          <span id="auth-toggle-text">Don't have an account?</span>
          <button id="auth-toggle" class="text-indigo-600 hover:underline ml-1">Sign Up</button>
        </p>
        <button id="auth-close" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
    </div>
    <button id="auth-open" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Sign In</button>
  `;

  let isSignup = false;
  const modal = document.getElementById('auth-modal');
  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const titleEl = document.getElementById('auth-title');
  const toggleBtn = document.getElementById('auth-toggle');
  const toggleText = document.getElementById('auth-toggle-text');
  const nameField = document.getElementById('name-field');

  document.getElementById('auth-open')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });
  document.getElementById('auth-close')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  const turnstileContainer = document.getElementById('turnstile-container');
  let turnstileWidgetId = null;

  function renderTurnstile() {
    if (!TURNSTILE_SITE_KEY || !turnstileContainer) return;
    turnstileContainer.innerHTML = '';
    if (typeof turnstile !== 'undefined') {
      turnstileWidgetId = turnstile.render(turnstileContainer, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
      });
    }
  }

  toggleBtn?.addEventListener('click', () => {
    isSignup = !isSignup;
    titleEl.textContent = isSignup ? 'Sign Up' : 'Sign In';
    toggleText.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
    toggleBtn.textContent = isSignup ? 'Sign In' : 'Sign Up';
    nameField?.classList.toggle('hidden', !isSignup);
    turnstileContainer?.classList.toggle('hidden', !isSignup);
    if (isSignup) renderTurnstile();
    form.querySelector('button[type="submit"]').textContent = isSignup ? 'Sign Up' : 'Sign In';
    errorEl?.classList.add('hidden');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl?.classList.add('hidden');
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    const name = document.getElementById('auth-name')?.value || '';

    try {
      if (isSignup) {
        const turnstileToken = TURNSTILE_SITE_KEY && typeof turnstile !== 'undefined'
          ? turnstile.getResponse(turnstileWidgetId)
          : null;
        if (TURNSTILE_SITE_KEY && !turnstileToken) {
          throw new Error('Please complete the captcha');
        }
        await signup(email, password, name, turnstileToken);
      } else {
        await login(email, password);
      }
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl?.classList.remove('hidden');
      if (isSignup && typeof turnstile !== 'undefined' && turnstileWidgetId !== null) {
        turnstile.reset(turnstileWidgetId);
      }
    }
  });
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// Auto-render on load
document.addEventListener('DOMContentLoaded', renderAuthUI);
