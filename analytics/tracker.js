/* ================================================================
   NIKEPIG Visitor Analytics Tracker v2.0
   Comprehensive client-side analytics: location, clicks, section
   dwell time, scroll depth, sessions, devices, referrers.
   Data sent to Supabase + localStorage fallback.
   ================================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'nikepig_analytics';
  const SESSION_KEY = 'nikepig_session';
  const CONFIG = {
    // ---- Supabase configuration ----
    // Replace these with your Supabase project values
    supabaseUrl: 'https://yurrhnhduhosigalfopo.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cnJobmhkdWhvc2lnYWxmb3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTI3NDIsImV4cCI6MjA5MDI4ODc0Mn0.EozFWDGm2dbafGrjenySyOym6M-IU8_SRcI_wKbtBto',
    // How often to flush to localStorage (ms)
    flushInterval: 5000,
    // Max clicks to buffer in memory before forcing a flush
    maxClickBuffer: 500
  };

  function supabaseEnabled() {
    return CONFIG.supabaseUrl && CONFIG.supabaseKey;
  }

  /* ---- Supabase REST helper ---- */
  function supabaseInsert(table, rows) {
    if (!supabaseEnabled() || !rows.length) return Promise.resolve();
    return fetch(`${CONFIG.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(rows)
    }).catch(() => {});
  }

  function supabaseUpsert(table, rows) {
    if (!supabaseEnabled() || !rows.length) return Promise.resolve();
    return fetch(`${CONFIG.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    }).catch(() => {});
  }

  function supabaseUpdate(table, match, data) {
    if (!supabaseEnabled()) return Promise.resolve();
    const params = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    return fetch(`${CONFIG.supabaseUrl}/rest/v1/${table}?${params}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    }).catch(() => {});
  }

  /* ---- Utility helpers ---- */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function getStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || createEmptyStore();
    } catch {
      return createEmptyStore();
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* storage full – degrade gracefully */ }
  }

  function createEmptyStore() {
    return {
      visitors: [],
      sessions: [],
      pageviews: [],
      clicks: [],
      sectionViews: [],
      scrollDepths: [],
      createdAt: new Date().toISOString()
    };
  }

  /* ---- Visitor fingerprint (privacy-friendly, no cookies) ---- */
  function getVisitorId() {
    let vid = null;
    try { vid = localStorage.getItem('nikepig_vid'); } catch {}
    if (!vid) {
      vid = 'v_' + generateId();
      try { localStorage.setItem('nikepig_vid', vid); } catch {}
    }
    return vid;
  }

  /* ---- Session management ---- */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const session = {
      id: 's_' + generateId(),
      visitorId: getVisitorId(),
      startedAt: new Date().toISOString(),
      referrer: document.referrer || 'direct',
      utmSource: new URLSearchParams(location.search).get('utm_source') || null,
      utmMedium: new URLSearchParams(location.search).get('utm_medium') || null,
      utmCampaign: new URLSearchParams(location.search).get('utm_campaign') || null,
      landingPage: location.pathname + location.hash
    };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    return session;
  }

  /* ---- Device & browser info ---- */
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'desktop';
    const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    if (/Mobi|Android/i.test(ua) && !/Tablet|iPad/i.test(ua)) device = 'mobile';
    else if (/Tablet|iPad/i.test(ua) || isIPadOS) device = 'tablet';

    let browser = 'unknown';
    if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua)) browser = 'Safari';

    let os = 'unknown';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua) || isIPadOS) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    return {
      device,
      browser,
      os,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language || navigator.userLanguage || 'unknown',
      languages: Array.from(navigator.languages || []),
      touchSupport: 'ontouchstart' in window,
      pixelRatio: window.devicePixelRatio || 1
    };
  }

  /* ---- Geolocation via IP (cached per session, with fallback) ---- */
  async function fetchGeoLocation() {
    // Return cached result if available
    try {
      const cached = sessionStorage.getItem('nikepig_geo');
      if (cached) return JSON.parse(cached);
    } catch {}

    // Try primary API: ipwho.is
    try {
      const resp = await fetch('https://ipwho.is/');
      const data = await resp.json();
      if (data.success !== false && data.country) {
        const geo = {
          // IP intentionally omitted to avoid storing PII (GDPR/CCPA)
          country: data.country,
          countryCode: data.country_code,
          region: data.region,
          city: data.city,
          lat: data.latitude,
          lon: data.longitude,
          timezone: data.timezone?.id || null,
          isp: data.connection?.isp || null
        };
        try { sessionStorage.setItem('nikepig_geo', JSON.stringify(geo)); } catch {}
        return geo;
      }
    } catch {}

    // Fallback API: ip-api.com (HTTP only, but works as last resort)
    try {
      const resp = await fetch('https://ipapi.co/json/');
      const data = await resp.json();
      if (data.country_name) {
        const geo = {
          country: data.country_name,
          countryCode: data.country_code,
          region: data.region,
          city: data.city,
          lat: data.latitude,
          lon: data.longitude,
          timezone: data.timezone || null,
          isp: data.org || null
        };
        try { sessionStorage.setItem('nikepig_geo', JSON.stringify(geo)); } catch {}
        return geo;
      }
    } catch {}

    return null;
  }

  /* ---- Section dwell-time tracking ---- */
  const sectionTimers = {};
  const sectionTotalTime = {};

  function setupSectionTracking() {
    const sections = document.querySelectorAll('section');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const cn = entry.target.className;
        const sectionId = entry.target.id || (typeof cn === 'string' ? cn.split(' ')[0] : '') || 'unknown';
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          if (!sectionTimers[sectionId]) {
            sectionTimers[sectionId] = Date.now();
            if (!sectionTotalTime[sectionId]) sectionTotalTime[sectionId] = 0;
          }
        } else {
          if (sectionTimers[sectionId]) {
            sectionTotalTime[sectionId] += Date.now() - sectionTimers[sectionId];
            delete sectionTimers[sectionId];
          }
        }
      });
    }, { threshold: [0.3] });

    sections.forEach(s => observer.observe(s));
  }

  function getSectionDwellTimes() {
    const now = Date.now();
    const result = {};
    for (const [id, total] of Object.entries(sectionTotalTime)) {
      let t = total;
      if (sectionTimers[id]) t += now - sectionTimers[id];
      result[id] = Math.round(t / 1000);
    }
    return result;
  }

  /* ---- Click tracking ---- */
  const clickLog = [];

  function setupClickTracking() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, .cta-btn, .nav-links a, [onclick], .card, .exchange-link, .gif-card, .meme-track img');
      const el = target || e.target;

      const entry = {
        timestamp: new Date().toISOString(),
        sessionId: currentSession.id,
        tag: el.tagName,
        id: el.id || null,
        className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : null,
        text: (el.textContent || '').trim().slice(0, 80),
        href: el.href || el.closest('a')?.href || null,
        x: e.clientX,
        y: e.clientY,
        section: el.closest('section')?.id || el.closest('section')?.className?.split(' ')[0] || el.closest('nav')?.id || el.closest('header')?.id || el.closest('footer')?.id || el.closest('[data-section]')?.dataset?.section || 'unknown'
      };
      clickLog.push(entry);
      if (clickLog.length >= CONFIG.maxClickBuffer) flushData();
    }, { capture: true });
  }

  /* ---- Scroll depth tracking ---- */
  let maxScrollDepth = 0;

  function setupScrollTracking() {
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrollTop / docHeight) * 100);
        if (pct > maxScrollDepth) maxScrollDepth = pct;
      }
    };
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => { update(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---- Flush data to store ---- */
  function flushData() {
    const store = getStore();

    if (clickLog.length > 0) {
      const newClicks = clickLog.splice(0);
      store.clicks.push(...newClicks);

      // Send clicks to Supabase
      supabaseInsert('clicks', newClicks.map(c => ({
        session_id: c.sessionId,
        timestamp: c.timestamp,
        tag: c.tag,
        element_id: c.id,
        class_name: c.className,
        text: c.text,
        href: c.href,
        x: c.x,
        y: c.y,
        section: c.section
      })));
    }

    // Keep localStorage manageable (retain last 30 days)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    store.clicks = store.clicks.filter(c => new Date(c.timestamp).getTime() > cutoff);
    store.sessions = store.sessions.filter(s => new Date(s.startedAt).getTime() > cutoff);
    store.pageviews = store.pageviews.filter(p => new Date(p.timestamp).getTime() > cutoff);

    saveStore(store);
  }

  /* ---- Record session end data ---- */
  let sessionEnded = false;
  function recordSessionEnd() {
    if (sessionEnded) return;
    sessionEnded = true;

    const store = getStore();

    // Flush remaining clicks FIRST to get accurate count
    const remainingClicks = clickLog.splice(0);
    if (remainingClicks.length) {
      store.clicks.push(...remainingClicks);
      supabaseInsert('clicks', remainingClicks.map(c => ({
        session_id: c.sessionId,
        timestamp: c.timestamp,
        tag: c.tag,
        element_id: c.id,
        class_name: c.className,
        text: c.text,
        href: c.href,
        x: c.x,
        y: c.y,
        section: c.section
      })));
    }

    const dwellTimes = getSectionDwellTimes();
    const totalClicks = store.clicks.filter(c => c.sessionId === currentSession.id).length;
    const sessionEnd = {
      endedAt: new Date().toISOString(),
      duration: Math.round((Date.now() - new Date(currentSession.startedAt).getTime()) / 1000),
      maxScrollDepth,
      sectionDwellTimes: dwellTimes,
      totalClicks
    };

    // Update local session record
    const idx = store.sessions.findIndex(s => s.id === currentSession.id);
    if (idx >= 0) {
      Object.assign(store.sessions[idx], sessionEnd);
    }

    saveStore(store);

    // Update Supabase session with end data
    supabaseUpdate('sessions', { id: currentSession.id }, {
      ended_at: sessionEnd.endedAt,
      duration: sessionEnd.duration,
      max_scroll_depth: sessionEnd.maxScrollDepth,
      section_dwell_times: sessionEnd.sectionDwellTimes,
      total_clicks: sessionEnd.totalClicks
    });
  }

  /* ---- Initialize ---- */
  const currentSession = getSession();

  function init() {
    try {
      const store = getStore();
      const deviceInfo = getDeviceInfo();

      let visitor = store.visitors.find(v => v.id === currentSession.visitorId);

      if (!visitor) {
        visitor = {
          id: currentSession.visitorId,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          visitCount: 1,
          device: deviceInfo,
          geo: null
        };
        store.visitors.push(visitor);
      } else {
        visitor.lastSeen = new Date().toISOString();
        visitor.visitCount++;
        visitor.device = deviceInfo;
      }

      // Record session locally
      if (!store.sessions.some(s => s.id === currentSession.id)) {
        store.sessions.push({
          ...currentSession,
          device: deviceInfo,
          geo: null
        });
      }

      // Record pageview
      const pageview = {
        timestamp: new Date().toISOString(),
        sessionId: currentSession.id,
        visitorId: currentSession.visitorId,
        path: location.pathname + location.hash,
        referrer: document.referrer || 'direct'
      };
      store.pageviews.push(pageview);

      saveStore(store);

      // Send session + pageview to Supabase
      supabaseUpsert('visitors', [{
        id: visitor.id,
        first_seen: visitor.firstSeen,
        last_seen: visitor.lastSeen,
        visit_count: visitor.visitCount
      }]);

      supabaseInsert('sessions', [{
        id: currentSession.id,
        visitor_id: currentSession.visitorId,
        started_at: currentSession.startedAt,
        referrer: currentSession.referrer,
        utm_source: currentSession.utmSource,
        utm_medium: currentSession.utmMedium,
        utm_campaign: currentSession.utmCampaign,
        landing_page: currentSession.landingPage,
        device_type: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screen_width: deviceInfo.screenWidth,
        screen_height: deviceInfo.screenHeight,
        viewport_width: deviceInfo.viewportWidth,
        viewport_height: deviceInfo.viewportHeight,
        language: deviceInfo.language,
        touch_support: deviceInfo.touchSupport,
        pixel_ratio: deviceInfo.pixelRatio
      }]);

      supabaseInsert('pageviews', [{
        session_id: pageview.sessionId,
        visitor_id: pageview.visitorId,
        timestamp: pageview.timestamp,
        path: pageview.path,
        referrer: pageview.referrer
      }]);

      // Set up trackers
      setupSectionTracking();
      setupClickTracking();
      setupScrollTracking();

      setInterval(flushData, CONFIG.flushInterval);

      window.addEventListener('beforeunload', recordSessionEnd);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') recordSessionEnd();
      });

      // Fetch geo in background
      fetchGeoLocation().then(geo => {
        if (!geo) return;
        const s = getStore();
        const v = s.visitors.find(v => v.id === currentSession.visitorId);
        if (v) v.geo = geo;
        const sess = s.sessions.find(ss => ss.id === currentSession.id);
        if (sess) sess.geo = geo;
        saveStore(s);

        // Update Supabase with geo data
        supabaseUpdate('sessions', { id: currentSession.id }, {
          country: geo.country,
          country_code: geo.countryCode,
          region: geo.region,
          city: geo.city,
          latitude: geo.lat,
          longitude: geo.lon,
          timezone: geo.timezone,
          isp: geo.isp
        });
      }).catch(() => {});
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[NIKEPIG Analytics] init error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
