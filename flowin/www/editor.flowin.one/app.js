'use strict';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'manual';
const editSlug = params.get('edit') || '';

const API_BASE = 'https://api.flowin.one';
const PUBLISH_URL = `${API_BASE}/publish`;
const GENERATE_URL = `${API_BASE}/generate`;
const ENHANCE_URL = `${API_BASE}/generate/enhance`;
const SITES_URL = `${API_BASE}/sites`;

const PURPOSE_LABELS = {
  resume: 'Resume or CV',
  portfolio: 'Portfolio or showcase',
  calendar: 'Family or team calendar',
  event: 'Event or RSVP page',
  business: 'Business landing page',
  other: 'Custom site'
};

const FEATURE_LABELS = {
  forms: 'Collect visitor submissions',
  accounts: 'Private areas or sign-in',
  updates: 'Frequently changing data',
  collaboration: 'Shared editing',
  static: 'Static information'
};

const FEATURE_PROMPTS = {
  forms: 'Include a clearly labelled form that stores submissions for later review.',
  accounts: 'Plan for a friendly sign-in experience and explain how Flowin keeps the private area secure.',
  updates: 'Make it easy to update recurring items such as calendar events or schedules.',
  collaboration: 'Highlight how multiple editors can update the same data without conflicts.',
  static: 'Keep the structure simple and easy to edit without extra tooling.'
};

const CADENCE_LABELS = {
  occasionally: 'only occasionally',
  monthly: 'about once a month',
  weekly: 'every week',
  daily: 'daily or in real-time'
};

const CADENCE_PROMPTS = {
  occasionally: 'Content changes are rare, so focus on a durable layout.',
  monthly: 'Assume content is updated monthly and keep the structure easy to edit.',
  weekly: 'Assume weekly updates and design sections that are simple to refresh.',
  daily: 'Expect daily updates; streamline the layout so changes are quick and safe.'
};

const COLOR_SCHEMES = {
  calm: {
    label: 'Breezy blues',
    description: 'Calm, friendly blues with soft purple highlights.',
    background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
    surface: '#ffffff',
    surfaceSoft: 'rgba(99, 102, 241, 0.08)',
    surfaceAccent: 'rgba(99, 102, 241, 0.12)',
    primary: '#4f46e5',
    primaryDark: '#3730a3',
    accent: '#a855f7',
    accentSoft: 'rgba(168, 85, 247, 0.18)',
    text: '#1f2937',
    muted: '#64748b',
    badgeBg: 'rgba(251, 146, 60, 0.15)',
    badgeText: '#c2410c',
    prompt: 'Use calming blues and violets with rounded surfaces and soft shadows.'
  },
  sunrise: {
    label: 'Warm sunrise',
    description: 'Inviting oranges and pinks with plenty of white space.',
    background: 'linear-gradient(135deg, #fff7ed, #fee2e2)',
    surface: '#ffffff',
    surfaceSoft: 'rgba(251, 146, 60, 0.12)',
    surfaceAccent: 'rgba(236, 72, 153, 0.12)',
    primary: '#f97316',
    primaryDark: '#c2410c',
    accent: '#ec4899',
    accentSoft: 'rgba(236, 72, 153, 0.15)',
    text: '#1f2937',
    muted: '#6b7280',
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    badgeText: '#be185d',
    prompt: 'Blend warm orange and pink gradients with bright call-to-action elements.'
  },
  forest: {
    label: 'Fresh greens',
    description: 'Nature-inspired greens with crisp white cards.',
    background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
    surface: '#ffffff',
    surfaceSoft: 'rgba(34, 197, 94, 0.12)',
    surfaceAccent: 'rgba(14, 165, 233, 0.12)',
    primary: '#16a34a',
    primaryDark: '#047857',
    accent: '#0ea5e9',
    accentSoft: 'rgba(14, 165, 233, 0.15)',
    text: '#134e4a',
    muted: '#0f766e',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeText: '#1d4ed8',
    prompt: 'Use leafy greens, clean white surfaces, and relaxed rounded corners.'
  },
  minimal: {
    label: 'Classic minimal',
    description: 'Crisp neutrals with strong typography and subtle shadows.',
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceSoft: '#f3f4f6',
    surfaceAccent: '#e5e7eb',
    primary: '#111827',
    primaryDark: '#0f172a',
    accent: '#4b5563',
    accentSoft: '#e5e7eb',
    text: '#111827',
    muted: '#6b7280',
    badgeBg: '#e5e7eb',
    badgeText: '#111827',
    prompt: 'Keep things minimal with dark text on light neutrals and tidy spacing.'
  }
};

const TABLE_TEMPLATES = {
  sites: {
    name: 'sites',
    description: 'Tracks each Flowin site instance and its owner.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'owner_id uuid references auth.users not null',
      'site_slug text unique',
      'title text',
      'created_at timestamptz default now()'
    ],
    policies: [
      'Allow owners to manage their sites: auth.uid() = owner_id.'
    ]
  },
  events: {
    name: 'events',
    description: 'Stores calendar items, schedules, or recurring plans.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'title text',
      'details text',
      'starts_at timestamptz',
      'ends_at timestamptz',
      'is_all_day boolean default false',
      'location text',
      'created_by uuid references auth.users'
    ],
    policies: [
      'Owners or collaborators tied to the same site_id can select/insert/update.',
      'Only allow deletes from owners to avoid accidental loss.'
    ]
  },
  submissions: {
    name: 'submissions',
    description: 'Captures form responses or RSVPs from visitors.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'form_slug text',
      'payload jsonb',
      'submitted_at timestamptz default now()'
    ],
    policies: [
      'Site owners can read all submissions for their site.',
      'Allow anonymous inserts so public forms can post data.'
    ]
  },
  members: {
    name: 'members',
    description: 'Keeps track of collaborators or family members allowed to edit.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'user_id uuid references auth.users',
      'email text',
      'role text default "editor"',
      'invited_at timestamptz default now()'
    ],
    policies: [
      'Owners can invite and manage members for their site.',
      'Members can read rows where auth.uid() = user_id.'
    ]
  },
  projects: {
    name: 'projects',
    description: 'Stores portfolio pieces, resume highlights, or case studies.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'title text',
      'summary text',
      'tags text[]',
      'order_index int default 0',
      'featured boolean default false'
    ],
    policies: [
      'Owners and members for the same site can manage project rows.'
    ]
  },
  offerings: {
    name: 'offerings',
    description: 'Lists services or products for a business landing page.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'title text',
      'price text',
      'description text',
      'image_url text'
    ],
    policies: [
      'Restrict selects and updates to site owners and members.'
    ]
  },
  rsvps: {
    name: 'rsvps',
    description: 'Records guests attending an event, including their responses.',
    columns: [
      'id uuid primary key default uuid_generate_v4()',
      'site_id uuid references sites(id) on delete cascade',
      'guest_name text',
      'contact text',
      'party_size int',
      'status text default "pending"',
      'submitted_at timestamptz default now()'
    ],
    policies: [
      'Allow anonymous inserts; limit reads to site owners and members.'
    ]
  }
};

