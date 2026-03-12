'use strict';

/**
 * Demo mode for unauthenticated users.
 * Simulates the AI generation flow with a pre-built site,
 * then prompts sign-up.
 */

const DEMO_SITES = [
  {
    keywords: ['portfolio', 'photographer', 'photo', 'gallery', 'creative'],
    title: 'Creative Portfolio',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sarah Chen — Photographer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#fafafa}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 48px;background:#fff;border-bottom:1px solid #e5e7eb}
nav .logo{font-size:1.4rem;font-weight:700;color:#111}
nav ul{display:flex;gap:28px;list-style:none}
nav a{text-decoration:none;color:#6b7280;font-size:.9rem;font-weight:500;transition:color .2s}
nav a:hover{color:#4f46e5}
.hero{text-align:center;padding:80px 24px 60px;background:linear-gradient(135deg,#eef2ff,#faf5ff)}
.hero h1{font-size:3rem;font-weight:800;margin-bottom:16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.15rem;color:#6b7280;max-width:540px;margin:0 auto 32px}
.hero .cta{display:inline-block;padding:14px 36px;background:#4f46e5;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;transition:transform .2s,box-shadow .2s}
.hero .cta:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(79,70,229,.3)}
.gallery{max-width:1100px;margin:60px auto;padding:0 24px}
.gallery h2{font-size:1.8rem;font-weight:700;text-align:center;margin-bottom:40px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.grid .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);transition:transform .3s,box-shadow .3s}
.grid .card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.1)}
.grid .card .img{height:220px;background:linear-gradient(135deg,#c7d2fe,#ddd6fe);display:flex;align-items:center;justify-content:center;font-size:3rem}
.grid .card .info{padding:16px}
.grid .card .info h3{font-weight:600;margin-bottom:4px}
.grid .card .info p{font-size:.85rem;color:#9ca3af}
.contact{max-width:600px;margin:80px auto;padding:0 24px;text-align:center}
.contact h2{font-size:1.8rem;font-weight:700;margin-bottom:12px}
.contact p{color:#6b7280;margin-bottom:32px}
.contact form{display:flex;flex-direction:column;gap:14px;text-align:left}
.contact input,.contact textarea{padding:12px 16px;border:1px solid #d1d5db;border-radius:10px;font-size:.95rem;font-family:inherit}
.contact textarea{height:120px;resize:vertical}
.contact button{padding:14px;background:#4f46e5;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer}
footer{text-align:center;padding:32px;color:#9ca3af;font-size:.85rem;border-top:1px solid #e5e7eb;margin-top:60px}
</style>
</head>
<body>
<nav><div class="logo">Sarah Chen</div><ul><li><a href="#work">Work</a></li><li><a href="#contact">Contact</a></li></ul></nav>
<section class="hero">
<h1>Capturing moments that matter</h1>
<p>Award-winning photographer specializing in portraits, landscapes, and editorial work based in San Francisco.</p>
<a href="#work" class="cta">View Portfolio</a>
</section>
<section class="gallery" id="work">
<h2>Selected Work</h2>
<div class="grid">
<div class="card"><div class="img">&#x1F305;</div><div class="info"><h3>Golden Hour Series</h3><p>Landscape &middot; 2024</p></div></div>
<div class="card"><div class="img">&#x1F3A8;</div><div class="info"><h3>Urban Canvas</h3><p>Street &middot; 2024</p></div></div>
<div class="card"><div class="img">&#x1F33F;</div><div class="info"><h3>Natural Light</h3><p>Portrait &middot; 2023</p></div></div>
<div class="card"><div class="img">&#x1F30A;</div><div class="info"><h3>Coastal Dreams</h3><p>Landscape &middot; 2023</p></div></div>
<div class="card"><div class="img">&#x1F3D9;</div><div class="info"><h3>City Nights</h3><p>Editorial &middot; 2023</p></div></div>
<div class="card"><div class="img">&#x1F338;</div><div class="info"><h3>Spring Collection</h3><p>Portrait &middot; 2024</p></div></div>
</div>
</section>
<section class="contact" id="contact">
<h2>Get in Touch</h2>
<p>Available for bookings, collaborations, and print inquiries.</p>
<form onsubmit="return false">
<input type="text" placeholder="Your name" />
<input type="email" placeholder="Email address" />
<textarea placeholder="Tell me about your project..."></textarea>
<button type="submit">Send Message</button>
</form>
</section>
<footer>&copy; 2024 Sarah Chen Photography. All rights reserved.</footer>
</body>
</html>`
  },
  {
    keywords: ['business', 'landing', 'startup', 'saas', 'company', 'product', 'app'],
    title: 'SaaS Landing Page',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FlowMetrics — Analytics Made Simple</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#fff}
nav{display:flex;justify-content:space-between;align-items:center;padding:16px 48px;border-bottom:1px solid #f3f4f6}
nav .logo{font-size:1.3rem;font-weight:800;color:#4f46e5}
nav .links{display:flex;gap:24px;align-items:center}
nav .links a{text-decoration:none;color:#6b7280;font-size:.9rem}
nav .links .btn{padding:8px 20px;background:#4f46e5;color:#fff;border-radius:8px;font-weight:600;font-size:.85rem}
.hero{padding:100px 24px 80px;text-align:center;background:linear-gradient(180deg,#eef2ff 0%,#fff 100%)}
.hero .badge{display:inline-block;padding:6px 16px;background:#e0e7ff;color:#4338ca;border-radius:20px;font-size:.8rem;font-weight:600;margin-bottom:20px}
.hero h1{font-size:3.2rem;font-weight:800;line-height:1.15;max-width:700px;margin:0 auto 20px}
.hero h1 span{color:#4f46e5}
.hero p{font-size:1.15rem;color:#6b7280;max-width:560px;margin:0 auto 36px}
.hero .actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.hero .actions a{padding:14px 32px;border-radius:10px;font-weight:600;text-decoration:none;font-size:.95rem}
.hero .actions .primary{background:#4f46e5;color:#fff}
.hero .actions .secondary{background:#f3f4f6;color:#374151}
.features{max-width:1000px;margin:80px auto;padding:0 24px}
.features h2{font-size:2rem;font-weight:700;text-align:center;margin-bottom:48px}
.features .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px}
.features .card{padding:28px;border-radius:16px;background:#f9fafb;border:1px solid #f3f4f6}
.features .card .icon{font-size:2rem;margin-bottom:12px}
.features .card h3{font-weight:700;margin-bottom:8px}
.features .card p{color:#6b7280;font-size:.9rem;line-height:1.6}
.stats{background:#4f46e5;color:#fff;padding:60px 24px;text-align:center;margin:80px 0}
.stats .grid{display:flex;justify-content:center;gap:64px;flex-wrap:wrap}
.stats .stat .num{font-size:2.5rem;font-weight:800}
.stats .stat .label{font-size:.9rem;opacity:.8}
.pricing{max-width:900px;margin:80px auto;padding:0 24px;text-align:center}
.pricing h2{font-size:2rem;font-weight:700;margin-bottom:48px}
.pricing .plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.pricing .plan{padding:32px;border-radius:16px;border:2px solid #e5e7eb;text-align:center}
.pricing .plan.popular{border-color:#4f46e5;position:relative}
.pricing .plan.popular::before{content:"Most Popular";position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:4px 16px;background:#4f46e5;color:#fff;border-radius:20px;font-size:.75rem;font-weight:600}
.pricing .plan .price{font-size:2.5rem;font-weight:800;margin:12px 0}
.pricing .plan .price span{font-size:1rem;color:#6b7280;font-weight:400}
.pricing .plan ul{list-style:none;margin:20px 0;text-align:left}
.pricing .plan li{padding:8px 0;font-size:.9rem;color:#374151}
.pricing .plan li::before{content:"\\2713 ";color:#16a34a;font-weight:700}
.pricing .plan .btn{display:block;padding:12px;border-radius:10px;font-weight:600;text-decoration:none;margin-top:20px}
.pricing .plan .btn.primary{background:#4f46e5;color:#fff}
.pricing .plan .btn.outline{background:#fff;color:#4f46e5;border:2px solid #4f46e5}
footer{text-align:center;padding:40px;color:#9ca3af;font-size:.85rem;border-top:1px solid #f3f4f6}
</style>
</head>
<body>
<nav><div class="logo">FlowMetrics</div><div class="links"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#" class="btn">Get Started</a></div></nav>
<section class="hero">
<div class="badge">Now with AI insights</div>
<h1>Analytics that <span>actually make sense</span></h1>
<p>Stop drowning in dashboards. FlowMetrics turns your data into clear, actionable insights in seconds.</p>
<div class="actions"><a href="#" class="primary">Start Free Trial</a><a href="#" class="secondary">Watch Demo</a></div>
</section>
<section class="features" id="features">
<h2>Everything you need</h2>
<div class="grid">
<div class="card"><div class="icon">&#x26A1;</div><h3>Real-time Dashboards</h3><p>See your metrics update live. No more waiting for overnight batch jobs.</p></div>
<div class="card"><div class="icon">&#x1F916;</div><h3>AI Insights</h3><p>Our AI finds patterns you'd miss and surfaces them before you even ask.</p></div>
<div class="card"><div class="icon">&#x1F4CA;</div><h3>Custom Reports</h3><p>Build beautiful reports in minutes. Drag, drop, and share with your team.</p></div>
</div>
</section>
<section class="stats">
<div class="grid">
<div class="stat"><div class="num">10K+</div><div class="label">Active Teams</div></div>
<div class="stat"><div class="num">50M</div><div class="label">Events/day</div></div>
<div class="stat"><div class="num">99.9%</div><div class="label">Uptime</div></div>
<div class="stat"><div class="num">4.9/5</div><div class="label">Rating</div></div>
</div>
</section>
<section class="pricing" id="pricing">
<h2>Simple, transparent pricing</h2>
<div class="plans">
<div class="plan"><h3>Starter</h3><div class="price">$29<span>/mo</span></div><ul><li>5 dashboards</li><li>10K events/day</li><li>7-day retention</li><li>Email support</li></ul><a href="#" class="btn outline">Get Started</a></div>
<div class="plan popular"><h3>Pro</h3><div class="price">$79<span>/mo</span></div><ul><li>Unlimited dashboards</li><li>1M events/day</li><li>90-day retention</li><li>AI insights</li><li>Priority support</li></ul><a href="#" class="btn primary">Start Free Trial</a></div>
<div class="plan"><h3>Enterprise</h3><div class="price">Custom</div><ul><li>Everything in Pro</li><li>Unlimited retention</li><li>SSO & SAML</li><li>Dedicated CSM</li></ul><a href="#" class="btn outline">Contact Sales</a></div>
</div>
</section>
<footer>&copy; 2024 FlowMetrics, Inc. All rights reserved.</footer>
</body>
</html>`
  },
  {
    keywords: [],  // default / fallback
    title: 'Modern Landing Page',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Horizon — Modern Website</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 48px;background:#fff;border-bottom:1px solid #f3f4f6}
nav .logo{font-size:1.4rem;font-weight:800;color:#4f46e5}
nav .links{display:flex;gap:20px;align-items:center}
nav .links a{text-decoration:none;color:#6b7280;font-size:.9rem}
.hero{padding:100px 24px;text-align:center;background:linear-gradient(135deg,#eef2ff 0%,#fdf4ff 50%,#fff 100%)}
.hero h1{font-size:3.5rem;font-weight:800;line-height:1.1;max-width:700px;margin:0 auto 20px;background:linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.2rem;color:#6b7280;max-width:520px;margin:0 auto 36px}
.hero a{display:inline-block;padding:16px 40px;background:#4f46e5;color:#fff;border-radius:12px;font-weight:700;text-decoration:none;font-size:1rem;transition:transform .2s,box-shadow .2s}
.hero a:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(79,70,229,.25)}
.features{max-width:1000px;margin:80px auto;padding:0 24px}
.features .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
.features .card{padding:32px;border-radius:16px;background:#fff;border:1px solid #e5e7eb;transition:box-shadow .3s}
.features .card:hover{box-shadow:0 8px 32px rgba(0,0,0,.08)}
.features .card .icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:16px}
.features .card h3{font-weight:700;margin-bottom:8px;font-size:1.1rem}
.features .card p{color:#6b7280;font-size:.9rem;line-height:1.6}
.cta-section{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:80px 24px;text-align:center;color:#fff;margin:80px 0 0}
.cta-section h2{font-size:2.2rem;font-weight:800;margin-bottom:16px}
.cta-section p{font-size:1.1rem;opacity:.85;margin-bottom:32px;max-width:480px;margin-left:auto;margin-right:auto}
.cta-section a{display:inline-block;padding:14px 36px;background:#fff;color:#4f46e5;border-radius:10px;font-weight:700;text-decoration:none}
footer{text-align:center;padding:32px;color:#9ca3af;font-size:.85rem;background:#f9fafb}
</style>
</head>
<body>
<nav><div class="logo">Horizon</div><div class="links"><a href="#features">Features</a><a href="#">About</a><a href="#">Contact</a></div></nav>
<section class="hero">
<h1>Build something beautiful today</h1>
<p>The modern platform for creators, makers, and dreamers who want to ship fast and look great doing it.</p>
<a href="#">Get Started Free</a>
</section>
<section class="features" id="features">
<div class="grid">
<div class="card"><div class="icon" style="background:#eef2ff">&#x1F680;</div><h3>Lightning Fast</h3><p>Built for speed from the ground up. Your site loads in milliseconds, not seconds.</p></div>
<div class="card"><div class="icon" style="background:#fdf4ff">&#x1F3A8;</div><h3>Beautiful Design</h3><p>Stunning templates that look professional on every device, every screen size.</p></div>
<div class="card"><div class="icon" style="background:#ecfdf5">&#x1F512;</div><h3>Secure by Default</h3><p>Enterprise-grade security with SSL, DDoS protection, and automatic backups.</p></div>
<div class="card"><div class="icon" style="background:#fef3c7">&#x26A1;</div><h3>AI-Powered</h3><p>Let AI handle the heavy lifting. Describe your vision and watch it come to life.</p></div>
<div class="card"><div class="icon" style="background:#fee2e2">&#x1F4F1;</div><h3>Mobile First</h3><p>Responsive layouts that feel native on phones, tablets, and desktops.</p></div>
<div class="card"><div class="icon" style="background:#e0e7ff">&#x1F4E6;</div><h3>One-Click Deploy</h3><p>Publish to your own subdomain instantly. No servers, no config, no hassle.</p></div>
</div>
</section>
<section class="cta-section">
<h2>Ready to get started?</h2>
<p>Join thousands of creators who build with Horizon every day.</p>
<a href="#">Create Your Site</a>
</section>
<footer>&copy; 2024 Horizon. Built with Flowin.</footer>
</body>
</html>`
  }
];

function pickDemoSite(prompt) {
  const lower = (prompt || '').toLowerCase();
  for (const demo of DEMO_SITES) {
    if (demo.keywords.length === 0) continue;
    if (demo.keywords.some(kw => lower.includes(kw))) return demo;
  }
  // Return last one (default) as fallback
  return DEMO_SITES[DEMO_SITES.length - 1];
}

/**
 * Simulate AI generation for unauthenticated users.
 * Shows the loading animation, progressively types HTML into the editor,
 * then shows a sign-up CTA.
 */
async function runDemoGeneration(prompt) {
  const demo = pickDemoSite(prompt);

  showLoading();
  // Simulate analysis delay
  await _sleep(1800);
  hideLoading();

  // Simulate a second "generating" phase
  showLoading();
  await _sleep(2200);
  hideLoading();

  // Progressively fill the editor
  const html = demo.html;
  const editor = window.editor;
  const preview = document.getElementById('preview');

  if (editor) {
    editor.setValue('');
    const chunkSize = Math.ceil(html.length / 40);
    for (let i = 0; i < html.length; i += chunkSize) {
      const partial = html.slice(0, i + chunkSize);
      editor.setValue(partial);
      await _sleep(60);
    }
    editor.setValue(html);
  }

  if (preview) {
    preview.srcdoc = html;
  }

  // Show the CTA
  _showDemoCTA('generate');
}

/**
 * Simulate refine for unauthenticated users.
 */
async function runDemoRefine(instruction) {
  showLoading();
  await _sleep(2000);
  hideLoading();

  // Swap to a different demo site to show "change"
  const current = window.editor?.getValue() || '';
  const demo = DEMO_SITES.find(d => !current.includes(d.title)) || DEMO_SITES[0];

  if (window.editor) {
    window.editor.setValue(demo.html);
  }
  const preview = document.getElementById('preview');
  if (preview) preview.srcdoc = demo.html;

  _showDemoCTA('refine');
}

/**
 * Show sign-up CTA overlay after demo.
 */
function _showDemoCTA(action) {
  // Remove any existing
  document.getElementById('demo-cta-overlay')?.remove();

  const actionText = action === 'refine'
    ? 'Refinements use AI to transform your site in seconds.'
    : 'This is a preview of what Flowin AI can build for you.';

  const overlay = document.createElement('div');
  overlay.id = 'demo-cta-overlay';
  overlay.innerHTML = `
    <div class="demo-cta-card">
      <div class="demo-cta-sparkle">&#10024;</div>
      <h2>Like what you see?</h2>
      <p>${actionText}</p>
      <p class="demo-cta-sub">Sign up free to generate your own custom site with AI — it takes 30 seconds.</p>
      <div class="demo-cta-actions">
        <button id="demo-cta-signup" class="demo-cta-primary">Sign Up Free</button>
        <button id="demo-cta-dismiss" class="demo-cta-secondary">Keep Exploring</button>
      </div>
      <p class="demo-cta-fine">No credit card required &middot; 3 free AI generations</p>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'demo-cta-style';
  style.textContent = `
    #demo-cta-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      animation: demo-fade-in 0.4s ease;
    }
    @keyframes demo-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .demo-cta-card {
      background: #fff; border-radius: 20px; padding: 44px 48px;
      text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.2);
      max-width: 440px; width: 92%; animation: demo-slide-up 0.4s ease;
    }
    @keyframes demo-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .demo-cta-sparkle { font-size: 2.5rem; margin-bottom: 12px; }
    .demo-cta-card h2 { font-size: 1.5rem; font-weight: 800; color: #1f2937; margin-bottom: 8px; }
    .demo-cta-card p { color: #6b7280; font-size: 0.95rem; line-height: 1.5; margin-bottom: 6px; }
    .demo-cta-sub { font-size: 0.9rem !important; color: #4f46e5 !important; font-weight: 500; margin-bottom: 20px !important; }
    .demo-cta-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .demo-cta-primary {
      padding: 14px 32px; background: #4f46e5; color: #fff; border: none;
      border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;
      transition: background 0.2s, transform 0.2s;
    }
    .demo-cta-primary:hover { background: #4338ca; transform: translateY(-1px); }
    .demo-cta-secondary {
      padding: 10px 24px; background: transparent; color: #6b7280; border: none;
      font-size: 0.9rem; cursor: pointer; text-decoration: underline;
    }
    .demo-cta-fine { font-size: 0.78rem !important; color: #9ca3af !important; margin-bottom: 0 !important; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  document.getElementById('demo-cta-signup')?.addEventListener('click', () => {
    overlay.remove();
    style.remove();
    // Trigger the auth modal
    document.getElementById('auth-open')?.click();
  });

  document.getElementById('demo-cta-dismiss')?.addEventListener('click', () => {
    overlay.remove();
    style.remove();
  });

  // Close on backdrop
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      style.remove();
    }
  });
}

/**
 * Show publish CTA for unauthenticated users.
 */
function showDemoPublishCTA() {
  _showDemoCTA('publish');
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
