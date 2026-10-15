/*
 * ACOANDES · Recorrido virtual 360°
 * Interfaz del recorrido: izada de bandera (carga), guirnalda de banderines,
 * banda del espacio actual, índice, recorrido guiado, música y atajos.
 */
(() => {
  'use strict';

  const rooms = window.ACO_ROOMS;
  const CATS = window.ACO_CATEGORIES;
  const TOTAL = rooms.length;
  const ROTATE_SPEED = -1.6;      // grados por segundo
  const ROTATE_RESUME_MS = 4000;  // vuelve a girar tras este tiempo sin tocar
  const TOUR_SECONDS = 16;
  const MIN_IZADA_MS = 1600;

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // Preferencias de este navegador (si el almacenamiento falla, todo sigue funcionando).
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (_e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_e) { /* sin almacenamiento */ }
    }
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  const panoUrl = (room) => `img/pano/${room.id}.jpg`;
  const thumbUrl = (room) => `img/thumb/${room.id}.jpg`;
  const catOf = (room) => CATS[room.category];
  const esc = (v) => String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- Estado ----------
  let current = indexFromHash();
  let viewer = null;
  let entered = false;
  let rotating = true;
  let touring = false;
  let tourTimer = null;
  let tourAnim = null;
  let gyroOn = false;
  let filter = 'Todos';
  let musicOn = !store.get('aco360:muted', false);
  let sceneLoadTimer = null;
  let onFirstLoad = null;
  const visited = new Set(store.get('aco360:visited', []).filter((id) => rooms.some((r) => r.id === id)));

  // ---------- Elementos ----------
  const garland = $('garland');
  const track = $('garlandTrack');
  const list = $('garlandList');
  const cordPath = $('garlandCord').querySelector('path');
  const tip = $('pennantTip');
  const bannerInner = $('bannerInner');
  const drawer = $('drawer');
  const scrim = $('scrim');
  const search = $('roomSearch');
  const roomList = $('roomList');
  const about = $('about');
  const soundBtn = $('soundBtn');
  const tourBtn = $('tourBtn');
  const rotateBtn = $('rotateBtn');
  const indexBtn = $('indexBtn');
  const gyroBtn = $('gyroBtn');
  const pennants = [];
  const pennantX = [];

  function indexFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = rooms.findIndex((r) => r.id === id);
    return i >= 0 ? i : 0;
  }

  // =========================================================
  // Guirnalda de banderines
  // =========================================================
  function buildGarland() {
    const frag = document.createDocumentFragment();
    rooms.forEach((room, i) => {
      const cat = catOf(room);
      const li = document.createElement('li');
      li.innerHTML =
        `<button type="button" class="pennant dye-${cat.dye}" data-index="${i}" aria-current="false" aria-label="${pad2(room.number)}. ${esc(room.name)}, ${esc(cat.short)}">` +
          '<svg viewBox="0 0 40 52" aria-hidden="true">' +
            '<path class="p-body" d="M1 1.5H39L20 51Z"/>' +
            '<path class="p-hem" d="M1 1.5H39L37.3 6H2.7Z"/>' +
            '<path class="p-stitch" d="M6 8.5H34L20 44Z"/>' +
            '<circle class="p-dot" cx="20" cy="20" r="8"/>' +
            `<text class="p-num" x="20" y="23.4" text-anchor="middle">${pad2(room.number)}</text>` +
          '</svg>' +
        '</button>';
      const btn = li.firstElementChild;
      btn.classList.toggle('is-visited', visited.has(room.id));
      pennants.push(btn);
      frag.appendChild(li);
    });
    list.appendChild(frag);

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.pennant');
      if (btn) goTo(Number(btn.dataset.index));
    });
    list.addEventListener('pointerover', (e) => {
      const btn = e.target.closest('.pennant');
      if (btn && e.pointerType === 'mouse') showTip(btn);
    });
    list.addEventListener('pointerout', (e) => {
      if (e.target.closest('.pennant') && !list.contains(e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.pennant') : null)) hideTip();
    });
    list.addEventListener('focusin', (e) => {
      const btn = e.target.closest('.pennant');
      if (btn && btn.matches(':focus-visible')) showTip(btn);
    });
    list.addEventListener('focusout', hideTip);
    garland.addEventListener('scroll', hideTip, { passive: true });
  }

  // El cordón cuelga con una curva suave; cada banderín sigue su inclinación.
  function layoutGarland() {
    const avail = garland.clientWidth;
    if (!avail) return;
    // Con mouse los 22 banderines caben encogiéndose; en pantallas táctiles se desliza la guirnalda.
    const base = parseFloat(getComputedStyle(garland).getPropertyValue('--w')) || 38;
    const w = finePointer.matches ? Math.max(28, Math.min(base, (avail - 8) / TOTAL - 6)) : base;
    garland.style.setProperty('--pw', `${w}px`);
    const step = Math.max(w + 6, Math.min(w + 20, (avail - 8) / TOTAL));
    const width = Math.ceil(step * TOTAL + 8);
    const sag = Math.min(22, width * 0.018);
    const y0 = 6;
    track.style.width = `${width}px`;
    cordPath.setAttribute('d', `M0 ${y0} Q ${width / 2} ${y0 + sag * 2} ${width} ${y0}`);
    pennants.forEach((btn, i) => {
      const x = 4 + step / 2 + i * step;
      const t = x / width;
      const y = y0 + sag * 4 * t * (1 - t);
      const slope = Math.atan((sag * 4 * (1 - 2 * t)) / width) * 180 / Math.PI;
      pennantX[i] = x;
      btn.parentElement.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - 1.5).toFixed(1)}px) rotate(${slope.toFixed(2)}deg)`;
    });
    garland.classList.toggle('is-scrollable', width > avail + 1);
    scrollGarlandTo(current, false);
  }

  function scrollGarlandTo(i, smooth) {
    if (!garland.classList.contains('is-scrollable')) return;
    garland.scrollTo({ left: pennantX[i] - garland.clientWidth / 2, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  }

  // Al entrar: el cordón se dibuja y los banderines se cuelgan uno a uno.
  function hangGarland() {
    if (reduceMotion.matches) return;
    const len = cordPath.getTotalLength();
    cordPath.animate(
      [{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }],
      { duration: 1100, delay: 200, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
    );
    pennants.forEach((btn, i) => {
      btn.querySelector('svg').animate(
        [
          { opacity: 0, transform: 'translateY(-28px) rotate(-18deg)' },
          { opacity: 1, transform: 'translateY(0) rotate(7deg)', offset: 0.55 },
          { transform: 'rotate(-3.5deg)', offset: 0.8 },
          { opacity: 1, transform: 'rotate(0)' }
        ],
        { duration: 950, delay: 420 + i * 34, easing: 'ease-out', fill: 'backwards' }
      );
    });
  }

  function showTip(btn) {
    if (!finePointer.matches) return;
    const room = rooms[Number(btn.dataset.index)];
    tip.querySelector('img').src = thumbUrl(room);
    tip.querySelector('span').textContent = `${pad2(room.number)} · ${room.name}`;
    const r = btn.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - 184, Math.max(8, r.left + r.width / 2 - 88))}px`;
    tip.style.top = `${r.bottom + 12}px`;
    tip.classList.add('show');
  }
  function hideTip() { tip.classList.remove('show'); }

  // =========================================================
  // Banda del espacio actual: cada cambio es una izada
  // =========================================================
  let bannerToken = 0;

  function fillBanner(room) {
    $('placard').className = `placard dye-${catOf(room).dye}`;
    $('bannerNum').textContent = pad2(room.number);
    $('bannerName').textContent = room.name;
    $('bannerCat').textContent = room.category;
  }

  async function raiseBanner(room, animate) {
    const token = ++bannerToken;
    bannerInner.getAnimations().forEach((a) => a.cancel());
    if (!animate || reduceMotion.matches) { fillBanner(room); return; }
    const lower = bannerInner.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(125%)', opacity: 0 }],
      { duration: 220, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' }
    );
    try { await lower.finished; } catch (_e) { return; }
    if (token !== bannerToken) return;
    fillBanner(room);
    bannerInner.animate(
      [{ transform: 'translateY(125%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 640, easing: 'cubic-bezier(.34,1.45,.55,1)', fill: 'forwards' }
    );
    lower.cancel();
  }

  function updateCounts() {
    const text = `${visited.size} de ${TOTAL} visitados`;
    $('visitedCount').textContent = text;
    $('drawerVisited').textContent = text;
  }

  function reflectCurrent(animate) {
    const room = rooms[current];
    pennants.forEach((btn, i) => {
      const on = i === current;
      btn.setAttribute('aria-current', on ? 'true' : 'false');
      btn.parentElement.classList.toggle('is-current', on);
    });
    scrollGarlandTo(current, animate);
    raiseBanner(room, animate);
    document.title = `${room.name} · ACOANDES 360°`;
    if (entered) history.replaceState(null, '', `#${room.id}`);
    if (window.AcoMusic) window.AcoMusic.setMood(catOf(room).key);
    if (drawer.classList.contains('is-open')) renderList();
  }

  function markVisited(room) {
    if (visited.has(room.id)) return;
    visited.add(room.id);
    store.set('aco360:visited', [...visited]);
    pennants[rooms.indexOf(room)].classList.add('is-visited');
    updateCounts();
    if (drawer.classList.contains('is-open')) renderList();
    if (visited.size === TOTAL && entered) celebrate();
  }

  // =========================================================
  // Visor 360°
  // =========================================================
  function createViewer(firstPanorama) {
    const scenes = {};
    rooms.forEach((room, i) => {
      scenes[room.id] = {
        type: 'equirectangular',
        panorama: i === current && firstPanorama ? firstPanorama : panoUrl(room),
        hfov: 100,
        pitch: 0,
        yaw: 0
      };
    });
    viewer = window.pannellum.viewer('panorama', {
      default: {
        firstScene: rooms[current].id,
        sceneFadeDuration: reduceMotion.matches ? 0 : 900,
        autoLoad: true,
        autoRotate: ROTATE_SPEED,
        autoRotateInactivityDelay: ROTATE_RESUME_MS,
        showControls: false,
        keyboardZoom: true,
        mouseZoom: true,
        friction: 0.16,
        minHfov: 45,
        maxHfov: 120
      },
      scenes
    });
    viewer.on('load', onSceneLoad);
    viewer.on('error', onViewerError);
    viewer.on('mousedown', onUserLook);
    viewer.on('touchstart', onUserLook);
  }

  function onSceneLoad() {
    clearTimeout(sceneLoadTimer);
    $('sceneLoading').classList.remove('show');
    markVisited(rooms[current]);
    applyRotate();
    if (touring) scheduleTour();
    setTimeout(preloadNeighbors, 1200);
    if (onFirstLoad) { onFirstLoad(); onFirstLoad = null; }
  }

  function onViewerError() {
    clearTimeout(sceneLoadTimer);
    $('sceneLoading').classList.remove('show');
    if (!entered) {
      fatal('No se pudo abrir el recorrido', 'La primera foto 360° no cargó. Revisa tu conexión a internet y vuelve a cargar la página.');
      return;
    }
    toast('No se pudo cargar este espacio. Revisa tu conexión e inténtalo de nuevo.');
  }

  function onUserLook() {
    hideCoach();
    setTimeout(() => {
      if (gyroOn && viewer.isOrientationActive && !viewer.isOrientationActive()) setGyro(false);
    }, 80);
  }

  const preloaded = new Set();
  function preloadNeighbors() {
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    [current + 1, current - 1].forEach((i) => {
      const room = rooms[(i + TOTAL) % TOTAL];
      if (preloaded.has(room.id)) return;
      preloaded.add(room.id);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = panoUrl(room);
    });
  }

  function goTo(index) {
    if (!viewer) return;
    const next = (index + TOTAL) % TOTAL;
    closeDrawer(false);
    if (next === current) return;
    current = next;
    const room = rooms[current];
    if (touring) { clearTimeout(tourTimer); if (tourAnim) tourAnim.cancel(); }
    clearTimeout(sceneLoadTimer);
    $('sceneLoadingText').textContent = `Cargando ${room.name}…`;
    sceneLoadTimer = setTimeout(() => $('sceneLoading').classList.add('show'), 280);
    viewer.loadScene(room.id, 0, 0, 100);
    reflectCurrent(true);
  }

  // ---------- Rotación, vista y giroscopio ----------
  function applyRotate() {
    if (!viewer) return;
    if (rotating && !gyroOn) {
      viewer.startAutoRotate(ROTATE_SPEED);
      viewer.getConfig().autoRotateInactivityDelay = ROTATE_RESUME_MS;
    } else {
      viewer.stopAutoRotate();
    }
  }

  function setRotate(on) {
    rotating = on;
    rotateBtn.classList.toggle('is-on', on);
    rotateBtn.setAttribute('aria-pressed', String(on));
    applyRotate();
  }

  function resetView() {
    if (!viewer) return;
    viewer.setPitch(0, 600);
    viewer.setYaw(0, 600);
    viewer.setHfov(100, 600);
  }

  function setGyro(on) {
    gyroOn = on;
    gyroBtn.setAttribute('aria-pressed', String(on));
    applyRotate();
  }

  async function toggleGyro() {
    if (gyroOn) { viewer.stopOrientation(); setGyro(false); return; }
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('denied');
      }
      await new Promise((r) => setTimeout(r, 300));
      if (viewer.isOrientationSupported && !viewer.isOrientationSupported()) throw new Error('unsupported');
      viewer.startOrientation();
      setGyro(true);
      toast('Mueve el celular para mirar alrededor.');
    } catch (_e) {
      toast('Este navegador no permite usar el movimiento del celular.');
    }
  }

  // ---------- Recorrido guiado ----------
  function setTour(on) {
    touring = on;
    tourBtn.setAttribute('aria-pressed', String(on));
    body.classList.toggle('is-touring', on);
    clearTimeout(tourTimer);
    if (tourAnim) tourAnim.cancel();
    if (on) {
      if (!rotating) setRotate(true);
      toast(`Recorrido guiado: avanza solo cada ${TOUR_SECONDS} segundos.`);
      scheduleTour();
    }
  }

  function scheduleTour() {
    clearTimeout(tourTimer);
    if (tourAnim) tourAnim.cancel();
    if (!touring) return;
    tourAnim = $('tourBar').animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: TOUR_SECONDS * 1000, easing: 'linear', fill: 'forwards' }
    );
    tourTimer = setTimeout(() => goTo(current + 1), TOUR_SECONDS * 1000);
  }

  // =========================================================
  // Música
  // =========================================================
  const bars = [...soundBtn.querySelectorAll('rect')];

  function setMusic(on) {
    musicOn = on;
    store.set('aco360:muted', !on);
    if (window.AcoMusic) {
      if (on) { window.AcoMusic.setMood(catOf(rooms[current]).key); window.AcoMusic.start(); }
      else window.AcoMusic.setMuted(true);
    }
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', 'Música ambiental');
    soundBtn.title = on ? 'Silenciar música (M)' : 'Activar música (M)';
  }

  function meter(t) {
    const level = musicOn && window.AcoMusic ? window.AcoMusic.level() : 0;
    bars.forEach((bar, i) => {
      let s = 0.3;
      if (musicOn) {
        s = reduceMotion.matches ? 0.7 : 0.34 + level * 1.5 * (0.7 + 0.5 * Math.sin(t / (210 + i * 65) + i * 1.9));
      }
      bar.style.transform = `scaleY(${Math.max(0.3, Math.min(1, s)).toFixed(3)})`;
    });
    requestAnimationFrame(meter);
  }

  // =========================================================
  // Índice
  // =========================================================
  function buildFilters() {
    const options = ['Todos', ...Object.keys(CATS)];
    $('filters').innerHTML = options.map((cat) => {
      const dye = CATS[cat] ? `<i class="chip-pennant dye-${CATS[cat].dye}" aria-hidden="true"></i>` : '';
      return `<button type="button" class="filter-btn" data-filter="${esc(cat)}" aria-pressed="${cat === filter}">${dye}${esc(CATS[cat] ? CATS[cat].short : cat)}</button>`;
    }).join('');
    $('filters').addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filter = btn.dataset.filter;
      $('filters').querySelectorAll('.filter-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderList();
    });
  }

  function renderList() {
    const raw = search.value.trim();
    const term = normalize(raw);
    const matches = rooms
      .map((room, index) => ({ room, index }))
      .filter(({ room }) => (filter === 'Todos' || room.category === filter) &&
        (!term || normalize(`${room.name} ${room.category} ${room.number}`).includes(term)));
    if (!matches.length) {
      roomList.innerHTML = `<p class="empty">No hay espacios que coincidan con «${esc(raw)}».</p>`;
      return;
    }
    let html = '';
    Object.keys(CATS).forEach((category) => {
      const group = matches.filter(({ room }) => room.category === category);
      if (!group.length) return;
      const cat = CATS[category];
      html += `<div class="group-label"><i class="chip-pennant dye-${cat.dye}" aria-hidden="true"></i>${esc(cat.short)}</div>`;
      group.forEach(({ room, index }) => {
        const seen = visited.has(room.id);
        html +=
          `<button type="button" class="room-item dye-${cat.dye}${seen ? ' is-visited' : ''}" data-index="${index}"${index === current ? ' aria-current="true"' : ''}>` +
            `<img class="room-thumb" src="${thumbUrl(room)}" alt="" loading="lazy" width="76" height="42">` +
            `<span class="room-copy"><b>${esc(room.name)}</b><small>${pad2(room.number)} · ${seen ? 'Visitado' : 'Sin visitar'}</small></span>` +
            '<svg class="room-state" viewBox="0 0 24 24" aria-hidden="true"><circle class="ring" cx="12" cy="12" r="9"/><path class="tick" d="M7.8 12.3l2.8 2.8 5.6-5.8"/></svg>' +
          '</button>';
      });
    });
    roomList.innerHTML = html;
  }

  function openDrawer() {
    if (touring) setTour(false);
    renderList();
    drawer.inert = false;
    drawer.classList.add('is-open');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('show'));
    indexBtn.setAttribute('aria-expanded', 'true');
    const active = roomList.querySelector('[aria-current="true"]');
    if (active) active.scrollIntoView({ block: 'center' });
    setTimeout(() => (finePointer.matches ? search : $('closeDrawer')).focus({ preventScroll: true }), 80);
  }

  function closeDrawer(restoreFocus) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.inert = true;
    scrim.classList.remove('show');
    setTimeout(() => { if (!drawer.classList.contains('is-open')) scrim.hidden = true; }, 360);
    indexBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) indexBtn.focus();
  }

  function openAbout() {
    if (touring) setTour(false);
    closeDrawer(false);
    about.showModal();
  }

  // =========================================================
  // Avisos
  // =========================================================
  let toastTimer = null;
  function toast(message, big = false, ms = 3400) {
    const el = $('toast');
    el.textContent = message;
    el.classList.toggle('is-big', big);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  let coachTimer = null;
  function showCoach() {
    if (store.get('aco360:coached', false)) return;
    $('coachText').textContent = finePointer.matches ? 'Arrastra para mirar alrededor' : 'Desliza para mirar alrededor';
    coachTimer = setTimeout(() => {
      $('coach').classList.add('show');
      coachTimer = setTimeout(hideCoach, 5500);
    }, 1800);
  }
  function hideCoach() {
    clearTimeout(coachTimer);
    if (!entered) return;
    $('coach').classList.remove('show');
    store.set('aco360:coached', true);
  }

  function celebrate() {
    toast('¡Recorriste los 22 espacios de ACOANDES!', true, 5600);
    if (reduceMotion.matches) return;
    const colors = ['var(--girasol)', 'var(--azul)', 'var(--felt-500)', 'var(--cord)'];
    const box = $('confetti');
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 48; i++) {
      const el = document.createElement('i');
      el.style.setProperty('--x', `${Math.random() * 100}vw`);
      el.style.setProperty('--c', colors[i % colors.length]);
      el.style.setProperty('--d', `${2.6 + Math.random() * 1.8}s`);
      el.style.setProperty('--delay', `${Math.random() * 0.7}s`);
      el.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
      el.style.setProperty('--spin', `${Math.random() * 900 - 450}deg`);
      frag.appendChild(el);
    }
    box.appendChild(frag);
    setTimeout(() => { box.textContent = ''; }, 5400);
  }

  function fatal(title, text) {
    $('fatalTitle').textContent = title;
    $('fatalText').textContent = text;
    $('fatal').hidden = false;
    $('izada').classList.add('is-done');
  }

  // =========================================================
  // Izada de bandera: la bandera sube con la carga real de la primera foto
  // =========================================================
  function download(url, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error(`HTTP ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('red'));
      xhr.send();
    });
  }

  function izar() {
    const started = performance.now();
    const flag = $('flag');
    const stage = flag.parentElement;
    const pctEl = $('izadaPct');
    let target = 0;
    let shown = 0;
    let known = false;
    let finished = false;
    let raised;
    const atTop = new Promise((r) => { raised = r; });

    (function frame() {
      if (!known && !finished) target = Math.min(0.82, target + 0.003);
      shown += (target - shown) * (reduceMotion.matches ? 1 : 0.1);
      if (finished && target - shown < 0.004) shown = 1;
      const travel = stage.clientHeight - flag.offsetHeight - 16;
      flag.style.transform = `translateY(${(-shown * travel).toFixed(1)}px)`;
      pctEl.textContent = `${Math.round(shown * 100)}%`;
      if (shown >= 1) raised();
      // Con la pestaña oculta el navegador pausa requestAnimationFrame; seguimos con un temporizador.
      else if (document.hidden) setTimeout(frame, 120);
      else requestAnimationFrame(frame);
    })();

    const firstLoad = new Promise((r) => { onFirstLoad = r; });
    download(panoUrl(rooms[current]), (p) => { known = true; target = Math.max(target, p * 0.9); })
      .then((blob) => URL.createObjectURL(blob), () => null)
      .then((blobUrl) => {
        target = Math.max(target, 0.9);
        createViewer(blobUrl);
        return Promise.race([firstLoad, new Promise((r) => setTimeout(r, 20000))]);
      })
      .then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN_IZADA_MS - (performance.now() - started)))))
      .then(() => { finished = true; target = 1; return atTop; })
      .then(() => {
        if ($('fatal').hidden === false) return;
        $('izadaText').textContent = 'Bandera izada';
        $('izada').classList.add('is-raised');
        return new Promise((r) => setTimeout(r, reduceMotion.matches ? 200 : 900));
      })
      .then(() => {
        if ($('fatal').hidden === false) return;
        $('izada').classList.add('is-done');
        body.classList.remove('is-loading');
        body.classList.add('is-intro');
        $('welcome').inert = false;
        setTimeout(() => $('enterBtn').focus({ preventScroll: true }), 700);
      });
  }

  function enter() {
    if (entered || !body.classList.contains('is-intro')) return;
    entered = true;
    $('welcome').inert = true;
    body.classList.remove('is-intro');
    body.classList.add('is-entered');
    history.replaceState(null, '', `#${rooms[current].id}`);
    layoutGarland();
    hangGarland();
    if (musicOn) setMusic(true);
    showCoach();
    setTimeout(() => { if (visited.size === TOTAL) toast('Ya visitaste todos los espacios. ¡Bienvenido de nuevo!'); }, 2400);
  }

  // =========================================================
  // Pantalla completa
  // =========================================================
  const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  function toggleFullscreen() {
    if (!fsEnabled) return;
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (!isFs) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (_e) { /* el navegador lo rechazó */ }
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    body.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement || document.webkitFullscreenElement));
  }));

  // =========================================================
  // Eventos
  // =========================================================
  function bind() {
    $('enterBtn').addEventListener('click', enter);
    $('aboutFromWelcome').addEventListener('click', openAbout);
    $('aboutFromDrawer').addEventListener('click', openAbout);
    $('crestBtn').addEventListener('click', openAbout);
    $('closeAbout').addEventListener('click', () => about.close());
    about.addEventListener('click', (e) => {
      const r = about.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) about.close();
    });

    $('prevBtn').addEventListener('click', () => goTo(current - 1));
    $('nextBtn').addEventListener('click', () => goTo(current + 1));
    rotateBtn.addEventListener('click', () => setRotate(!rotating));
    $('resetBtn').addEventListener('click', resetView);
    tourBtn.addEventListener('click', () => setTour(!touring));
    soundBtn.addEventListener('click', () => setMusic(!musicOn));
    indexBtn.addEventListener('click', () => (drawer.classList.contains('is-open') ? closeDrawer(true) : openDrawer()));
    $('closeDrawer').addEventListener('click', () => closeDrawer(true));
    scrim.addEventListener('click', () => closeDrawer(true));
    search.addEventListener('input', renderList);
    roomList.addEventListener('click', (e) => {
      const item = e.target.closest('.room-item');
      if (item) goTo(Number(item.dataset.index));
    });
    $('resetVisited').addEventListener('click', () => {
      visited.clear();
      store.set('aco360:visited', []);
      pennants.forEach((p) => p.classList.remove('is-visited'));
      markVisited(rooms[current]);
      updateCounts();
      renderList();
      toast('Listo: los banderines vuelven a estar por visitar.');
    });

    if (fsEnabled) $('fullscreenBtn').addEventListener('click', toggleFullscreen);
    else $('fullscreenBtn').hidden = true;

    if (matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window) {
      gyroBtn.hidden = false;
      gyroBtn.addEventListener('click', toggleGyro);
    }

    window.addEventListener('hashchange', () => { if (entered) goTo(indexFromHash()); });
    new ResizeObserver(() => requestAnimationFrame(layoutGarland)).observe(garland);

    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || about.open) return;
      if (e.key === 'Escape') {
        if (drawer.classList.contains('is-open')) closeDrawer(true);
        else if (touring) setTour(false);
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing || !entered) return;
      const inViewer = e.target.closest && e.target.closest('#panorama');
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          if (inViewer && e.key === 'ArrowRight') return;
          e.preventDefault(); goTo(current + 1); break;
        case 'ArrowLeft':
        case 'PageUp':
          if (inViewer && e.key === 'ArrowLeft') return;
          e.preventDefault(); goTo(current - 1); break;
        case 'i': case 'I':
          if (drawer.classList.contains('is-open')) closeDrawer(true); else openDrawer();
          break;
        case 'g': case 'G': setTour(!touring); break;
        case 'r': case 'R': resetView(); break;
        case 'm': case 'M': setMusic(!musicOn); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case ' ':
          if (e.target.closest && e.target.closest('button')) return;
          e.preventDefault(); setRotate(!rotating); break;
        default: break;
      }
    });
  }

  // =========================================================
  // Arranque
  // =========================================================
  function boot() {
    buildGarland();
    buildFilters();
    bind();
    fillBanner(rooms[current]);
    reflectCurrent(false);
    updateCounts();
    // La música arranca solo con el clic de "Entrar" (los navegadores lo exigen).
    soundBtn.setAttribute('aria-pressed', String(musicOn));
    soundBtn.title = musicOn ? 'Silenciar música (M)' : 'Activar música (M)';
    requestAnimationFrame(meter);

    if (location.protocol === 'file:') {
      fatal('Abre el recorrido desde un servidor web',
        'Los navegadores bloquean las fotos 360° cuando la página se abre directamente como archivo. Publícala en GitHub Pages o ábrela con un servidor local, por ejemplo la extensión Live Server de VS Code.');
      return;
    }
    if (typeof window.pannellum === 'undefined') {
      fatal('No se pudo abrir el visor 360°', 'El visor se descarga de internet. Revisa tu conexión y vuelve a cargar la página.');
      return;
    }
    izar();
  }

  boot();
})();
