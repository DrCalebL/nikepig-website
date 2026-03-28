/* ================================================================
   NIKEPIG Visitor Analytics Tracker v1.0
   Comprehensive client-side analytics: location, clicks, section
   dwell time, scroll depth, sessions, devices, referrers.
   Data stored in localStorage + optional remote endpoint.
   ================================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'nikepig_analytics';
  const SESSION_KEY = 'nikepig_session';
  const CONFIG = {
    // Set this to your analytics endpoint to persist data server-side
    // e.g. a Supabase function, Google Apps Script, or any POST endpoint
    remoteEndpoint: null,
    // Free IP geolocation API (no key needed, 45 req/min)
    geoAPI: 'https://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,query',
    // How often to flush to localStorage (ms)
    flushInterval: 5000,
    // Idle timeout before ending a section view (ms)
    idleTimeout: 30000
  };

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
    if (/Mobi|Android/i.test(ua)) device = 'mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'tablet';

    let browser = 'unknown';
    if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua)) browser = 'Safari';
    else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

    let os = 'unknown';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';

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

  /* ---- Geolocation via IP ---- */
  async function fetchGeoLocation() {
    try {
      const resp = await fetch(CONFIG.geoAPI);
      const data = await resp.json();
      if (data.status === 'success') {
        return {
          ip: data.query,
          country: data.country,
          countryCode: data.countryCode,
          region: data.regionName,
          city: data.city,
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          isp: data.isp
        };
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
        const sectionId = entry.target.id || entry.target.className.split(' ')[0] || 'unknown';
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
    // Flush any currently-visible sections
    const now = Date.now();
    const result = {};
    for (const [id, total] of Object.entries(sectionTotalTime)) {
      let t = total;
      if (sectionTimers[id]) t += now - sectionTimers[id];
      result[id] = Math.round(t / 1000); // seconds
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
        section: el.closest('section')?.id || el.closest('section')?.className?.split(' ')[0] || 'unknown'
      };
      clickLog.push(entry);
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
    const now = new Date().toISOString();

    // Append clicks
    if (clickLog.length > 0) {
      store.clicks.push(...clickLog.splice(0));
    }

    // Keep store size manageable (retain last 30 days)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    store.clicks = store.clicks.filter(c => new Date(c.timestamp).getTime() > cutoff);
    store.sessions = store.sessions.filter(s => new Date(s.startedAt).getTime() > cutoff);
    store.pageviews = store.pageviews.filter(p => new Date(p.timestamp).getTime() > cutoff);

    saveStore(store);
  }

  /* ---- Record session end data ---- */
  function recordSessionEnd() {
    const store = getStore();
    const dwellTimes = getSectionDwellTimes();
    const sessionEnd = {
      sessionId: currentSession.id,
      visitorId: currentSession.visitorId,
      endedAt: new Date().toISOString(),
      duration: Math.round((Date.now() - new Date(currentSession.startedAt).getTime()) / 1000),
      maxScrollDepth,
      sectionDwellTimes: dwellTimes,
      totalClicks: clickLog.length + (store.clicks.filter(c => c.sessionId === currentSession.id).length)
    };

    // Update session record
    const idx = store.sessions.findIndex(s => s.id === currentSession.id);
    if (idx >= 0) {
      Object.assign(store.sessions[idx], sessionEnd);
    }

    // Flush remaining clicks
    if (clickLog.length > 0) {
      store.clicks.push(...clickLog.splice(0));
    }

    saveStore(store);
    sendToRemote(store);
  }

  /* ---- Remote endpoint (optional) ---- */
  function sendToRemote(store) {
    if (!CONFIG.remoteEndpoint) return;
    try {
      const payload = JSON.stringify({
        session: currentSession,
        dwellTimes: getSectionDwellTimes(),
        scrollDepth: maxScrollDepth,
        clicks: store.clicks.filter(c => c.sessionId === currentSession.id)
      });
      // Use sendBeacon for reliability on page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(CONFIG.remoteEndpoint, payload);
      } else {
        fetch(CONFIG.remoteEndpoint, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }

  /* ---- Initialize ---- */
  const currentSession = getSession();

  async function init() {
    const store = getStore();
    const deviceInfo = getDeviceInfo();

    // Check if this visitor already exists
    let visitor = store.visitors.find(v => v.id === currentSession.visitorId);
    const geo = await fetchGeoLocation();

    if (!visitor) {
      visitor = {
        id: currentSession.visitorId,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        visitCount: 1,
        device: deviceInfo,
        geo: geo,
        ageGroup: null // Can be set via optional survey prompt
      };
      store.visitors.push(visitor);
    } else {
      visitor.lastSeen = new Date().toISOString();
      visitor.visitCount++;
      if (geo) visitor.geo = geo;
      visitor.device = deviceInfo;
    }

    // Record session
    store.sessions.push({
      ...currentSession,
      device: deviceInfo,
      geo: geo
    });

    // Record pageview
    store.pageviews.push({
      timestamp: new Date().toISOString(),
      sessionId: currentSession.id,
      visitorId: currentSession.visitorId,
      path: location.pathname + location.hash,
      referrer: document.referrer || 'direct'
    });

    saveStore(store);

    // Set up trackers
    setupSectionTracking();
    setupClickTracking();
    setupScrollTracking();

    // Periodic flush
    setInterval(flushData, CONFIG.flushInterval);

    // Capture session end
    window.addEventListener('beforeunload', recordSessionEnd);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') recordSessionEnd();
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
