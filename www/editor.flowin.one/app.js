'use strict';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'ai';

// Supabase (public anon key — safe to expose when RLS is properly configured)
const SUPABASE_URL = 'https://joosxsxvgtwwtdzibcbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvb3N4c3h2Z3R3d3RkemliY2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMDI4MDAsImV4cCI6MjA3NDg3ODgwMH0.kkQG8JqGJb4ucke4Jgwy9YHSWOSrXRS5f7p37nC749E';

const API_BASE = 'https://api.flowin.one';
const PUBLISH_URL = `${API_BASE}/publish`;
const GENERATE_URL = `${API_BASE}/generate`;
const PROVISION_URL = `${API_BASE}/provision`;
const CHECKOUT_URL = `${API_BASE}/create-checkout-session`;

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
let supabase = null;
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------------------------------------------------------------------------
// Purpose labels (Everyman-friendly)
// ---------------------------------------------------------------------------
const PURPOSE_LABELS = {
  bio: 'personal page',
  portfolio: 'portfolio or showcase',
  event: 'event page',
  business: 'business site',
  group: 'group hub',
  other: 'custom site'
};

const PURPOSE_PROMPTS = {
  bio: 'This is a personal page, resume, or online bio. Include sections for an introduction, skills or experience, and a way to get in touch.',
  portfolio: 'This is a portfolio or showcase. Include a gallery or project grid, an about section, and a contact area.',
  event: 'This is an event page. Include event details (date, time, location), a description, and an RSVP or contact section.',
  business: 'This is a business site. Include services or products, business hours, location, testimonials, and a contact section.',
  group: 'This is a group hub for a family, team, or club. Include a shared calendar or announcement area, member info, and contact details.',
  other: 'This is a custom site. Create a clean, versatile layout with a hero section, content area, and contact section.'
};

// ---------------------------------------------------------------------------
// Audience labels
// ---------------------------------------------------------------------------
const AUDIENCE_PROMPTS = {
  private: 'This site is for a small group of friends and family. Keep it personal and warm.',
  local: 'This site serves a local community or neighborhood. Include local SEO basics and clear contact info.',
  public: 'This site is meant for a broad public audience. Include SEO meta tags, a clear value proposition, and professional polish.'
};

// ---------------------------------------------------------------------------
// Feature labels and prompts
// ---------------------------------------------------------------------------
const FEATURE_LABELS = {
  contact_form: 'contact form',
  rsvp: 'RSVP or sign-up',
  payments: 'payments or purchases',
  login: 'member login',
  dynamic_content: 'dynamic schedule or calendar',
  collaborators: 'team collaboration'
};

const FEATURE_PROMPTS = {
  contact_form: 'Include a clearly labelled contact form that collects name, email, and a message.',
  rsvp: 'Include an RSVP form where guests can confirm attendance and provide details like party size.',
  payments: 'Include a section listing products or services with prices. Use a "Contact to order" button for now (Stripe integration will come later).',
  login: 'Plan for a sign-in experience with a members-only area. Use a simple username/password form.',
  dynamic_content: 'Include a schedule or calendar section that is easy to update with new events or items.',
  collaborators: 'Design the site so multiple editors can update content. Highlight shared editing areas.'
};

// ---------------------------------------------------------------------------
// Update frequency prompts
// ---------------------------------------------------------------------------
const FREQUENCY_PROMPTS = {
  rarely: 'Content changes are rare, so focus on a timeless, durable layout.',
  monthly: 'Content is updated monthly. Keep the structure clean and easy to edit.',
  weekly: 'Expect weekly updates. Design sections that are simple to refresh.',
  daily: 'Expect daily updates. Streamline the layout so changes are quick and safe.'
};

// ---------------------------------------------------------------------------
// Color schemes (including new "playful")
// ---------------------------------------------------------------------------
const COLOR_SCHEMES = {
  calm: {
    label: 'Clean and calm',
    description: 'Professional blues with soft purple highlights.',
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
    label: 'Warm and inviting',
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
    label: 'Fresh and natural',
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
    label: 'Bold and minimal',
    description: 'Crisp neutrals with strong typography.',
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
  },
  playful: {
    label: 'Fun and playful',
    description: 'Bright pops of color with bouncy elements.',
    background: 'linear-gradient(135deg, #fdf2f8, #ede9fe)',
    surface: '#ffffff',
    surfaceSoft: 'rgba(236, 72, 153, 0.08)',
    surfaceAccent: 'rgba(139, 92, 246, 0.12)',
    primary: '#d946ef',
    primaryDark: '#a21caf',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.18)',
    text: '#1f2937',
    muted: '#6b7280',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#b45309',
    prompt: 'Use vibrant pinks, purples, and yellows with extra-rounded corners and playful spacing.'
  }
};

