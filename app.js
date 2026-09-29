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
    rainingContainer: document.getElementById('rainingContainer')
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
    pollTimer: null
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
  // Raining / Floating Names Engine (Pills Flowing Up & Down)
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
    const badgeEl = document.createElement('div');
    badgeEl.className = 'name-badge-pill';
    if (!isRestored) badgeEl.classList.add('newly-spawned');

    // Display only the submitted name (no icon)
    badgeEl.innerHTML = `<span class="pill-name">${escapeHTML(nameString)}</span>`;

    dom.rainingContainer.appendChild(badgeEl);

    // Relative coordinates across screen
    const relX = 0.06 + Math.random() * 0.84;
    const relY = isRestored 
      ? (0.08 + Math.random() * 0.80)
      : (0.35 + Math.random() * 0.35);

    const badgeObj = {
      el: badgeEl,
      name: nameString,
      relX: relX,
      baseRelY: relY,
      // Dynamic vertical flow speed (visibly flows up and down across the screen)
      speedRelY: 0.00085 + Math.random() * 0.00075,
      amplitude: 35 + Math.random() * 45,
      frequency: 0.0020 + Math.random() * 0.0018,
      phase: Math.random() * Math.PI * 2,
      driftXAmp: 14 + Math.random() * 18,
      scale: 0.95 + Math.random() * 0.15,
      opacity: 0.80 + Math.random() * 0.18,
      direction: Math.random() > 0.5 ? 1 : -1
    };

    badgeEl.style.opacity = badgeObj.opacity;
    state.floatingBadges.push(badgeObj);
  }

  function animateFloatingBadges() {
    const scale = state.currentScale || 1.0;
    const vHeight = window.innerHeight;
    const vWidth = window.innerWidth;

    // Center zone exclusion half-dimensions
    const centerAvoid = {
      halfW: 600 * scale,
      halfH: 160 * scale
    };

    for (let i = 0; i < state.floatingBadges.length; i++) {
      const b = state.floatingBadges[i];
      b.phase += b.frequency * 60;
      
      // Continuous vertical rain drift in normalized coordinates
      b.baseRelY += b.speedRelY * b.direction;

      // Smooth turnaround when reaching screen top or bottom boundaries
      if (b.baseRelY < 0.05) {
        b.baseRelY = 0.05;
        b.direction = 1;
      } else if (b.baseRelY > 0.92) {
        b.baseRelY = 0.92;
        b.direction = -1;
      }

      const waveY = Math.sin(b.phase) * (b.amplitude * scale);
      const waveX = Math.cos(b.phase * 0.8) * (b.driftXAmp * scale);

      const currentX = b.relX * vWidth + waveX;
      const currentY = b.baseRelY * vHeight + waveY;

      // Subtle opacity reduction when passing directly behind center text
      let opacityFactor = 1.0;
      if (
        Math.abs(currentX - vWidth * 0.5) < centerAvoid.halfW &&
        Math.abs(currentY - vHeight * 0.5) < centerAvoid.halfH
      ) {
        opacityFactor = 0.16;
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
