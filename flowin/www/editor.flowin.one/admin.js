'use strict';

const ADMIN_API = 'https://api.flowin.one/admin';

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'className') el.className = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else el.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });
  return el;
}

async function api(path, opts = {}) {
  const res = await fetch(`${ADMIN_API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  if (res.status === 403) {
    alert('Admin access required');
    window.location.href = '/dashboard.html';
    return null;
  }
  return res.json();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function tierBadge(slug, name) {
  const cls = slug === 'pro' ? 'bg-purple-100 text-purple-700' : slug === 'starter' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600';
  return `<span class="text-xs font-bold px-2 py-0.5 rounded-full ${cls}">${esc(name)}</span>`;
}

function statusBadge(status) {
  const cls = status === 'active' ? 'text-green-600' : status === 'past_due' ? 'text-red-600' : 'text-gray-500';
  return `<span class="text-xs ${cls}">${esc(status)}</span>`;
}

function actionBadge(action) {
  const colors = {
    login: 'bg-blue-100 text-blue-700',
    signup: 'bg-green-100 text-green-700',
    oauth_login: 'bg-blue-100 text-blue-700',
    generate: 'bg-pink-100 text-pink-700',
    refine: 'bg-purple-100 text-purple-700',
    enhance: 'bg-purple-100 text-purple-700',
    site_publish: 'bg-emerald-100 text-emerald-700',
    site_update: 'bg-amber-100 text-amber-700',
    site_delete: 'bg-red-100 text-red-700',
    subscription_created: 'bg-green-100 text-green-700',
    subscription_cancelled: 'bg-red-100 text-red-700',
    payment_failed: 'bg-red-100 text-red-700',
    admin_tier_change: 'bg-orange-100 text-orange-700',
    admin_user_update: 'bg-orange-100 text-orange-700',
    email_verified: 'bg-cyan-100 text-cyan-700',
    password_reset: 'bg-yellow-100 text-yellow-700',
    slug_change: 'bg-amber-100 text-amber-700',
  };
  const cls = colors[action] || 'bg-gray-100 text-gray-600';
  return `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${cls}">${esc(action)}</span>`;
}

function timeAgo(iso) {
  const d = new Date(iso);
  const now = new Date();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return d.toLocaleDateString();
}

function pagination(currentPage, total, limit, onPage) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return '';
  const el = h('div', { className: 'flex gap-2 items-center justify-center mt-4' });
  if (currentPage > 1) el.appendChild(h('button', { className: 'px-3 py-1 border rounded text-sm hover:bg-gray-50', onClick: () => onPage(currentPage - 1) }, 'Prev'));
  el.appendChild(h('span', { className: 'px-3 py-1 text-sm text-gray-500' }, `Page ${currentPage} of ${totalPages}`));
  if (currentPage < totalPages) el.appendChild(h('button', { className: 'px-3 py-1 border rounded text-sm hover:bg-gray-50', onClick: () => onPage(currentPage + 1) }, 'Next'));
  return el;
}

// ── Overview ──────────────────────────────────────────────────

async function loadOverview() {
  const data = await api('/stats');
  if (!data) return;

  const el = document.getElementById('overview');
  const cards = [
    { label: 'MRR', value: `$${data.mrr.toFixed(2)}`, color: 'text-green-600' },
    { label: 'Total Users', value: data.total_users, sub: `Free: ${data.free_users}/${data.free_cap}` },
    { label: 'Waitlist', value: data.waitlist_count, color: data.waitlist_count > 0 ? 'text-amber-600' : '' },
    { label: 'Gens This Month', value: data.gens_this_month },
  ];

  el.innerHTML = cards.map(c => `
    <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p class="text-xs text-gray-500 uppercase font-semibold">${c.label}</p>
      <p class="text-2xl font-bold ${c.color || ''}">${c.value}</p>
      ${c.sub ? `<p class="text-xs text-gray-400 mt-1">${c.sub}</p>` : ''}
    </div>
  `).join('');
}