// ---------------------------------------------------------------------------
// Supabase table templates (for provisioning and generated site templates)
// ---------------------------------------------------------------------------
const TABLE_TEMPLATES = {
  sites: {
    name: 'sites',
    description: 'Tracks each Flowin site instance and its owner.'
  },
  events: {
    name: 'events',
    description: 'Stores calendar items, schedules, or recurring plans.'
  },
  submissions: {
    name: 'submissions',
    description: 'Captures form responses from visitors.'
  },
  members: {
    name: 'members',
    description: 'Keeps track of collaborators allowed to edit.'
  },
  projects: {
    name: 'projects',
    description: 'Stores portfolio pieces or case studies.'
  },
  offerings: {
    name: 'offerings',
    description: 'Lists services or products for a business page.'
  },
  rsvps: {
    name: 'rsvps',
    description: 'Records guests attending an event.'
  }
};

// ---------------------------------------------------------------------------
// Pricing tiers
// ---------------------------------------------------------------------------
const TIERS = {
  free: {
    name: 'Free',
    price: '$0',
    priceYearly: '$0',
    description: '1 site, free subdomain, static content, Flowin branding',
    features: ['1 site', 'Free flowin.one address', 'Static content', 'Flowin branding']
  },
  starter: {
    name: 'Starter',
    price: '$5/mo',
    priceYearly: '$48/yr',
    description: '3 sites, forms, dynamic content, no branding',
    features: ['3 sites', 'Contact forms & RSVPs', 'Dynamic content', 'No Flowin branding']
  },
  pro: {
    name: 'Pro',
    price: '$12/mo',
    priceYearly: '$108/yr',
    description: 'Unlimited sites, logins, custom domain, priority support',
    features: ['Unlimited sites', 'Member logins', 'Custom domain', 'Priority support']
  }
};

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------
const TOTAL_STEPS = 9;

const wizard = {
  currentStep: 1,
  data: {
    siteName: '',
    purpose: '',
    audience: '',
    features: [],
    updateFrequency: '',
    colorScheme: '',
    content: [],
    domain: '',
    extraNotes: ''
  }
};