const HERO_COPY = {
  resume: {
    title: 'Your Name',
    subtitle: 'Role · Location',
    body: 'Add a friendly introduction and highlight your experience with the sections below.'
  },
  portfolio: {
    title: 'Showcase Your Work',
    subtitle: 'Creative projects & success stories',
    body: 'Tell visitors what you do, then populate the project cards with your favourite wins.'
  },
  calendar: {
    title: 'Family & Friends Hub',
    subtitle: 'Keep everyone in sync',
    body: 'Events you add in Flowin will appear here automatically so nobody misses a date.'
  },
  event: {
    title: 'You’re Invited!',
    subtitle: 'Celebrate with us',
    body: 'Share event details, gather RSVPs, and keep your guest list in one place.'
  },
  business: {
    title: 'Welcome to Our Business',
    subtitle: 'Services, pricing, and testimonials',
    body: 'Explain what you offer and edit Flowin content any time to keep this page fresh.'
  },
  other: {
    title: 'Flowin Site Starter',
    subtitle: 'A Flowin-powered experience',
    body: 'Adjust the layout to match your idea. The sections below stay synced with Flowin.'
  }
};

const state = {
  needsDatabase: false,
  purpose: 'resume',
  features: [],
  updateCadence: 'occasionally',
  extraNotes: '',
  siteName: '',
  initialUsername: '',
  defaultPassword: '',
  colorScheme: 'calm',
  estimatedCost: null,
  schema: []
};

const elements = {
  promptSection: document.getElementById('prompt-section'),
  editorSection: document.getElementById('editor-section'),
  promptField: document.getElementById('prompt'),
  result: document.getElementById('result'),
  intakeSummary: document.getElementById('intake-summary'),
  intakeSummaryText: document.getElementById('intake-summary-text'),
  databaseAdvice: document.getElementById('database-advice'),
  databaseAdviceLine: document.getElementById('database-advice-line'),
  staticAdvice: document.getElementById('static-advice'),
  supabaseSection: document.getElementById('supabase-section'),
  databaseCost: document.getElementById('database-cost'),
  intakeForm: document.getElementById('intake-form'),
  accountsCredentials: document.getElementById('accounts-credentials'),
  initialUsernameInput: document.getElementById('initial-username'),
  initialUsernameHint: document.getElementById('initial-username-hint'),
  publishButton: document.getElementById('publish-button'),
  generateButton: document.getElementById('generate-button'),
  analyzeButton: document.getElementById('analyze-needs')
};

function toggleElement(el, shouldShow) {
  if (!el) return;
  el.classList.toggle('hidden', !shouldShow);
}

function getColorScheme(key) {
  return COLOR_SCHEMES[key] || COLOR_SCHEMES.calm;
}

function estimateDatabaseCost(currentState) {
  let monthly = 12;
  if (currentState.features.includes('accounts')) {
    monthly += 5;
  }
  if (currentState.features.includes('forms') || currentState.features.includes('updates')) {
    monthly += 3;
  }
  if (currentState.features.includes('collaboration')) {
    monthly += 2;
  }
  return `$${monthly}/month`;
}

function createDefaultPassword() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const length = 10;
  let password = 'Start-';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    password += Array.from(values, (value) => charset[value % charset.length]).join('');
  } else {
    for (let index = 0; index < length; index += 1) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
  }
  return `${password}!`;
}

function getAccountsCheckbox() {
  if (!elements.intakeForm) return null;
  return elements.intakeForm.querySelector('input[name="feature"][value="accounts"]');
}

function resetInitialUsernameHint() {
  if (!elements.initialUsernameHint) return;
  elements.initialUsernameHint.textContent = 'Use letters, numbers, dashes, or underscores (min 3 characters). We\'ll generate a temporary password for this account.';
  elements.initialUsernameHint.style.color = '#6b7280';
}

function flagInitialUsernameHint(message) {
  if (!elements.initialUsernameHint) return;
  elements.initialUsernameHint.textContent = message;
  elements.initialUsernameHint.style.color = '#b91c1c';
}

function updateAccountsCredentialsVisibility() {
  const accountsCheckbox = getAccountsCheckbox();
  const shouldShow = accountsCheckbox ? accountsCheckbox.checked : false;
  toggleElement(elements.accountsCredentials, shouldShow);
  if (elements.initialUsernameInput) {
    elements.initialUsernameInput.required = shouldShow;
    if (shouldShow) {
      resetInitialUsernameHint();
    } else {
      elements.initialUsernameInput.value = '';
      resetInitialUsernameHint();
    }
  }
}

function initLayout() {
  if (mode === 'ai') {
    toggleElement(elements.promptSection, true);
    toggleElement(elements.editorSection, false);
  } else {
    toggleElement(elements.promptSection, false);
    toggleElement(elements.editorSection, true);
  }
}

function setResult(message, type = 'info') {
  if (!elements.result) return;
  elements.result.textContent = message;
  elements.result.classList.remove('text-green-600', 'text-red-600');
  if (type === 'error') {
    elements.result.classList.add('text-red-600');
  } else {
    elements.result.classList.add('text-green-600');
  }
}

function summarizeSelections({ siteName, colorScheme, purpose, features, updateCadence, extraNotes, needsDatabase, estimatedCost, initialUsername, defaultPassword }) {
  const purposeLabel = PURPOSE_LABELS[purpose] || PURPOSE_LABELS.other;
  const featureLabels = features.map((key) => FEATURE_LABELS[key]).filter(Boolean);
  const cadenceDescription = CADENCE_LABELS[updateCadence] || CADENCE_LABELS.occasionally;
  const scheme = getColorScheme(colorScheme);
  const displayName = siteName ? `“${siteName}”` : 'Your Flowin site';

  const summaryParts = [`${displayName} will be a ${purposeLabel.toLowerCase()} experience.`];
  summaryParts.push(`Style: ${scheme.label.toLowerCase()}.`);

  if (featureLabels.length > 0) {
    summaryParts.push(`It should handle: ${featureLabels.join(', ')}.`);
  } else {
    summaryParts.push('No special add-ons selected yet.');
  }

  summaryParts.push(`You expect to update it ${cadenceDescription}.`);

  if (features.includes('accounts')) {
    if (initialUsername && defaultPassword) {
      summaryParts.push(`Starter login ready: username ${initialUsername} / password ${defaultPassword}. The built-in admin panel lets you add teammates and reset passwords.`);
    } else {
      summaryParts.push('We will seed a default admin login when you add accounts.');
    }
  }

  if (needsDatabase && estimatedCost) {
    summaryParts.push(`We’ll keep logins and data running for roughly ${estimatedCost}.`);
  }

  if (extraNotes) {
    summaryParts.push(`Notes: ${extraNotes}.`);
  }

  return summaryParts.join(' ');
}

function buildSchemaRecommendations() {
  const tables = [];
  const addTable = (key) => {
    const table = TABLE_TEMPLATES[key];
    if (!table) return;
    if (tables.some((existing) => existing.name === table.name)) return;
    tables.push(table);
  };

  addTable('sites');

  if (state.purpose === 'calendar' || state.features.includes('updates')) {
    addTable('events');
  }
  if (state.features.includes('forms') || state.purpose === 'event') {
    addTable('submissions');
  }
  if (state.features.includes('accounts') || state.features.includes('collaboration')) {
    addTable('members');
  }
  if (state.purpose === 'portfolio' || state.purpose === 'resume') {
    addTable('projects');
  }
  if (state.purpose === 'business') {
    addTable('offerings');
  }
  if (state.purpose === 'event') {
    addTable('rsvps');
  }

  return tables;
}

