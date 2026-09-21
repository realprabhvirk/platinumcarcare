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

  /* Contact form: validate, submit via mailto fallback, show success/error state */
  function initContactForm() {
    const form = document.getElementById('enquiryForm');
    const errorEl = document.getElementById('formError');
    const successPanel = document.getElementById('successPanel');
    if (!form || !errorEl || !successPanel) return;

    const serviceLabels = {
      'exterior-wash-wax': 'Exterior Wash & Wax',
      'interior-deep-clean': 'Interior Deep Clean',
      'paint-protection': 'Paint Protection',
      'ceramic-coating': 'Ceramic Coating',
      'mobile-detailing': 'Mobile Detailing',
      'maintenance-details': 'Maintenance Details',
      'not-sure': 'Not sure, advise me',
    };

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
      const mailto = `mailto:bookings@platinumcarcare.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      window.location.href = mailto;

      form.hidden = true;
      successPanel.hidden = false;
      successPanel.setAttribute('tabindex', '-1');
      successPanel.focus({ preventScroll: true });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSmoothScroll();
    initReveal();
    initHeroCinema();
    initContactForm();
  });
})();