// ── Users ─────────────────────────────────────────────────────

let usersPage = 1;
let usersSearch = '';
let cachedTiers = null;

async function getTiers() {
  if (cachedTiers) return cachedTiers;
  const data = await api('/tiers');
  if (data) cachedTiers = data.tiers;
  return cachedTiers || [];
}

async function loadUsers() {
  const data = await api(`/users?page=${usersPage}&limit=30&search=${encodeURIComponent(usersSearch)}`);
  if (!data) return;

  const panel = document.getElementById('panel-users');
  panel.innerHTML = '';

  // Search bar
  const searchBar = h('div', { className: 'flex gap-2 mb-4' },
    h('input', { type: 'text', placeholder: 'Search users...', value: usersSearch,
      className: 'flex-1 px-3 py-2 border rounded-lg text-sm',
      onInput: (e) => { usersSearch = e.target.value; },
      onKeydown: (e) => { if (e.key === 'Enter') { usersPage = 1; loadUsers(); } }
    }),
    h('button', { className: 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold', onClick: () => { usersPage = 1; loadUsers(); } }, 'Search'),
  );
  panel.appendChild(searchBar);

  // Table
  const table = h('div', { className: 'bg-white rounded-xl shadow-sm border overflow-x-auto' });
  table.innerHTML = `
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Tier</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Gens</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Sites</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Joined</th>
          <th class="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.users.map(u => `
          <tr class="border-t hover:bg-gray-50">
            <td class="px-4 py-3">
              <p class="font-medium">${esc(u.email)}</p>
              <p class="text-xs text-gray-400">${esc(u.display_name)}</p>
            </td>
            <td class="px-4 py-3">${tierBadge(u.tier_slug, u.tier_name)}</td>
            <td class="px-4 py-3">${u.gens_used}</td>
            <td class="px-4 py-3">${u.site_count}</td>
            <td class="px-4 py-3">${statusBadge(u.subscription_status)}${u.is_admin ? ' <span class="text-xs text-orange-600">(admin)</span>' : ''}</td>
            <td class="px-4 py-3 text-xs text-gray-400">${new Date(u.created_at).toLocaleDateString()}</td>
            <td class="px-4 py-3">
              <button class="view-user text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100" data-id="${u.id}">View</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  panel.appendChild(table);

  // Wire view buttons
  table.querySelectorAll('.view-user').forEach(btn => {
    btn.addEventListener('click', () => openUserModal(parseInt(btn.dataset.id)));
  });

  // Pagination
  const pag = pagination(usersPage, data.total, data.limit, (p) => { usersPage = p; loadUsers(); });
  if (pag) panel.appendChild(pag);
}

// ── User Detail Modal ────────────────────────────────────────

async function openUserModal(userId) {
  const modal = document.getElementById('user-modal');
  const content = document.getElementById('user-modal-content');
  content.innerHTML = '<p class="text-gray-400 py-8 text-center">Loading...</p>';
  modal.classList.remove('hidden');

  const [userData, tiers] = await Promise.all([
    api(`/users/${userId}`),
    getTiers(),
  ]);

  if (!userData) { closeUserModal(); return; }

  content.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between pr-8">
        <div>
          <h2 class="text-xl font-bold text-gray-800">${esc(userData.email)}</h2>
          <p class="text-sm text-gray-500">${esc(userData.display_name)} &middot; ID: ${userData.id}</p>
          <p class="text-xs text-gray-400 mt-1">Joined ${new Date(userData.created_at).toLocaleDateString()}</p>
        </div>
        <div class="flex gap-2">
          ${userData.email_verified ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Verified</span>' : '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Unverified</span>'}
          ${userData.has_google ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Google</span>' : ''}
          ${userData.is_admin ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Admin</span>' : ''}
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid gap-3 sm:grid-cols-4">
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-500 font-semibold">Plan</p>
          <p class="font-bold">${tierBadge(userData.tier_slug, userData.tier_name)}</p>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-500 font-semibold">Gens Used</p>
          <p class="font-bold text-lg">${userData.gens_used}</p>
          ${userData.gens_reset_at ? `<p class="text-xs text-gray-400">Resets ${new Date(userData.gens_reset_at).toLocaleDateString()}</p>` : ''}
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-500 font-semibold">Sites</p>
          <p class="font-bold text-lg">${userData.site_count}</p>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-500 font-semibold">Total Gens</p>
          <p class="font-bold text-lg">${userData.total_gens}</p>
        </div>
      </div>

      <!-- Modify User -->
      <div class="bg-white border rounded-xl p-4">
        <h3 class="font-semibold text-sm text-gray-700 mb-3">Modify User</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-gray-500 text-xs">Plan</span>
            <select id="modal-tier" class="border rounded px-2 py-1.5 text-sm">
              ${tiers.map(t => `<option value="${t.id}" ${t.id === userData.tier_id ? 'selected' : ''}>${esc(t.name)} ($${t.price_monthly}/mo)</option>`).join('')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-gray-500 text-xs">Subscription Status</span>
            <select id="modal-status" class="border rounded px-2 py-1.5 text-sm">
              ${['free', 'active', 'past_due', 'cancelled'].map(s => `<option value="${s}" ${s === userData.subscription_status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-gray-500 text-xs">Gens Used This Month</span>
            <input type="number" id="modal-gens" value="${userData.gens_used}" class="border rounded px-2 py-1.5 text-sm" min="0" />
          </label>
          <label class="flex items-center gap-2 text-sm pt-5">
            <input type="checkbox" id="modal-admin" ${userData.is_admin ? 'checked' : ''} />
            <span>Admin</span>
          </label>
        </div>
        <button id="modal-save" class="mt-3 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Save Changes</button>
        <span id="modal-save-status" class="ml-2 text-sm text-green-600 hidden">Saved!</span>
      </div>

      <!-- Tabs: Audit / Sites / Generations -->
      <div>
        <div class="flex gap-1 border-b border-gray-200 mb-3">
          <button class="modal-tab active px-3 py-2 text-xs font-semibold text-gray-500 border-b-2 border-transparent" data-tab="audit">Audit Trail</button>
          <button class="modal-tab px-3 py-2 text-xs font-semibold text-gray-500 border-b-2 border-transparent" data-tab="sites">Sites</button>
          <button class="modal-tab px-3 py-2 text-xs font-semibold text-gray-500 border-b-2 border-transparent" data-tab="gens">Generations</button>
        </div>
        <div id="modal-tab-audit" class="modal-panel"></div>
        <div id="modal-tab-sites" class="modal-panel hidden"></div>
        <div id="modal-tab-gens" class="modal-panel hidden"></div>
      </div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.modal-tab').forEach(b => { b.classList.remove('active'); b.style.borderBottomColor = ''; b.style.color = ''; });
      content.querySelectorAll('.modal-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      btn.style.borderBottomColor = '#4f46e5';
      btn.style.color = '#4f46e5';
      document.getElementById('modal-tab-' + btn.dataset.tab)?.classList.remove('hidden');
    });
  });
  content.querySelector('.modal-tab.active').style.borderBottomColor = '#4f46e5';
  content.querySelector('.modal-tab.active').style.color = '#4f46e5';

  // Save handler
  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const updates = {};
    const newTier = parseInt(document.getElementById('modal-tier').value);
    const newStatus = document.getElementById('modal-status').value;
    const newGens = parseInt(document.getElementById('modal-gens').value);
    const newAdmin = document.getElementById('modal-admin').checked;

    if (newTier !== userData.tier_id) updates.tier_id = newTier;
    if (newStatus !== userData.subscription_status) updates.subscription_status = newStatus;
    if (newGens !== userData.gens_used) updates.gens_used_this_month = newGens;
    if (newAdmin !== userData.is_admin) updates.is_admin = newAdmin;

    if (Object.keys(updates).length === 0) { alert('No changes to save'); return; }

    const result = await api(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (result?.updated) {
      const status = document.getElementById('modal-save-status');
      status.classList.remove('hidden');
      setTimeout(() => status.classList.add('hidden'), 2000);
      loadUsers(); // Refresh list behind modal
    }
  });

  // Load initial tab data
  loadUserAudit(userId);
  loadUserSites(userId);
  loadUserGens(userId);
}

function closeUserModal() {
  document.getElementById('user-modal')?.classList.add('hidden');
}

// Close on backdrop click
document.getElementById('user-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'user-modal') closeUserModal();
});

let auditPage = 1;
async function loadUserAudit(userId, page) {
  if (page) auditPage = page;
  const data = await api(`/users/${userId}/audit?page=${auditPage}&limit=20`);
  if (!data) return;

  const panel = document.getElementById('modal-tab-audit');
  if (!data.entries.length) { panel.innerHTML = '<p class="text-sm text-gray-400 py-4">No activity recorded yet.</p>'; return; }

  panel.innerHTML = `
    <div class="space-y-2 max-h-80 overflow-y-auto">
      ${data.entries.map(e => `
        <div class="flex items-start gap-3 py-2 border-b border-gray-50">
          <div class="shrink-0 mt-0.5">${actionBadge(e.action)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-600">${e.entity_type ? `<span class="text-gray-400">${esc(e.entity_type)}</span> ${esc(e.entity_id)}` : ''}</p>
            ${e.detail && Object.keys(e.detail).length > 0 ? `<p class="text-xs text-gray-400 font-mono truncate">${esc(JSON.stringify(e.detail))}</p>` : ''}
          </div>
          <span class="text-xs text-gray-400 shrink-0" title="${new Date(e.created_at).toLocaleString()}">${timeAgo(e.created_at)}</span>
        </div>
      `).join('')}
    </div>
  `;

  const pag = pagination(auditPage, data.total, data.limit, (p) => loadUserAudit(userId, p));
  if (pag) panel.appendChild(pag);
}

async function loadUserSites(userId) {
  const data = await api(`/users/${userId}/sites`);
  if (!data) return;

  const panel = document.getElementById('modal-tab-sites');
  if (!data.sites.length) { panel.innerHTML = '<p class="text-sm text-gray-400 py-4">No sites.</p>'; return; }

  panel.innerHTML = `
    <div class="space-y-2">
      ${data.sites.map(s => `
        <div class="flex items-center justify-between py-2 border-b border-gray-50">
          <div>
            <p class="text-sm font-medium">${esc(s.title || s.slug)}</p>
            <a href="https://${esc(s.slug)}.flowin.one" target="_blank" class="text-xs text-indigo-500 hover:underline">${esc(s.slug)}.flowin.one</a>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-400">${s.slug_type || 'generated'}${s.custom_domain ? ` &middot; ${esc(s.custom_domain)}` : ''}</p>
            <p class="text-xs text-gray-400">${new Date(s.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadUserGens(userId) {
  const data = await api(`/users/${userId}/generations`);
  if (!data) return;

  const panel = document.getElementById('modal-tab-gens');
  if (!data.generations.length) { panel.innerHTML = '<p class="text-sm text-gray-400 py-4">No generations.</p>'; return; }

  panel.innerHTML = `
    <div class="space-y-2 max-h-80 overflow-y-auto">
      ${data.generations.map(g => `
        <div class="flex items-start gap-3 py-2 border-b border-gray-50">
          <span class="text-xs px-2 py-0.5 rounded bg-gray-100 shrink-0">${esc(g.gen_type)}</span>
          <p class="text-xs text-gray-600 flex-1 truncate">${esc(g.prompt)}</p>
          <span class="text-xs text-gray-400 shrink-0">${g.tokens_in || 0}/${g.tokens_out || 0}</span>
          <span class="text-xs text-gray-400 shrink-0">${timeAgo(g.created_at)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Tiers ─────────────────────────────────────────────────────

async function loadTiers() {
  const data = await api('/tiers');
  if (!data) return;

  const panel = document.getElementById('panel-tiers');
  panel.innerHTML = '';

  for (const tier of data.tiers) {
    const card = h('div', { className: 'bg-white rounded-xl shadow-sm border p-5 mb-4' });
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">${esc(tier.name)} <span class="text-sm text-gray-400">(${tier.slug})</span></h3>
        <span class="text-sm ${tier.is_active ? 'text-green-600' : 'text-red-500'}">${tier.is_active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-3 text-sm mb-3">
        <label class="flex flex-col gap-1"><span class="text-gray-500 text-xs">Price/mo</span><input type="number" step="0.01" value="${tier.price_monthly}" data-field="price_monthly" class="tier-input border rounded px-2 py-1" /></label>
        <label class="flex flex-col gap-1"><span class="text-gray-500 text-xs">Max Sites</span><input type="number" value="${tier.max_sites}" data-field="max_sites" class="tier-input border rounded px-2 py-1" /></label>
        <label class="flex flex-col gap-1"><span class="text-gray-500 text-xs">Max Gens/mo</span><input type="number" value="${tier.max_gens_month}" data-field="max_gens_month" class="tier-input border rounded px-2 py-1" /></label>
      </div>
      <div class="flex gap-4 text-xs mb-3">
        <label><input type="checkbox" ${tier.allows_custom_subdomain ? 'checked' : ''} data-field="allows_custom_subdomain" class="tier-check" /> Custom subdomain</label>
        <label><input type="checkbox" ${tier.allows_custom_domain ? 'checked' : ''} data-field="allows_custom_domain" class="tier-check" /> Custom domain</label>
        <label><input type="checkbox" ${tier.allows_db_apps ? 'checked' : ''} data-field="allows_db_apps" class="tier-check" /> DB apps</label>
        <label><input type="checkbox" ${tier.show_ads ? 'checked' : ''} data-field="show_ads" class="tier-check" /> Show ads</label>
      </div>
      <label class="flex flex-col gap-1 text-sm mb-3"><span class="text-gray-500 text-xs">Features (JSON)</span><textarea data-field="features_list" class="tier-textarea border rounded px-2 py-1 text-xs font-mono h-16">${JSON.stringify(tier.features_list, null, 2)}</textarea></label>
      <label class="flex flex-col gap-1 text-sm mb-3"><span class="text-gray-500 text-xs">Stripe Price ID</span><input type="text" value="${tier.stripe_price_id || ''}" data-field="stripe_price_id" class="tier-input border rounded px-2 py-1" /></label>
      <button class="tier-save px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold" data-tier-id="${tier.id}">Save</button>
    `;
    panel.appendChild(card);

    card.querySelector('.tier-save').addEventListener('click', async () => {
      const updates = {};
      card.querySelectorAll('.tier-input').forEach(inp => {
        const field = inp.dataset.field;
        updates[field] = inp.type === 'number' ? Number(inp.value) : inp.value;
      });
      card.querySelectorAll('.tier-check').forEach(cb => {
        updates[cb.dataset.field] = cb.checked;
      });
      card.querySelectorAll('.tier-textarea').forEach(ta => {
        try { updates[ta.dataset.field] = JSON.parse(ta.value); } catch {}
      });
      await api(`/tiers/${tier.id}`, { method: 'PATCH', body: JSON.stringify(updates) });
      cachedTiers = null;
      alert('Tier saved');
    });
  }
}

// ── Settings ──────────────────────────────────────────────────

async function loadSettings() {
  const data = await api('/settings');
  if (!data) return;

  const panel = document.getElementById('panel-settings');
  const fields = [
    { key: 'free_user_cap', label: 'Free User Cap', type: 'number' },
    { key: 'free_user_budget_usd', label: 'Free User Budget ($)', type: 'number' },
    { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'checkbox' },
    { key: 'maintenance_message', label: 'Maintenance Message', type: 'text' },
    { key: 'adsense_publisher_id', label: 'AdSense Publisher ID', type: 'text' },
    { key: 'adsense_ad_unit_editor', label: 'AdSense Ad Unit (Editor)', type: 'text' },
    { key: 'adsense_ad_unit_sites', label: 'AdSense Ad Unit (Sites)', type: 'text' },
  ];

  panel.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border p-6 max-w-xl">
      <h3 class="font-bold text-lg mb-4">Site Settings</h3>
      ${fields.map(f => `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label>
          ${f.type === 'checkbox'
            ? `<input type="checkbox" ${data[f.key] ? 'checked' : ''} data-key="${f.key}" class="setting-input" />`
            : `<input type="${f.type}" value="${data[f.key] ?? ''}" data-key="${f.key}" class="setting-input w-full border rounded-lg px-3 py-2 text-sm" />`
          }
        </div>
      `).join('')}
      <button id="save-settings" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Save Settings</button>
    </div>
  `;

  document.getElementById('save-settings').addEventListener('click', async () => {
    const updates = {};
    panel.querySelectorAll('.setting-input').forEach(inp => {
      const key = inp.dataset.key;
      if (inp.type === 'checkbox') updates[key] = inp.checked;
      else if (inp.type === 'number') updates[key] = Number(inp.value);
      else updates[key] = inp.value;
    });
    await api('/settings', { method: 'PATCH', body: JSON.stringify(updates) });
    alert('Settings saved');
  });
}

// ── Waitlist ──────────────────────────────────────────────────

async function loadWaitlist() {
  const data = await api('/waitlist');
  if (!data) return;

  const panel = document.getElementById('panel-waitlist');
  panel.innerHTML = `
    <div class="flex items-center gap-4 mb-4">
      <p class="text-sm text-gray-600"><strong>${data.pending_count}</strong> pending</p>
      <button id="admit-batch" class="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold">Admit Next 10</button>
    </div>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-4 py-3 text-left">Email</th>
          <th class="px-4 py-3 text-left">Signed Up</th>
          <th class="px-4 py-3 text-left">Status</th>
          <th class="px-4 py-3 text-left">Actions</th>
        </tr></thead>
        <tbody>
          ${data.entries.map(e => `
            <tr class="border-t">
              <td class="px-4 py-3">${esc(e.email)}</td>
              <td class="px-4 py-3 text-xs text-gray-400">${new Date(e.created_at).toLocaleDateString()}</td>
              <td class="px-4 py-3"><span class="text-xs ${e.admitted ? 'text-green-600' : 'text-amber-600'}">${e.admitted ? 'Admitted' : 'Pending'}</span></td>
              <td class="px-4 py-3">${!e.admitted ? `<button class="admit-one text-xs px-2 py-1 bg-green-50 text-green-700 rounded" data-id="${e.id}">Admit</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('admit-batch').addEventListener('click', async () => {
    await api('/waitlist/admit-batch', { method: 'POST', body: JSON.stringify({ count: 10 }) });
    loadWaitlist();
  });

  panel.querySelectorAll('.admit-one').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/waitlist/${btn.dataset.id}/admit`, { method: 'POST' });
      loadWaitlist();
    });
  });
}

// ── Generation Log ────────────────────────────────────────────

async function loadGenLog() {
  const data = await api('/generation-log');
  if (!data) return;

  const panel = document.getElementById('panel-genlog');
  panel.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-4 py-3 text-left">User</th>
          <th class="px-4 py-3 text-left">Type</th>
          <th class="px-4 py-3 text-left">Prompt</th>
          <th class="px-4 py-3 text-left">Tokens</th>
          <th class="px-4 py-3 text-left">Date</th>
        </tr></thead>
        <tbody>
          ${data.entries.map(e => `
            <tr class="border-t">
              <td class="px-4 py-3 text-xs">${esc(e.email)}</td>
              <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded bg-gray-100">${e.gen_type || 'generate'}</span></td>
              <td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">${esc(e.prompt)}</td>
              <td class="px-4 py-3 text-xs text-gray-400">${e.tokens_in || 0}/${e.tokens_out || 0}</td>
              <td class="px-4 py-3 text-xs text-gray-400">${new Date(e.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Activity Log ──────────────────────────────────────────────

let activityPage = 1;
let activityFilter = '';

async function loadActivity() {
  let url = `/activity?page=${activityPage}&limit=50`;
  if (activityFilter) url += `&action=${encodeURIComponent(activityFilter)}`;

  const data = await api(url);
  if (!data) return;

  // Load available actions for filter
  const actionsData = await api('/activity/actions');
  const actions = actionsData?.actions || [];

  const panel = document.getElementById('panel-activity');
  panel.innerHTML = '';

  // Filter bar
  const filterBar = h('div', { className: 'flex gap-2 mb-4 items-center' });
  const select = h('select', { className: 'border rounded-lg px-3 py-2 text-sm' });
  select.appendChild(h('option', { value: '' }, 'All Actions'));
  actions.forEach(a => {
    const opt = h('option', { value: a }, a);
    if (a === activityFilter) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => { activityFilter = select.value; activityPage = 1; loadActivity(); });
  filterBar.appendChild(select);
  filterBar.appendChild(h('span', { className: 'text-sm text-gray-500' }, `${data.total} total events`));
  panel.appendChild(filterBar);

  // Activity list
  const list = h('div', { className: 'bg-white rounded-xl shadow-sm border divide-y' });
  if (!data.entries.length) {
    list.innerHTML = '<p class="text-sm text-gray-400 py-8 text-center">No activity recorded yet.</p>';
  } else {
    data.entries.forEach(e => {
      const row = h('div', { className: 'flex items-start gap-3 px-4 py-3 hover:bg-gray-50' });
      row.innerHTML = `
        <div class="shrink-0 mt-0.5">${actionBadge(e.action)}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm">
            <span class="font-medium text-gray-800">${esc(e.user_email) || `User #${e.user_id || '?'}`}</span>
            ${e.entity_type ? `<span class="text-gray-400 mx-1">&rarr;</span> <span class="text-gray-500">${esc(e.entity_type)}</span> <span class="font-mono text-xs text-gray-500">${esc(e.entity_id)}</span>` : ''}
          </p>
          ${e.detail && Object.keys(e.detail).length > 0 ? `<p class="text-xs text-gray-400 font-mono truncate mt-0.5">${esc(JSON.stringify(e.detail))}</p>` : ''}
          ${e.ip_address ? `<p class="text-xs text-gray-300 mt-0.5">${esc(e.ip_address)}</p>` : ''}
        </div>
        <div class="shrink-0 text-right">
          <p class="text-xs text-gray-400" title="${new Date(e.created_at).toLocaleString()}">${timeAgo(e.created_at)}</p>
          ${e.user_id ? `<button class="text-xs text-indigo-500 hover:underline mt-1 view-activity-user" data-id="${e.user_id}">View user</button>` : ''}
        </div>
      `;
      list.appendChild(row);
    });
  }
  panel.appendChild(list);

  // Wire view user links
  list.querySelectorAll('.view-activity-user').forEach(btn => {
    btn.addEventListener('click', () => openUserModal(parseInt(btn.dataset.id)));
  });

  // Pagination
  const pag = pagination(activityPage, data.total, data.limit, (p) => { activityPage = p; loadActivity(); });
  if (pag) panel.appendChild(pag);
}

// ── Tabs & Init ───────────────────────────────────────────────

const loaders = {
  users: loadUsers, tiers: loadTiers, settings: loadSettings,
  waitlist: loadWaitlist, genlog: loadGenLog, activity: loadActivity,
};

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('panel-' + btn.dataset.panel);
    if (panel) panel.classList.add('active');
    loaders[btn.dataset.panel]?.();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) { window.location.href = '/index.html'; return; }
  loadOverview();
  loadUsers();
});
