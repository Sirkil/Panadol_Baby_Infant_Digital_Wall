/**
 * Panadol - Live Community Display Screen
 * 
 * Features:
 * 1. Haleon branding and the 70-year claim highlighted.
 * 2. Submission spotlight in center:
 *    - Top line: Dr. [Name]
 *    - Bottom line: "I trust Panadol"
 *    - Displayed for 10 seconds.
 *    - Center-stage message remains "I trust Panadol".
 * 3. View Switcher button:
 *    - Toggles between Rain View and Grid View (showing all submitted doctor names).
 * 4. Glowing rain, falling strawberries and names over the blue background.
 */

// =========================================================================
// ⚙️ JOTFORM CONFIGURATION (Enter your Form details here)
// =========================================================================
const JOTFORM_CONFIG = {
  // 1. Jotform Link OR Form ID:
  formLinkOrId: 'https://form.jotform.com/262711631992056',

  // 2. Jotform API Key:
  apiKey: 'e04a6ce1d6a481feed7a40cc4e7a2c9a',

  // 3. Field IDs (Unique name: {name}, Field IDs: #first_3, #last_3):
  fieldIdFirst: 'first_3',
  fieldIdLast: 'last_3',

  // 4. Polling frequency (milliseconds):
  pollingIntervalMs: 2500
};

