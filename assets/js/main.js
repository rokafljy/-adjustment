/* 2026 대한민국 지속가능경영 대상 — 사이트 인터랙션
   의존성 없음. defer 로 로드되므로 DOM 은 이미 준비된 상태입니다. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 시상식 카운트다운 ─────────────────────────────────────── */
  var CEREMONY = new Date('2026-11-06T14:00:00+09:00').getTime();

  (function countdown() {
    var cd = document.getElementById('cd');
    if (!cd) return;

    var fields = {
      d: cd.querySelector('[data-u="d"]'),
      h: cd.querySelector('[data-u="h"]'),
      m: cd.querySelector('[data-u="m"]'),
      s: cd.querySelector('[data-u="s"]')
    };
    if (!fields.d || !fields.h || !fields.m || !fields.s) return;

    var pad = function (n) { return String(n).padStart(2, '0'); };
    var timer;

    function tick() {
      var left = CEREMONY - Date.now();
      if (left <= 0) {
        left = 0;
        if (timer) clearInterval(timer);
        cd.setAttribute('data-state', 'done');
      }
      fields.d.textContent = pad(Math.floor(left / 864e5));
      fields.h.textContent = pad(Math.floor(left / 36e5) % 24);
      fields.m.textContent = pad(Math.floor(left / 6e4) % 60);
      fields.s.textContent = pad(Math.floor(left / 1e3) % 60);
    }

    tick();
    timer = setInterval(tick, 1000);

    // 탭이 백그라운드로 갔다 돌아오면 즉시 동기화
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
  })();

  /* ── 스크롤 진입 페이드인 ──────────────────────────────────── */
  (function reveal() {
    var items = document.querySelectorAll('.fade');
    if (!items.length) return;

    var showAll = function () {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
    };

    if (reduceMotion || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    for (var i = 0; i < items.length; i++) io.observe(items[i]);
  })();

  /* ── 역대 수상 연도 탭 ─────────────────────────────────────── */
  (function winnerTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.wtab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.wpanel'));
    if (!tabs.length || !panels.length) return;

    function select(tab, focus) {
      var year = tab.dataset.year;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p) {
        var on = p.dataset.panel === year;
        p.classList.toggle('active', on);
        if (on) p.removeAttribute('hidden');
        else p.setAttribute('hidden', '');
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, true);
      });
    });
  })();

  /* ── 시상 절차 타임라인 강조 (hover / focus / tap) ──────────── */
  (function timeline() {
    var steps = Array.prototype.slice.call(document.querySelectorAll('.tstep'));
    if (!steps.length) return;

    function activate(step) {
      steps.forEach(function (s) { s.classList.toggle('active', s === step); });
    }

    steps.forEach(function (step) {
      step.addEventListener('mouseenter', function () { activate(step); });
      step.addEventListener('focus', function () { activate(step); });
      step.addEventListener('click', function () { activate(step); });
    });
  })();

  /* ── 모바일 내비게이션 ─────────────────────────────────────── */
  (function mobileNav() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    var nav = document.querySelector('.nav');
    if (!toggle || !links || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
    });

    // 데스크톱 폭으로 돌아오면 열린 상태를 정리
    window.matchMedia('(min-width: 1025px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  })();
})();
