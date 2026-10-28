/* AI Scan — поведение статьи */
/* global window, document, navigator, requestAnimationFrame */
(function () {
  'use strict';

  var head = document.getElementById('head');

  /* Шапка: тонкая тень после прокрутки */
  function onScroll() {
    if (!head) { return; }
    if (window.scrollY > 4) { head.classList.add('stuck'); }
    else { head.classList.remove('stuck'); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Оглавление: закрываем после перехода по ссылке */
  var toc = document.querySelector('.toc');
  if (toc) {
    toc.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.tagName === 'A' && window.innerWidth < 1020) {
        toc.removeAttribute('open');
      }
    });
  }

  /* Поделиться: системный диалог, иначе копируем ссылку */
  var shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var data = {
        title: document.title,
        url: window.location.href,
      };
      if (navigator.share) {
        navigator.share(data).catch(function () { /* пользователь отменил */ });
        return;
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data.url).then(function () {
          shareBtn.textContent = 'Ссылка скопирована';
          window.setTimeout(function () {
            shareBtn.textContent = 'Поделиться статьёй';
          }, 2200);
        }).catch(function () { /* доступ к буферу запрещён */ });
      }
    });
  }

  /* ── Слайды экранов: листание, точки, счётчик, клавиатура ── */
  function initSlides(root) {
    var viewport = root.querySelector('[data-slides-viewport]');
    if (!viewport) { return; }

    var slides = viewport.querySelectorAll('.slide');
    var dots = root.querySelectorAll('.slides-dot');
    var prev = root.querySelector('[data-slide-prev]');
    var next = root.querySelector('[data-slide-next]');
    var counter = root.querySelector('[data-slide-current]');
    var total = slides.length;
    var index = 0;
    var raf = null;

    function pageWidth() {
      return viewport.clientWidth || 1;
    }

    function paint() {
      for (var i = 0; i < dots.length; i += 1) {
        var on = i === index;
        dots[i].classList.toggle('is-on', on);
        if (on) { dots[i].setAttribute('aria-current', 'true'); }
        else { dots[i].removeAttribute('aria-current'); }
      }
      if (counter) { counter.textContent = String(index + 1); }
      if (prev) { prev.disabled = index <= 0; }
      if (next) { next.disabled = index >= total - 1; }
    }

    function goTo(i, smooth) {
      var target = Math.max(0, Math.min(total - 1, i));
      index = target;
      viewport.scrollTo({
        left: target * pageWidth(),
        behavior: smooth === false ? 'auto' : 'smooth',
      });
      paint();
    }

    viewport.addEventListener('scroll', function () {
      if (raf) { return; }
      raf = requestAnimationFrame(function () {
        raf = null;
        var i = Math.round(viewport.scrollLeft / pageWidth());
        if (i !== index) {
          index = Math.max(0, Math.min(total - 1, i));
          paint();
        }
      });
    }, { passive: true });

    for (var d = 0; d < dots.length; d += 1) {
      (function (n) {
        dots[n].addEventListener('click', function () { goTo(n); });
      })(d);
    }

    if (prev) {
      prev.addEventListener('click', function () { goTo(index - 1); });
    }
    if (next) {
      next.addEventListener('click', function () { goTo(index + 1); });
    }

    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      }
    });

    /* Смена ширины: сохраняем текущий слайд под курсором */
    window.addEventListener('resize', function () { goTo(index, false); });

    goTo(0, false);
  }

  var carousels = document.querySelectorAll('[data-slides]');
  for (var c = 0; c < carousels.length; c += 1) {
    initSlides(carousels[c]);
  }
})();
