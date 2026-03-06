'use strict';

const ANALYZE_URL = 'https://api.flowin.one/generate/analyze';
const CREDS_BASE = 'https://api.flowin.one/sites';

// ── Pre-flight analysis modal ──────────────────────────────────────

let _preflightResolve = null;
let _preflightAnalysis = null;

function _injectPreflightStyles() {
  if (document.getElementById('preflight-style')) return;
  const style = document.createElement('style');
  style.id = 'preflight-style';
  style.textContent = `
    #preflight-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: pf-fade-in 0.3s ease;
    }
    @keyframes pf-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .pf-card {
      background: white; border-radius: 20px; padding: 36px 40px;
      max-width: 520px; width: 92%; box-shadow: 0 24px 80px rgba(0,0,0,0.2);
      max-height: 90vh; overflow-y: auto;
    }
    .pf-card h2 { margin: 0 0 4px; font-size: 1.4rem; color: #4f46e5; font-weight: 700; }
    .pf-card .pf-subtitle { color: #6b7280; font-size: 0.9rem; margin: 0 0 20px; }
    .pf-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .pf-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 12px; border-radius: 99px; font-size: 0.78rem; font-weight: 600;
    }
    .pf-badge-purple { background: #ede9fe; color: #6d28d9; }
    .pf-badge-blue { background: #dbeafe; color: #1d4ed8; }
    .pf-badge-green { background: #dcfce7; color: #15803d; }
    .pf-badge-amber { background: #fef3c7; color: #b45309; }
    .pf-section { margin-bottom: 20px; }
    .pf-section label { display: block; font-weight: 600; font-size: 0.88rem; color: #374151; margin-bottom: 6px; }
    .pf-section input[type="text"],
    .pf-section select {
      width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 10px;
      font-size: 0.9rem; outline: none; transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .pf-section input:focus, .pf-section select:focus { border-color: #4f46e5; }
    .pf-creds-box {
      background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px;
      padding: 16px; margin-top: 4px;
    }
    .pf-creds-box .pf-creds-row { display: flex; gap: 10px; margin-bottom: 10px; }
    .pf-creds-box .pf-creds-row:last-child { margin-bottom: 0; }
    .pf-creds-box label { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 4px; }
    .pf-creds-box input {
      flex: 1; padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px;
      font-size: 0.85rem; font-family: monospace; outline: none;
    }
    .pf-creds-box input:focus { border-color: #4f46e5; }
    .pf-creds-note { font-size: 0.78rem; color: #9ca3af; margin-top: 8px; }
    .pf-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
    .pf-btn {
      padding: 10px 24px; border-radius: 10px; font-weight: 600; font-size: 0.9rem;
      cursor: pointer; border: none; transition: all 0.2s;
    }
    .pf-btn-primary { background: #4f46e5; color: white; }
    .pf-btn-primary:hover { background: #4338ca; }
    .pf-btn-ghost { background: transparent; color: #6b7280; }
    .pf-btn-ghost:hover { background: #f3f4f6; }
    .pf-reasoning {
      background: #fefce8; border-left: 3px solid #facc15; padding: 10px 14px;
      border-radius: 0 8px 8px 0; font-size: 0.82rem; color: #713f12; margin-bottom: 20px;
    }
  `;
  document.head.appendChild(style);
}

function _generatePassword() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return 'Start-' + Array.from(values, v => charset[v % charset.length]).join('') + '!';
}

function _featureBadges(analysis) {
  const badges = [];
  if (analysis.needs_auth) badges.push({ text: 'Login Required', cls: 'pf-badge-purple', icon: '🔐' });
  if (analysis.needs_database) badges.push({ text: 'Database Needed', cls: 'pf-badge-blue', icon: '🗄' });
  const type = analysis.site_type || 'static';
  if (type === 'static') badges.push({ text: 'Static Site', cls: 'pf-badge-green', icon: '📄' });
  else if (type === 'dynamic') badges.push({ text: 'Dynamic App', cls: 'pf-badge-amber', icon: '⚡' });
  (analysis.features_detected || []).forEach(f => {
    const label = f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    badges.push({ text: label, cls: 'pf-badge-green', icon: '✓' });
  });
  return badges;
}

