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
    initContactForm();
  });
})();