(function () {
  'use strict';

  // =========================================================================
  // Timing & Constant Configuration
  // =========================================================================
  const NAME_SPOTLIGHT_DURATION = 10000; // 10 seconds display per submitted doctor
  const STORAGE_KEY_NAMES = 'panadol_live_submitted_names_v4';
  const STORAGE_KEY_SEEN_IDS = 'panadol_seen_submission_ids_v4';

  const GRID_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>`;
  const RAIN_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>`;
  const strawberryImage = new Image();
  strawberryImage.src = 'assets/Strawberry_Logo.png';

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const dom = {
    claimView: document.getElementById('claimView'),
    nameView: document.getElementById('nameView'),
    spotlightName: document.getElementById('spotlightName'),
    rainingContainer: document.getElementById('rainingContainer'),
    glowRainCanvas: document.getElementById('glowRainCanvas'),
    viewToggleBtn: document.getElementById('viewToggleBtn'),
    toggleIcon: document.getElementById('toggleIcon'),
    toggleText: document.getElementById('toggleText'),
    namesCountBadge: document.getElementById('namesCountBadge'),
    gridViewSection: document.getElementById('gridViewSection'),
    gridNamesContainer: document.getElementById('gridNamesContainer'),
    gridEmptyMessage: document.getElementById('gridEmptyMessage')
  };

  // =========================================================================
  // Application State
  // =========================================================================
  const state = {
    isSpotlightActive: false,
    submissionQueue: [],
    submittedNames: [],
    seenSubmissionIds: new Set(),
    floatingBadges: [],
    nextRainBadgeIndex: 0,
    currentScale: 1.0,
    pollTimer: null,
    pollInProgress: false,
    hasLoadedSubmissionHistory: false,
    rainStreaks: [],
    strawberryDrops: [],
    currentView: 'rain' // 'rain' | 'grid'
  };

  // =========================================================================
  // Helper: Format Doctor Name with "Dr. " prefix
  // =========================================================================
  function formatDoctorName(rawName) {
    if (!rawName) return '';
    let clean = rawName.trim();
    // Remove existing Dr./Doctor prefix to avoid duplicates
    clean = clean.replace(/^(dr\.?|doctor)\s+/i, '');
    return `Dr. ${clean}`;
  }

  // =========================================================================
  // Responsive Scale Engine
  // =========================================================================
  function updateResponsiveScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isPortrait = vh > vw;
    
    // Baseline reference: 1920x1080 display
    let scale;
    if (isPortrait) {
      scale = Math.min(vw / 1080, vh / 1920);
      scale = Math.max(0.48, Math.min(scale, 3.5));
    } else {
      scale = Math.min(vw / 1920, vh / 1080);
      scale = Math.max(0.50, Math.min(scale, 4.0));
    }

    state.currentScale = scale;
    document.documentElement.style.setProperty('--ui-scale', scale.toFixed(4));

    // Resize the glowing rain canvas
    resizeGlowCanvas();

    if (state.currentView === 'grid') renderGrid();
  }

  // =========================================================================
  // Glowing Rain Canvas (Luminous Falling Streaks)
  // =========================================================================
  function resizeGlowCanvas() {
    const canvas = dom.glowRainCanvas;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function initGlowRain() {
    const canvas = dom.glowRainCanvas;
    if (!canvas) return;

    resizeGlowCanvas();

    const STREAK_COUNT = 60; // Reduced rain by half (from 120)

    state.rainStreaks = [];
    for (let i = 0; i < STREAK_COUNT; i++) {
      state.rainStreaks.push(createRainStreak(true));
    }

    state.strawberryDrops = Array.from({ length: 11 }, (_, index) => createStrawberryDrop(true, index % 3));

    requestAnimationFrame(renderGlowRain);
  }

  function createStrawberryDrop(randomizeY, sizeTier) {
    const scale = state.currentScale || 1;
    const sizeRanges = [[56, 76], [82, 108], [116, 150]];
    const [minimumSize, maximumSize] = sizeRanges[sizeTier];
    return {
      x: Math.random() * window.innerWidth,
      y: randomizeY ? Math.random() * window.innerHeight : -Math.random() * window.innerHeight,
      speed: (0.9 + Math.random() * 1.5) * scale,
      size: (minimumSize + Math.random() * (maximumSize - minimumSize)) * scale,
      sizeTier,
      sway: (7 + Math.random() * 14) * scale,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.55 + Math.random() * 0.3
    };
  }

  function createRainStreak(randomizeY) {
    const scale = state.currentScale || 1;
    return {
      x: Math.random() * window.innerWidth,
      y: randomizeY ? Math.random() * window.innerHeight : -Math.random() * 200,
      speed: (1.6 + Math.random() * 3.8) * scale,
      length: (50 + Math.random() * 130) * scale,
      width: (1.2 + Math.random() * 2.0) * scale, // Refined streak width
      opacity: 0.55 + Math.random() * 0.45
    };
  }

  function renderGlowRain() {
    const canvas = dom.glowRainCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear the canvas
    ctx.clearRect(0, 0, w, h);

    // Lighter blending for luminous, radiant pink rain
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < state.rainStreaks.length; i++) {
      const s = state.rainStreaks[i];

      // Move streak downward
      s.y += s.speed;

      // If streak falls past bottom, respawn at top
      if (s.y > h + s.length) {
        s.x = Math.random() * w;
        s.y = -s.length - Math.random() * 200;
        s.speed = (1.6 + Math.random() * 3.8) * state.currentScale;
        s.width = (1.2 + Math.random() * 2.0) * state.currentScale;
        s.opacity = 0.55 + Math.random() * 0.45;
      }

      // 1. Draw glowing light streak body (white transitioning to pink #EA5297)
      const gradient = ctx.createLinearGradient(s.x, s.y - s.length, s.x, s.y);
      gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
      gradient.addColorStop(0.3, `rgba(255, 200, 230, ${s.opacity * 0.4})`);
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${s.opacity * 0.85})`);
      gradient.addColorStop(1, `rgba(234, 82, 151, ${s.opacity})`);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.length);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Glowing pink #EA5297 halo at the droplet tip
      const glowRadius = s.width * 3.8;
      const tipGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowRadius);
      tipGlow.addColorStop(0, `rgba(255, 255, 255, ${s.opacity * 0.95})`);
      tipGlow.addColorStop(0.4, `rgba(234, 82, 151, ${s.opacity * 0.75})`);
      tipGlow.addColorStop(1, `rgba(234, 82, 151, 0)`);

      ctx.beginPath();
      ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = tipGlow;
      ctx.fill();

      // 3. Crisp white center dot at droplet tip
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.width * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity * 0.9})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    // Strawberries share the stars' downward motion and soft luminous trails.
    if (strawberryImage.complete && strawberryImage.naturalWidth) {
      for (const drop of state.strawberryDrops) {
        drop.y += drop.speed;
        if (drop.y > h + drop.size) {
          Object.assign(drop, createStrawberryDrop(false, drop.sizeTier));
        }

        const x = drop.x + Math.sin(drop.y * 0.008 + drop.phase) * drop.sway;
        const trail = ctx.createLinearGradient(x, drop.y - drop.size * 2.3, x, drop.y);
        trail.addColorStop(0, 'rgba(255, 255, 255, 0)');
        trail.addColorStop(1, `rgba(255, 184, 214, ${drop.opacity * 0.45})`);

        ctx.save();
        ctx.globalAlpha = drop.opacity;
        ctx.strokeStyle = trail;
        ctx.lineWidth = Math.max(1, 1.5 * state.currentScale);
        ctx.beginPath();
        ctx.moveTo(x, drop.y - drop.size * 2.3);
        ctx.lineTo(x, drop.y - drop.size * 0.3);
        ctx.stroke();
        ctx.shadowColor = 'rgba(255, 130, 185, 0.8)';
        ctx.shadowBlur = drop.size * 0.5;
        ctx.drawImage(strawberryImage, x - drop.size / 2, drop.y - drop.size / 2, drop.size, drop.size);
        ctx.restore();
      }
    }

    requestAnimationFrame(renderGlowRain);
  }

  // =========================================================================
  // Submission Flow (Doctor Name with Dr. Prefix on Top Line, 10s Spotlight)
  // =========================================================================
  function queueSubmission(firstName, lastName, submissionId = null) {
    const cleanFirst = (firstName || '').trim();
    const cleanLast = (lastName || '').trim();
    const rawFullName = `${cleanFirst} ${cleanLast}`.trim();

    if (!rawFullName) return;

    if (submissionId) {
      if (state.seenSubmissionIds.has(submissionId)) return;
      state.seenSubmissionIds.add(submissionId);
      saveSeenIds();
    }

    const doctorName = formatDoctorName(rawFullName);

    // Add to submission spotlight queue
    state.submissionQueue.push({
      fullName: doctorName,
      id: submissionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    });

    // Add to permanent floating rain and grid list
    const added = addSubmittedName(doctorName);

    // If currently on grid view, re-render to show the new name shape.
    if (added && state.currentView === 'grid') {
      renderGrid();
    }

    // Trigger spotlight if not currently spotlighting another doctor
    if (!state.isSpotlightActive) {
      processNextSubmission();
    }
  }

  function processNextSubmission() {
    if (state.submissionQueue.length === 0) {
      state.isSpotlightActive = false;
      return;
    }

    state.isSpotlightActive = true;

    const submission = state.submissionQueue.shift();

    // 1. Idle claim fades out
    dom.claimView.classList.remove('is-active');
    dom.claimView.classList.add('is-exiting');

    setTimeout(() => {
      // 2. Doctor Name fades in: Top line Dr. [Name], Bottom line "I trust Panadol"
      dom.spotlightName.textContent = submission.fullName;
      dom.nameView.classList.remove('is-exiting');
      dom.nameView.classList.add('is-active');

      // 3. Stays still for 10 seconds
      setTimeout(() => {
        // Spotlight name fades out
        dom.nameView.classList.remove('is-active');
        dom.nameView.classList.add('is-exiting');

        setTimeout(() => {
          dom.nameView.classList.remove('is-exiting');

          // If there is another queued submission, process it next
          if (state.submissionQueue.length > 0) {
            processNextSubmission();
          } else {
            // Return to idle claim "I trust Panadol"
            dom.claimView.classList.remove('is-exiting');
            dom.claimView.classList.add('is-active');
            state.isSpotlightActive = false;
          }
        }, 600);

      }, NAME_SPOTLIGHT_DURATION);

    }, 500);
  }

  // =========================================================================
  // Raining Names Engine (Names Fall Downward Like Glowing Rain)
  // =========================================================================
  const RAIN_VISIBLE_FRACTION = 0.7;

  function addSubmittedName(nameString, skipAnimation = false) {
    if (!nameString) return false;

    if (state.submittedNames.includes(nameString)) return false;
    state.submittedNames.push(nameString);
    saveSubmittedNames();
    updateCounterBadges();
    spawnFloatingBadge(nameString, skipAnimation);
    return true;
  }

  function updateCounterBadges() {
    const total = state.submittedNames.length;
    if (dom.namesCountBadge) {
      dom.namesCountBadge.textContent = total;
    }
  }

  function spawnFloatingBadge(nameString, isRestored = false) {
    const labelEl = document.createElement('div');
    labelEl.className = 'name-rain-label';
    if (!isRestored) labelEl.classList.add('newly-spawned');

    // Display the formatted Doctor name
    labelEl.textContent = nameString;

    dom.rainingContainer.appendChild(labelEl);

    // Random horizontal position across screen width
    const relX = 0.04 + Math.random() * 0.88;

    // Rain start position
    const startRelY = isRestored
      ? (Math.random() * 1.0)
      : (-0.05 - Math.random() * 0.15);

    const badgeObj = {
      el: labelEl,
      name: nameString,
      active: false,
      relX: relX,
      relY: startRelY,
      // Fall speed
      fallSpeed: 0.0003 + Math.random() * 0.0005,
      // Subtle horizontal sway for organic movement
      swayAmplitude: 4 + Math.random() * 8,
      swayFrequency: 0.0008 + Math.random() * 0.0015,
      swayPhase: Math.random() * Math.PI * 2,
      scale: 0.9 + Math.random() * 0.2,
      opacity: 0.88 + Math.random() * 0.12 // Increased opacity for raining names
    };

    labelEl.style.opacity = badgeObj.opacity;
    labelEl.style.display = 'none';
    state.floatingBadges.push(badgeObj);
    updateRainBadgeCount(badgeObj);
  }

  function updateRainBadgeCount(newBadge) {
    const badges = state.floatingBadges;
    const target = Math.max(1, Math.round(badges.length * RAIN_VISIBLE_FRACTION));
    let activeCount = badges.filter(badge => badge.active).length;

    // New submissions join the rain immediately, even when the target count
    // has not increased.
    if (newBadge && activeCount >= target) {
      const outgoing = badges
        .filter(badge => badge.active)
        .reduce((lowest, badge) => badge.relY > lowest.relY ? badge : lowest);
      outgoing.active = false;
      outgoing.el.style.display = 'none';
      activeCount--;
    }

    while (activeCount < target) {
      const badge = newBadge && !newBadge.active
        ? newBadge
        : badges.find(candidate => !candidate.active);
      if (!badge) break;
      badge.active = true;
      badge.el.style.display = '';
      activeCount++;
    }
  }

  function nextInactiveRainBadge(exclude) {
    const badges = state.floatingBadges;
    for (let step = 0; step < badges.length; step++) {
      const index = (state.nextRainBadgeIndex + step) % badges.length;
      const candidate = badges[index];
      if (!candidate.active && candidate !== exclude) {
        state.nextRainBadgeIndex = (index + 1) % badges.length;
        return candidate;
      }
    }
    return null;
  }

  function animateFloatingBadges() {
    const scale = state.currentScale || 1.0;
    const vHeight = window.innerHeight;
    const vWidth = window.innerWidth;

    // Center zone exclusion half-dimensions (dim names behind center text)
    const centerAvoid = {
      halfW: 520 * scale,
      halfH: 150 * scale
    };

    for (let i = 0; i < state.floatingBadges.length; i++) {
      const b = state.floatingBadges[i];
      if (!b.active) continue;

      // Steady downward fall
      b.relY += b.fallSpeed;

      // Rotate in another submitted name after each fall so every name
      // appears over time while only 70% are in the rain at once.
      if (b.relY > 1.08) {
        const replacement = nextInactiveRainBadge(b);
        if (replacement) {
          b.active = false;
          b.el.style.display = 'none';
          replacement.active = true;
          replacement.el.style.display = '';
          replacement.relY = -0.06 - Math.random() * 0.10;
          replacement.relX = 0.04 + Math.random() * 0.88;
          continue;
        }
        b.relY = -0.06 - Math.random() * 0.10;
        b.relX = 0.04 + Math.random() * 0.88;
      }

      // Gentle horizontal sway
      b.swayPhase += b.swayFrequency;
      const swayX = Math.sin(b.swayPhase) * (b.swayAmplitude * scale);

      const currentX = Math.max(0, Math.min(
        b.relX * vWidth + swayX,
        vWidth - b.el.offsetWidth * b.scale - 8
      ));
      const currentY = b.relY * vHeight;

      // Subtle opacity reduction when passing directly behind center text
      let opacityFactor = 1.0;
      if (
        Math.abs(currentX - vWidth * 0.5) < centerAvoid.halfW &&
        Math.abs(currentY - vHeight * 0.5) < centerAvoid.halfH
      ) {
        opacityFactor = 0.12;
      }

      b.el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${b.scale})`;
      b.el.style.opacity = b.opacity * opacityFactor;
    }

    requestAnimationFrame(animateFloatingBadges);
  }

  // =========================================================================
  // Grid View Management (Toggle between Rain View & Grid View)
  // =========================================================================
  function toggleView() {
    state.currentView = state.currentView === 'rain' ? 'grid' : 'rain';
    applyViewMode();
  }

  function applyViewMode() {
    if (state.currentView === 'grid') {
      document.body.classList.add('view-mode-grid');
      if (dom.toggleText) dom.toggleText.textContent = 'Rain View';
      if (dom.toggleIcon) dom.toggleIcon.innerHTML = RAIN_ICON_SVG;
      if (dom.viewToggleBtn) dom.viewToggleBtn.title = 'Switch to Rain View';
      renderGrid();
    } else {
      document.body.classList.remove('view-mode-grid');
      if (dom.toggleText) dom.toggleText.textContent = 'Grid View';
      if (dom.toggleIcon) dom.toggleIcon.innerHTML = GRID_ICON_SVG;
      if (dom.viewToggleBtn) dom.viewToggleBtn.title = 'Switch to Grid View';
    }
  }

  function renderGrid() {
    const container = dom.gridNamesContainer;
    const emptyMessage = dom.gridEmptyMessage;
    if (!container) return;

    container.innerHTML = '';
    const total = state.submittedNames.length;
    updateCounterBadges();

    if (total === 0) {
      container.style.display = 'none';
      if (emptyMessage) emptyMessage.style.display = 'flex';
      return;
    }

    container.style.display = 'block';
    if (emptyMessage) emptyMessage.style.display = 'none';

    // Randomize display order without changing the saved submission order.
    const gridNames = [...state.submittedNames];
    for (let i = gridNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gridNames[i], gridNames[j]] = [gridNames[j], gridNames[i]];
    }

    const field = document.createElement('div');
    field.className = 'grid-name-field';
    container.appendChild(field);

    gridNames.forEach((doctorName, idx) => {
      const item = document.createElement('div');
      item.className = `grid-floating-name size-${(idx % 3) + 1}`;
      item.style.animationDelay = `${Math.min(idx * 0.03, 0.8)}s`;

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = doctorName;

      item.appendChild(name);
      field.appendChild(item);
    });

    scatterGridNames(container, field);
  }

  function scatterGridNames(container, field) {
    const scale = state.currentScale || 1;
    const items = Array.from(field.children);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    function measure(density) {
      field.style.setProperty('--grid-scale', (scale * density).toFixed(5));
      const edge = Math.max(1, 12 * scale * density);
      const horizontalGap = Math.max(1, 16 * scale * density);
      const verticalGap = Math.max(1, 12 * scale * density);
      const usableWidth = Math.max(1, width - edge * 2);
      const usableHeight = Math.max(1, height - edge * 2);
      let widest = 0;
      let tallest = 0;

      items.forEach(item => {
        item.style.maxWidth = `${Math.max(1, Math.min(usableWidth - horizontalGap, 320 * scale))}px`;
        widest = Math.max(widest, item.offsetWidth);
        tallest = Math.max(tallest, item.offsetHeight);
      });

      const columns = Math.max(1, Math.min(items.length,
        Math.floor((usableWidth + horizontalGap) / (widest + horizontalGap))));
      const rows = Math.ceil(items.length / columns);
      const cellWidth = usableWidth / columns;
      const cellHeight = usableHeight / rows;
      return {
        edge, columns, rows, cellWidth, cellHeight,
        fits: widest + horizontalGap <= cellWidth && tallest + verticalGap <= cellHeight
      };
    }

    // Use the largest readable size that places every name inside the viewport.
    let density = 0.82;
    let layout = measure(density);
    if (!layout.fits) {
      let lower = 0.01;
      let upper = density;
      for (let attempt = 0; attempt < 12; attempt++) {
        const middle = (lower + upper) / 2;
        const candidate = measure(middle);
        if (candidate.fits) lower = middle;
        else upper = middle;
      }
      density = lower;
      layout = measure(density);
    }

    const slots = Array.from({ length: layout.columns * layout.rows }, (_, index) => index);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    items.forEach((item, index) => {
      const slot = slots[index];
      const column = slot % layout.columns;
      const row = Math.floor(slot / layout.columns);
      const xJitter = Math.max(0, layout.cellWidth - item.offsetWidth);
      const yJitter = Math.max(0, layout.cellHeight - item.offsetHeight);
      item.style.left = `${layout.edge + column * layout.cellWidth + Math.random() * xJitter}px`;
      item.style.top = `${layout.edge + row * layout.cellHeight + Math.random() * yJitter}px`;
    });

    field.style.height = `${height}px`;
  }

  // =========================================================================
  // Persistence (Keeps all submitted names on screen permanently)
  // =========================================================================
  function loadPersistedData() {
    try {
      // Migrate or load from v4, fallback to v3
      let savedNames = localStorage.getItem(STORAGE_KEY_NAMES);
      if (!savedNames) {
        savedNames = localStorage.getItem('panadol_live_submitted_names_v3');
      }

      if (savedNames) {
        const rawList = JSON.parse(savedNames) || [];
        // Ensure all names have the "Dr. " prefix
        state.submittedNames = rawList.map(name => formatDoctorName(name));
        // Remove duplicates if any
        state.submittedNames = Array.from(new Set(state.submittedNames));
        saveSubmittedNames();

        state.submittedNames.forEach(name => spawnFloatingBadge(name, true));
      }
    } catch (e) {
      console.warn('Could not load persisted names:', e);
    }

    try {
      let savedIds = localStorage.getItem(STORAGE_KEY_SEEN_IDS);
      if (!savedIds) {
        savedIds = localStorage.getItem('panadol_seen_submission_ids_v3');
      }
      if (savedIds) {
        state.seenSubmissionIds = new Set(JSON.parse(savedIds) || []);
      }
    } catch (e) {
      console.warn('Could not load seen submission IDs:', e);
    }

    updateCounterBadges();
  }

  function saveSubmittedNames() {
    try {
      localStorage.setItem(STORAGE_KEY_NAMES, JSON.stringify(state.submittedNames));
    } catch (e) {}
  }

  function saveSeenIds() {
    try {
      localStorage.setItem(STORAGE_KEY_SEEN_IDS, JSON.stringify(Array.from(state.seenSubmissionIds)));
    } catch (e) {}
  }

  // =========================================================================
  // Jotform Integration (Extracts #first_3, #last_3 or {name})
  // =========================================================================
  function extractFormId(input) {
    if (!input || input.includes('PASTE_YOUR_')) return '';
    const match = input.match(/\d{5,}/);
    return match ? match[0] : input.trim();
  }

  async function pollJotform() {
    const formId = extractFormId(JOTFORM_CONFIG.formLinkOrId);
    const apiKey = (JOTFORM_CONFIG.apiKey || '').trim();

    if (!formId || !apiKey || apiKey.includes('PASTE_YOUR_') || state.pollInProgress) {
      return;
    }

    state.pollInProgress = true;
    try {
      const pageSize = 100;
      const isHistoryLoad = !state.hasLoadedSubmissionHistory;
      const submissions = [];
      let offset = 0;

      // Load every page once at startup. Later checks stop at the first known
      // submission, but continue across pages if more than one page is new.
      while (true) {
        const endpoint = `https://api.jotform.com/form/${encodeURIComponent(formId)}/submissions?apiKey=${encodeURIComponent(apiKey)}&limit=${pageSize}&offset=${offset}&orderby=created_at`;
        const response = await fetch(endpoint, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return;
        const data = await response.json();
        if (data.responseCode !== 200 || !Array.isArray(data.content)) return;

        const page = data.content;
        const reachedKnownSubmission = page.some(item => state.seenSubmissionIds.has(item.id));
        submissions.push(...page);

        if (page.length < pageSize || (!isHistoryLoad && reachedKnownSubmission)) break;
        offset += page.length;
      }

      // Process oldest first. History fills both views without making the
      // spotlight replay every submission ever received.
      let namesChanged = false;
      submissions.reverse().forEach((item, index) => {
        const nameData = extractNameFromSubmission(item);
        if (nameData && (nameData.first || nameData.last)) {
          if (addSubmittedName(formatDoctorName(`${nameData.first} ${nameData.last}`.trim()))) {
            namesChanged = true;
          }
          if (!state.seenSubmissionIds.has(item.id)) {
            const isRecent = !isHistoryLoad || index >= submissions.length - 15;
            if (isRecent) {
              queueSubmission(nameData.first, nameData.last, item.id);
            } else {
              state.seenSubmissionIds.add(item.id);
            }
          }
        } else if (item.id) {
          state.seenSubmissionIds.add(item.id);
        }
      });

      saveSeenIds();
      state.hasLoadedSubmissionHistory = true;
      if (namesChanged && state.currentView === 'grid') renderGrid();

    } catch (err) {
      console.warn('Jotform check:', err);
    } finally {
      state.pollInProgress = false;
    }
  }

  function extractNameFromSubmission(subObj) {
    const answers = subObj.answers || {};

    // 1. Question 3 (#first_3, #last_3)
    if (answers['3']) {
      const q3 = answers['3'];
      if (q3.answer && typeof q3.answer === 'object') {
        return { first: q3.answer.first || '', last: q3.answer.last || '' };
      }
      if (typeof q3.answer === 'string') {
        const parts = q3.answer.trim().split(/\s+/);
        return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
      }
    }

    // 2. Search by unique name {name}
    for (const key in answers) {
      const field = answers[key];
      if (field.name === 'name' || (field.text && field.text.toLowerCase() === 'name')) {
        if (field.answer && typeof field.answer === 'object') {
          return { first: field.answer.first || '', last: field.answer.last || '' };
        }
        if (typeof field.answer === 'string') {
          const parts = field.answer.trim().split(/\s+/);
          return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
        }
      }
    }

    return null;
  }

  // =========================================================================
  // URL Parameter Listener (e.g. ?first=Ahmed&last=Ali or Jotform Redirect)
  // =========================================================================
  function initUrlListener() {
    const params = new URLSearchParams(window.location.search);
    const first = params.get('first') || params.get('first_3') || params.get('firstName');
    const last = params.get('last') || params.get('last_3') || params.get('lastName');
    const name = params.get('name');

    if (first || last) {
      setTimeout(() => queueSubmission(first || '', last || ''), 800);
    } else if (name) {
      const parts = name.trim().split(/\s+/);
      setTimeout(() => queueSubmission(parts[0], parts.slice(1).join(' ')), 800);
    }
  }

  // =========================================================================
  // Initialization
  // =========================================================================
  function init() {
    updateResponsiveScale();
    loadPersistedData();

    window.addEventListener('resize', updateResponsiveScale);
    window.addEventListener('orientationchange', updateResponsiveScale);

    // Setup view toggle button
    if (dom.viewToggleBtn) {
      dom.viewToggleBtn.addEventListener('click', toggleView);
    }

    // Keyboard shortcut: Press 'v' or 'g' to toggle view
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'v' || e.key === 'V' || e.key === 'g' || e.key === 'G') {
        toggleView();
      }
    });

    initUrlListener();

    // Start Jotform polling
    pollJotform();
    state.pollTimer = setInterval(pollJotform, JOTFORM_CONFIG.pollingIntervalMs || 2500);

    // Start floating names rain animation loop
    requestAnimationFrame(animateFloatingBadges);

    // Start glowing rain streaks canvas
    initGlowRain();

    // Allow testing from browser console: testSubmit('John', 'Doe')
    window.testSubmit = (first, last) => queueSubmission(first, last);
    window.toggleView = toggleView;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
