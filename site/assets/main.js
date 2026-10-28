/* AI Scan — поведение статьи */
/* global window, document, navigator */
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
})();