// Computed after wizard completes
const computed = {
  needsDatabase: false,
  needsAuth: false,
  tables: [],
  tier: 'free'
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const el = {
  authScreen: document.getElementById('auth-screen'),
  authForm: document.getElementById('auth-form'),
  authEmail: document.getElementById('auth-email'),
  authStatus: document.getElementById('auth-status'),
  dashboardScreen: document.getElementById('dashboard-screen'),
  dashboardEmail: document.getElementById('dashboard-email'),
  sitesList: document.getElementById('sites-list'),
  newSiteBtn: document.getElementById('new-site-btn'),
  signOutBtn: document.getElementById('sign-out-btn'),
  mainApp: document.getElementById('main-app'),
  wizardProgress: document.getElementById('wizard-progress'),
  wizardStepLabel: document.getElementById('wizard-step-label'),
  wizardProgressFill: document.getElementById('wizard-progress-fill'),
  wizardBack: document.getElementById('wizard-back'),
  wizardNext: document.getElementById('wizard-next'),
  wizardNav: document.getElementById('wizard-nav'),
  upgradeScreen: document.getElementById('upgrade-screen'),
  upgradeDescription: document.getElementById('upgrade-description'),
  upgradeTiers: document.getElementById('upgrade-tiers'),
  upgradeContinueFree: document.getElementById('upgrade-continue-free'),
  buildingScreen: document.getElementById('building-screen'),
  editorSection: document.getElementById('editor-section'),
  editorWrapper: document.getElementById('editor-wrapper'),
  toggleCodeBtn: document.getElementById('toggle-code-btn'),
  publishButton: document.getElementById('publish-button'),
  regenerateButton: document.getElementById('regenerate-button'),
  promptField: document.getElementById('prompt'),
  result: document.getElementById('result'),
  preview: document.getElementById('preview')
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function show(element) {
  if (element) element.classList.remove('hidden');
}

function hide(element) {
  if (element) element.classList.add('hidden');
}

function setResult(message, type = 'info') {
  if (!el.result) return;
  el.result.textContent = message;
  el.result.className = 'mt-4 text-sm font-mono whitespace-pre-wrap';
  if (type === 'error') el.result.classList.add('text-red-600');
  else if (type === 'success') el.result.classList.add('text-green-600');
  else el.result.classList.add('text-gray-600');
}

function getColorScheme(key) {
  return COLOR_SCHEMES[key] || COLOR_SCHEMES.calm;
}

// ---------------------------------------------------------------------------
// Option card selection highlighting
// ---------------------------------------------------------------------------
function setupOptionCards() {
  document.querySelectorAll('.option-card').forEach(card => {
    const input = card.querySelector('input');
    if (!input) return;

    input.addEventListener('change', () => {
      if (input.type === 'radio') {
        const group = card.closest('[id$="-group"]');
        if (group) {
          group.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        }
        card.classList.add('selected');
      } else {
        card.classList.toggle('selected', input.checked);
      }
    });

    card.addEventListener('click', (e) => {
      if (e.target === input) return;
      if (input.type === 'radio') {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (input.type === 'checkbox') {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Wizard navigation
// ---------------------------------------------------------------------------
function showStep(n) {
  document.querySelectorAll('.wizard-step').forEach(step => {
    const stepNum = parseInt(step.dataset.step, 10);
    if (stepNum === n) {
      show(step);
    } else {
      hide(step);
    }
  });
  wizard.currentStep = n;
  updateProgressBar();
  updateNavButtons();
}

function updateProgressBar() {
  const pct = ((wizard.currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
  if (el.wizardProgressFill) {
    el.wizardProgressFill.style.width = `${pct}%`;
  }
  if (el.wizardStepLabel) {
    el.wizardStepLabel.textContent = `Step ${wizard.currentStep} of ${TOTAL_STEPS}`;
  }
}

function updateNavButtons() {
  if (el.wizardBack) {
    if (wizard.currentStep === 1) {
      hide(el.wizardBack);
    } else {
      show(el.wizardBack);
    }
  }
  if (el.wizardNext) {
    if (wizard.currentStep === TOTAL_STEPS) {
      el.wizardNext.textContent = 'Build my site';
      el.wizardNext.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
      el.wizardNext.classList.add('bg-pink-600', 'hover:bg-pink-700');
    } else {
      el.wizardNext.textContent = 'Next';
      el.wizardNext.classList.remove('bg-pink-600', 'hover:bg-pink-700');
      el.wizardNext.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    }
  }
}

function collectWizardData() {
  const d = wizard.data;
  d.siteName = (document.getElementById('w-site-name') || {}).value || '';

  const purposeRadio = document.querySelector('input[name="w-purpose"]:checked');
  d.purpose = purposeRadio ? purposeRadio.value : '';

  const audienceRadio = document.querySelector('input[name="w-audience"]:checked');
  d.audience = audienceRadio ? audienceRadio.value : '';

  d.features = Array.from(document.querySelectorAll('input[name="w-feature"]:checked'))
    .map(cb => cb.value);

  const freqRadio = document.querySelector('input[name="w-frequency"]:checked');
  d.updateFrequency = freqRadio ? freqRadio.value : '';

  const vibeRadio = document.querySelector('input[name="w-vibe"]:checked');
  d.colorScheme = vibeRadio ? vibeRadio.value : '';

  d.content = Array.from(document.querySelectorAll('input[name="w-content"]:checked'))
    .map(cb => cb.value);

  const domainRadio = document.querySelector('input[name="w-domain"]:checked');
  d.domain = domainRadio ? domainRadio.value : '';

  d.extraNotes = (document.getElementById('w-extra-notes') || {}).value || '';
}

function goNext() {
  collectWizardData();

  if (wizard.currentStep < TOTAL_STEPS) {
    showStep(wizard.currentStep + 1);
  } else {
    finishWizard();
  }
}

function goBack() {
  if (wizard.currentStep > 1) {
    showStep(wizard.currentStep - 1);
  }
}

// ---------------------------------------------------------------------------
// Tech-stack decision engine
// ---------------------------------------------------------------------------
function determineStack() {
  const d = wizard.data;

  computed.needsDatabase = false;
  computed.needsAuth = false;
  computed.tables = ['sites'];
  computed.tier = 'free';

  const dynamicFeatures = ['contact_form', 'rsvp', 'dynamic_content', 'collaborators', 'login', 'payments'];
  if (dynamicFeatures.some(f => d.features.includes(f))) {
    computed.needsDatabase = true;
  }

  if (['weekly', 'daily'].includes(d.updateFrequency)) {
    computed.needsDatabase = true;
  }

  if (d.features.includes('login') || d.features.includes('collaborators')) {
    computed.needsAuth = true;
  }

  // Table selection
  if (d.purpose === 'event' || d.features.includes('rsvp')) {
    if (!computed.tables.includes('rsvps')) computed.tables.push('rsvps');
    if (!computed.tables.includes('events')) computed.tables.push('events');
  }
  if (d.features.includes('contact_form')) {
    if (!computed.tables.includes('submissions')) computed.tables.push('submissions');
  }
  if (d.features.includes('dynamic_content') && (d.purpose === 'group' || d.purpose === 'event')) {
    if (!computed.tables.includes('events')) computed.tables.push('events');
  }
  if (computed.needsAuth || d.features.includes('collaborators')) {
    if (!computed.tables.includes('members')) computed.tables.push('members');
  }
  if (d.purpose === 'portfolio' || d.purpose === 'bio') {
    if (!computed.tables.includes('projects')) computed.tables.push('projects');
  }
  if (d.purpose === 'business' || d.features.includes('payments')) {
    if (!computed.tables.includes('offerings')) computed.tables.push('offerings');
  }

  // Tier
  if (!computed.needsDatabase) {
    computed.tier = 'free';
  } else if (computed.needsAuth || d.audience === 'public' || d.features.includes('payments')) {
    computed.tier = 'pro';
  } else {
    computed.tier = 'starter';
  }
}

function getTierInfo(tier) {
  return TIERS[tier] || TIERS.free;
}

// ---------------------------------------------------------------------------
// AI prompt builder
// ---------------------------------------------------------------------------
function buildPrompt() {
  const d = wizard.data;
  const scheme = getColorScheme(d.colorScheme);
  const lines = [];

  const siteName = d.siteName.trim() || 'Flowin site';
  lines.push(`Project name: "${siteName}".`);

  // Purpose
  const purposePrompt = PURPOSE_PROMPTS[d.purpose] || PURPOSE_PROMPTS.other;
  lines.push(purposePrompt);

  // Audience
  const audiencePrompt = AUDIENCE_PROMPTS[d.audience] || AUDIENCE_PROMPTS.private;
  lines.push(audiencePrompt);

  // Visual direction
  lines.push(`Visual direction: ${scheme.prompt}`);

  // Features
  const featureDescriptions = d.features
    .map(f => FEATURE_LABELS[f])
    .filter(Boolean);
  if (featureDescriptions.length > 0) {
    lines.push(`The site needs to support: ${featureDescriptions.join(', ')}.`);
  }

  // Feature-specific guidance
  d.features.forEach(key => {
    const prompt = FEATURE_PROMPTS[key];
    if (prompt) lines.push(prompt);
  });

  // Update frequency
  const freqPrompt = FREQUENCY_PROMPTS[d.updateFrequency] || FREQUENCY_PROMPTS.rarely;
  lines.push(freqPrompt);

  // Content readiness
  if (d.content.includes('from_scratch') || d.content.length === 0) {
    lines.push('The owner is starting from scratch. Use appealing, realistic placeholder content they can swap out later. Include placeholder images using https://placehold.co/ URLs.');
  } else {
    const contentParts = [];
    if (d.content.includes('has_logo')) contentParts.push('their own logo');
    if (d.content.includes('has_photos')) contentParts.push('their own photos');
    if (d.content.includes('has_text')) contentParts.push('their own text');
    lines.push(`The owner has ${contentParts.join(' and ')} ready. Include clear placeholder spots marked with comments like "<!-- Replace with your photo -->" so they know exactly where to add their content.`);
  }

  // Database guidance
  if (computed.needsDatabase) {
    lines.push('The site will connect to a Supabase database. Use the constants SUPABASE_URL, SUPABASE_ANON_KEY, and SITE_ID that will be provided. Do not expose any secret keys.');
    if (computed.tables.length > 1) {
      const tableSummaries = computed.tables
        .filter(t => t !== 'sites')
        .map(t => TABLE_TEMPLATES[t] ? `${t}: ${TABLE_TEMPLATES[t].description}` : t)
        .join('; ');
      lines.push(`Available database tables: ${tableSummaries}. Read and write them with the Supabase JavaScript client.`);
    }
  } else {
    lines.push('Keep all data inline in the HTML. No external database. Make it easy to edit text directly in the HTML.');
  }

  // Extra notes
  if (d.extraNotes.trim()) {
    lines.push(`Additional notes from the owner: "${d.extraNotes.trim()}".`);
  }

  lines.push('Return a complete, single-file HTML5 page with embedded CSS and JavaScript. It must be mobile-friendly and look polished.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Wizard completion flow
// ---------------------------------------------------------------------------
async function finishWizard() {
  collectWizardData();
  determineStack();

  // Hide wizard, show building or upgrade
  hide(el.wizardNav);
  hide(el.wizardProgress);
  document.querySelectorAll('.wizard-step').forEach(s => hide(s));

  if (computed.tier !== 'free') {
    showUpgradeScreen();
  } else {
    await buildSite();
  }
}

function showUpgradeScreen() {
  show(el.upgradeScreen);
  const tierInfo = getTierInfo(computed.tier);
  if (el.upgradeDescription) {
    el.upgradeDescription.textContent =
      `Based on your answers, your site needs features from our ${tierInfo.name} plan (${tierInfo.price}). ` +
      tierInfo.description + '.';
  }

  if (el.upgradeTiers) {
    el.upgradeTiers.innerHTML = '';

    // Starter card
    const starterInfo = TIERS.starter;
    el.upgradeTiers.innerHTML += `
      <div class="border border-gray-200 rounded-xl p-6 text-left">
        <h3 class="font-bold text-lg text-gray-900 mb-1">${starterInfo.name}</h3>
        <p class="text-2xl font-bold text-indigo-600 mb-3">${starterInfo.price}</p>
        <ul class="text-sm text-gray-600 space-y-1">
          ${starterInfo.features.map(f => `<li>- ${f}</li>`).join('')}
        </ul>
        <button class="upgrade-btn mt-4 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-sm"
                data-tier="starter">
          Choose Starter
        </button>
      </div>
    `;

    // Pro card
    const proInfo = TIERS.pro;
    el.upgradeTiers.innerHTML += `
      <div class="border-2 border-indigo-600 rounded-xl p-6 text-left relative">
        <span class="absolute -top-3 left-4 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">Recommended</span>
        <h3 class="font-bold text-lg text-gray-900 mb-1">${proInfo.name}</h3>
        <p class="text-2xl font-bold text-indigo-600 mb-3">${proInfo.price}</p>
        <ul class="text-sm text-gray-600 space-y-1">
          ${proInfo.features.map(f => `<li>- ${f}</li>`).join('')}
        </ul>
        <button class="upgrade-btn mt-4 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-sm"
                data-tier="pro">
          Choose Pro
        </button>
      </div>
    `;

    // Wire upgrade buttons
    el.upgradeTiers.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUpgrade(btn.dataset.tier));
    });
  }
}

async function handleUpgrade(tier) {
  const session = supabase ? await supabase.auth.getSession() : null;
  const email = session?.data?.session?.user?.email || '';

  if (!email) {
    alert('Please sign in first to subscribe.');
    return;
  }

  try {
    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, billing: 'monthly', user_email: email })
    });

    if (!res.ok) {
      const text = await res.text();
      alert('Could not start checkout: ' + text);
      return;
    }

    const data = await res.json();
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    }
  } catch (err) {
    alert('Checkout error: ' + err.message);
  }
}

async function buildSite() {
  hide(el.upgradeScreen);
  show(el.buildingScreen);

  const prompt = buildPrompt();
  if (el.promptField) el.promptField.value = prompt;

  try {
    const res = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(responseText || `Generation failed with status ${res.status}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (_) {
      throw new Error('Invalid response from AI. Please try again.');
    }

    if (!data || typeof data.html !== 'string') {
      throw new Error('Invalid response from AI.');
    }

    hide(el.buildingScreen);
    showEditor(data.html);
  } catch (err) {
    hide(el.buildingScreen);
    show(el.editorSection);
    setResult('Could not generate your site: ' + err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
function showEditor(html) {
  show(el.editorSection);

  if (window.editor) {
    window.editor.setValue(html);
  } else {
    setupMonacoEditor(html);
  }

  if (el.preview) {
    el.preview.srcdoc = html;
  }

  setResult('Your site is ready! Preview it above, then hit "Publish my site" to go live.', 'success');
}

function setupMonacoEditor(initialValue) {
  if (typeof require === 'undefined') return;

  require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.34.1/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    window.editor = monaco.editor.create(document.getElementById('editor'), {
      value: initialValue || '',
      language: 'html',
      theme: 'vs-light',
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'on'
    });

    window.editor.onDidChangeModelContent(() => {
      if (el.preview) {
        el.preview.srcdoc = window.editor.getValue();
      }
    });
  });
}

function toggleCode() {
  if (!el.editorWrapper) return;
  const isHidden = el.editorWrapper.classList.contains('hidden');
  if (isHidden) {
    show(el.editorWrapper);
    if (el.toggleCodeBtn) el.toggleCodeBtn.textContent = 'Hide code';
    if (!window.editor) {
      const html = el.preview ? el.preview.srcdoc : '';
      setupMonacoEditor(html);
    }
  } else {
    hide(el.editorWrapper);
    if (el.toggleCodeBtn) el.toggleCodeBtn.textContent = 'Show code';
  }
}

// ---------------------------------------------------------------------------
// Publish flow (with provisioning)
// ---------------------------------------------------------------------------
async function publishSite() {
  if (!window.editor && !el.preview) {
    setResult('Nothing to publish yet.', 'error');
    return;
  }

  setResult('Publishing your site...');

  let html = window.editor ? window.editor.getValue() : (el.preview ? el.preview.srcdoc : '');
  let slug = null;

  // Provision in Supabase if database is needed
  if (computed.needsDatabase) {
    try {
      const headers = { 'Content-Type': 'application/json' };

      // Include auth token if available
      if (supabase) {
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const provisionRes = await fetch(PROVISION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          slug: wizard.data.siteName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-site',
          title: wizard.data.siteName.trim() || 'My Flowin Site',
          purpose: wizard.data.purpose || 'other',
          features: wizard.data.features,
          color_scheme: wizard.data.colorScheme || 'calm'
        })
      });

      if (provisionRes.ok) {
        const provisionData = await provisionRes.json();
        slug = provisionData.slug;
        html = html.replace(/REPLACE_WITH_SITE_UUID/g, provisionData.site_id);
      }
    } catch (err) {
      // Provisioning is optional — continue publishing without it
      console.warn('Provisioning skipped:', err.message);
    }
  }

  // Publish the HTML
  try {
    const publishUrl = slug ? `${PUBLISH_URL}?slug=${encodeURIComponent(slug)}` : PUBLISH_URL;
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: html
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(responseText || `Publish failed with status ${res.status}`);
    }

    const publishedUrl = responseText.trim();
    setResult(`Your site is live!\n${publishedUrl}`, 'success');

    const newTab = window.open(publishedUrl, '_blank', 'noopener');
    if (newTab) newTab.opener = null;
  } catch (err) {
    setResult('Could not publish: ' + err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Auth (Supabase magic link)
// ---------------------------------------------------------------------------
async function checkAuth() {
  if (!supabase) {
    // No Supabase client — skip auth, go straight to wizard
    showMainApp();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
  } else {
    show(el.authScreen);
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  if (!supabase || !el.authEmail) return;

  const email = el.authEmail.value.trim();
  if (!email) return;

  if (el.authStatus) {
    el.authStatus.textContent = 'Sending magic link...';
    el.authStatus.className = 'mt-4 text-sm text-indigo-600';
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });

  if (error) {
    if (el.authStatus) {
      el.authStatus.textContent = 'Error: ' + error.message;
      el.authStatus.className = 'mt-4 text-sm text-red-600';
    }
  } else {
    if (el.authStatus) {
      el.authStatus.textContent = 'Check your email for a magic link! Click it to sign in.';
      el.authStatus.className = 'mt-4 text-sm text-green-600';
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function showDashboard(user) {
  hide(el.authScreen);
  hide(el.mainApp);
  show(el.dashboardScreen);

  if (el.dashboardEmail && user) {
    el.dashboardEmail.textContent = user.email || '';
  }

  loadUserSites();
}

async function loadUserSites() {
  if (!supabase || !el.sitesList) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('sites')
      .select('id, site_slug, title, purpose, created_at')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    el.sitesList.innerHTML = '';

    if (error) {
      el.sitesList.innerHTML = '<p class="text-gray-400 text-sm">Could not load sites. The database may not be set up yet.</p>';
      return;
    }

    if (!data || data.length === 0) {
      el.sitesList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <p class="text-lg mb-2">No sites yet</p>
          <p class="text-sm">Click "New site" to create your first one!</p>
        </div>
      `;
      return;
    }

    data.forEach(site => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between';
      card.innerHTML = `
        <div>
          <h3 class="font-semibold text-gray-900">${site.title || site.site_slug}</h3>
          <p class="text-sm text-gray-500">${site.site_slug}.flowin.one</p>
        </div>
        <div class="flex gap-2">
          <a href="https://${site.site_slug}.flowin.one" target="_blank" rel="noopener"
             class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            View
          </a>
        </div>
      `;
      el.sitesList.appendChild(card);
    });
  } catch (err) {
    el.sitesList.innerHTML = '<p class="text-gray-400 text-sm">Could not load sites.</p>';
  }
}

async function handleSignOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  hide(el.dashboardScreen);
  show(el.authScreen);
}

function showMainApp() {
  hide(el.authScreen);
  hide(el.dashboardScreen);
  show(el.mainApp);

  if (mode === 'manual') {
    // Manual mode — skip wizard, show editor directly
    hide(el.wizardProgress);
    hide(el.wizardNav);
    document.querySelectorAll('.wizard-step').forEach(s => hide(s));
    show(el.editorSection);
    show(el.editorWrapper);
    if (el.toggleCodeBtn) el.toggleCodeBtn.textContent = 'Hide code';
    setupMonacoEditor('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>My Site</title>\n</head>\n<body>\n  <h1>Hello, world!</h1>\n</body>\n</html>');
  } else {
    showStep(1);
  }
}

// ---------------------------------------------------------------------------
// Wire up events
// ---------------------------------------------------------------------------
function init() {
  setupOptionCards();

  // Wizard navigation
  if (el.wizardNext) {
    el.wizardNext.addEventListener('click', goNext);
  }
  if (el.wizardBack) {
    el.wizardBack.addEventListener('click', goBack);
  }

  // Upgrade screen
  if (el.upgradeContinueFree) {
    el.upgradeContinueFree.addEventListener('click', () => {
      computed.tier = 'free';
      buildSite();
    });
  }

  // Editor
  if (el.toggleCodeBtn) {
    el.toggleCodeBtn.addEventListener('click', toggleCode);
  }
  if (el.publishButton) {
    el.publishButton.addEventListener('click', publishSite);
  }
  if (el.regenerateButton) {
    el.regenerateButton.addEventListener('click', () => {
      hide(el.editorSection);
      buildSite();
    });
  }

  // Auth
  if (el.authForm) {
    el.authForm.addEventListener('submit', handleAuthSubmit);
  }
  if (el.signOutBtn) {
    el.signOutBtn.addEventListener('click', handleSignOut);
  }
  if (el.newSiteBtn) {
    el.newSiteBtn.addEventListener('click', () => {
      hide(el.dashboardScreen);
      showMainApp();
    });
  }

  // Handle auth callback (magic link redirect)
  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        showDashboard(session.user);
      }
    });
  }

  // Payment success/cancel handling
  if (params.get('payment') === 'success') {
    // User just completed payment — start wizard
    showMainApp();
    return;
  }

  // Decide starting screen
  if (mode === 'manual') {
    showMainApp();
  } else {
    checkAuth();
  }
}

init();