function renderSupabaseSection() {
  if (!elements.supabaseSection) return;
  const shouldShow = state.needsDatabase;
  toggleElement(elements.supabaseSection, shouldShow);

  if (!shouldShow) {
    return;
  }

  const cost = state.estimatedCost || estimateDatabaseCost(state);
  state.estimatedCost = cost;

  if (elements.databaseCost) {
    elements.databaseCost.textContent = `Estimated hosted cost: about ${cost}.`;
  }

  if (elements.databaseAdviceLine) {
    elements.databaseAdviceLine.textContent = `Expect Flowin to host logins and data for about ${cost}.`;
  }
}

function getHeroCopy(currentState) {
  const base = HERO_COPY[currentState.purpose] || HERO_COPY.other;
  return {
    title: currentState.siteName || base.title,
    subtitle: base.subtitle,
    body: base.body
  };
}

function createStaticTemplate() {
  const hero = getHeroCopy(state);
  const scheme = getColorScheme(state.colorScheme);
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${hero.title}</title>`,
    '  <style>',
    '    :root {',
    '      color-scheme: light;',
    '      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    `      --bg: ${scheme.background};`,
    `      --surface: ${scheme.surface};`,
    `      --surface-soft: ${scheme.surfaceSoft};`,
    `      --surface-accent: ${scheme.surfaceAccent};`,
    `      --primary: ${scheme.primary};`,
    `      --primary-dark: ${scheme.primaryDark};`,
    `      --text: ${scheme.text};`,
    `      --muted: ${scheme.muted};`,
    '    }',
    '    body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); }',
    '    .page { max-width: 960px; margin: 0 auto; padding: 64px 24px; }',
    '    .card { background: var(--surface); border-radius: 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); padding: 48px; display: grid; gap: 24px; }',
    '    h1 { font-size: clamp(2.5rem, 8vw, 3.5rem); margin: 0; color: var(--primary); }',
    '    p.lead { font-size: 1.125rem; margin: 0; line-height: 1.6; color: var(--muted); }',
    '    ul { margin: 0; padding-left: 1.25rem; color: var(--muted); }',
    '    .hint { font-size: 0.9rem; color: var(--muted); background: var(--surface-soft); padding: 12px 16px; border-radius: 12px; }',
    '    footer { margin-top: 48px; font-size: 0.875rem; color: var(--muted); text-align: center; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="page">',
    '    <section class="card">',
    `      <header><h1>${hero.title}</h1><p class="lead">${hero.subtitle}</p></header>`,
    `      <p>${hero.body}</p>`,
    '      <div class="hint">Use this as a starting point, then ask Flowin again any time you need sign-ins or live data.</div>',
    '      <ul>',
    '        <li>Replace the headline and copy with your own story.</li>',
    '        <li>Add sections, images, or call-to-action buttons as needed.</li>',
    '        <li>When you want live data or logins, rerun the Flowin questionnaire and we will wire it up.</li>',
    '      </ul>',
    '    </section>',
    '    <footer>Built with Flowin 🌀</footer>',
    '  </main>',
    '</body>',
    '</html>'
  ].join('\n');
}

function schemaHas(name) {
  return state.schema.some((table) => table.name === name);
}

function buildSupabaseTemplate(currentState) {
  const hero = getHeroCopy(currentState);
  const scheme = getColorScheme(currentState.colorScheme);
  const sections = [];
  const functionBlocks = [];
  const loadFunctionNames = [];
  const setupCalls = [];

  sections.push([
    '    <header class="hero">',
    `      <h1>${hero.title}</h1>`,
    `      <p class="hero-sub">${hero.subtitle}</p>`,
    `      <p class="hero-body">${hero.body}</p>`,
    '    </header>'
  ].join('\n'));

  if (currentState.extraNotes) {
    sections.push([
      '    <section class="card note-card">',
      '      <h2>Notes for Flowin</h2>',
      `      <p>${currentState.extraNotes.replace(/</g, '&lt;')}</p>`,
      '    </section>'
    ].join('\n'));
  }

  if (currentState.features.includes('accounts')) {
    const adminUsername = currentState.initialUsername || 'admin';
    const adminPassword = currentState.defaultPassword || createDefaultPassword();
    const adminUsernameLiteral = JSON.stringify(adminUsername);
    const adminPasswordLiteral = JSON.stringify(adminPassword);

    sections.push([
      '    <section class="card auth-card">',
      '      <h2 class="section-title">Member sign-in</h2>',
      `      <p class="muted">Starter credentials — username <code>${adminUsername}</code> / password <code>${adminPassword}</code>. Sign in once, then change them from the admin panel.</p>`,
      '      <form id="account-login-form" class="form-grid auth-form credentials-form">',
      '        <label>',
      '          <span>Username</span>',
      `          <input name="username" type="text" autocomplete="username" required placeholder="${adminUsername}" />`,
      '        </label>',
      '        <label>',
      '          <span>Password</span>',
      '          <input name="password" type="password" autocomplete="current-password" required placeholder="••••••••" />',
      '        </label>',
      '        <button type="submit" class="primary">Sign in</button>',
      '      </form>',
      `      <p id="login-status" class="message muted" data-tone="muted">Starter login — username ${adminUsername} / password ${adminPassword}. Change it after signing in.</p>`,
      '      <div id="member-area" class="member-area hidden">',
      '        <h3>Private area placeholder</h3>',
      '        <p class="muted">Swap this for calendars, notes, or dashboards once someone signs in.</p>',
      '        <button id="signout-button" class="secondary">Sign out</button>',
      '      </div>',
      '      <div id="admin-panel" class="admin-panel hidden">',
      '        <h3>Account manager</h3>',
      '        <p class="muted">Admins can add teammates and reset passwords from here.</p>',
      '        <div id="user-list" class="stack"></div>',
      '        <form id="add-user-form" class="form-grid inline-form">',
      '          <label>',
      '            <span>New username</span>',
      '            <input name="new_username" type="text" autocomplete="off" required placeholder="teammate-name" />',
      '          </label>',
      '          <label>',
      '            <span>Temporary password</span>',
      '            <input name="new_password" type="text" required placeholder="Share securely" />',
      '          </label>',
      '          <label class="toggle">',
      '            <input name="new_is_admin" type="checkbox" />',
      '            <span>Give admin access</span>',
      '          </label>',
      '          <button type="submit" class="primary">Add user</button>',
      '        </form>',
      '      </div>',
      '    </section>'
    ].join('\n'));

    functionBlocks.push(String.raw`async function setupAccountsUi() {
  const form = document.getElementById('account-login-form');
  const status = document.getElementById('login-status');
  const memberArea = document.getElementById('member-area');
  const adminPanel = document.getElementById('admin-panel');
  const userList = document.getElementById('user-list');
  const addUserForm = document.getElementById('add-user-form');
  const signOutButton = document.getElementById('signout-button');
  if (!form || !status || !memberArea || !signOutButton) return;

  const STORAGE_KEY = 'flowin-users-' + SITE_ID;
  const SESSION_KEY = STORAGE_KEY + '-session';
  const DEFAULT_USERNAME = ${adminUsernameLiteral};
  const DEFAULT_PASSWORD = ${adminPasswordLiteral};
  let currentUser = null;

  const safeParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn('Unable to parse stored data', error);
      return fallback;
    }
  };

  const readUsers = () => safeParse(localStorage.getItem(STORAGE_KEY), []);
  const writeUsers = (users) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  };

  const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

  const hashPassword = async (password) => {
    if (window.crypto && window.crypto.subtle) {
      const encoded = new TextEncoder().encode(password);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      return toHex(digest);
    }
    let hash = 0;
    for (let index = 0; index < password.length; index += 1) {
      hash = (hash << 5) - hash + password.charCodeAt(index);
      hash |= 0;
    }
    return String(hash);
  };

  const findUser = (username, users) => users.find((user) => user.username.toLowerCase() === username.toLowerCase());

  const persistSession = (user) => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const restoreSession = () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parsed = safeParse(stored, null);
    if (!parsed || !parsed.username) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const users = readUsers();
    const match = findUser(parsed.username, users);
    if (!match) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { username: match.username, isAdmin: Boolean(match.isAdmin) };
  };

  const ensureDefaultUser = async () => {
    const users = readUsers();
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const existing = findUser(DEFAULT_USERNAME, users);

    if (existing) {
      if (existing.seeded !== false && existing.passwordHash !== passwordHash) {
        existing.passwordHash = passwordHash;
        existing.isAdmin = true;
        existing.seeded = true;
        if (!existing.createdAt) {
          existing.createdAt = new Date().toISOString();
        }
        writeUsers(users);
      }
      return;
    }

    users.push({
      username: DEFAULT_USERNAME,
      passwordHash,
      isAdmin: true,
      createdAt: new Date().toISOString(),
      seeded: true
    });
    writeUsers(users);
  };

  const refreshUserList = async () => {
    if (!adminPanel || !userList) return;
    userList.innerHTML = '';
    const users = readUsers();
    if (!users.length) {
      userList.appendChild(createMessage('No users yet. Add teammates below.', 'muted'));
      return;
    }

    users.forEach((user) => {
      const row = document.createElement('div');
      row.className = 'card-item';

      const header = document.createElement('div');
      header.className = 'grid-item-header';
      const name = document.createElement('strong');
      name.textContent = user.username;
      const role = document.createElement('span');
      role.className = 'badge';
      role.textContent = user.isAdmin ? 'Admin' : 'Member';
      header.appendChild(name);
      header.appendChild(role);
      row.appendChild(header);

      const description = document.createElement('p');
      description.className = 'muted';
      description.textContent = user.isAdmin
        ? 'Admins can manage other accounts and reset passwords.'
        : 'Members can view private areas without changing other accounts.';
      row.appendChild(description);

      const changeButton = document.createElement('button');
      changeButton.type = 'button';
      changeButton.className = 'secondary';
      changeButton.textContent = 'Change password';
      changeButton.addEventListener('click', async () => {
        const nextPassword = window.prompt('Enter a new password for ' + user.username);
        if (!nextPassword) {
          return;
        }
        const trimmed = nextPassword.trim();
        if (trimmed.length < 6) {
          window.alert('Use at least 6 characters for a password.');
          return;
        }
        const latestUsers = readUsers();
        const target = findUser(user.username, latestUsers);
        if (!target) {
          window.alert('That account no longer exists.');
          return;
        }
        target.passwordHash = await hashPassword(trimmed);
        target.seeded = false;
        writeUsers(latestUsers);
        setStatus(status, 'Password updated for ' + user.username + '.', 'success');
      });
      row.appendChild(changeButton);

      userList.appendChild(row);
    });
  };

  const updateUi = () => {
    const signedIn = Boolean(currentUser);
    memberArea.classList.toggle('hidden', !signedIn);
    if (adminPanel) {
      adminPanel.classList.toggle('hidden', !signedIn || !currentUser.isAdmin);
    }
    if (!signedIn) {
      setStatus(status, 'Starter login — username ' + DEFAULT_USERNAME + ' / password ' + DEFAULT_PASSWORD + '. Sign in and update it from the admin panel.', 'muted');
    } else if (currentUser.isAdmin) {
      setStatus(status, 'Signed in as ' + currentUser.username + '. Admin controls are unlocked below.', 'success');
    } else {
      setStatus(status, 'Signed in as ' + currentUser.username + '.', 'success');
    }
  };

  await ensureDefaultUser();
  currentUser = restoreSession();
  if (currentUser && currentUser.isAdmin) {
    await refreshUserList();
  }
  updateUi();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();
    if (!username || !password) {
      setStatus(status, 'Enter a username and password to sign in.', 'error');
      return;
    }
    const users = readUsers();
    const match = findUser(username, users);
    if (!match) {
      setStatus(status, 'That account was not found.', 'error');
      return;
    }
    const hashed = await hashPassword(password);
    if (hashed !== match.passwordHash) {
      setStatus(status, 'Incorrect password. Try again.', 'error');
      return;
    }
    currentUser = { username: match.username, isAdmin: Boolean(match.isAdmin) };
    persistSession(currentUser);
    form.reset();
    updateUi();
    if (currentUser.isAdmin) {
      await refreshUserList();
    }
  });

  signOutButton.addEventListener('click', () => {
    currentUser = null;
    persistSession(null);
    updateUi();
  });

  if (addUserForm) {
    addUserForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentUser || !currentUser.isAdmin) {
        setStatus(status, 'Only admins can add accounts.', 'error');
        return;
      }
      const formData = new FormData(addUserForm);
      const newUsername = String(formData.get('new_username') || '').trim();
      const newPassword = String(formData.get('new_password') || '').trim();
      const wantsAdmin = formData.get('new_is_admin') === 'on';

      if (!newUsername || !/^[A-Za-z0-9._-]{3,}$/.test(newUsername)) {
        setStatus(status, 'Choose a username with at least 3 characters using letters, numbers, dots, dashes, or underscores.', 'error');
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        setStatus(status, 'Temporary passwords need at least 6 characters.', 'error');
        return;
      }

      const users = readUsers();
      if (findUser(newUsername, users)) {
        setStatus(status, 'That username is already in use.', 'error');
        return;
      }

      users.push({
        username: newUsername,
        passwordHash: await hashPassword(newPassword),
        isAdmin: wantsAdmin,
        createdAt: new Date().toISOString(),
        seeded: false
      });
      writeUsers(users);
      addUserForm.reset();
      setStatus(status, 'Added ' + newUsername + ' with a temporary password.', 'success');
      await refreshUserList();
    });
  }
}`);
    setupCalls.push('await setupAccountsUi();');
  }

  if (schemaHas('events')) {
    sections.push([
      '    <section class="card">',
      '      <h2 class="section-title">Upcoming Events</h2>',
      '      <p class="muted">Add events in Flowin to keep friends and family in sync.</p>',
      '      <ul id="events-list" class="stack"></ul>',
      '    </section>'
    ].join('\n'));
    functionBlocks.push(String.raw`async function loadEvents() {
  const list = document.getElementById('events-list');
  if (!list) return;
  list.innerHTML = '';
  list.appendChild(createMessage('Loading events…', 'muted'));

  const { data, error } = await supabase
    .from('events')
    .select('id, title, details, starts_at, ends_at, is_all_day, location')
    .eq('site_id', SITE_ID)
    .order('starts_at', { ascending: true });

  list.innerHTML = '';

  if (error) {
    list.appendChild(createMessage('Unable to load events: ' + error.message, 'error'));
    console.error('loadEvents', error);
    return;
  }

  if (!data || data.length === 0) {
    list.appendChild(createMessage('Add events in Flowin to see them here.', 'muted'));
    return;
  }

  data.forEach((event) => {
    const li = document.createElement('li');
    li.className = 'card-item';

    const title = document.createElement('h3');
    title.textContent = event.title || 'Untitled event';
    li.appendChild(title);

    if (event.starts_at) {
      const time = document.createElement('p');
      time.className = 'muted';
      time.textContent = formatDateRange(event.starts_at, event.ends_at, event.is_all_day);
      li.appendChild(time);
    }

    if (event.location) {
      const location = document.createElement('p');
      location.className = 'badge';
      location.textContent = event.location;
      li.appendChild(location);
    }

    if (event.details) {
      const details = document.createElement('p');
      details.textContent = event.details;
      li.appendChild(details);
    }

    list.appendChild(li);
  });
}`);
    loadFunctionNames.push('loadEvents');
  }

  if (schemaHas('projects')) {
    sections.push([
      '    <section class="card">',
      '      <h2 class="section-title">Featured Projects</h2>',
      '      <div id="projects-grid" class="grid"></div>',
      '    </section>'
    ].join('\n'));
    functionBlocks.push(String.raw`async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  grid.innerHTML = '<p class="message muted">Loading projects…</p>';

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, summary, tags, order_index, featured')
    .eq('site_id', SITE_ID)
    .order('order_index', { ascending: true });

  if (error) {
    grid.innerHTML = '<p class="message error">Unable to load projects: ' + error.message + '</p>';
    console.error('loadProjects', error);
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="message muted">Add portfolio items in Flowin to showcase them here.</p>';
    return;
  }

  grid.innerHTML = '';

  data.forEach((project) => {
    const article = document.createElement('article');
    article.className = 'grid-item';
    if (project.featured) {
      article.classList.add('featured');
    }

    const title = document.createElement('h3');
    title.textContent = project.title || 'Untitled project';
    article.appendChild(title);

    if (project.summary) {
      const summary = document.createElement('p');
      summary.textContent = project.summary;
      article.appendChild(summary);
    }

    if (Array.isArray(project.tags) && project.tags.length > 0) {
      const tagList = document.createElement('ul');
      tagList.className = 'tag-list';
      project.tags.forEach((tag) => {
        const li = document.createElement('li');
        li.textContent = tag;
        tagList.appendChild(li);
      });
      article.appendChild(tagList);
    }

    grid.appendChild(article);
  });
}`);
    loadFunctionNames.push('loadProjects');
  }

  if (schemaHas('offerings')) {
    sections.push([
      '    <section class="card">',
      '      <h2 class="section-title">Services & Pricing</h2>',
      '      <div id="offerings-grid" class="grid"></div>',
      '    </section>'
    ].join('\n'));
    functionBlocks.push(String.raw`async function loadOfferings() {
  const grid = document.getElementById('offerings-grid');
  if (!grid) return;
  grid.innerHTML = '<p class="message muted">Loading services…</p>';

  const { data, error } = await supabase
    .from('offerings')
    .select('id, title, price, description, image_url')
    .eq('site_id', SITE_ID)
    .order('title', { ascending: true });

  if (error) {
    grid.innerHTML = '<p class="message error">Unable to load services: ' + error.message + '</p>';
    console.error('loadOfferings', error);
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="message muted">Add offerings in Flowin to list them here.</p>';
    return;
  }

  grid.innerHTML = '';

  data.forEach((offering) => {
    const article = document.createElement('article');
    article.className = 'grid-item';

    const header = document.createElement('div');
    header.className = 'grid-item-header';

    const title = document.createElement('h3');
    title.textContent = offering.title || 'Service';
    header.appendChild(title);

    if (offering.price) {
      const price = document.createElement('span');
      price.className = 'badge';
      price.textContent = offering.price;
      header.appendChild(price);
    }

    article.appendChild(header);

    if (offering.description) {
      const description = document.createElement('p');
      description.textContent = offering.description;
      article.appendChild(description);
    }

    if (offering.image_url) {
      const image = document.createElement('img');
      image.src = offering.image_url;
      image.alt = offering.title ? offering.title + ' image' : 'Service image';
      image.loading = 'lazy';
      article.appendChild(image);
    }

    grid.appendChild(article);
  });
}`);
    loadFunctionNames.push('loadOfferings');
  }

  if (schemaHas('submissions')) {
    sections.push([
      '    <section class="card">',
      '      <h2 class="section-title">Get in touch</h2>',
      '      <p class="muted">Messages land in the <code>submissions</code> table with the slug <code>contact</code>.</p>',
      '      <form id="submission-form" class="form-grid">',
      '        <label>',
      '          <span>Name</span>',
      '          <input name="name" type="text" required placeholder="Your name" />',
      '        </label>',
      '        <label>',
      '          <span>Email</span>',
      '          <input name="email" type="email" required placeholder="you@example.com" />',
      '        </label>',
      '        <label class="full">',
      '          <span>Message</span>',
      '          <textarea name="message" rows="4" required placeholder="How can we help?"></textarea>',
      '        </label>',
      '        <button type="submit" class="primary">Send message</button>',
      '      </form>',
      '      <p id="submission-status" class="message muted" data-tone="muted"></p>',
      '    </section>'
    ].join('\n'));
    functionBlocks.push(String.raw`function setupSubmissionForm() {
  const form = document.getElementById('submission-form');
  const status = document.getElementById('submission-status');
  if (!form) return;

  const showStatus = (message, tone = 'muted') => {
    if (status) {
      setStatus(status, message, tone);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    showStatus('Sending…');

    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message')
    };

    const { error } = await supabase.from('submissions').insert({
      site_id: SITE_ID,
      form_slug: 'contact',
      payload
    });

    if (error) {
      console.error('submission error', error);
      showStatus('Could not send your message. Please try again.', 'error');
      return;
    }

    form.reset();
    showStatus('Thanks! We received your message.', 'success');
  });
}`);
    setupCalls.push('setupSubmissionForm();');
  }

  if (schemaHas('rsvps')) {
    sections.push([
      '    <section class="card">',
      '      <h2 class="section-title">RSVP</h2>',
      '      <p class="muted">This form writes to the <code>rsvps</code> table.</p>',
      '      <form id="rsvp-form" class="form-grid">',
      '        <label>',
      '          <span>Name</span>',
      '          <input name="guest_name" type="text" required placeholder="Guest name" />',
      '        </label>',
      '        <label>',
      '          <span>Email or phone</span>',
      '          <input name="contact" type="text" required placeholder="Reach you at…" />',
      '        </label>',
      '        <label>',
      '          <span>Party size</span>',
      '          <input name="party_size" type="number" min="1" value="1" required />',
      '        </label>',
      '        <label class="full">',
      '          <span>Notes</span>',
      '          <textarea name="notes" rows="3" placeholder="Dietary needs or song requests"></textarea>',
      '        </label>',
      '        <button type="submit" class="primary">Confirm attendance</button>',
      '      </form>',
      '      <p id="rsvp-status" class="message muted" data-tone="muted"></p>',
      '    </section>'
    ].join('\n'));
    functionBlocks.push(String.raw`function setupRsvpForm() {
  const form = document.getElementById('rsvp-form');
  const status = document.getElementById('rsvp-status');
  if (!form) return;

  const showStatus = (message, tone = 'muted') => {
    if (status) {
      setStatus(status, message, tone);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    showStatus('Saving RSVP…');

    const submission = {
      site_id: SITE_ID,
      guest_name: formData.get('guest_name'),
      contact: formData.get('contact'),
      party_size: Number(formData.get('party_size') || 1),
      notes: formData.get('notes') || ''
    };

    const { error } = await supabase.from('rsvps').insert(submission);

    if (error) {
      console.error('rsvp error', error);
      showStatus('We could not save your RSVP. Please try again.', 'error');
      return;
    }

    form.reset();
    showStatus('Thanks! Your RSVP is confirmed.', 'success');
  });
}`);
    setupCalls.push('setupRsvpForm();');
  }

  const helperBlock = String.raw`function createMessage(text, tone = 'muted') {
  const p = document.createElement('p');
  p.className = 'message ' + tone;
  p.textContent = text;
  return p;
}

