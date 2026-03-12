'use strict';

const SITES_API = 'https://api.flowin.one/sites';
const USERS_API = 'https://api.flowin.one/users';
const PAYMENTS_API = 'https://api.flowin.one/payments';
const BASE_DOMAIN = 'flowin.one';

// Handle Google OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('google_token')) {
  const token = urlParams.get('google_token');
  localStorage.setItem('flowin_token', token);
  // Fetch user info
  fetch('https://api.flowin.one/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => r.json())
    .then(data => {
      if (data.user) {
        localStorage.setItem('flowin_user', JSON.stringify(data.user));
      }
      window.location.href = '/dashboard.html';
    })
    .catch(() => { window.location.href = '/dashboard.html'; });
}

if (urlParams.get('verified') === 'true') {
  setTimeout(() => showToast('Email verified! Welcome to Flowin.', 'success'), 500);
}

// Auto-open pricing modal if redirected from editor
if (urlParams.get('upgrade') === 'true') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => handleUpgrade(), 500);
  });
  window.history.replaceState({}, '', '/dashboard.html');
}

// Handle Stripe payment redirects
if (urlParams.get('payment') === 'success') {
  setTimeout(() => showToast('Payment successful! Your plan has been upgraded.', 'success'), 500);
  // Clean URL
  window.history.replaceState({}, '', '/dashboard.html');
}
if (urlParams.get('payment') === 'cancelled') {
  setTimeout(() => showToast('Payment cancelled. No changes were made.', 'info'), 500);
  window.history.replaceState({}, '', '/dashboard.html');
}

async function loadDashboard() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  // Load stats and sites in parallel
  const [statsRes, sitesRes] = await Promise.all([
    fetch(`${USERS_API}/me/stats`, { headers: authHeaders() }).catch(() => null),
    fetch(SITES_API, { headers: authHeaders() }).catch(() => null),
  ]);

  if (statsRes && statsRes.ok) {
    const stats = await statsRes.json();
    renderStats(stats);
  }

  const loading = document.getElementById('sites-loading');
  const empty = document.getElementById('sites-empty');
  const grid = document.getElementById('sites-grid');

  if (!sitesRes || sitesRes.status === 401) {
    clearAuth();
    window.location.href = '/index.html';
    return;
  }

  try {
    const data = await sitesRes.json();
    const sites = data.sites || [];

    loading?.classList.add('hidden');

    if (sites.length === 0) {
      empty?.classList.remove('hidden');
      return;
    }

    grid?.classList.remove('hidden');
    grid.innerHTML = '';

    for (const site of sites) {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl shadow-md p-5 flex flex-col gap-3 border border-gray-100 hover:shadow-lg transition';

      const liveUrl = `https://${site.slug}.${BASE_DOMAIN}`;
      const editUrl = `/index.html?mode=manual&edit=${encodeURIComponent(site.slug)}`;
      const created = new Date(site.created_at).toLocaleDateString();

      card.innerHTML = `
        <div class="flex items-start justify-between">
          <h3 class="font-semibold text-lg text-gray-800 truncate">${escapeHtml(site.title)}</h3>
        </div>
        <a href="${liveUrl}" target="_blank" rel="noopener" class="text-sm text-indigo-500 hover:underline truncate">${site.slug}.${BASE_DOMAIN}</a>
        <p class="text-xs text-gray-400">Created ${created}</p>
        <div class="creds-section" data-slug="${escapeHtml(site.slug)}"></div>
        <div class="flex gap-2 mt-auto pt-2">
          <a href="${editUrl}" class="flex-1 text-center px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition">Edit</a>
          <button data-slug="${escapeHtml(site.slug)}" class="delete-btn px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition">Delete</button>
        </div>
      `;

      grid.appendChild(card);
      loadCredentials(site.slug, card.querySelector('.creds-section'));
    }

    setupDeleteHandlers(grid, empty);
  } catch (err) {
    loading.textContent = 'Failed to load sites. Please refresh.';
    console.error('loadSites error:', err);
  }
}

