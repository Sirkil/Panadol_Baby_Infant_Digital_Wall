/**
 * Panadol - Live Community Display Screen
 * 
 * Flow:
 * Initially: Displays rotating claims in the center of the screen
 * On submission:
 *   1. Claim fades out
 *   2. Submitted Name fades in, stays still for 3 seconds
 *   3. Name fades out, next claim fades in ("claim name claim name claim")
 *   4. Name transitions to the canvas and flows up and down as rain
 *   5. Keeps all submitted names shown on screen permanently
 *
 * Visual:
 *   - Glowing rain streaks rendered on <canvas>
 *   - Names displayed as labels falling with the rain
 */

// =========================================================================
// ⚙️ JOTFORM CONFIGURATION (Enter your Form details here)
// =========================================================================
const JOTFORM_CONFIG = {
  // 1. Paste your Jotform Link OR Form ID:
  // Examples: "https://form.jotform.com/240982348239055" or "240982348239055"
  formLinkOrId: 'https://form.jotform.com/262711631992056',

  // 2. Paste your Jotform API Key (Read Access from jotform.com/myaccount/api):
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
  // Claims & Timing Configuration
  // =========================================================================
  const CLAIMS = [
    'Gets to work on FEVER in 15 mins',
    'We Love Panadol',
    'Starts to relieve Fever in 15 mins',
    'I trust Panadol',
    'innovative Formula'
  ];

  const CLAIM_CYCLE_DURATION = 10000;    // 6s display per claim during idle
  const NAME_SPOTLIGHT_DURATION = 3000; // Stays still for 3 seconds
  const CLAIM_INTERLUDE_DURATION = 2500;// Brief claim display between consecutive names
  const STORAGE_KEY_NAMES = 'panadol_live_submitted_names_v3';
  const STORAGE_KEY_SEEN_IDS = 'panadol_seen_submission_ids_v3';

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const dom = {
    claimView: document.getElementById('claimView'),
    claimText: document.getElementById('claimText'),
    nameView: document.getElementById('nameView'),
    spotlightName: document.getElementById('spotlightName'),
    rainingContainer: document.getElementById('rainingContainer'),
    glowRainCanvas: document.getElementById('glowRainCanvas')
  };

  // =========================================================================
  // Application State
  // =========================================================================
  const state = {
    currentClaimIndex: 0,
    claimTimer: null,
    isSpotlightActive: false,
    submissionQueue: [],
    submittedNames: [],
    seenSubmissionIds: new Set(),
    floatingBadges: [],
    currentScale: 1.0,
    pollTimer: null,
    rainStreaks: []
  };

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

    const STREAK_COUNT = 120; // Number of rain streaks

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
      speed: (1.5 + Math.random() * 4.0) * scale,
      length: (40 + Math.random() * 120) * scale,
      width: (0.8 + Math.random() * 1.8) * scale,
      opacity: 0.15 + Math.random() * 0.6,
      // Color variation — mostly white/pink
      hue: Math.random() > 0.3 ? 330 : 0, // 330 = magenta/pink, 0 = white-ish
      brightness: 0.7 + Math.random() * 0.3
    };
  }

  function renderGlowRain() {
    const canvas = dom.glowRainCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear the canvas
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < state.rainStreaks.length; i++) {
      const s = state.rainStreaks[i];

      // Move streak downward
      s.y += s.speed;

      // If streak falls past bottom, respawn at top
      if (s.y > h + s.length) {
        s.x = Math.random() * w;
        s.y = -s.length - Math.random() * 200;
        s.speed = (1.5 + Math.random() * 4.0) * state.currentScale;
      }

      // Draw the glowing streak
      const gradient = ctx.createLinearGradient(s.x, s.y - s.length, s.x, s.y);
      gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
      gradient.addColorStop(0.3, `rgba(255, 200, 230, ${s.opacity * 0.3})`);
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${s.opacity * 0.7})`);
      gradient.addColorStop(1, `rgba(234, 82, 151, ${s.opacity * 0.9})`);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.length);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw glow at the tip
      const glowRadius = s.width * 3;
      const tipGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowRadius);
      tipGlow.addColorStop(0, `rgba(255, 255, 255, ${s.opacity * 0.6})`);
      tipGlow.addColorStop(0.5, `rgba(234, 82, 151, ${s.opacity * 0.3})`);
      tipGlow.addColorStop(1, `rgba(234, 82, 151, 0)`);

      ctx.beginPath();
      ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = tipGlow;
      ctx.fill();
    }

    requestAnimationFrame(renderGlowRain);
  }

  // =========================================================================
  // Claims Engine (Pure Clean Typography, Single Uniform Color)
  // =========================================================================
  function formatClaimText(text) {
    return escapeHTML(text);
  }

  function showClaim(index) {
    if (state.isSpotlightActive) return;

    state.currentClaimIndex = index % CLAIMS.length;
    const claim = CLAIMS[state.currentClaimIndex];

    dom.claimView.classList.remove('is-active');
    dom.claimView.classList.add('is-exiting');

    setTimeout(() => {
      dom.claimText.innerHTML = formatClaimText(claim);
      dom.claimView.classList.remove('is-exiting');
      dom.claimView.classList.add('is-active');
    }, 400);

    clearTimeout(state.claimTimer);
    state.claimTimer = setTimeout(() => {
      if (!state.isSpotlightActive) {
        showClaim((state.currentClaimIndex + 1) % CLAIMS.length);
      }
    }, CLAIM_CYCLE_DURATION);
  }

  // =========================================================================
  // Submission Flow ("claim name claim name claim")
  // =========================================================================
  function queueSubmission(firstName, lastName, submissionId = null) {
    const cleanFirst = (firstName || '').trim();
    const cleanLast = (lastName || '').trim();
    const fullName = `${cleanFirst} ${cleanLast}`.trim();

    if (!fullName) return;

    if (submissionId) {
      if (state.seenSubmissionIds.has(submissionId)) return;
      state.seenSubmissionIds.add(submissionId);
      saveSeenIds();
    }

    state.submissionQueue.push({
      fullName: fullName,
      id: submissionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    });

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
    clearTimeout(state.claimTimer);

    const submission = state.submissionQueue.shift();

    // 1. Current claim fades out
    dom.claimView.classList.remove('is-active');
    dom.claimView.classList.add('is-exiting');

    setTimeout(() => {
      // 2. Name fades in (center)
      dom.spotlightName.textContent = submission.fullName;
      dom.nameView.classList.remove('is-exiting');
      dom.nameView.classList.add('is-active');

      // 3. Stays still for 3 seconds
      setTimeout(() => {
        // Name fades out
        dom.nameView.classList.remove('is-active');
        dom.nameView.classList.add('is-exiting');

        // Add to permanent floating rain list
        addSubmittedName(submission.fullName);

        setTimeout(() => {
          // 4. Next claim fades in ("claim name claim name claim")
          state.currentClaimIndex = (state.currentClaimIndex + 1) % CLAIMS.length;
          const nextClaim = CLAIMS[state.currentClaimIndex];
          dom.claimText.innerHTML = formatClaimText(nextClaim);

          dom.nameView.classList.remove('is-exiting');
          dom.claimView.classList.remove('is-exiting');
          dom.claimView.classList.add('is-active');

          if (state.submissionQueue.length > 0) {
            // Show claim briefly between names
            state.claimTimer = setTimeout(() => {
              processNextSubmission();
            }, CLAIM_INTERLUDE_DURATION);
          } else {
            // Return to regular claim cycling
            state.isSpotlightActive = false;
            state.claimTimer = setTimeout(() => {
              if (!state.isSpotlightActive) {
                showClaim((state.currentClaimIndex + 1) % CLAIMS.length);
              }
            }, CLAIM_CYCLE_DURATION);
          }
        }, 550);

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
    }

    spawnFloatingBadge(nameString, skipAnimation);
  }

  function spawnFloatingBadge(nameString, isRestored = false) {
    const labelEl = document.createElement('div');
    labelEl.className = 'name-rain-label';
    if (!isRestored) labelEl.classList.add('newly-spawned');

    // Display only the submitted name
    labelEl.textContent = nameString;

    dom.rainingContainer.appendChild(labelEl);

    // Random horizontal position across screen width
    const relX = 0.04 + Math.random() * 0.88;

    // Rain start position: restored names scatter across the screen,
    // new names start above the visible area and fall in
    const startRelY = isRestored
      ? (Math.random() * 1.0)   // Scatter across full height on restore
      : (-0.05 - Math.random() * 0.15); // Start just above the top edge

    const badgeObj = {
      el: labelEl,
      name: nameString,
      relX: relX,
      relY: startRelY,
      // Fall speed — each name falls at a slightly different rate (like real rain)
      fallSpeed: 0.0003 + Math.random() * 0.0005,
      // Subtle horizontal sway for organic movement
      swayAmplitude: 4 + Math.random() * 8,
      swayFrequency: 0.0008 + Math.random() * 0.0015,
      swayPhase: Math.random() * Math.PI * 2,
      scale: 0.9 + Math.random() * 0.2,
      opacity: 0.55 + Math.random() * 0.35
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
      halfW: 500 * scale,
      halfH: 140 * scale
    };

    for (let i = 0; i < state.floatingBadges.length; i++) {
      const b = state.floatingBadges[i];

      // ---- RAIN: Steady downward fall ----
      b.relY += b.fallSpeed;

      // When a name falls past the bottom, respawn it at the top
      // with a new random X position for variety
      if (b.relY > 1.08) {
        b.relY = -0.06 - Math.random() * 0.10;
        b.relX = 0.04 + Math.random() * 0.88;
      }

      // Gentle horizontal sway (subtle, like wind on rain)
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
  // Persistence (Keeps all submitted names on screen)
  // =========================================================================
  function loadPersistedData() {
    try {
      const savedNames = localStorage.getItem(STORAGE_KEY_NAMES);
      if (savedNames) {
        state.submittedNames = JSON.parse(savedNames) || [];
        state.submittedNames.forEach(name => spawnFloatingBadge(name, true));
      }
    } catch (e) {}

    try {
      const savedIds = localStorage.getItem(STORAGE_KEY_SEEN_IDS);
      if (savedIds) {
        state.seenSubmissionIds = new Set(JSON.parse(savedIds) || []);
      }
    } catch (e) {}
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
      return; // Waiting for user to configure credentials
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
    return str
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

    initUrlListener();

    // Start initial Claim display
    showClaim(0);

    // Start Jotform polling
    pollJotform();
    state.pollTimer = setInterval(pollJotform, JOTFORM_CONFIG.pollingIntervalMs || 2500);

    // Start floating names rain animation loop
    requestAnimationFrame(animateFloatingBadges);

    // Start glowing rain streaks canvas
    initGlowRain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
