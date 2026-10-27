/* ИИ или Нет? Для чайников — поведение страницы */
(function () {
  'use strict';

  var head = document.getElementById('siteHead');
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  /* --- Шапка: линия при скролле --- */
  function onScroll() {
    if (window.scrollY > 4) { head.classList.add('stuck'); }
    else { head.classList.remove('stuck'); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- Мобильное меню --- */
  if (burger) {
    burger.addEventListener('click', function () {
      var open = head.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        head.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --- Появление блоков --- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revObs.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* --- Подсветка активного раздела --- */
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var spyObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        var id = '#' + en.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === id);
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(function (s) { spyObs.observe(s); });
  }

  /* --- Слайды-презентация --- */
  var track = document.getElementById('slidesTrack');
  if (track) {
    var slides = Array.prototype.slice.call(track.children);
    var counter = document.getElementById('slideCounter');
    var dotsBox = document.getElementById('slidesDots');
    var prev = document.getElementById('prevSlide');
    var next = document.getElementById('nextSlide');
    var index = 0;
    var slidesVisible = false;

    slides.forEach(function (_, i) {
      var d = document.createElement('button');
      d.className = 'sdot';
      d.type = 'button';
      d.setAttribute('aria-label', 'Слайд ' + (i + 1));
      d.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(d);
    });
    var dots = Array.prototype.slice.call(dotsBox.children);

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      counter.textContent = (index + 1) + ' / ' + slides.length;
      dots.forEach(function (d, di) { d.classList.toggle('active', di === index); });
    }
    prev.addEventListener('click', function () { go(index - 1); });
    next.addEventListener('click', function () { go(index + 1); });
    go(0);

    /* Клавиши — только когда презентация на экране */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        slidesVisible = entries[0] && entries[0].isIntersecting;
      }, { threshold: 0.25 }).observe(document.getElementById('slides'));
    }
    document.addEventListener('keydown', function (e) {
      if (!slidesVisible) { return; }
      if (e.key === 'ArrowLeft') { go(index - 1); }
      if (e.key === 'ArrowRight') { go(index + 1); }
    });

    /* Свайп на тач-устройствах */
    var x0 = null;
    track.addEventListener('pointerdown', function (e) { x0 = e.clientX; }, { passive: true });
    track.addEventListener('pointerup', function (e) {
      if (x0 === null) { return; }
      var dx = e.clientX - x0;
      if (Math.abs(dx) > 44) { go(index + (dx < 0 ? 1 : -1)); }
      x0 = null;
    }, { passive: true });
    track.addEventListener('pointercancel', function () { x0 = null; }, { passive: true });
  }
})();