function renderStats(stats) {
  const container = document.getElementById('stats-section');
  if (!container) return;
  container.classList.remove('hidden');

  const tier = stats.tier || {};
  const gensPct = stats.gens_limit > 0 ? Math.round((stats.gens_used / stats.gens_limit) * 100) : 0;
  const sitesPct = stats.sites_limit > 0 ? Math.round((stats.sites_used / stats.sites_limit) * 100) : 0;
  const gensColor = gensPct >= 95 ? 'bg-red-500' : gensPct >= 80 ? 'bg-amber-500' : 'bg-indigo-500';
  const resetDate = stats.gens_reset_at ? new Date(stats.gens_reset_at).toLocaleDateString() : '—';

  const tierColors = { free: 'bg-gray-100 text-gray-700', starter: 'bg-indigo-100 text-indigo-700', pro: 'bg-purple-100 text-purple-700' };
  const tierBadgeClass = tierColors[tier.slug] || tierColors.free;

  container.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Plan</p>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tierBadgeClass}">${tier.name || 'Free'}</span>
          ${tier.price_monthly > 0 ? `<span class="text-sm text-gray-500">$${tier.price_monthly}/mo</span>` : ''}
        </div>
        <div class="mt-3 flex gap-2">
          ${tier.slug === 'free' ? '<button onclick="handleUpgrade()" class="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Upgrade</button>' : ''}
          ${tier.price_monthly > 0 ? '<button onclick="handlePortal()" class="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Manage Billing</button>' : ''}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Generations</p>
        <p class="text-2xl font-bold">${stats.gens_used}<span class="text-sm text-gray-400 font-normal">/${stats.gens_limit}</span></p>
        <div class="w-full bg-gray-100 rounded-full h-2 mt-2">
          <div class="${gensColor} h-2 rounded-full transition-all" style="width:${Math.min(gensPct, 100)}%"></div>
        </div>
        <p class="text-xs text-gray-400 mt-1">Resets ${resetDate}</p>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Sites</p>
        <p class="text-2xl font-bold">${stats.sites_used}<span class="text-sm text-gray-400 font-normal">/${stats.sites_limit}</span></p>
        <div class="w-full bg-gray-100 rounded-full h-2 mt-2">
          <div class="bg-indigo-500 h-2 rounded-full transition-all" style="width:${Math.min(sitesPct, 100)}%"></div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
        <p class="text-sm font-medium ${stats.email_verified ? 'text-green-600' : 'text-amber-600'}">
          ${stats.email_verified ? 'Verified' : 'Email not verified'}
        </p>
        ${!stats.email_verified ? '<p class="text-xs text-gray-400 mt-1">Check your inbox for verification link</p>' : ''}
      </div>
    </div>
  `;
}

function handleUpgrade() {
  const modal = document.getElementById('pricing-modal');
  if (!modal) return;

  // Pass customer email to the pricing table for pre-fill
  const user = getUser();
  if (user?.email) {
    const table = modal.querySelector('stripe-pricing-table');
    if (table) table.setAttribute('customer-email', user.email);
  }

  modal.classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricing-modal')?.classList.add('hidden');
}

async function handlePortal() {
  try {
    const res = await fetch(`${PAYMENTS_API}/portal`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.portal_url) {
      window.location.href = data.portal_url;
    } else {
      showToast(data.detail || 'Billing portal unavailable', 'error');
    }
  } catch (err) {
    showToast('Failed to open billing portal', 'error');
  }
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:0.9rem;font-weight:500;color:white;z-index:1000;transform:translateY(100px);opacity:0;transition:all 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  const colors = { success: '#16a34a', error: '#dc2626', info: '#4f46e5' };
  toast.style.background = colors[type] || colors.info;
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.transform = 'translateY(100px)'; toast.style.opacity = '0'; }, 3000);
}

async function loadCredentials(slug, container) {
  if (!container) return;
  try {
    const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}/credentials`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    const creds = data.credentials || [];
    if (creds.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <div class="mt-1 border border-gray-100 rounded-lg overflow-hidden">
        <button class="creds-toggle w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-600 transition cursor-pointer border-none">
          <span>Site Credentials (${creds.length})</span>
          <span class="creds-arrow text-xs">▼</span>
        </button>
        <div class="creds-list hidden">
          ${creds.map(c => credentialRow(slug, c)).join('')}
        </div>
      </div>
    `;

    container.querySelector('.creds-toggle')?.addEventListener('click', () => {
      const list = container.querySelector('.creds-list');
      const arrow = container.querySelector('.creds-arrow');
      list?.classList.toggle('hidden');
      if (arrow) arrow.textContent = list?.classList.contains('hidden') ? '▼' : '▲';
    });

    setupCredentialHandlers(slug, container);
  } catch (err) {
    console.error('Failed to load credentials for', slug, err);
  }
}

function credentialRow(slug, cred) {
  return `
    <div class="cred-row flex items-center gap-2 px-3 py-2 border-t border-gray-50 text-sm" data-cred-id="${cred.id}">
      <span class="text-xs font-semibold text-indigo-500 w-16 shrink-0">${escapeHtml(cred.label)}</span>
      <input type="text" value="${escapeHtml(cred.username)}" class="cred-user flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
      <div class="flex-1 min-w-0 relative">
        <input type="password" value="${escapeHtml(cred.password)}" class="cred-pass w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono pr-7" />
        <button class="cred-eye absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer bg-transparent border-none" title="Show/hide">Show</button>
      </div>
      <button class="cred-save px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-medium hover:bg-indigo-100 transition cursor-pointer border-none" data-slug="${escapeHtml(slug)}" data-cred-id="${cred.id}">Save</button>
      <button class="cred-del px-2 py-1 bg-red-50 text-red-500 rounded text-xs font-medium hover:bg-red-100 transition cursor-pointer border-none" data-slug="${escapeHtml(slug)}" data-cred-id="${cred.id}">X</button>
    </div>
  `;
}

function setupCredentialHandlers(slug, container) {
  container.querySelectorAll('.cred-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.relative')?.querySelector('.cred-pass');
      if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.textContent = input.type === 'password' ? 'Show' : 'Hide'; }
    });
  });
  container.querySelectorAll('.cred-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.cred-row');
      const credId = btn.dataset.credId;
      const username = row.querySelector('.cred-user')?.value;
      const password = row.querySelector('.cred-pass')?.value;
      btn.textContent = '...';
      try {
        const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}/credentials/${credId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ username, password }),
        });
        btn.textContent = res.ok ? 'Saved!' : 'Error';
      } catch { btn.textContent = 'Error'; }
      setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    });
  });
  container.querySelectorAll('.cred-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const credId = btn.dataset.credId;
      if (!confirm('Delete this credential?')) return;
      try {
        const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}/credentials/${credId}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        if (res.ok) btn.closest('.cred-row')?.remove();
      } catch { alert('Failed to delete credential'); }
    });
  });
}

function setupDeleteHandlers(grid, empty) {
  grid.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.slug;
      if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
      btn.textContent = '...';
      btn.disabled = true;
      const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (res.ok) {
        btn.closest('div.bg-white')?.remove();
        if (grid.querySelectorAll('div.bg-white').length === 0) {
          grid.classList.add('hidden');
          empty?.classList.remove('hidden');
        }
      } else {
        btn.textContent = 'Delete';
        btn.disabled = false;
        alert('Failed to delete site.');
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Close pricing modal on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('pricing-modal');
  if (modal && e.target === modal) closePricingModal();
});

document.addEventListener('DOMContentLoaded', loadDashboard);
