(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mobile nav toggle */
  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    const closeNav = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };
    const openNav = () => {
      toggle.setAttribute('aria-expanded', 'true');
      nav.classList.add('is-open');
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeNav() : openNav();
    });

    document.addEventListener('click', (e) => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      closeNav();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeNav();
        toggle.focus();
      }
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });
  }

  /* Smooth scroll for on-page anchors */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  }

  /* Scroll-triggered section reveal */
  function initReveal() {
    const sections = document.querySelectorAll('.is-reveal');
    if (!sections.length) return;

    if (reduceMotion) {
      sections.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    sections.forEach((el) => observer.observe(el));
  }

  /* Cinematic scroll-scrubbed hero: scroll position through the tall .hero-cinema
     track drives video.currentTime (smoothed via rAF, never set directly from the
     scroll event) plus the intro/outro text timeline. Falls back to a static
     poster + always-visible intro text on narrow viewports and reduced-motion,
     matching the .hero-cinema--simple CSS an inline page script applies early. */
  function initHeroCinema() {
    const section = document.getElementById('heroCinema');
    const video = document.getElementById('heroVideo');
    const startEl = document.getElementById('heroContentStart');
    const endEl = document.getElementById('heroContentEnd');
    if (!section || !video || !startEl || !endEl) return;

    const narrowQuery = window.matchMedia('(max-width: 900px)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const EASE = 0.12;
    const SNAP_EPSILON = 0.0006;
    const SEEK_EPSILON = 1 / 48; // ~ half a frame at this video's 24fps

    let active = false;
    let observer = null;
    let rafId = null;
    let intersecting = false;
    let progressInitialized = false;
    let current = 0;
    let videoReady = false;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothstep = (t) => t * t * (3 - 2 * t);

    function startOpacity(p) {
      if (p <= 0.10) return lerp(1, 0.7, smoothstep(p / 0.10));
      if (p <= 0.20) return lerp(0.7, 0, smoothstep((p - 0.10) / 0.10));
      return 0;
    }
    function startTranslate(p) {
      return p <= 0.20 ? lerp(0, -14, smoothstep(p / 0.20)) : -14;
    }
    function endAmount(p) {
      if (p <= 0.75) return 0;
      if (p <= 0.90) return smoothstep((p - 0.75) / 0.15);
      return 1;
    }

    function setVisible(el, visible) {
      el.style.pointerEvents = visible ? 'auto' : 'none';
      if (visible) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    }

    function applyText(p) {
      const sOpacity = startOpacity(p);
      startEl.style.opacity = sOpacity;
      startEl.style.transform = `translateY(${startTranslate(p)}px)`;
      setVisible(startEl, sOpacity > 0.05);

      const eAmount = endAmount(p);
      endEl.style.opacity = eAmount;
      endEl.style.transform = `translateY(${lerp(20, 0, eAmount)}px)`;
      setVisible(endEl, eAmount > 0.5);
    }

    function tick() {
      const rect = section.getBoundingClientRect();
      const sectionTop = window.scrollY + rect.top;
      const scrollable = section.offsetHeight - window.innerHeight;
      const target = scrollable > 0 ? clamp((window.scrollY - sectionTop) / scrollable, 0, 1) : 0;

      if (!progressInitialized) {
        current = target;
        progressInitialized = true;
      } else if (Math.abs(target - current) < SNAP_EPSILON) {
        current = target;
      } else {
        current += (target - current) * EASE;
      }

      if (videoReady && video.duration) {
        const desired = clamp(current * video.duration, 0, video.duration - 0.02);
        if (Math.abs(video.currentTime - desired) > SEEK_EPSILON) {
          try { video.currentTime = desired; } catch (err) { /* mid-seek throws are transient; next tick retries */ }
        }
      }

      applyText(current);

      rafId = intersecting ? requestAnimationFrame(tick) : null;
    }

    function startLoop() {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    function enableCinema() {
      if (active) return;
      active = true;
      section.classList.remove('hero-cinema--simple');

      if (!video.hasChildNodes()) {
        const source = document.createElement('source');
        source.src = 'videos/hero-orbit.mp4';
        source.type = 'video/mp4';
        video.preload = 'auto';
        video.appendChild(source);
        video.load();
      }
      video.addEventListener('loadedmetadata', () => { videoReady = true; }, { once: true });
      video.addEventListener('loadeddata', () => { video.classList.add('is-ready'); }, { once: true });

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          intersecting = entry.isIntersecting;
          if (intersecting) startLoop();
        });
      }, { threshold: 0 });
      observer.observe(section);

      progressInitialized = false;
      startLoop();
    }

    function disableCinema() {
      section.classList.add('hero-cinema--simple');
      if (!active) return;
      active = false;

      if (observer) { observer.disconnect(); observer = null; }
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      intersecting = false;

      video.classList.remove('is-ready');
      video.pause();
      video.removeAttribute('src');
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();

      [startEl, endEl].forEach((el) => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.pointerEvents = '';
        el.removeAttribute('aria-hidden');
      });
    }

    function evaluate() {
      (narrowQuery.matches || reduceQuery.matches) ? disableCinema() : enableCinema();
    }

    narrowQuery.addEventListener('change', evaluate);
    reduceQuery.addEventListener('change', evaluate);
    evaluate();
  }

  /* Small looping supporting clips (gallery tiles, service detail media): load
     and play only while scrolled into view, pause once scrolled away. Never
     autoplays under reduced motion, poster frame stays static instead. */
  function initAutoplayVideos() {
    const videos = document.querySelectorAll('video.autoplay-video[data-autoplay-src]');
    if (!videos.length || reduceMotion) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.src) {
            video.src = video.dataset.autoplaySrc;
            video.load();
          }
          video.play().catch(() => { /* autoplay can be blocked; poster stays visible */ });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.35 });

    videos.forEach((video) => observer.observe(video));
  }

  /* Contact form: validate, submit via mailto fallback, show success/error state */
  function initContactForm() {
    const form = document.getElementById('enquiryForm');
    const errorEl = document.getElementById('formError');
    const successPanel = document.getElementById('successPanel');
    if (!form || !errorEl || !successPanel) return;

    const serviceLabels = {
      'regular-maintenance': 'Regular Maintenance ($150)',
      'mini-detail': 'Mini Detail ($180)',
      'full-detail': 'Full Detail ($360)',
      'paint-correction': 'Paint Correction (Quote)',
      'ceramic-coating': 'Ceramic Coating (Quote)',
      'not-sure': 'Not sure, advise me',
    };

    // Pre-select the service dropdown when arriving via a package's
    // "Book This Detail" / "Get a Quote" link, e.g. contact.html?service=full-detail
    const serviceField = form.elements.namedItem('service');
    const requestedService = new URLSearchParams(window.location.search).get('service');
    if (serviceField && requestedService && requestedService in serviceLabels) {
      serviceField.value = requestedService;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const data = new FormData(form);
      const required = ['name', 'phone', 'email', 'suburb', 'vehicle', 'locationType', 'service'];
      const missing = required.some((key) => !String(data.get(key) || '').trim());

      if (missing) {
        errorEl.hidden = false;
        return;
      }
      errorEl.hidden = true;

      const name = data.get('name');
      const phone = data.get('phone');
      const email = data.get('email');
      const suburb = data.get('suburb');
      const vehicle = data.get('vehicle');
      const locationType = data.get('locationType') === 'home' ? 'Home' : 'Workplace';
      const service = serviceLabels[data.get('service')] || data.get('service');
      const notes = String(data.get('notes') || '').trim();

      const subject = `Detail enquiry from ${name}`;
      const bodyLines = [
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        `Suburb / Location: ${suburb}`,
        `Vehicle type: ${vehicle}`,
        `Home or workplace: ${locationType}`,
        `Desired service: ${service}`,
        `Notes: ${notes || 'None'}`,
      ];
      const mailto = `mailto:platinummobliecarcare@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      window.location.href = mailto;

      form.hidden = true;
      successPanel.hidden = false;
      successPanel.setAttribute('tabindex', '-1');
      successPanel.focus({ preventScroll: true });
    });
  }

  /* Page transition cutscene: internal link clicks play a short car clip over a
     black overlay, the outgoing page navigates at the clip's midpoint, and the
     incoming page picks the clip up where it left off (state handed over via
     sessionStorage) before fading the overlay out. Every path has a timeout so
     the overlay can never stay stuck. */
  function initPageTransition() {
    const KEY = 'pcc-cutscene';
    const NAV_AT = 0.3;            // clip second where the car is mid-screen
    const NAV_FALLBACK_MS = 700;   // navigate anyway if the clip stalls
    const HARD_LIMIT_MS = 2500;    // absolute cap on how long the overlay may show
    const root = document.documentElement;

    let arrival = null;
    try {
      arrival = JSON.parse(sessionStorage.getItem(KEY));
      sessionStorage.removeItem(KEY);
    } catch (err) { /* storage unavailable, just no handover */ }

    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduceMotion || saveData) {
      root.classList.remove('cutscene-arrive');
      return;
    }
    const arriving = !!arrival && Date.now() - arrival.at < 4000;

    const overlay = document.createElement('div');
    overlay.className = 'cutscene';
    overlay.setAttribute('aria-hidden', 'true');

    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.tabIndex = -1;
    video.preload = 'auto';
    video.poster = 'images/car-cutscene-poster.jpg';
    [['videos/car-cutscene.webm', 'video/webm'], ['videos/car-cutscene.mp4', 'video/mp4']].forEach(([src, type]) => {
      const source = document.createElement('source');
      source.src = src;
      source.type = type;
      video.appendChild(source);
    });
    overlay.appendChild(video);
    document.body.appendChild(overlay);

    let timers = [];
    let running = false;
    let navigated = false;
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function hide(instant) {
      clearTimers();
      running = false;
      navigated = false;
      video.pause();
      overlay.classList.remove('is-seeking');
      if (instant) overlay.classList.add('is-instant');
      overlay.classList.remove('is-active');
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove('is-instant')));
    }

    if (arriving) {
      running = true;
      overlay.classList.add('is-active', 'is-instant', 'is-seeking');
      root.classList.remove('cutscene-arrive');
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove('is-instant')));

      const offset = Math.max(0, (arrival.vt || 0) + (Date.now() - arrival.at) / 1000);
      const resume = () => {
        if (offset >= video.duration - 0.05) { hide(); return; }
        video.addEventListener('seeked', () => overlay.classList.remove('is-seeking'), { once: true });
        video.currentTime = offset;
        video.play().catch(() => hide());
      };
      if (video.readyState >= 1) resume();
      else video.addEventListener('loadedmetadata', resume, { once: true });

      video.addEventListener('ended', () => hide(), { once: true });
      video.addEventListener('error', () => hide(), { once: true });
      later(() => hide(), HARD_LIMIT_MS);
    } else {
      root.classList.remove('cutscene-arrive');
      video.load();
    }

    function isCutsceneLink(link) {
      const href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return false;
      if (link.target && link.target !== '_self') return false;
      if (link.hasAttribute('download')) return false;
      let url;
      try { url = new URL(link.href, window.location.href); } catch (err) { return false; }
      if (url.protocol !== window.location.protocol || url.origin !== window.location.origin) return false;
      if (!/(\/|\.html?)$/.test(url.pathname)) return false;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
      return true;
    }

    function play(href) {
      running = true;
      navigated = false;
      overlay.classList.remove('is-seeking');
      video.currentTime = 0;
      const started = video.play();

      const go = () => {
        if (navigated) return;
        navigated = true;
        try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), vt: video.currentTime })); } catch (err) { /* no handover */ }
        window.location.href = href;
      };

      if (started && started.catch) {
        started.catch(() => { hide(); window.location.href = href; });
      }
      overlay.classList.add('is-active');

      const watch = () => {
        if (navigated || !running) return;
        if (video.currentTime >= NAV_AT) go();
        else requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
      later(go, NAV_FALLBACK_MS);
      later(() => hide(), HARD_LIMIT_MS);
    }

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || !isCutsceneLink(link)) return;
      e.preventDefault();
      if (running) return;
      play(link.href);
    });

    window.addEventListener('pageshow', (e) => {
      if (e.persisted) hide(true);
    });
  }

  initPageTransition();

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSmoothScroll();
    initReveal();
    initHeroCinema();
    initAutoplayVideos();
    initContactForm();
  });
})();
