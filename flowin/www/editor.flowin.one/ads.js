'use strict';

/**
 * Ad injection for free-tier users in the editor.
 * Fetches ad config from /users/me/stats and injects AdSense if show_ads is true.
 */
function initAds(publisherId, adUnitId) {
  if (!publisherId || !adUnitId) return;

  // Load AdSense script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);

  // Inject ad unit into a banner at the bottom of the sidebar
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const adContainer = document.createElement('div');
  adContainer.style.cssText = 'padding:8px;border-top:1px solid #e5e7eb;background:#f9fafb;';
  adContainer.innerHTML = `
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="${publisherId}"
         data-ad-slot="${adUnitId}"
         data-ad-format="horizontal"
         data-full-width-responsive="true"></ins>
  `;
  sidebar.appendChild(adContainer);

  // Push ad after script loads
  script.onload = () => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  };
}

// Auto-check on page load if user should see ads
async function checkAndShowAds() {
  if (!isLoggedIn()) return;
  try {
    const res = await fetch('https://api.flowin.one/users/me/stats', { headers: authHeaders() });
    if (!res.ok) return;
    const stats = await res.json();
    if (stats.tier && stats.tier.show_ads) {
      // Fetch ad config from settings (use a simple endpoint or hardcode for now)
      // The admin sets these in site_settings
      const settingsRes = await fetch('https://api.flowin.one/auth/me', { headers: authHeaders() });
      if (!settingsRes.ok) return;
      // For now, try to get from a meta tag or global config
      const publisherId = document.querySelector('meta[name="adsense-publisher"]')?.content;
      const adUnitId = document.querySelector('meta[name="adsense-adunit"]')?.content;
      if (publisherId && adUnitId) {
        initAds(publisherId, adUnitId);
      }
    }
  } catch (e) {
    // Ads are non-critical, fail silently
  }
}

document.addEventListener('DOMContentLoaded', checkAndShowAds);