function setStatus(element, message, tone = 'muted') {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.className = 'message ' + tone;
}

function formatDateRange(start, end, allDay) {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const baseOptions = { dateStyle: 'medium' };
  const withTime = { dateStyle: 'medium', timeStyle: 'short' };
  const formatter = new Intl.DateTimeFormat(undefined, allDay ? baseOptions : withTime);
  if (!endDate) {
    return formatter.format(startDate);
  }
  return formatter.format(startDate) + ' → ' + formatter.format(endDate);
}`;

  const loadBlock = loadFunctionNames.length > 0
    ? `await Promise.all([\n      ${loadFunctionNames.map((name) => `${name}()`).join(',\n      ')}\n    ]);`
    : '';

  const setupBlock = setupCalls.length > 0 ? setupCalls.join('\n      ') : '';

  const script = [
    '  <script type="module">',
    "    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';",
    `    const SUPABASE_URL = '${SUPABASE_URL}';`,
    `    const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';`,
    "    // Replace SITE_ID with the UUID from your Supabase 'sites' table.",
    "    const SITE_ID = 'REPLACE_WITH_SITE_UUID';",
    '',
    '    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);',
    '',
    `    ${helperBlock.split('\n').join('\n    ')}`,
    '',
    functionBlocks.length > 0 ? functionBlocks.map((block) => block.split('\n').map((line) => `    ${line}`).join('\n')).join('\n\n') : '',
    '',
    '    async function init() {',
    setupBlock ? `      ${setupBlock}` : '',
    loadBlock ? `      ${loadBlock}` : '',
    '    }',
    '',
    '    document.addEventListener(' + "'DOMContentLoaded'" + ', init);',
    '  </script>'
  ].join('\n');

  const template = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${hero.title}</title>`,
    '  <style>',
    '    :root {',
    '      color-scheme: light;',
    '      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    `      --bg: ${scheme.background};`,
    `      --surface: ${scheme.surface};`,
    `      --surface-soft: ${scheme.surfaceSoft};`,
    `      --surface-accent: ${scheme.surfaceAccent};`,
    `      --primary: ${scheme.primary};`,
    `      --primary-dark: ${scheme.primaryDark};`,
    `      --accent: ${scheme.accent};`,
    `      --accent-soft: ${scheme.accentSoft};`,
    `      --text: ${scheme.text};`,
    `      --muted: ${scheme.muted};`,
    `      --badge-bg: ${scheme.badgeBg};`,
    `      --badge-text: ${scheme.badgeText};`,
    '    }',
    '    body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }',
    '    main { max-width: 960px; margin: 0 auto; padding: 64px 24px 96px; display: grid; gap: 32px; }',
    '    .hero { background: linear-gradient(135deg, var(--primary), var(--accent)); border-radius: 32px; padding: 48px; color: #f9fafb; box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18); }',
    '    .hero h1 { font-size: clamp(2.75rem, 9vw, 3.75rem); margin: 0 0 12px; }',
    '    .hero-sub { margin: 0 0 16px; font-size: 1.25rem; opacity: 0.9; }',
    '    .hero-body { margin: 0; font-size: 1rem; max-width: 540px; line-height: 1.6; }',
    '    .card { background: var(--surface); border-radius: 24px; padding: 40px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08); display: grid; gap: 20px; }',
    '    .card.note-card { border: 1px dashed var(--accent); background: var(--surface-accent); }',
    '    .section-title { font-size: 1.75rem; margin: 0; color: var(--primary); }',
    '    .muted { color: var(--muted); font-size: 0.95rem; margin: 0; }',
    '    .stack { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }',
    '    .card-item { background: var(--surface-soft); border-radius: 18px; padding: 20px 24px; display: grid; gap: 8px; }',
    '    .badge { display: inline-block; background: var(--badge-bg); color: var(--badge-text); padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; width: fit-content; }',
    '    .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }',
    '    .grid-item { background: var(--surface-soft); border-radius: 18px; padding: 24px; display: grid; gap: 12px; border: 1px solid var(--surface-accent); }',
    '    .grid-item.featured { border: 1px solid var(--accent); background: var(--accent-soft); }',
    '    .grid-item img { width: 100%; border-radius: 12px; object-fit: cover; }',
    '    .grid-item-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }',
    '    .tag-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }',
    '    .tag-list li { background: var(--badge-bg); color: var(--badge-text); padding: 2px 12px; border-radius: 999px; font-size: 0.8rem; }',
    '    .form-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }',
    '    .form-grid label { display: grid; gap: 6px; font-size: 0.9rem; color: var(--primary); }',
    '    .form-grid input, .form-grid textarea { border: 1px solid var(--surface-accent); border-radius: 12px; padding: 12px 14px; font-size: 1rem; font-family: inherit; background: #ffffff; color: var(--text); }',
    '    .form-grid textarea { resize: vertical; }',
    '    .form-grid .full { grid-column: 1 / -1; }',
    '    .primary { background: var(--primary); color: #f9fafb; border: none; border-radius: 999px; padding: 12px 20px; font-weight: 600; cursor: pointer; justify-self: start; transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }',
    '    .primary:hover { transform: translateY(-1px); box-shadow: 0 12px 20px rgba(15, 23, 42, 0.18); background: var(--primary-dark); }',
    '    .secondary { background: transparent; color: var(--primary); border: 1px solid var(--primary); border-radius: 999px; padding: 10px 18px; font-weight: 600; cursor: pointer; transition: background 0.2s ease, color 0.2s ease; justify-self: start; }',
    '    .secondary:hover { background: var(--primary); color: var(--surface); }',
    '    .message { font-size: 0.95rem; margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--surface-soft); color: var(--primary); }',
    '    .message.success { background: rgba(34, 197, 94, 0.12); color: #166534; }',
    '    .message.error { background: rgba(239, 68, 68, 0.12); color: #991b1b; }',
    '    .message.muted { color: var(--muted); }',
    '    .auth-form { align-items: end; }',
    '    .credentials-form { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }',
    '    .inline-form { align-items: end; }',
    '    .inline-form label.toggle { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--primary); }',
    '    .inline-form label.toggle input { width: auto; margin: 0; }',
    '    .admin-panel { background: var(--surface-soft); border-radius: 18px; padding: 20px 24px; display: grid; gap: 16px; }',
    '    .member-area { background: var(--surface-soft); border-radius: 18px; padding: 20px 24px; display: grid; gap: 8px; }',
    '    .hidden { display: none !important; }',
    '    code { font-family: "Fira Code", "SFMono-Regular", ui-monospace, monospace; background: var(--surface-soft); padding: 2px 6px; border-radius: 6px; }',
    '    @media (max-width: 640px) {',
    '      .hero { padding: 32px; border-radius: 24px; }',
    '      .card { padding: 28px; border-radius: 20px; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    sections.join('\n'),
    '  </main>',
    script,
    '</body>',
    '</html>'
  ].join('\n');

  return template;
}

function maybeSeedEditorWithTemplate() {
  if (!window.editor) return;
  const currentValue = window.editor.getValue().trim();
  const defaultStatic = (window.defaultStaticTemplate || '').trim();
  const lastAuto = (window.lastAutoTemplate || '').trim();

  if (state.needsDatabase) {
    if (!currentValue || currentValue === defaultStatic || currentValue === lastAuto) {
      const template = buildSupabaseTemplate(state);
      window.lastAutoTemplate = template;
      window.editor.setValue(template);
    }
  } else {
    if (!currentValue || currentValue === lastAuto) {
      const template = createStaticTemplate();
      window.lastAutoTemplate = template;
      window.editor.setValue(template);
    }
  }
}

function analyzeNeeds() {
  if (!elements.intakeForm) return;
  const formData = new FormData(elements.intakeForm);

  state.purpose = formData.get('sitePurpose') || 'other';
  state.features = Array.from(elements.intakeForm.querySelectorAll('input[name="feature"]:checked')).map((input) => input.value);
  state.updateCadence = formData.get('updateCadence') || 'occasionally';
  state.extraNotes = (formData.get('extraNotes') || '').trim();
  state.siteName = (formData.get('siteName') || '').trim();
  state.colorScheme = formData.get('colorScheme') || 'calm';
  state.initialUsername = '';
  state.defaultPassword = '';

  if (state.features.includes('accounts')) {
    const requestedUsername = (formData.get('initialUsername') || '').trim();
    const usernamePattern = /^[A-Za-z0-9._-]{3,}$/;

    if (!requestedUsername) {
      flagInitialUsernameHint('Add an initial username so we can seed the first account.');
      if (elements.initialUsernameInput) {
        elements.initialUsernameInput.focus();
      }
      setResult('Add an initial username so Flowin can create the starter login.', 'error');
      return;
    }

    if (!usernamePattern.test(requestedUsername)) {
      flagInitialUsernameHint('Usernames need at least 3 characters using letters, numbers, dots, dashes, or underscores.');
      if (elements.initialUsernameInput) {
        elements.initialUsernameInput.focus();
        elements.initialUsernameInput.select();
      }
      setResult('Pick a username using letters, numbers, dots, dashes, or underscores.', 'error');
      return;
    }

    resetInitialUsernameHint();
    state.initialUsername = requestedUsername;
    state.defaultPassword = createDefaultPassword();
  } else {
    resetInitialUsernameHint();
  }

  const hasDynamicFeature = state.features.some((feature) => ['forms', 'accounts', 'updates'].includes(feature));
  const frequentUpdates = state.updateCadence === 'daily' || state.updateCadence === 'weekly';
  const purposeRequiresData = state.purpose === 'calendar' && !state.features.includes('static');

  state.needsDatabase = hasDynamicFeature || frequentUpdates || purposeRequiresData;
  state.schema = state.needsDatabase ? buildSchemaRecommendations() : [];
  state.estimatedCost = state.needsDatabase ? estimateDatabaseCost(state) : null;

  const summaryText = summarizeSelections(state);
  if (elements.intakeSummaryText) {
    elements.intakeSummaryText.textContent = summaryText;
  }
  toggleElement(elements.intakeSummary, true);

  toggleElement(elements.databaseAdvice, state.needsDatabase);
  toggleElement(elements.staticAdvice, !state.needsDatabase);

  renderSupabaseSection();
  prefillPrompt();
  maybeSeedEditorWithTemplate();
  toggleElement(elements.promptSection, true);
}

function prefillPrompt() {
  if (!elements.promptField) return;
  const purposeLabel = PURPOSE_LABELS[state.purpose] || PURPOSE_LABELS.other;
  const filteredFeatures = state.features.filter((key) => key !== 'static' || state.features.length === 1);
  const featureLabels = filteredFeatures.map((key) => FEATURE_LABELS[key]).filter(Boolean);
  const includeStaticGuidance = state.features.length === 1 && state.features[0] === 'static';
  const scheme = getColorScheme(state.colorScheme);
  const siteName = state.siteName || 'Flowin site';

  const promptLines = [
    `Project name: ${siteName}.`,
    `Create a ${purposeLabel.toLowerCase()} website that feels welcoming for non-technical owners.`,
    `Visual direction: ${scheme.prompt}`,
    CADENCE_PROMPTS[state.updateCadence] || CADENCE_PROMPTS.occasionally
  ];

  if (featureLabels.length > 0) {
    promptLines.push(`Support these needs: ${featureLabels.join(', ')}.`);
  } else {
    promptLines.push('Keep it as a simple static site with easy-to-edit sections.');
  }

  state.features.forEach((featureKey) => {
    if (featureKey === 'static' && !includeStaticGuidance) {
      return;
    }
    const extraGuidance = FEATURE_PROMPTS[featureKey];
    if (extraGuidance) {
      promptLines.push(extraGuidance);
    }
  });

  if (state.needsDatabase) {
    promptLines.push('Use the provided SUPABASE_URL, SUPABASE_ANON_KEY, and SITE_ID constants that Flowin adds to the page. Do not expose any other keys.');
    if (state.features.includes('accounts')) {
      const adminUsername = state.initialUsername || 'admin';
      const adminPassword = state.defaultPassword || 'Start-change!';
      promptLines.push(`Build a username and password sign-in flow. Seed the initial admin account with username "${adminUsername}" and password "${adminPassword}" so the owner can get started immediately.`);
      promptLines.push('Keep the authentication logic on the client (localStorage is fine) so we do not need Supabase service keys.');
      promptLines.push('After sign-in, show an admin panel that lists existing users, lets admins add new usernames with temporary passwords, and allows password resets.');
    }
    if (state.schema.length > 0) {
      const tableSummaries = state.schema.map((table) => `${table.name}: ${table.description}`).join('; ');
      promptLines.push(`Assume Flowin has tables ready for you (${tableSummaries}). Read/write them safely with Supabase JS.`);
    }
  } else {
    promptLines.push('Avoid external databases; keep data inline in the HTML so it is easy to tweak later.');
  }

  if (state.extraNotes) {
    promptLines.push(`Extra notes: ${state.extraNotes}.`);
  }

  promptLines.push('Return complete HTML, CSS, and JavaScript in one snippet ready for Flowin.');

  elements.promptField.value = promptLines.join('\n');
}

async function publishSite() {
  if (!window.editor) {
    setResult('Editor is still loading. Please wait a moment.', 'error');
    return;
  }

  if (!isLoggedIn()) {
    showDemoPublishCTA();
    return;
  }

  const html = window.editor.getValue();
  setResult('Publishing...');

  try {
    if (editSlug) {
      const res = await fetch(`${SITES_URL}/${encodeURIComponent(editSlug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ html_content: html }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Update failed with status ${res.status}`);
      }
      const site = await res.json();

      // Save credentials if generated during preflight
      if (_lastPreflightResult && _lastPreflightResult.credentials) {
        await saveCredentialsForSite(editSlug, _lastPreflightResult.credentials);
        _lastPreflightResult = null;
      }

      setResult(`Updated! ${site.url}`);
    } else {
      const res = await fetch(PUBLISH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/html', ...authHeaders() },
        body: html,
      });

      const responseText = await res.text();
      if (!res.ok) {
        throw new Error(responseText || `Publish failed with status ${res.status}`);
      }

      const publishedUrl = responseText.trim();
      setResult(`Published at:\n${publishedUrl}`);

      // Save credentials if generated during preflight
      if (_lastPreflightResult && _lastPreflightResult.credentials) {
        const slugMatch = publishedUrl.match(/https?:\/\/([^.]+)\./);
        if (slugMatch) {
          await saveCredentialsForSite(slugMatch[1], _lastPreflightResult.credentials);
        }
        _lastPreflightResult = null;
      }

      const newTab = window.open(publishedUrl, '_blank', 'noopener');
      if (newTab) newTab.opener = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while publishing.';
    setResult(`Error:\n${message}`, 'error');
  }
}

async function loadExistingSite() {
  if (!editSlug || !isLoggedIn()) return;
  try {
    const res = await fetch(`${SITES_URL}/${encodeURIComponent(editSlug)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const site = await res.json();
    if (site.html_content && window.editor) {
      window.editor.setValue(site.html_content);
    }
    if (elements.publishButton) {
      elements.publishButton.textContent = 'Update';
    }
  } catch (err) {
    console.error('Failed to load site for editing:', err);
  }
}

