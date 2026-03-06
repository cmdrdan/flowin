'use strict';

const SITES_API = 'https://api.flowin.one/sites';
const BASE_DOMAIN = 'flowin.one';

async function loadSites() {
  const loading = document.getElementById('sites-loading');
  const empty = document.getElementById('sites-empty');
  const grid = document.getElementById('sites-grid');

  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const res = await fetch(SITES_API, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      clearAuth();
      window.location.href = '/index.html';
      return;
    }

    const data = await res.json();
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

      // Load credentials for this site
      loadCredentials(site.slug, card.querySelector('.creds-section'));
    }

    setupDeleteHandlers(grid, empty);
  } catch (err) {
    loading.textContent = 'Failed to load sites. Please refresh.';
    console.error('loadSites error:', err);
  }
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
    if (creds.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="mt-1 border border-gray-100 rounded-lg overflow-hidden">
        <button class="creds-toggle w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-600 transition cursor-pointer border-none">
          <span>🔐 Site Credentials (${creds.length})</span>
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
        <button class="cred-eye absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer bg-transparent border-none" title="Show/hide">👁</button>
      </div>
      <button class="cred-save px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-medium hover:bg-indigo-100 transition cursor-pointer border-none" data-slug="${escapeHtml(slug)}" data-cred-id="${cred.id}">Save</button>
      <button class="cred-del px-2 py-1 bg-red-50 text-red-500 rounded text-xs font-medium hover:bg-red-100 transition cursor-pointer border-none" data-slug="${escapeHtml(slug)}" data-cred-id="${cred.id}">✕</button>
    </div>
  `;
}

function setupCredentialHandlers(slug, container) {
  // Toggle password visibility
  container.querySelectorAll('.cred-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.relative')?.querySelector('.cred-pass');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Save credential
  container.querySelectorAll('.cred-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.cred-row');
      const credId = btn.dataset.credId;
      const username = row.querySelector('.cred-user')?.value;
      const password = row.querySelector('.cred-pass')?.value;

      btn.textContent = '...';
      try {
        const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}/credentials/${credId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ username, password }),
        });
        btn.textContent = res.ok ? 'Saved!' : 'Error';
        setTimeout(() => { btn.textContent = 'Save'; }, 1500);
      } catch {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Save'; }, 1500);
      }
    });
  });

  // Delete credential
  container.querySelectorAll('.cred-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const credId = btn.dataset.credId;
      if (!confirm('Delete this credential?')) return;

      try {
        const res = await fetch(`${SITES_API}/${encodeURIComponent(slug)}/credentials/${credId}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          btn.closest('.cred-row')?.remove();
        }
      } catch (err) {
        alert('Failed to delete credential');
      }
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
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (res.ok) {
        btn.closest('div.bg-white')?.remove();
        const remaining = grid.querySelectorAll('div.bg-white');
        if (remaining.length === 0) {
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

document.addEventListener('DOMContentLoaded', loadSites);
