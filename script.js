/* ==========================================================================
   Rahmat Firdaus / portfolio interactions (upgraded motion + floating preview)
   Vanilla JS + GSAP. No build step.
   ========================================================================== */

(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover     = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wideEnough   = () => window.innerWidth >= 768;
  const previewOn    = () => canHover && wideEnough() && !!window.gsap;

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  const state = { projects: [], filter: 'all', view: 'list', hovered: null, openId: null };

  const esc = (str = '') => String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad = (n) => String(n).padStart(2, '0');
  const lockScroll = (on) => {
    document.body.classList.toggle('is-locked', on);
    syncLenis();
  };

  /* ── anticipation & tactile press (12 prinsip animasi) ── */
  function attachPress(el) {
    if (!el || !window.gsap || reduceMotion) return;
    const isRow = el.classList.contains('project-row');
    el.addEventListener('pointerdown', () => {
      el.style.transition = 'none';
      if (isRow) {
        gsap.to(el, {
          scaleX: 1.015,
          scaleY: 0.96,
          transformOrigin: '50% 50%',
          duration: 0.12,
          ease: 'power2.out',
          overwrite: 'auto'
        });
        return;
      }
      gsap.to(el, { scale: 0.95, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
    });
    const release = () => {
      if (isRow) {
        gsap.to(el, {
          scaleX: 1,
          scaleY: 1,
          duration: 0.6,
          ease: 'elastic.out(1, 0.45)',
          overwrite: 'auto',
          onComplete: () => { el.style.transition = ''; gsap.set(el, { clearProps: 'transform' }); }
        });
        return;
      }
      gsap.to(el, {
        scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.5)', overwrite: 'auto',
        onComplete: () => { el.style.transition = ''; gsap.set(el, { clearProps: 'transform' }); }
      });
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }

  const list        = $('#project-list');
  const countEl     = $('#index-count');
  const filtersWrap = $('.filters');
  const filterPill  = $('.filter-pill');
  const filterBtns  = $$('.filter');
  const preview     = $('#cursor-preview');
  const previewBox  = preview ? $('.cp-inner', preview) : null;
  const previewVid  = $('#cp-video');
  const previewImg  = $('#cp-image');
  const previewName = $('#cp-title');
  const previewMeta = $('#cp-meta');

  const spiralView = $('#spiral-view');
  const vsBtns = $$('.vs-btn');

  const modal       = $('#project-modal');
  const modalPanel  = modal ? $('.modal__panel', modal) : null;
  const modalScroll = $('#pm-scroll');
  const pmMedia     = $('#pm-media');
  const pmTitle     = $('#pm-title');
  const pmDesc      = $('#pm-desc');
  const pmKicker    = $('#pm-kicker');
  const pmKickerSub = $('#pm-kicker-sub');
  const pmSpecs     = $('#pm-specs');
  const pmGallery   = $('#pm-gallery');
  const pmNext      = $('#pm-next');

  const infoPanel    = $('#info-panel');
  const infoScrim    = $('#panel-scrim');
  const openInfoBtn  = $('#open-info');
  const closeInfoBtn = $('#close-info');

  let lastFocus = null;

  /* ═══ DATA + RENDER ═══ */

  async function loadProjects() {
    try {
      const res = await fetch('projects.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.projects = await res.json();
      if (!Array.isArray(state.projects) || !state.projects.length) throw new Error('empty');
      updateFilterCounts();
      renderList({ animate: true });
      if (state.view === 'spiral') buildSpiral();
      queueIntro();
    } catch (err) {
      console.error('[portfolio] could not load projects.json:', err);
      list.innerHTML = '<p class="empty">Projects could not be loaded. Run the site through a local server (<code>python -m http.server</code>); JSON files cannot be read from <code>file://</code>.</p>';
      queueIntro();
    }
  }

  function updateFilterCounts() {
    filterBtns.forEach((btn) => {
      const cat = btn.dataset.cat;
      const n = cat === 'all' ? state.projects.length : state.projects.filter((p) => p.category === cat).length;
      const sup = btn.querySelector('sup');
      if (sup) sup.textContent = pad(n);
      if (cat !== 'all') btn.hidden = n === 0;
    });
  }

  function visibleProjects() {
    if (state.filter === 'all') return state.projects;
    return state.projects.filter((p) => p.category === state.filter);
  }

  function rowMarkup(project) {
    const thumb = project.thumb || (project.breakdownImages && project.breakdownImages[0]) || '';
    return `
      <a class="row project-row" href="#${esc(project.id)}" data-id="${esc(project.id)}"
         role="listitem" aria-label="${esc(project.title)}, ${esc(project.category)} ${esc(project.year)}">
        <span class="row-thumb">
          <img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="row-main">
          <span class="row-title">${esc(project.title)}</span>
          ${project.description ? `<span class="row-desc">${esc(project.description)}</span>` : ''}
          <span class="row-meta mono">${esc(project.category)} · ${esc(project.client)} · ${esc(project.year)}</span>
        </span>
      </a>`;
  }

  function renderList({ animate = false } = {}) {
    const items = visibleProjects();
    list.innerHTML = items.length ? items.map(rowMarkup).join('') : '<p class="empty">No projects in this category yet.</p>';
    if (countEl) countEl.textContent = `${pad(items.length)} ${items.length === 1 ? 'Project' : 'Projects'}`;
    bindRows();
    animateRows(animate);
  }

  function bindRows() {
    $$('.row', list).forEach((row) => {
      row.addEventListener('pointerenter', onRowEnter);
      row.addEventListener('click', (e) => { e.preventDefault(); openProject(row.dataset.id); });
      attachPress(row);
    });
  }

  function animateRows(animate) {
    const rows = $$('.row', list);
    if (!rows.length) return;
    if (!animate || reduceMotion || !window.gsap) return;

    const partsOf = (row) => $$('.row-title, .row-desc, .row-meta', row);
    const ensure = () => rows.forEach((row) => {
      row.style.opacity = '1';
      row.style.transform = 'none';
      partsOf(row).forEach((part) => {
        part.style.opacity = '1';
        part.style.transform = 'none';
      });
    });

    rows.forEach((row, i) => {
      const tl = gsap.timeline({ delay: i * 0.06 });
      tl.from(row, {
        y: 26,
        opacity: 0,
        scale: 0.97,
        duration: 0.7,
        ease: 'power4.out',
        clearProps: 'opacity,transform'
      }, 0);
      const parts = partsOf(row);
      if (parts.length) {
        tl.from(parts, {
          y: 10,
          opacity: 0,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.out',
          clearProps: 'opacity,transform'
        }, 0.1);
      }
    });
    setTimeout(ensure, 1600);
  }

  /* ═══ FILTERS — sliding active pill ═══ */

  function positionPill(animate = true) {
    if (!filtersWrap || !filterPill || !window.gsap) return;
    const active = filtersWrap.querySelector('.filter.is-active') || filterBtns[0];
    if (!active) return;
    const vals = { x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight };
    if (animate) gsap.to(filterPill, { ...vals, duration: 0.35, ease: 'power3.out', overwrite: true });
    else gsap.set(filterPill, vals);
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (cat === state.filter) return;
      state.filter = cat;
      filterBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      positionPill(true);

      if (state.view === 'spiral') { buildSpiral(); return; }

      /* render segera + entrance; tidak bergantung onComplete GSAP */
      renderList({ animate: true });
      return;

      /* (kode lama, tidak dipakai) */
    });
  });

  /* ═══ FLOATING PREVIEW — quickTo + velocity tilt ═══ */

  let previewReady = false;
  let quickX = null;
  let quickY = null;
  let tiltPrevX = 0;
  let tiltTimer = null;

  function initPreview() {
    if (!previewOn() || !previewBox) return;
    quickX = gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3.out' });
    quickY = gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3.out' });
    previewReady = true;

    document.addEventListener('pointermove', (e) => {
      if (!state.hovered || !previewReady) return;
      positionPreview(e.clientX, e.clientY);
      updateTilt(e.clientX);
    }, { passive: true });

    window.addEventListener('scroll', () => { if (state.hovered) hidePreview(); }, { passive: true });
    if (list) list.addEventListener('mouseleave', onListLeave);
  }

  function positionPreview(cx, cy) {
    const w = preview.offsetWidth || 360;
    const h = preview.offsetHeight || 202;
    const gap = 26;
    let x = cx + gap;
    let y = cy + gap;
    if (x + w > window.innerWidth - 16) x = cx - w - gap;
    if (y + h > window.innerHeight - 16) y = cy - h - gap;
    quickX(x);
    quickY(Math.max(12, y));
  }

  function updateTilt(cx) {
    if (!previewBox || !window.gsap || reduceMotion) return;
    const vx = cx - tiltPrevX;
    tiltPrevX = cx;
    const clamped = Math.max(-40, Math.min(40, vx));
    const rot = (clamped / 40) * 4;
    const mag = Math.min(Math.abs(clamped) / 40, 1);
    const stretch = 1 + mag * 0.12;
    gsap.to(previewBox, {
      rotation: rot, scaleX: stretch, scaleY: 1 / stretch,
      duration: 0.25, ease: 'power2.out', overwrite: 'auto'
    });
    clearTimeout(tiltTimer);
    tiltTimer = setTimeout(() => {
      gsap.to(previewBox, {
        rotation: 0, scaleX: 1, scaleY: 1,
        duration: 0.7, ease: 'elastic.out(1, 0.45)', overwrite: 'auto'
      });
    }, 90);
  }

  function onRowEnter(e) {
    const row = e.currentTarget;
    state.hovered = row;
    tiltPrevX = e.clientX;

    document.body.classList.add('list-hover');
    $$('.row.is-hot', list).forEach((r) => { if (r !== row) r.classList.remove('is-hot'); });
    row.classList.add('is-hot');

    if (!previewOn() || !previewBox) return;

    const project = state.projects.find((p) => p.id === row.dataset.id);
    if (!project) return;

    if (project.previewVideo) {
      preview.classList.remove('is-image');
      if (previewVid.getAttribute('data-src') !== project.previewVideo) {
        previewVid.setAttribute('data-src', project.previewVideo);
        previewVid.src = project.previewVideo;
        previewVid.load();
      }
      /* Safari iOS: paksa muted + playsInline sebelum play */
      armVideo(previewVid);
      previewVid.play().catch(() => {});
    } else {
      previewVid.pause();
      previewVid.removeAttribute('src');
      previewVid.removeAttribute('data-src');
      previewVid.load();
      if (previewImg && project.thumb) {
        if (previewImg.getAttribute('src') !== project.thumb) previewImg.src = project.thumb;
        preview.classList.add('is-image');
      }
    }

    if (previewName) previewName.textContent = project.title;
    if (previewMeta) previewMeta.textContent = `${project.category} / ${project.year}`;

    gsap.set(preview, { x: e.clientX, y: e.clientY, visibility: 'visible', opacity: 1 });
    gsap.set(previewBox, { rotation: 0 });
    positionPreview(e.clientX, e.clientY);

    gsap.to(previewBox, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
  }

  function onListLeave() {
    document.body.classList.remove('list-hover');
    $$('.row.is-hot', list).forEach((r) => r.classList.remove('is-hot'));
    state.hovered = null;
    hidePreview();
  }

  function hidePreview() {
    if (!previewBox || !window.gsap) return;
    clearTimeout(tiltTimer);
    gsap.to(previewBox, {
      scale: 0.85, opacity: 0, rotation: 0, duration: 0.3, ease: 'power2.out', overwrite: true,
      onComplete: () => { if (!state.hovered) gsap.set(preview, { visibility: 'hidden' }); }
    });
    if (previewVid) previewVid.pause();
  }

  /* ═══ PROJECT MODAL ═══ */

  function mediaMarkup(project) {
    if (project.youtubeId) {
      return `<iframe src="https://www.youtube-nocookie.com/embed/${esc(project.youtubeId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(project.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
    return `<div class="pm-media__fallback">Media unavailable.</div>`;
  }

  function specRow(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function openProject(id) {
    const project = state.projects.find((p) => p.id === id);
    if (!project || !modal) return;

    onListLeave();

    state.openId = id;
    lastFocus = document.activeElement;

    const idx = state.projects.findIndex((p) => p.id === id);
    const sort = state.projects.filter((p) => visibleProjects().some((v) => v.id === p.id));
    const orderIdx = Math.max(0, sort.findIndex((p) => p.id === id));

    if (pmKicker) pmKicker.textContent = `${project.category.toUpperCase()} / Number ${pad(orderIdx + 1)} / ${pad(sort.length)}`;
    if (pmKickerSub) pmKickerSub.textContent = project.category.toUpperCase() || 'Project';
    if (pmTitle) pmTitle.textContent = project.title;
    if (pmDesc) {
      pmDesc.textContent = project.description || '';
      pmDesc.hidden = !project.description;
    }
    if (pmMedia) {
      pmMedia.innerHTML = mediaMarkup(project);
      pmMedia.classList.toggle('is-vertical', project.orientation === 'vertical');
    }
    if (pmSpecs) pmSpecs.innerHTML = [
      specRow('Year', project.year),
      specRow('Role', project.role || project.category),
      specRow('Client', project.client || '-'),
      specRow('Tools', (project.software || []).join(' · ') || '-')
    ].join('');
    if (pmGallery) pmGallery.innerHTML = (project.breakdownImages || []).map((src, i) => `
      <figure>
        <img src="${esc(src)}" alt="${esc(project.title)} / breakdown ${pad(i + 1)}" loading="lazy" decoding="async">
        <figcaption>${pad(i + 1)} / Breakdown image</figcaption>
      </figure>`).join('');

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    if (modalScroll) modalScroll.scrollTop = 0;

    if (!window.gsap || reduceMotion) { focusFirst(modal); return; }

    const tl = gsap.timeline();
    const pieces = [pmMedia, pmKicker, pmTitle, pmDesc, pmSpecs, pmGallery, pmNext].filter(Boolean);
    tl.fromTo(modalPanel,
      { opacity: 0, y: 26, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out', clearProps: 'transform' })
      .fromTo(pieces,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.055, ease: 'power4.out', clearProps: 'transform' }, 0.08);

    focusFirst(modal);
  }

  function closeProject({ restoreFocus = true } = {}) {
    if (!modal || !modal.classList.contains('is-open')) return;

    const done = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (pmMedia) pmMedia.innerHTML = '';
      state.openId = null;
      lockScroll(false);
      if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
    };

    if (!window.gsap || reduceMotion) { done(); return; }

    /* Animasi visual + fallback timer yang PASTI jalan: jangan menggantung
       penutupan pada onComplete gsap (bisa tidak advance saat tab/RAF mati). */
    gsap.to(modalPanel, {
      opacity: 0, y: 24, duration: 0.28, ease: 'power2.in',
      onComplete: () => gsap.set(modalPanel, { clearProps: 'all' })
    });
    setTimeout(done, 300);
  }

  /* ═══ INFO PANEL ═══ */

  function openInfo() {
    if (!infoPanel) return;
    lastFocus = document.activeElement;
    if (infoScrim) infoScrim.hidden = false;
    infoPanel.classList.add('is-open');
    infoPanel.setAttribute('aria-hidden', 'false');
    lockScroll(true);

    if (!window.gsap || reduceMotion) { if (infoScrim) infoScrim.style.opacity = '1'; focusFirst(infoPanel); return; }

    gsap.set(infoPanel, { xPercent: 100, x: 0 });
    if (infoScrim) gsap.fromTo(infoScrim, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
    gsap.to(infoPanel, { xPercent: 0, duration: 0.65, ease: 'expo.out' });
    gsap.fromTo($$('.panel__scroll > *', infoPanel),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.045, delay: 0.12, ease: 'power2.out' });
    focusFirst(infoPanel);
  }

  function closeInfo({ restoreFocus = true } = {}) {
    if (!infoPanel || !infoPanel.classList.contains('is-open')) return;

    const done = () => {
      infoPanel.classList.remove('is-open');
      infoPanel.setAttribute('aria-hidden', 'true');
      if (infoScrim) { infoScrim.hidden = true; infoScrim.style.opacity = ''; }
      lockScroll(false);
      if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
    };

    if (!window.gsap || reduceMotion) { done(); return; }

    gsap.to(infoPanel, {
      xPercent: 100, duration: 0.4, ease: 'power3.inOut'
    });
    if (infoScrim) gsap.to(infoScrim, { opacity: 0, duration: 0.35 });
    setTimeout(done, 420);
  }

  function focusFirst(container) {
    const target = container.querySelector('[data-close], .icon-btn, .btn-solid, a[href]');
    if (target) setTimeout(() => target.focus({ preventScroll: true }), 60);
  }

  /* ═══ HERO ENTRANCE ═══ */

  let introDone = false;
  let introQueued = false;
  function startHeroIntro() {
    if (introDone) return;
    introDone = true;
    if (reduceMotion || !window.gsap) return;

    gsap.from('.line__in', { y: 20, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'opacity,transform' });
    gsap.from('.hero__meta > *', { y: 20, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,transform' });
    gsap.from(['.hero__lede', '.hero__hint', '.filter'], { y: 20, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', delay: 0.3, clearProps: 'opacity,transform' });
  }

  function queueIntro() {
    if (document.body.classList.contains('preloader-done')) startHeroIntro();
    else introQueued = true;
  }

  /* ═══ WIRING ═══ */

  if (openInfoBtn) openInfoBtn.addEventListener('click', openInfo);
  if (closeInfoBtn) closeInfoBtn.addEventListener('click', () => closeInfo());
  if (infoScrim) infoScrim.addEventListener('click', () => closeInfo());

  if (modal) {
    $$('[data-close]', modal).forEach((el) => el.addEventListener('click', () => closeProject()));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal && modal.classList.contains('is-open')) return closeProject();
      if (infoPanel && infoPanel.classList.contains('is-open')) return closeInfo();
      return;
    }
    if (e.key !== 'Tab') return;
    const active = modal && modal.classList.contains('is-open')
      ? modalPanel
      : (infoPanel && infoPanel.classList.contains('is-open') ? infoPanel : null);
    if (!active) return;

    const focusables = $$('a[href], button, iframe, video, [tabindex]:not([tabindex="-1"])', active)
      .filter((el) => el.offsetParent !== null || el.tagName === 'IFRAME');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  window.addEventListener('resize', () => {
    if (!previewOn()) {
      hidePreview();
      document.body.classList.remove('list-hover');
      $$('.row.is-hot', list).forEach((r) => r.classList.remove('is-hot'));
      state.hovered = null;
    }
    if (state.view === 'spiral' && spiralView && !spiralView.classList.contains('hidden')) {
      buildSpiral();
    }
    positionPill(false);
  });

  /* ═══ VIEW SWITCHER — LIST / SPIRAL ═══ */

  let spiralCards = [];
  let spiralRing = null;
  const AUTO_SPIN = 0.18;   /* derajat per frame saat idle (tanpa drag/wheel) */
  const FRAME_MS = 1000 / 60;
  const MIN_WHEEL = 0.004;
  /* rotY = sudut rotasi utama; currentRot = alias kompatibilitas;
     vel = momentum dari drag/wheel (derajat per frame). */
  let rotY = 0;
  let currentRot = 0;
  let vel = 0;
  /* lerp yang identik di 60Hz maupun 144Hz (adaptasi pola pacomepertant) */
  const frameLerp = (base, steps) => 1 - Math.pow(1 - base, steps);
  const spiralState = {
    dragging: false, lastX: 0,
    potentialDrag: false, startX: 0, startY: 0, justDragged: false,
    hoverCard: false, angularVelocity: 0, wheelDirection: 1
  };

  /* poros tengah editorial (billboard di dalam stage, berbagi konteks 3D) */
  let spiralCoreEl = null;
  let coreGyro = null;
  /* giroskop multi-sumbu + follow-through (overlapping action) */
  const coreLayer = { outerAngle: 0, outerVel: 0, innerAngle: 0, innerVel: 0, breath: 1 };
  const CORE_MARKUP = `
      <div id="spiral-center-core" aria-hidden="true">
        <div class="core-gyro">
          <span class="core-glow"></span>
          <div class="core-sphere">
            <span class="core-lon core-lon--1"></span>
            <span class="core-lon core-lon--2"></span>
            <span class="core-lon core-lon--3"></span>
            <span class="core-lon core-lon--4"></span>
            <span class="core-lon core-lon--5"></span>
            <span class="core-lon core-lon--6"></span>
            <span class="core-lat core-lat--1"></span>
            <span class="core-lat core-lat--2"></span>
            <span class="core-lat core-lat--3"></span>
            <span class="core-lat core-lat--4"></span>
          </div>
          <span class="core-orbit core-orbit--1"></span>
          <span class="core-orbit core-orbit--2"></span>
        </div>
      </div>`;

  function applyStageRotation() {
    /* ring hanya sebagai penjaga konteks 3D — rotasi dihitung per kartu */
    if (spiralRing) spiralRing.style.transform = 'translate3d(0, 0, 0)';
    updateSpiralFacing();
  }

  function spiralMarkup(project) {
    const src = project.previewVideo || project.thumb || ((project.breakdownImages && project.breakdownImages[0]) || '');
    const media = project.previewVideo
      ? `<video src="${esc(src)}" muted loop playsinline autoplay preload="metadata"></video>`
      : `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
    return `
      <a class="spiral-card" href="#${esc(project.id)}" data-id="${esc(project.id)}"
         aria-label="${esc(project.title)}, ${esc(project.category)} ${esc(project.year)}">
        ${media}
        <span class="spiral-card__meta">
          <span class="spiral-card__no">${esc(project.id)}</span>
          <span class="spiral-card__title">${esc(project.title)}</span>
        </span>
      </a>`;
  }

  /* Safari iOS: paksa properti autoplay sebelum .play(), kalau tidak video
     diblokir meski sudah ada atribut muted/playsinline di markup */
  function armVideo(v) {
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
  }

  function armVideosIn(root) {
    if (!root) return;
    $$('video', root).forEach((v) => {
      armVideo(v);
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    });
  }

  function buildSpiral() {
    if (!spiralView) return;

    /* teardown listeners lama sebelum rebuild */
    if (spiralView._handlers) {
      const h = spiralView._handlers;
      spiralView.removeEventListener('wheel', h.onWheel);
      spiralView.removeEventListener('pointerdown', h.onDown);
      spiralView.removeEventListener('pointermove', h.onMove);
      if (h.onParallax) spiralView.removeEventListener('pointermove', h.onParallax);
      spiralView.removeEventListener('pointerup', h.onUp);
      spiralView.removeEventListener('pointercancel', h.onUp);
      const oldStage = $('#spiral-stage');
      if (oldStage) {
        oldStage.removeEventListener('click', h.onClick);
        oldStage.removeEventListener('pointerover', h.onOver);
        oldStage.removeEventListener('pointerout', h.onOut);
      }
    }

    const items = visibleProjects();
    spiralView.innerHTML = '<div id="spiral-stage"><div id="spiral-ring"></div></div>';

    const stage = $('#spiral-stage');
    const ring = $('#spiral-ring');
    spiralRing = ring;
    spiralCards = [];

    if (!items.length) return;

    /* >=6 proyek: JANGAN gandakan pita, agar kartu tidak terlalu padat dan
       saling bertabrakan di layar HP; gandakan hanya bila proyek < 6 */
    const ringItems = items.length >= 6 ? items : [...items, ...items];
    ring.innerHTML = ringItems.map(spiralMarkup).join('');
    /* Safari iOS: senjata video kartu sebelum diputar otomatis */
    armVideosIn(ring);

    /* poros tengah: struktur tetap, rotasi bola memakai animasi CSS */
    spiralView.insertAdjacentHTML('beforeend', CORE_MARKUP);
    spiralCoreEl = $('#spiral-center-core');
    coreGyro = $('.core-gyro');
    coreLayer.outerAngle = coreLayer.outerVel = coreLayer.innerAngle = coreLayer.innerVel = 0;
    coreLayer.breath = 1;

    const cards = $$('.spiral-card', ring);
    const n = cards.length;
    const stepAngle = 360 / n;

    spiralCards = cards.map((el, i) => ({
      el,
      a: i * stepAngle
    }));

    const onWheel = (e) => {
      e.preventDefault();
      const push = (e.deltaY || 0) * 0.06;
      spiralState.wheelDirection = push >= 0 ? 1 : -1;
      vel = Math.max(-3, Math.min(3, vel + push));
      startMotor();
    };
    const onDown = (e) => {
      /* JANGAN langsung menandai drag: gerakan mouse mikro (mis. <6px)
         tetap dianggap klik. Drag baru aktif setelah melewati ambang,
         sehingga klik di kartu selalu andal di desktop. */
      spiralState.potentialDrag = true;
      spiralState.dragging = false;
      spiralState.startX = e.clientX;
      spiralState.startY = e.clientY;
      spiralState.lastX = e.clientX;
    };
    const onMove = (e) => {
      if (!spiralState.potentialDrag) return;
      if (!spiralState.dragging) {
        const tx = e.clientX - spiralState.startX;
        const ty = e.clientY - spiralState.startY;
        if (Math.hypot(tx, ty) < 6) return; /* masih under ambang: = klik */
        spiralState.dragging = true;
        spiralView.classList.add('is-dragging');
        try { spiralView.setPointerCapture(e.pointerId); } catch (_) {}
      }
      const dx = e.clientX - spiralState.lastX;
      spiralState.lastX = e.clientX;
      rotY = (rotY + dx * 0.35 + 360) % 360;
      currentRot = rotY;
      spiralState.wheelDirection = dx >= 0 ? 1 : -1;
      vel = Math.max(-3, Math.min(3, vel * 0.55 + dx * 0.1));
      applyStageRotation();
    };
    const onUp = (e) => {
      if (spiralState.dragging) spiralState.justDragged = true;
      spiralState.dragging = false;
      spiralState.potentialDrag = false;
      spiralView.classList.remove('is-dragging');
      setTimeout(() => { spiralState.justDragged = false; }, 60);
    };
    const onClick = (e) => {
      const card = e.target.closest('.spiral-card');
      if (!card || spiralState.justDragged) return;
      e.preventDefault();
      openProject(card.dataset.id);
    };
    const onOver = (e) => {
      if (e.target.closest('.spiral-card')) spiralState.hoverCard = true;
    };
    const onOut = (e) => {
      const to = e.relatedTarget;
      if (!to || !to.closest || !to.closest('.spiral-card')) spiralState.hoverCard = false;
    };

    spiralView.addEventListener('wheel', onWheel, { passive: false });
    spiralView.addEventListener('pointerdown', onDown);
    spiralView.addEventListener('pointermove', onMove);
    spiralView.addEventListener('pointerup', onUp);
    spiralView.addEventListener('pointercancel', onUp);
    stage.addEventListener('click', onClick);
    stage.addEventListener('pointerover', onOver);
    stage.addEventListener('pointerout', onOut);

    spiralView._handlers = { onWheel, onDown, onMove, onUp, onClick, onOver, onOut };

    rotY = 0;
    currentRot = 0;
    vel = 0;
    spiralState.angularVelocity = 0;
    applyStageRotation();
    startMotor();
  }

  /* ── engine putaran otomatis: gsap.ticker + fallback interval ── */
  let motorState = { running: false, ticker: false, fallback: null, sawTick: false, last: 0 };
  let motorStep = null;

  function advanceSpiral() {
    /* dt normalisasi ke 60fps: hasil identik di monitor 60Hz / 120Hz / 144Hz */
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let dt = motorState.last ? (now - motorState.last) : FRAME_MS;
    motorState.last = now;
    /* clamp: jangan sampai lompat jauh setelah tab tidak aktif */
    dt = Math.max(FRAME_MS * 0.25, Math.min(FRAME_MS * 3, dt));
    const steps = dt / FRAME_MS;

    /* momentum dari wheel/drag meluruh halus; idle tetap berjalan konstan */
    vel *= Math.pow(0.94, steps);

    /* minWheelSpeed: arah putaran tetap mengikuti scroll/drag terakhir */
    if (!spiralState.dragging && vel !== 0 && Math.abs(vel) < MIN_WHEEL) {
      vel = spiralState.wheelDirection * MIN_WHEEL;
    }

    /* velocity motion blur: lacak kecepatan sudut (smoothing agar redam halus) */
    spiralState.angularVelocity +=
      (Math.abs(vel) - spiralState.angularVelocity) * frameLerp(0.35, steps);

    /* inkrementasi sudut utama: idle 0.18deg/frame + momentum.
       Saat drag, pointer yang memegang sudut agar tidak double-count. */
    if (!spiralState.dragging) {
      rotY = (rotY + (AUTO_SPIN + vel) * steps + 360) % 360;
      currentRot = rotY;
    }
    applyStageRotation();
    updateCore(steps);
  }

  function startMotor() {
    if (motorState.running) return;
    motorState.running = true;
    motorState.sawTick = false;
    motorState.last = 0;

    motorStep = () => {
      motorState.sawTick = true;
      advanceSpiral();
    };

    if (window.gsap && !reduceMotion) {
      motorState.ticker = true;
      gsap.ticker.add(motorStep);
      setTimeout(() => {
        if (motorState.running && !motorState.sawTick) {
          gsap.ticker.remove(motorStep);
          motorState.ticker = false;
          motorState.fallback = setInterval(advanceSpiral, 16);
        }
      }, 500);
    } else {
      motorState.ticker = false;
      motorState.fallback = setInterval(advanceSpiral, 16);
    }
  }

  function stopMotor() {
    if (!motorState.running) return;
    motorState.running = false;
    if (motorState.ticker) gsap.ticker.remove(motorStep);
    if (motorState.fallback !== null) { clearInterval(motorState.fallback); motorState.fallback = null; }
    motorStep = null;
  }

  function updateSpiralFacing() {
    if (!spiralRing || !spiralCards.length) return;
    const isMobile = window.innerWidth <= 768;

    /* ── MOBILE (<=768px): orbit & skala kartu khusus HP agar tidak
       bertabrakan dan tidak menutupi bola tengah ── */
    if (isMobile) {
      const rx = Math.min(window.innerWidth * 0.30, 118);
      const rz = rx * 0.65;
      const ry = Math.min(window.innerHeight * 0.145, 116);
      for (const c of spiralCards) {
        const activeRot = typeof rotY !== 'undefined' ? rotY : (typeof currentRot !== 'undefined' ? currentRot : 0);
        const eff = c.a + activeRot;
        const rad = (eff * Math.PI) / 180;
        const velocity = typeof vel !== 'undefined' ? vel : 0;
        const stretch = 1 + Math.min(Math.abs(velocity) * 0.015, 0.14);
        const x = Math.sin(rad) * rx;
        const z = Math.cos(rad) * rz;
        const y = Math.cos(rad) * ry + Math.sin(rad) * -14;
        const isFront = Math.cos(rad) >= 0;
        const cardRotY = isFront ? -Math.sin(rad) * 34 : Math.sin(rad) * 34;
        const cardRotZ = Math.sin(rad) * -6;
        const depthNorm = (z + rz) / (2 * rz);
        const depthScale = 0.78 + 0.26 * depthNorm;
        c.el.style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px,${z.toFixed(1)}px) ` +
          `rotateY(${cardRotY.toFixed(1)}deg) rotateZ(${cardRotZ.toFixed(1)}deg) ` +
          `scale(${depthScale.toFixed(3)}) scaleX(${stretch.toFixed(4)})`;
        c.el.style.opacity = (0.28 + 0.72 * Math.pow(depthNorm, 1.35)).toFixed(3);
        c.el.style.zIndex = isFront ? String(Math.round(10 + depthNorm * 10)) : '2';
      }
      return;
    }

    /* ── DESKTOP (>768px): tidak diubah (identik dengan sebelumnya) ── */
    const rx = Math.min(window.innerWidth * 0.41, 510);
    const rz = rx * 0.52;
    const ry = 156;
    for (const c of spiralCards) {
      const activeRot = typeof rotY !== 'undefined' ? rotY : (typeof currentRot !== 'undefined' ? currentRot : 0);
      const eff = c.a + activeRot;
      const rad = (eff * Math.PI) / 180;
      const velocity = typeof vel !== 'undefined' ? vel : 0;
      const stretch = 1 + Math.min(Math.abs(velocity) * 0.015, 0.14);
      const x = Math.sin(rad) * rx;
      const z = Math.cos(rad) * rz;
      const y = Math.cos(rad) * ry + Math.sin(rad) * -20;
      const isFront = Math.cos(rad) >= 0;
      const cardRotY = isFront ? -Math.sin(rad) * 40 : Math.sin(rad) * 40;
      const cardRotZ = Math.sin(rad) * -7;
      const depthNorm = (z + rz) / (2 * rz);
      const depthScale = 0.66 + 0.38 * depthNorm;
      c.el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px,${z.toFixed(1)}px) ` +
        `rotateY(${cardRotY.toFixed(1)}deg) rotateZ(${cardRotZ.toFixed(1)}deg) ` +
        `scale(${depthScale.toFixed(3)}) scaleX(${stretch.toFixed(4)})`;
      c.el.style.opacity = (0.28 + 0.72 * Math.pow(depthNorm, 1.35)).toFixed(3);
      c.el.style.zIndex = isFront ? String(Math.round(10 + depthNorm * 10)) : '2';
    }
  }

  /* ── poros tengah: giroskop multi-sumbu + follow-through + breathing ── */
  function updateCore(steps = 1) {
    if (!coreGyro) return;
    const mag = spiralState.angularVelocity;     /* magnitude tersmoothing */

    /* breathing scale: 1 → 1.07 saat cepat, susut halus (slow-out) */
    coreLayer.breath += ((1 + Math.min(mag * 0.025, 0.07)) - coreLayer.breath) * frameLerp(0.08, steps);
    coreGyro.style.transform = `scale(${coreLayer.breath.toFixed(4)})`;
  }

  function finalizeView() {
    if (state.view === 'spiral') {
      list.classList.add('hidden');
      spiralView.classList.remove('hidden');
    } else {
      spiralView.classList.add('hidden');
      list.classList.remove('hidden');
    }
    if (window.gsap) gsap.set([list, spiralView], { clearProps: 'opacity,transform' });
  }

  function switchView(view) {
    if (!spiralView || view === state.view) return;
    state.view = view;
    document.body.classList.toggle('view-spiral', view === 'spiral');
    vsBtns.forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });

    const useAnim = window.gsap && !reduceMotion;

    if (view === 'spiral') {
      onListLeave();
      spiralView.classList.remove('hidden');
      buildSpiral();
      if (useAnim) {
        gsap.set(spiralView, { opacity: 0, y: 24, scale: 0.985, rotation: -0.6 });
        gsap.timeline({ onComplete: finalizeView })
          .to(list, { opacity: 0, y: -24, scale: 0.985, rotation: 0.6, duration: 0.5, ease: 'expo.inOut' })
          .to(spiralView, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'expo.inOut' }, 0.08);
      } else {
        finalizeView();
      }
    } else {
      stopMotor();
      list.classList.remove('hidden');
      renderList({ animate: true });
      if (useAnim) {
        gsap.set(list, { opacity: 0, y: -24, scale: 0.985, rotation: -0.6 });
        gsap.timeline({ onComplete: finalizeView })
          .to(spiralView, { opacity: 0, y: 24, scale: 0.985, rotation: 0.6, duration: 0.5, ease: 'expo.inOut' })
          .to(list, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'expo.inOut' }, 0.08);
      } else {
        finalizeView();
      }
    }

    /* failsafe: pastikan satu view tampil meski ticker GSAP macet (headless) */
    setTimeout(() => { if (state.view === view) finalizeView(); }, 650);

    syncLenis();
  }

  vsBtns.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  /* ═══ PRELOADER ═══ */

  const preloaderEl = $('#preloader');
  const plCountEl = $('#pl-count');
  const plBarFill = $('#pl-bar-fill');
  let preloaderDone = false;
  let preloaderCleaned = false;

  function applyProgress(p) {
    if (plCountEl) plCountEl.textContent = String(Math.floor(p)).padStart(2, '0') + '%';
    if (plBarFill) plBarFill.style.width = p.toFixed(2) + '%';
  }

  function initPreloader() {
    if (!preloaderEl || preloaderDone) return;

    const doExit = () => {
      if (preloaderDone) return;
      preloaderDone = true;

      /* tirai mulai terbuka → entrance konten utama */
      document.body.classList.add('preloader-done');
      if (introQueued) startHeroIntro();

      if (window.gsap && !reduceMotion) {
        const tl = gsap.timeline();
        tl.to('.pl-center', { opacity: 0, scale: 0.96, duration: 0.3, ease: 'power2.out' })
          .to('.curtain-top', { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, '+=0.05')
          .to('.curtain-bottom', { yPercent: 100, duration: 0.85, ease: 'power4.inOut' }, '<')
          .add(() => finishPreloader(), '-=0.25');
      } else {
        const cTop = $('.curtain-top', preloaderEl);
        const cBot = $('.curtain-bottom', preloaderEl);
        if (plCountEl) plCountEl.style.opacity = '0';
        if (cTop) cTop.style.transform = 'translateY(-100%)';
        if (cBot) cBot.style.transform = 'translateY(100%)';
        setTimeout(finishPreloader, 250);
      }

      /* jaring pengaman: rAF/ticker mati di headless */
      setTimeout(finishPreloader, 1700);
    };

    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const driveByInterval = () => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (preloaderDone) { clearInterval(iv); return; }
        const raw = Math.min(1, (Date.now() - t0) / 1400);
        applyProgress(easeInOut(raw) * 100);
        if (raw >= 1) { clearInterval(iv); doExit(); }
      }, 38);
    };

    driveByInterval();
  }

  function finishPreloader() {
    if (preloaderCleaned) return;
    preloaderCleaned = true;
    if (preloaderEl && preloaderEl.parentNode) preloaderEl.parentNode.removeChild(preloaderEl);
    if (!document.body.classList.contains('preloader-done')) {
      document.body.classList.add('preloader-done');
      if (introQueued) startHeroIntro();
    }
  }

  /* ═══ COPY EMAIL ═══ */

  const CONTACT_EMAIL = 'hello@vivtus.studio';
  const copyBtn = $('#copy-email');

  function initCopyEmail() {
    if (!copyBtn) return;
    const label = copyBtn.querySelector('.copy-label');
    const orig = label ? label.textContent : '';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(CONTACT_EMAIL);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = CONTACT_EMAIL;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
      }
      copyBtn.classList.add('is-copied');
      if (label) label.textContent = 'EMAIL COPIED ✓';
      if (copyBtn._restoreTimer) clearTimeout(copyBtn._restoreTimer);
      copyBtn._restoreTimer = setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        if (label) label.textContent = orig;
      }, 2200);
    });
  }

  /* ═══ DEEP SPACE STARFIELD BACKGROUND ═══ */

  function initSpaceBackground() {
    const canvas = $('#space-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = 1;
    let stars = [];
    /* latar nebula di-cache sekali ke canvas offscreen, bukan digambar ulang per frame */
    const nebulaCanvas = document.createElement('canvas');
    const nebulaCtx = nebulaCanvas.getContext('2d');
    let nebulaClouds = []; /* 180 gumpalan awan kosmik prosedural */
    const mouse = { x: 0, y: 0 }; /* -0.5 .. 0.5 */

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      /* offscreen memakai piksel CSS; main context sudah diskalakan DPR saat drawImage */
      nebulaCanvas.width = Math.max(1, W);
      nebulaCanvas.height = Math.max(1, H);
    }

    function seed() {
      /* maksimal 220 bintang ringan; 20 di antaranya lebih terang (tanpa gradient) */
      stars = [];
      for (let i = 0; i < 220; i++) {
        const r = Math.random();
        const col = r < 0.5
          ? [255, 255, 255]
          : r < 0.78
            ? [233, 213, 255]
            : r < 0.93
              ? [216, 180, 254]
              : [255, 170, 214];
        const bright = i < 20;
        stars.push({
          x: Math.random(),
          y: Math.random(),
          size: bright ? 1.4 + Math.random() * 0.9 : 0.4 + Math.random() * 1.8,
          depth: 0.2 + Math.random() * 0.8,
          alpha: bright ? 0.75 + Math.random() * 0.25 : 0.3 + Math.random() * 0.6,
          color: col,
          glow: bright ? 3 + Math.random() * 3 : 0,
          tw: 0.8 + Math.random() * 3.2,
          ph: Math.random() * Math.PI * 2
        });
      }

      /* 180 gumpalan awan nebula berlapis di sepanjang diagonal kiri-atas ke kanan-bawah */
      nebulaClouds = [];
      const cloudPalette = [
        [126, 34, 206, 0.045],
        [192, 38, 211, 0.04],
        [76, 29, 149, 0.05],
        [4, 1, 10, 0.06]
      ];
      for (let i = 0; i < 180; i++) {
        const t = Math.random();
        const col = cloudPalette[Math.floor(Math.random() * cloudPalette.length)];
        nebulaClouds.push({
          x: Math.min(1.1, Math.max(-0.1, t + (Math.random() - 0.5) * 0.5)),
          y: Math.min(1.1, Math.max(-0.1, t + (Math.random() - 0.5) * 0.5)),
          size: 90 + Math.random() * 260,
          color: col
        });
      }
    }

    /* Dilukis sekali saat init/resize ke offscreen canvas. */
    function paintNebula() {
      nebulaCtx.clearRect(0, 0, W, H);
      nebulaCtx.fillStyle = '#05020B';
      nebulaCtx.fillRect(0, 0, W, H);
      for (const c of nebulaClouds) {
        const px = c.x * W;
        const py = c.y * H;
        const [cr, cg, cb, ca] = c.color;
        const g = nebulaCtx.createRadialGradient(px, py, 0, px, py, c.size);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${ca})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        nebulaCtx.fillStyle = g;
        nebulaCtx.beginPath();
        nebulaCtx.arc(px, py, c.size, 0, Math.PI * 2);
        nebulaCtx.fill();
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      /* satu blit dari cache offscreen — jutaan piksel tanpa radial gradient per frame */
      ctx.drawImage(nebulaCanvas, 0, 0, W, H);

      for (const s of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph);
        const px = (s.x + mouse.x * s.depth * 0.04) * W;
        const py = (s.y + mouse.y * s.depth * 0.04) * H;
        ctx.fillStyle = 'rgb(' + s.color[0] + ',' + s.color[1] + ',' + s.color[2] + ')';

        if (s.glow) {
          /* kilau bintang terang: kotak lembut, bukan createRadialGradient */
          const g = s.glow;
          ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha * twinkle * 0.22));
          ctx.fillRect(px - g * 0.5 + s.size * 0.5, py - g * 0.5 + s.size * 0.5, g, g);
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha * twinkle));
        ctx.fillRect(px, py, s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }

    resize();
    seed();
    paintNebula();
    draw(0);

    document.addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / Math.max(1, W)) - 0.5;
      mouse.y = (e.clientY / Math.max(1, H)) - 0.5;
    }, { passive: true });

    window.addEventListener('resize', () => {
      resize();
      seed();
      paintNebula();
      draw(performance.now());
    });

    if (!reduceMotion && typeof requestAnimationFrame === 'function') {
      const loop = (t) => { draw(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  /* ═══ SMOOTH SCROLL (Lenis — inertia lembut) ═══ */

  let lenis = null;

  function initSmoothScroll() {
    if (reduceMotion || !window.Lenis) return;
    try {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.4
      });
      const raf = (time) => {
        if (lenis) lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    } catch (e) { lenis = null; }
  }

  function syncLenis() {
    if (!lenis) return;
    /* terkunci bersih saat modal/panel terbuka atau mode SPIRAL aktif */
    const enabled = !document.body.classList.contains('is-locked') && state.view !== 'spiral';
    if (enabled) lenis.start();
    else lenis.stop();
  }

  /* ═══ BOOT ═══ */
  initSpaceBackground();
  initPreloader();
  initCopyEmail();
  initSmoothScroll();
  initPreview();
  positionPill(false);
  vsBtns.forEach(attachPress);
  filterBtns.forEach(attachPress);
  loadProjects();

  if (pmNext) {
    pmNext.addEventListener('click', () => {
      if (!state.openId || !state.projects.length) return;
      const i = state.projects.findIndex((p) => p.id === state.openId);
      const next = state.projects[(i + 1) % state.projects.length];
      openProject(next.id);
    });
  }

  window.__portfolio = { state, openProject, closeProject, openInfo, closeInfo };
})();