// Store preflight result for use during publish
let _lastPreflightResult = null;

async function generateSite(event) {
  event.preventDefault();
  if (!elements.promptField) return;
  const prompt = elements.promptField.value.trim();
  if (!prompt) {
    setResult('Please describe what you want before asking Flowin AI.', 'error');
    return;
  }

  if (!isLoggedIn()) {
    runDemoGeneration(prompt);
    return;
  }

  // Step 1: Analyze the prompt
  setResult('🔍 Analyzing your request...');
  showLoading();

  let preflightResult = null;
  try {
    const analyzeRes = await fetch(`${API_BASE}/generate/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ prompt }),
    });

    if (analyzeRes.ok) {
      const analysis = await analyzeRes.json();
      hideLoading();

      // Step 2: Show preflight modal if auth/db needed or questions exist
      if (analysis.needs_auth || analysis.needs_database || (analysis.questions && analysis.questions.length > 0)) {
        preflightResult = await showPreflightModal(analysis);
        if (!preflightResult) {
          setResult('Generation cancelled.', 'error');
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Analysis skipped:', err);
    hideLoading();
  }

  _lastPreflightResult = preflightResult;

  // Step 3: Generate with enhanced prompt
  const finalPrompt = preflightResult
    ? buildEnhancedPrompt(prompt, preflightResult)
    : prompt;

  setResult('🤖 Asking Flowin AI…');
  showLoading();

  try {
    const res = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ prompt: finalPrompt })
    });

    const responseText = await res.text();
    if (!res.ok) {
      // Handle tier limit errors with upgrade prompt
      if (res.status === 403) {
        try {
          const errData = JSON.parse(responseText);
          const detail = errData.detail || errData;
          if (detail.upgrade_url || detail.upgrade_prompt) {
            hideLoading();
            setResult(detail.message || 'Generation limit reached.', 'error');
            // Open pricing modal if on dashboard, or redirect
            if (typeof handleUpgrade === 'function') {
              handleUpgrade();
            } else {
              window.location.href = '/dashboard.html?upgrade=true';
            }
            return;
          }
        } catch (_) {}
      }
      throw new Error(responseText || `Generation failed with status ${res.status}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (_) {
      throw new Error('Invalid response from AI. Please try again in a moment.');
    }

    if (!data || typeof data.html !== 'string') {
      throw new Error('Invalid response from AI.');
    }

    if (!window.editor) {
      throw new Error('Editor is still loading. Please wait before generating.');
    }

    window.editor.setValue(data.html);
    const preview = document.getElementById('preview');
    if (preview) {
      preview.srcdoc = data.html;
    }

    toggleElement(elements.editorSection, true);
    if (data.truncated) {
      setResult('⚠️ Site generated but may be incomplete (output was too long). Try simplifying your request or use Refine to fix.', 'error');
    } else {
      setResult('Analyzing admin sections...');

      // Second pass: enhance admin sections via SSE stream
      try {
        showLoading();
        const enhanceRes = await fetch(ENHANCE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ html: data.html })
        });

        const contentType = enhanceRes.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
          // SSE streaming — process section-by-section progress
          const reader = enhanceRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let finalData = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === 'progress') {
                  setResult(`Building admin section ${evt.current}/${evt.total}: ${evt.section}...`);
                } else if (evt.type === 'section_error') {
                  console.warn(`Enhancement failed for ${evt.section}:`, evt.error);
                } else if (evt.type === 'done') {
                  finalData = evt;
                }
              } catch (_) { /* ignore parse errors */ }
            }
          }

          if (finalData && finalData.enhanced && finalData.html) {
            window.editor.setValue(finalData.html);
            if (preview) {
              preview.srcdoc = finalData.html;
            }
            const sections = finalData.sections_added || [];
            if (finalData.truncated) {
              setResult(`Built ${sections.length} admin section(s) but output may be incomplete: ${sections.join(', ')}. Try Refine to fix.`, 'error');
            } else {
              setResult(`Site ready with ${sections.length} working admin section(s): ${sections.join(', ')}`);
            }
          } else if (finalData) {
            setResult('Site generated by AI — no admin sections needed enhancement.');
          } else {
            setResult('Site generated by AI — enhancement stream ended unexpectedly.');
          }
        } else if (enhanceRes.ok) {
          // Fallback: non-streaming JSON response (no admin sections found)
          const enhanceData = await enhanceRes.json();
          if (enhanceData.enhanced && enhanceData.html) {
            window.editor.setValue(enhanceData.html);
            if (preview) {
              preview.srcdoc = enhanceData.html;
            }
            const sections = enhanceData.sections_added || [];
            setResult(`Site ready with ${sections.length} working admin section(s): ${sections.join(', ')}`);
          } else {
            setResult('Site generated by AI — no admin sections needed enhancement.');
          }
        } else {
          setResult('Site generated by AI — enhancement skipped (you can refine manually).');
        }
      } catch (enhanceErr) {
        console.warn('Enhancement pass skipped:', enhanceErr);
        setResult('Site generated by AI — you can tweak or publish!');
      } finally {
        hideLoading();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating.';
    setResult(`❌ AI generation failed:\n${message}`, 'error');
    toggleElement(elements.editorSection, true);
  } finally {
    hideLoading();
  }
}

