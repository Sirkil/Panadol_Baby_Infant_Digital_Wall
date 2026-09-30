/**
 * Panadol - Live Community Display Screen
 * 
 * Features:
 * 1. Top bar with all logos side-by-side with spaces in between.
 * 2. Submission spotlight in center:
 *    - Top line: Dr. [Name]
 *    - Bottom line: "I trust Panadol"
 *    - Displayed for 10 seconds.
 *    - All other claims removed (sole claim is "I trust Panadol").
 * 3. View Switcher button:
 *    - Toggles between Rain View and Grid View (showing all submitted doctor names).
 * 4. Glowing Rain streaks & falling names over #0f0087 to #052fce gradient background.
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

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const dom = {
    claimView: document.getElementById('claimView'),
    claimText: document.getElementById('claimText'),
    nameView: document.getElementById('nameView'),
    spotlightName: document.getElementById('spotlightName'),
    spotlightSubClaim: document.getElementById('spotlightSubClaim'),
    rainingContainer: document.getElementById('rainingContainer'),
    glowRainCanvas: document.getElementById('glowRainCanvas'),
    viewToggleBtn: document.getElementById('viewToggleBtn'),
    toggleIcon: document.getElementById('toggleIcon'),
    toggleText: document.getElementById('toggleText'),
    namesCountBadge: document.getElementById('namesCountBadge'),
    gridViewSection: document.getElementById('gridViewSection'),
    gridCardsContainer: document.getElementById('gridCardsContainer'),
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
    currentScale: 1.0,
    pollTimer: null,
    rainStreaks: [],
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

    requestAnimationFrame(renderGlowRain);
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
    addSubmittedName(doctorName);

    // If currently on grid view, re-render grid to show new doctor card
    if (state.currentView === 'grid') {
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
      if (dom.spotlightSubClaim) {
        dom.spotlightSubClaim.textContent = 'I trust Panadol';
      }

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
            dom.claimText.textContent = 'I trust Panadol';
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
  function addSubmittedName(nameString, skipAnimation = false) {
    if (!nameString) return;

    if (!state.submittedNames.includes(nameString)) {
      state.submittedNames.push(nameString);
      saveSubmittedNames();
      updateCounterBadges();
    }

    spawnFloatingBadge(nameString, skipAnimation);
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
    state.floatingBadges.push(badgeObj);
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

      // Steady downward fall
      b.relY += b.fallSpeed;

      // When a name falls past the bottom, respawn it at the top
      if (b.relY > 1.08) {
        b.relY = -0.06 - Math.random() * 0.10;
        b.relX = 0.04 + Math.random() * 0.88;
      }

      // Gentle horizontal sway
      b.swayPhase += b.swayFrequency;
      const swayX = Math.sin(b.swayPhase) * (b.swayAmplitude * scale);

      const currentX = b.relX * vWidth + swayX;
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
    const container = dom.gridCardsContainer;
    const emptyMessage = dom.gridEmptyMessage;
    if (!container) return;

    container.innerHTML = '';
    const total = state.submittedNames.length;
    updateCounterBadges();

    if (total === 0) {
      if (emptyMessage) emptyMessage.style.display = 'flex';
      return;
    }

    if (emptyMessage) emptyMessage.style.display = 'none';

    // Render cards for all submitted doctors
    state.submittedNames.forEach((doctorName, idx) => {
      const card = document.createElement('div');
      card.className = 'doctor-card';
      card.style.animationDelay = `${Math.min(idx * 0.03, 0.8)}s`;

      card.innerHTML = `
        <div class="doctor-card-avatar" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="doctor-card-info">
          <div class="doctor-card-name" title="${escapeHTML(doctorName)}">${escapeHTML(doctorName)}</div>
          <div class="doctor-card-trust">Trusts Panadol</div>
        </div>
      `;

      container.appendChild(card);
    });
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

    if (!formId || !apiKey || apiKey.includes('PASTE_YOUR_')) {
      return;
    }

    try {
      const endpoint = `https://api.jotform.com/form/${encodeURIComponent(formId)}/submissions?apiKey=${encodeURIComponent(apiKey)}&limit=15&orderby=created_at`;
      const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.responseCode !== 200 || !data.content) return;

      const submissions = data.content || [];
      const newItems = [];

      for (const item of submissions) {
        const subId = item.id;
        if (!state.seenSubmissionIds.has(subId)) {
          const nameData = extractNameFromSubmission(item);
          if (nameData && (nameData.first || nameData.last)) {
            newItems.push({
              id: subId,
              first: nameData.first,
              last: nameData.last
            });
          } else {
            state.seenSubmissionIds.add(subId);
            saveSeenIds();
          }
        }
      }

      // Queue submissions in chronological order
      newItems.reverse().forEach(item => {
        queueSubmission(item.first, item.last, item.id);
      });

    } catch (err) {
      console.warn('Jotform check:', err);
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
  // Helper
  // =========================================================================
  function escapeHTML(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