function showPreflightModal(analysis) {
  _injectPreflightStyles();
  _preflightAnalysis = analysis;

  const badges = _featureBadges(analysis);
  const questions = analysis.questions || [];
  const defaultUser = 'admin';
  const defaultPass = _generatePassword();

  let badgesHtml = badges.map(b =>
    `<span class="pf-badge ${b.cls}">${b.icon} ${b.text}</span>`
  ).join('');

  let questionsHtml = questions.map(q => {
    if (q.type === 'choice' && q.options) {
      const opts = q.options.map(o =>
        `<option value="${o}" ${o === q.default ? 'selected' : ''}>${o}</option>`
      ).join('');
      return `<div class="pf-section">
        <label>${q.question}</label>
        <select data-qid="${q.id}">${opts}</select>
      </div>`;
    }
    return `<div class="pf-section">
      <label>${q.question}</label>
      <input type="text" data-qid="${q.id}" value="${q.default || ''}" placeholder="Type your answer..." />
    </div>`;
  }).join('');

  let credsHtml = '';
  if (analysis.needs_auth) {
    credsHtml = `
      <div class="pf-section">
        <label>Default Login Credentials</label>
        <div class="pf-creds-box">
          <div class="pf-creds-row">
            <div style="flex:1"><label>Username</label><input type="text" id="pf-cred-user" value="${defaultUser}" /></div>
            <div style="flex:1"><label>Password</label><input type="text" id="pf-cred-pass" value="${defaultPass}" /></div>
          </div>
          <p class="pf-creds-note">These will be baked into your site and saved to your dashboard. You can change them anytime.</p>
        </div>
      </div>`;
  }

  const overlay = document.createElement('div');
  overlay.id = 'preflight-overlay';
  overlay.innerHTML = `
    <div class="pf-card">
      <h2>${analysis.suggested_title || 'Your Site'}</h2>
      <p class="pf-subtitle">Here's what we detected from your description</p>
      <div class="pf-badges">${badgesHtml}</div>
      ${analysis.reasoning ? `<div class="pf-reasoning">${analysis.reasoning}</div>` : ''}
      ${questionsHtml}
      ${credsHtml}
      <div class="pf-actions">
        <button class="pf-btn pf-btn-ghost" id="pf-cancel">Cancel</button>
        <button class="pf-btn pf-btn-primary" id="pf-confirm">Generate Site</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    _preflightResolve = resolve;

    document.getElementById('pf-cancel').addEventListener('click', () => {
      _closePreflight();
      resolve(null);
    });

    document.getElementById('pf-confirm').addEventListener('click', () => {
      const answers = {};
      overlay.querySelectorAll('[data-qid]').forEach(el => {
        answers[el.dataset.qid] = el.value;
      });

      let credentials = null;
      if (analysis.needs_auth) {
        credentials = {
          username: document.getElementById('pf-cred-user')?.value || defaultUser,
          password: document.getElementById('pf-cred-pass')?.value || defaultPass,
        };
      }

      _closePreflight();
      resolve({ answers, credentials, analysis });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        _closePreflight();
        resolve(null);
      }
    });
  });
}

function _closePreflight() {
  const el = document.getElementById('preflight-overlay');
  if (el) el.remove();
  _preflightResolve = null;
}

function buildEnhancedPrompt(originalPrompt, preflightResult) {
  if (!preflightResult) return originalPrompt;

  const { answers, credentials, analysis } = preflightResult;
  const lines = [originalPrompt, '', '--- Additional context from user ---'];

  if (analysis.needs_auth && credentials) {
    lines.push(`This site needs authentication. Create a login page with default credentials: username "${credentials.username}" / password "${credentials.password}".`);
    lines.push('Store auth state in localStorage. Include a logout button when logged in.');
    lines.push('After login, show an admin dashboard panel with a grid of clearly labeled management buttons.');
    lines.push('IMPORTANT: Follow the admin dashboard HTML pattern from the system prompt exactly — use data-admin-section and data-admin-label attributes on each button, and include an empty #admin-section-container div.');
    lines.push('Include 3-6 admin buttons appropriate for this type of business (e.g., menu management, reservations, orders, staff, settings).');
    lines.push('Do NOT build the management interfaces — just the dashboard grid with buttons. A second AI pass will build the full CRUD for each section.');
  }

  if (analysis.needs_database) {
    lines.push('This site needs to store and retrieve data. Use localStorage as a simple client-side database for now.');
    lines.push('Structure the data storage so it could be migrated to a real database later.');
  }

  if (answers && Object.keys(answers).length > 0) {
    lines.push('');
    lines.push('User preferences:');
    for (const [key, value] of Object.entries(answers)) {
      if (value) lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

// ── Save credentials after publish ─────────────────────────────────

async function saveCredentialsForSite(slug, credentials) {
  if (!slug || !credentials) return;
  try {
    await fetch(`${CREDS_BASE}/${encodeURIComponent(slug)}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        label: 'Default Admin',
        username: credentials.username,
        password: credentials.password,
      }),
    });
  } catch (err) {
    console.error('Failed to save credentials:', err);
  }
}