function setupEditor() {
  if (typeof require === 'undefined') {
    setResult('Editor scripts failed to load. Please refresh the page.', 'error');
    return;
  }

  const startingTemplate = createStaticTemplate();
  window.defaultStaticTemplate = startingTemplate;
  window.lastAutoTemplate = startingTemplate;

  require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.34.1/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    window.editor = monaco.editor.create(document.getElementById('editor'), {
      value: startingTemplate,
      language: 'html',
      theme: 'vs-light',
      automaticLayout: true
    });

    window.editor.onDidChangeModelContent(() => {
      const preview = document.getElementById('preview');
      if (preview) {
        preview.srcdoc = window.editor.getValue();
      }
    });

    const preview = document.getElementById('preview');
    if (preview) {
      preview.srcdoc = window.editor.getValue();
    }

    if (editSlug) {
      loadExistingSite();
    }
  });
}

function wireEvents() {
  if (elements.publishButton) {
    elements.publishButton.addEventListener('click', publishSite);
  }
  if (elements.generateButton) {
    elements.generateButton.type = 'button';
    elements.generateButton.addEventListener('click', generateSite);
  }
  if (elements.analyzeButton) {
    elements.analyzeButton.type = 'button';
    elements.analyzeButton.addEventListener('click', analyzeNeeds);
  }
  const accountsCheckbox = getAccountsCheckbox();
  if (accountsCheckbox) {
    accountsCheckbox.addEventListener('change', updateAccountsCredentialsVisibility);
  }
  updateAccountsCredentialsVisibility();
}

initLayout();
wireEvents();
setupEditor();
