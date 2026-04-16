/**
 * Main JS - Header, mobile menu, scroll reveal (staggered + directional),
 * FAQ smooth accordion, step connector animation, parallax
 */

(function () {
  'use strict';

  // ====== HEADER SCROLL ======
  var header = document.getElementById('header');

  function updateHeader() {
    if (window.scrollY > 20) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // ====== MOBILE MENU ======
  var menuToggle = document.querySelector('.header__menu-toggle');
  var mobileMenu = document.querySelector('.header__mobile-menu');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      var isOpen = mobileMenu.getAttribute('aria-hidden') === 'false';
      mobileMenu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      menuToggle.setAttribute('aria-expanded', !isOpen);

      var spans = menuToggle.querySelectorAll('span');
      if (!isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.setAttribute('aria-hidden', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
        var spans = menuToggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      });
    });
  }

  // ====== SCROLL REVEAL (staggered + directional) ======
  var revealElements = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(function (el) {
      el.classList.add('revealed');
    });
  }

  // ====== FAQ SMOOTH ACCORDION ======
  var faqItems = document.querySelectorAll('.faq__item');

  faqItems.forEach(function (item) {
    var btn = item.querySelector('.faq__question');

    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('faq__item--open');

      // Close all others
      faqItems.forEach(function (other) {
        if (other !== item) {
          other.classList.remove('faq__item--open');
          other.querySelector('.faq__question').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current
      item.classList.toggle('faq__item--open');
      btn.setAttribute('aria-expanded', !isOpen);
    });
  });

  // ====== STEP CONNECTOR ANIMATION ======
  var connectorLines = document.querySelectorAll('.step__connector-line');

  if ('IntersectionObserver' in window && connectorLines.length > 0) {
    var connectorObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          connectorObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.5
    });

    connectorLines.forEach(function (line) {
      connectorObserver.observe(line);
    });
  }

  // ====== SMOOTH SCROLL ======
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ====== META PIXEL — ViewContent (form-card no viewport) ======
  var formCard = document.querySelector('.form-card') || document.getElementById('lead-form');
  if (formCard && 'IntersectionObserver' in window) {
    var viewContentFired = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !viewContentFired) {
          viewContentFired = true;
          observer.disconnect();
          try {
            if (typeof fbq === 'function') {
              fbq('track', 'ViewContent', {
                content_name: 'Formulario-LPB2B-Proxxima',
                content_category: 'lead-form'
              });
              console.log('[Pixel] ViewContent disparado');
            }
          } catch (e) { /* ignore */ }
        }
      });
    }, { threshold: 0.5 });
    observer.observe(formCard);
  }

  // ====== META PIXEL — Contact (mailto / tel / WhatsApp) ======
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest && e.target.closest('a[href]');
    if (!anchor) return;
    var href = anchor.getAttribute('href') || '';
    var isContact = /^mailto:/i.test(href)
      || /^tel:/i.test(href)
      || /(?:wa\.me|api\.whatsapp\.com|whatsapp:)/i.test(href);
    if (!isContact) return;
    try {
      if (typeof fbq === 'function') {
        var channel = /^mailto:/i.test(href) ? 'email'
          : /^tel:/i.test(href) ? 'phone'
          : 'whatsapp';
        fbq('track', 'Contact', {
          content_name: 'cta-' + channel,
          content_category: channel
        });
        console.log('[Pixel] Contact disparado', channel);
      }
    } catch (err) { /* ignore */ }
  }, true);
})();
