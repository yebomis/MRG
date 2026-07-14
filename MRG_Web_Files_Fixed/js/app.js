/**
 * MRG Experiment - Main Application
 * Orchestrates the entire experiment flow
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────
  const state = {
    participantId: null,
    cloudResearchId: '',
    conditionNumber: null,
    condition: null,
    currentRound: 1,
    progressStep: 0,
    totalReward: 0,
    rounds: {
      1: { turn1Choice: null, turn1Rt: null, turn3Choice: null, turn3Rt: null, participantReward: 0, aiReward: 0 },
      2: { turn1Choice: null, turn1Rt: null, turn3Choice: null, turn3Rt: null, participantReward: 0, aiReward: 0 }
    },
    timestamps: {}
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Screen Management ─────────────────────────────────────
  function showScreen(screenId) {
    $$('.screen').forEach(s => { s.classList.remove('active', 'fade-in'); });
    const screen = $(`#${screenId}`);
    if (screen) {
      screen.classList.add('active');
      void screen.offsetWidth;
      screen.classList.add('fade-in');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setProgress(step) {
    state.progressStep = step;
    const pct = (step / CONFIG.TOTAL_PROGRESS_STEPS) * 100;
    $('#progress-fill').style.width = `${pct}%`;
  }

  function freshButton(selector) {
    const btn = $(selector);
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    return newBtn;
  }

  // ─── Dwell Timer Helper ──────────────────────────────────────
  let activeDwellTimer = null;
  let activeChoiceInterval = null;

  function applyDwellTime(selectors, labelFn) {
    if (activeDwellTimer) {
      clearInterval(activeDwellTimer);
      activeDwellTimer = null;
    }
    if (activeChoiceInterval) {
      clearInterval(activeChoiceInterval);
      activeChoiceInterval = null;
    }
    const buttons = selectors.map(sel => $(sel)).filter(el => el !== null);
    if (buttons.length === 0) return;

    buttons.forEach(btn => {
      btn.disabled = true;
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
      }
    });

    let remaining = Math.ceil(CONFIG.MIN_DWELL_TIME / 1000);

    const updateLabels = () => {
      buttons.forEach(btn => {
        btn.textContent = labelFn(btn.dataset.originalText, remaining);
      });
    };

    updateLabels();

    activeDwellTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(activeDwellTimer);
        activeDwellTimer = null;
        buttons.forEach(btn => {
          btn.textContent = btn.dataset.originalText;
          btn.disabled = false;
        });
      } else {
        updateLabels();
      }
    }, 1000);
  }

  // ─── Choice Timer Helper (60s limit, 15s min) ───────────────
  function startChoiceTimer(screenId, buttonSelectors, onTimeout) {
    if (activeChoiceInterval) {
      clearInterval(activeChoiceInterval);
      activeChoiceInterval = null;
    }
    if (activeDwellTimer) {
      clearInterval(activeDwellTimer);
      activeDwellTimer = null;
    }

    const screenCard = $(`#${screenId} .card`);
    if (!screenCard) return;

    // Inject timer element if not exists
    let timerEl = screenCard.querySelector('.choice-timer');
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.className = 'choice-timer';
      screenCard.appendChild(timerEl);
    }
    timerEl.classList.remove('choice-timer-danger');

    const buttons = buttonSelectors.map(sel => $(sel)).filter(el => el !== null);
    buttons.forEach(btn => {
      btn.disabled = true;
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
      }
    });

    let dwellRemaining = 15; // 15 seconds min think time
    let totalRemaining = 60; // 60 seconds total time limit

    const updateUI = () => {
      timerEl.textContent = `⏱️ 0:${totalRemaining.toString().padStart(2, '0')}`;
      if (totalRemaining <= 10) {
        timerEl.classList.add('choice-timer-danger');
      }

      if (dwellRemaining > 0) {
        buttons.forEach(btn => {
          btn.textContent = `${btn.dataset.originalText} (${dwellRemaining}s)`;
          btn.disabled = true;
        });
      } else {
        buttons.forEach(btn => {
          btn.textContent = btn.dataset.originalText;
          btn.disabled = false;
        });
      }
    };

    updateUI();

    activeChoiceInterval = setInterval(() => {
      totalRemaining--;
      if (dwellRemaining > 0) {
        dwellRemaining--;
      }

      if (totalRemaining <= 0) {
        clearInterval(activeChoiceInterval);
        activeChoiceInterval = null;
        timerEl.remove();
        onTimeout();
      } else {
        updateUI();
      }
    }, 1000);
  }

  // ─── Flow Diagram Builder (Redesigned) ────────────────────────
  function buildFlowDiagram(opts) {
    // opts: { mode: 'stars'|'values', round: 1|2, activeNode: 0|1|2|-1 }
    const mode = opts.mode || 'stars';
    const round = opts.round || 1;
    const active = opts.activeNode ?? -1;
    const cond = state.condition;

    let ccYou, ccOpp, dcYou, dcOpp, defectT1You, defectT1Opp, defectT2You, defectT2Opp;
    if (mode === 'stars') {
      ccYou = '★★'; ccOpp = '☆☆';
      dcYou = '★★★★'; dcOpp = '—';
      defectT1You = '★'; defectT1Opp = '☆';
      defectT2You = '—'; defectT2Opp = '☆☆';
    } else {
      const p = PAYOFFS[round];
      const fmt = cond.formatReward;
      ccYou = fmt(p.cc.participant); ccOpp = fmt(p.cc.ai);
      dcYou = fmt(p.dc.participant); dcOpp = fmt(p.dc.ai);
      defectT1You = fmt(p.t1d.participant); defectT1Opp = fmt(p.t1d.ai);
      defectT2You = fmt(p.t2d.participant); defectT2Opp = fmt(p.t2d.ai);
    }

    const markerCls = (i) => active === i ? 'flow-node-active' : '';
    const youTag = (i) => active === i ? '<span class="flow-you-tag">📍 YOUR TURN</span>' : '';

    // Build payoff boxes with clear "You" and "Opp" labels
    function payoffBox(youVal, oppVal, isPositiveYou, isPositiveOpp) {
      const youClass = mode === 'stars' ? '' : (isPositiveYou ? 'payoff-positive' : 'payoff-negative');
      const oppClass = mode === 'stars' ? 'flow-outcome-opp' : (isPositiveOpp ? 'payoff-positive flow-outcome-opp' : 'payoff-negative flow-outcome-opp');
      return `
        <div class="flow-payoff-box">
          <div class="flow-payoff-row">
            <span class="flow-payoff-label">You</span>
            <span class="flow-payoff-value ${youClass}">${youVal}</span>
          </div>
          <div class="flow-payoff-divider"></div>
          <div class="flow-payoff-row">
            <span class="flow-payoff-label flow-payoff-label-opp">Opp</span>
            <span class="flow-payoff-value ${oppClass}">${oppVal}</span>
          </div>
        </div>`;
    }

    // Determine positive/negative for value mode
    function isPos(val) {
      if (mode === 'stars') return true;
      return val >= 0;
    }

    return `
      <div class="flow-chart-v2">
        <div class="flow-main-path">
          <!-- Turn 1: P1 -->
          <div class="flow-turn">
            ${youTag(0)}
            <div class="flow-node flow-p1 ${markerCls(0)}">
              <span class="flow-node-label">P1</span>
              <span class="flow-node-sub">(You)</span>
            </div>
            <div class="flow-defect-branch">
              <div class="flow-arrow-vertical">
                <svg width="16" height="36" viewBox="0 0 16 36"><line x1="8" y1="0" x2="8" y2="28" stroke="var(--defect)" stroke-width="2.5"/><polygon points="3,26 8,34 13,26" fill="var(--defect)"/></svg>
                <span class="flow-arrow-defect-label">D</span>
              </div>
              ${payoffBox(defectT1You, defectT1Opp, isPos(mode === 'stars' ? 1 : PAYOFFS[round].t1d.participant), isPos(mode === 'stars' ? 1 : PAYOFFS[round].t1d.ai))}
            </div>
          </div>

          <div class="flow-arrow-horizontal">
            <span class="flow-arrow-coop-label">C</span>
            <div class="flow-arrow-line-h">
              <svg width="60" height="16" viewBox="0 0 60 16"><line x1="0" y1="8" x2="52" y2="8" stroke="var(--cooperate)" stroke-width="2.5"/><polygon points="50,3 58,8 50,13" fill="var(--cooperate)"/></svg>
            </div>
          </div>

          <!-- Turn 2: P2 -->
          <div class="flow-turn">
            ${youTag(1)}
            <div class="flow-node flow-p2 ${markerCls(1)}">
              <span class="flow-node-label">P2</span>
              <span class="flow-node-sub">(Opp)</span>
            </div>
            <div class="flow-defect-branch">
              <div class="flow-arrow-vertical">
                <svg width="16" height="36" viewBox="0 0 16 36"><line x1="8" y1="0" x2="8" y2="28" stroke="var(--defect)" stroke-width="2.5"/><polygon points="3,26 8,34 13,26" fill="var(--defect)"/></svg>
                <span class="flow-arrow-defect-label">D</span>
              </div>
              ${payoffBox(defectT2You, defectT2Opp, isPos(mode === 'stars' ? 0 : PAYOFFS[round].t2d.participant), isPos(mode === 'stars' ? 1 : PAYOFFS[round].t2d.ai))}
            </div>
          </div>

          <div class="flow-arrow-horizontal">
            <span class="flow-arrow-coop-label">C</span>
            <div class="flow-arrow-line-h">
              <svg width="60" height="16" viewBox="0 0 60 16"><line x1="0" y1="8" x2="52" y2="8" stroke="var(--cooperate)" stroke-width="2.5"/><polygon points="50,3 58,8 50,13" fill="var(--cooperate)"/></svg>
            </div>
          </div>

          <!-- Turn 3: P1 -->
          <div class="flow-turn">
            ${youTag(2)}
            <div class="flow-node flow-p1 ${markerCls(2)}">
              <span class="flow-node-label">P1</span>
              <span class="flow-node-sub">(You)</span>
            </div>
            <div class="flow-defect-branch">
              <div class="flow-arrow-vertical">
                <svg width="16" height="36" viewBox="0 0 16 36"><line x1="8" y1="0" x2="8" y2="28" stroke="var(--defect)" stroke-width="2.5"/><polygon points="3,26 8,34 13,26" fill="var(--defect)"/></svg>
                <span class="flow-arrow-defect-label">D</span>
              </div>
              ${payoffBox(dcYou, dcOpp, isPos(mode === 'stars' ? 1 : PAYOFFS[round].dc.participant), isPos(mode === 'stars' ? 0 : PAYOFFS[round].dc.ai))}
            </div>
          </div>

          <div class="flow-arrow-horizontal">
            <span class="flow-arrow-coop-label">C</span>
            <div class="flow-arrow-line-h">
              <svg width="60" height="16" viewBox="0 0 60 16"><line x1="0" y1="8" x2="52" y2="8" stroke="var(--cooperate)" stroke-width="2.5"/><polygon points="50,3 58,8 50,13" fill="var(--cooperate)"/></svg>
            </div>
          </div>

          <!-- All Cooperate outcome -->
          <div class="flow-turn flow-turn-final">
            ${payoffBox(ccYou, ccOpp, isPos(mode === 'stars' ? 1 : PAYOFFS[round].cc.participant), isPos(mode === 'stars' ? 1 : PAYOFFS[round].cc.ai))}
          </div>
        </div>
      </div>`;
  }

  // ─── Parse URL Condition ────────────────────────────────────
  function getConditionFromURL() {
    const params = new URLSearchParams(window.location.search);
    const cond = parseInt(params.get('condition'));
    if (cond >= 1 && cond <= 4) return cond;
    return null;
  }

  function generateCompletionCode() {
    const urlParams = new URLSearchParams(window.location.search);
    // Use completion code from URL (CloudResearch connect uses fixed codes)
    // You can pass it as ?ccode=978E31999D
    const ccode = urlParams.get('ccode');
    if (ccode) return ccode;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'MRG-';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  // ═══ INIT ═══════════════════════════════════════════════════
  function init() {
    state.conditionNumber = getConditionFromURL();
    if (!state.conditionNumber) {
      const card = $('#screen-welcome .card');
      card.innerHTML = `
        <h1 style="color:#dc2626;">Configuration Error</h1>
        <p class="subtitle">No valid condition specified. Please use a URL with <code>?condition=1</code> through <code>?condition=4</code>.</p>
        <p style="margin-top:1rem;color:#94a3b8;font-size:0.85rem;">Example: <code>${window.location.origin}/?condition=1</code></p>`;
      showScreen('screen-welcome');
      return;
    }
    state.condition = CONDITIONS[state.conditionNumber];
    setProgress(0);
    showScreen('screen-welcome');
    requestAnimationFrame(() => $('#screen-welcome').classList.add('fade-in'));
    setupWelcome();
  }

  // ═══ WELCOME ════════════════════════════════════════════════
  function setupWelcome() {
    const input = $('#cloud-research-id');
    const btn = $('#btn-start');
    const error = $('#id-error');

    // Auto-fill from CloudResearch URL if available
    const urlParams = new URLSearchParams(window.location.search);
    const participantId = urlParams.get('participantId');
    if (participantId) {
      input.value = participantId;
      btn.disabled = false;
    }

    input.addEventListener('input', () => {
      btn.disabled = input.value.trim().length === 0;
      error.textContent = '';
      error.classList.remove('visible');
    });

    btn.addEventListener('click', async () => {
      const crId = input.value.trim();
      if (!crId) return;
      // Save locally
      state.cloudResearchId = crId;
      state.conditionNumber = state.conditionNumber;

      // Proceed to tutorial
      showTutorial1();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) btn.click();
    });
  }

  // ═══ TUTORIAL 1 — Flow Diagram Overview ═════════════════════
  function showTutorial1() {
    setProgress(1);
    $('#flow-diagram-tut1').innerHTML = buildFlowDiagram({ mode: 'stars' });
    const btn = freshButton('#btn-tut1-next');
    btn.addEventListener('click', () => showTutorial1a());
    showScreen('screen-tutorial-1');
    applyDwellTime(['#btn-tut1-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ TUTORIAL 1A — Choice Meanings ══════════════════════════
  function showTutorial1a() {
    setProgress(2);
    $('#flow-diagram-tut1a').innerHTML = buildFlowDiagram({ mode: 'stars' });
    const back = freshButton('#btn-tut1a-back');
    const next = freshButton('#btn-tut1a-next');
    back.addEventListener('click', () => showTutorial1());
    next.addEventListener('click', () => showTutorial1b());
    showScreen('screen-tutorial-1a');
    applyDwellTime(['#btn-tut1a-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ TUTORIAL 1B — Understanding Rewards ════════════════════
  function showTutorial1b() {
    setProgress(3);
    $('#flow-diagram-tut1b').innerHTML = buildFlowDiagram({ mode: 'stars' });
    const back = freshButton('#btn-tut1b-back');
    const next = freshButton('#btn-tut1b-next');
    back.addEventListener('click', () => showTutorial1a());
    next.addEventListener('click', () => showTutorial2());
    showScreen('screen-tutorial-1b');
    applyDwellTime(['#btn-tut1b-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ TUTORIAL 2 — Key Insight ═══════════════════════════════
  function showTutorial2() {
    setProgress(4);
    $('#flow-diagram-tut2').innerHTML = buildFlowDiagram({ mode: 'stars' });
    const back = freshButton('#btn-tut2-back');
    const next = freshButton('#btn-tut2-next');
    back.addEventListener('click', () => showTutorial1b());
    next.addEventListener('click', () => showTutorial3());
    showScreen('screen-tutorial-2');
    applyDwellTime(['#btn-tut2-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ TUTORIAL 3 — 4 Outcomes ════════════════════════════════
  function showTutorial3() {
    setProgress(5);
    $('#flow-diagram-tut3').innerHTML = buildFlowDiagram({ mode: 'stars' });
    const back = freshButton('#btn-tut3-back');
    const next = freshButton('#btn-tut3-next');
    back.addEventListener('click', () => showTutorial2());
    next.addEventListener('click', () => showPregame());
    showScreen('screen-tutorial-3');
    applyDwellTime(['#btn-tut3-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ PRE-GAME ═══════════════════════════════════════════════
  function showPregame() {
    setProgress(6);
    const cond = state.condition;
    $('#pregame-reward-info').innerHTML = `<p>• ${cond.rewardDescription}</p>`;
    const btn = freshButton('#btn-pregame-next');
    btn.addEventListener('click', () => showRecordNote());
    showScreen('screen-pregame');
    applyDwellTime(['#btn-pregame-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ RECORD NOTE ════════════════════════════════════════════
  function showRecordNote() {
    setProgress(7);
    const btn = freshButton('#btn-record-next');
    btn.addEventListener('click', () => showGameStart());
    showScreen('screen-record-note');
    applyDwellTime(['#btn-record-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ GAME START ═════════════════════════════════════════════
  function showGameStart() {
    setProgress(8);
    const btn = freshButton('#btn-gamestart-next');
    btn.addEventListener('click', () => showOpponent());
    showScreen('screen-gamestart');
  }

  // ═══ OPPONENT INFO ══════════════════════════════════════════
  function showOpponent() {
    setProgress(9);
    const cond = state.condition;

    // Build visual diagram based on condition
    let visualHtml = '';
    if (cond.socialFraming === 'low') {
      visualHtml = `
        <div class="opp-vis">
          <div class="opp-vis-node opp-vis-you">
            <div class="opp-vis-icon">👤</div>
            <div class="opp-vis-title">P1 (You)</div>
          </div>
          <div class="opp-vis-connector">
            <svg width="100" height="30" viewBox="0 0 100 30">
              <line x1="5" y1="15" x2="95" y2="15" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="6,3"/>
              <polygon points="90,10 98,15 90,20" fill="var(--text-muted)"/>
              <polygon points="10,10 2,15 10,20" fill="var(--text-muted)"/>
            </svg>
            <span class="opp-vis-conn-label">Game Interaction</span>
          </div>
          <div class="opp-vis-node opp-vis-ai-only">
            <div class="opp-vis-icon">🤖</div>
            <div class="opp-vis-title">P2 (AI Agent)</div>
            <div class="opp-vis-badge">Autonomous</div>
          </div>
        </div>`;
    } else {
      visualHtml = `
        <div class="opp-vis">
          <div class="opp-vis-node opp-vis-you">
            <div class="opp-vis-icon">👤</div>
            <div class="opp-vis-title">P1 (You)</div>
          </div>
          <div class="opp-vis-connector">
            <svg width="100" height="30" viewBox="0 0 100 30">
              <line x1="5" y1="15" x2="95" y2="15" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="6,3"/>
              <polygon points="90,10 98,15 90,20" fill="var(--text-muted)"/>
              <polygon points="10,10 2,15 10,20" fill="var(--text-muted)"/>
            </svg>
            <span class="opp-vis-conn-label">Game Interaction</span>
          </div>
          <div class="opp-vis-group">
            <div class="opp-vis-group-label">P2's Side</div>
            <div class="opp-vis-node opp-vis-human">
              <div class="opp-vis-icon">👤</div>
              <div class="opp-vis-title">P2 (Human)</div>
              <div class="opp-vis-badge opp-vis-badge-reward">💰 Receives Rewards</div>
            </div>
            <div class="opp-vis-link-vertical">
              <svg width="20" height="32" viewBox="0 0 20 32">
                <line x1="10" y1="0" x2="10" y2="26" stroke="var(--ai-color)" stroke-width="2"/>
                <polygon points="5,24 10,32 15,24" fill="var(--ai-color)"/>
              </svg>
              <span class="opp-vis-link-label">Must follow</span>
              <svg width="20" height="32" viewBox="0 0 20 32" style="transform: rotate(180deg);">
                <line x1="10" y1="0" x2="10" y2="26" stroke="var(--ai-color)" stroke-width="2"/>
                <polygon points="5,24 10,32 15,24" fill="var(--ai-color)"/>
              </svg>
            </div>
            <div class="opp-vis-node opp-vis-ai">
              <div class="opp-vis-icon">🤖</div>
              <div class="opp-vis-title">AI Agent</div>
              <div class="opp-vis-badge opp-vis-badge-decide">🧠 Makes Decisions</div>
            </div>
          </div>
        </div>`;
    }
    $('#opponent-visual').innerHTML = visualHtml;

    // Build description with emphasis boxes
    let descHtml = '';
    if (cond.socialFraming === 'low') {
      descHtml = `
        <p>• Your opponent in this game is <strong>an AI agent</strong>.</p>
        <p>• The AI agent is designed to make the most rational decisions based on its trained algorithm.</p>
        <p>• The rewards earned will go to you and the AI's account respectively.</p>
      `;
    } else {
      descHtml = `
        <p>• Your opponent is <strong>another real participant</strong> in this experiment — a human, just like you.</p>
        <p>• However, your opponent has been assigned <strong>different conditions</strong>.</p>
        <p>• Instead of making choices directly, they must <strong>unconditionally follow the decisions made by an AI agent</strong>.</p>
        <div class="highlight-box highlight-box-important">
          <p>⚠️ <strong>Key Point:</strong></p>
          <p>The AI makes all the decisions, but the <strong>rewards earned go to the human participant</strong> — not to the AI.</p>
          <p>In other words, <strong>whatever the opponent earns or loses, a real person is directly affected.</strong></p>
        </div>
      `;
    }
    $('#opponent-description').innerHTML = descHtml;

    const btn = freshButton('#btn-opponent-next');
    btn.addEventListener('click', () => showMatching());
    showScreen('screen-opponent');
    applyDwellTime(['#btn-opponent-next'], (txt, sec) => `${txt} (${sec}s)`);
  }

  // ═══ MATCHING ═══════════════════════════════════════════════
  function showMatching() {
    setProgress(10);
    showScreen('screen-matching');
    const delay = CONFIG.MATCHING_DELAY_MIN + Math.random() * (CONFIG.MATCHING_DELAY_MAX - CONFIG.MATCHING_DELAY_MIN);
    setTimeout(() => showMatched(), delay);
  }

  // ═══ MATCHED ════════════════════════════════════════════════
  function showMatched() {
    setProgress(11);
    showScreen('screen-matched');
    let count = CONFIG.MATCHED_COUNTDOWN;
    const el = $('#matched-countdown');
    el.textContent = count;
    const interval = setInterval(() => {
      count--;
      el.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        beginRound(1);
      }
    }, 1000);
  }

  // ═══ BEGIN ROUND ════════════════════════════════════════════
  function beginRound(roundNum) {
    state.currentRound = roundNum;
    showTurn1();
  }

  // ═══ TURN 1 ═════════════════════════════════════════════════
  function showTurn1() {
    const round = state.currentRound;
    setProgress(round === 1 ? 12 : 18);
    const cond = state.condition;
    const fmt = cond.formatReward;
    const p = PAYOFFS[round];

    $('#turn1-title').textContent = `Round ${round} — Choice 1`;

    let descHtml = `You can choose to <strong class="text-cooperate">Cooperate (C)</strong> or <strong class="text-defect">Defect (D)</strong>.<br><br>`;
    descHtml += `If you choose <strong class="text-cooperate">Cooperate (C)</strong>, the turn passes to <strong>your opponent</strong>.<br>`;
    descHtml += `If you choose <strong class="text-defect">Defect (D)</strong>, this round <strong>ends immediately</strong> and both you and your opponent receive <strong>${fmt(p.t1d.participant)}</strong>.`;
    $('#turn1-desc').innerHTML = descHtml;

    $('#turn1-flow-diagram').innerHTML = buildFlowDiagram({ mode: 'values', round, activeNode: 0 });
    $('#turn1-understood').textContent = '';

    state.timestamps.turn1Start = performance.now();

    const btnC = freshButton('#btn-t1-cooperate');
    const btnD = freshButton('#btn-t1-defect');
    btnC.addEventListener('click', () => handleTurn1('C'));
    btnD.addEventListener('click', () => handleTurn1('D'));

    showScreen('screen-turn1');
    startChoiceTimer(
      'screen-turn1',
      ['#btn-t1-cooperate', '#btn-t1-defect'],
      () => handleTurn1('D') // Auto-defect on timeout
    );
  }

  function handleTurn1(choice) {
    if (activeChoiceInterval) {
      clearInterval(activeChoiceInterval);
      activeChoiceInterval = null;
    }
    const rt = Math.round(performance.now() - state.timestamps.turn1Start);
    const round = state.currentRound;
    state.rounds[round].turn1Choice = choice;
    state.rounds[round].turn1Rt = rt;

    if (choice === 'D') {
      state.rounds[round].participantReward = PAYOFFS[round].t1d.participant;
      state.rounds[round].aiReward = PAYOFFS[round].t1d.ai;
      state.totalReward += PAYOFFS[round].t1d.participant;

      setProgress(round === 1 ? 13 : 19);

      const cond = state.condition;
      const fmt = cond.formatReward;

      let html = `<p>You chose <strong class="text-defect">Defect (D)</strong>.</p>`;
      if (round === 1) {
        html += `<p>Round 1 has ended. Both you and your opponent receive <strong>${fmt(PAYOFFS[1].t1d.participant)}</strong> this round.</p>`;
        html += `<p>You will now proceed to <strong>Round 2</strong>.</p>`;
      } else {
        html += `<p>Round 2 has ended. Both you and your opponent receive <strong>${fmt(PAYOFFS[2].t1d.participant)}</strong> this round.</p>`;
        html += `<p>Your final total reward is <strong>${fmt(state.totalReward)}</strong>.</p>`;
      }
      $('#turn1-defect-content').innerHTML = html;

      const btn = freshButton('#btn-t1d-next');
      btn.addEventListener('click', () => afterRound());
      showScreen('screen-turn1-defect');
    } else {
      setProgress(round === 1 ? 13 : 19);
      const btn = freshButton('#btn-t1c-next');
      btn.addEventListener('click', () => showTurn2());
      showScreen('screen-turn1-cooperate');
    }
  }

  // ═══ TURN 2 (AI) ════════════════════════════════════════════
  function showTurn2() {
    const round = state.currentRound;
    setProgress(round === 1 ? 14 : 20);

    $('#turn2-title').textContent = `Round ${round} — Choice 2`;
    $('#ai-thinking').style.display = 'flex';
    $('#ai-decision').style.display = 'none';
    $('#btn-t2-next').style.display = 'none';
    $('#ai-avatar').classList.add('thinking');
    $('#ai-avatar').classList.remove('decided');

    showScreen('screen-turn2');

    const delay = CONFIG.AI_THINKING_MIN + Math.random() * (CONFIG.AI_THINKING_MAX - CONFIG.AI_THINKING_MIN);
    setTimeout(() => {
      $('#ai-thinking').style.display = 'none';
      $('#ai-decision').style.display = 'block';
      $('#ai-avatar').classList.remove('thinking');
      $('#ai-avatar').classList.add('decided');

      $('#ai-sacrifice-detail').textContent =
        'By cooperating (C), your opponent accepted a personal cost to give you the opportunity to earn more.';

      setTimeout(() => {
        const btn = freshButton('#btn-t2-next');
        btn.style.display = 'inline-flex';
        btn.addEventListener('click', () => showTurn3());
      }, 800);
    }, delay);
  }

  // ═══ TURN 3 ═════════════════════════════════════════════════
  function showTurn3() {
    const round = state.currentRound;
    setProgress(round === 1 ? 15 : 21);
    const cond = state.condition;
    const fmt = cond.formatReward;
    const p = PAYOFFS[round];

    $('#turn3-title').textContent = `Round ${round} — Choice 3`;

    let descHtml = `<strong>It's your turn again.</strong><br><br>`;
    descHtml += `You can choose to <strong class="text-cooperate">Cooperate (C)</strong> or <strong class="text-defect">Defect (D)</strong>.<br><br>`;
    descHtml += `If you choose <strong class="text-cooperate">Cooperate (C)</strong>, you earn <strong>${fmt(p.cc.participant)}</strong> and your opponent earns <strong>${fmt(p.cc.ai)}</strong>.<br>`;
    descHtml += `If you choose <strong class="text-defect">Defect (D)</strong>, you earn <strong>${fmt(p.dc.participant)}</strong> and your opponent earns <strong>${fmt(p.dc.ai)}</strong>.<br><br>`;
    descHtml += `The round will then end.`;
    $('#turn3-desc').innerHTML = descHtml;

    $('#turn3-flow-diagram').innerHTML = buildFlowDiagram({ mode: 'values', round, activeNode: 2 });

    state.timestamps.turn3Start = performance.now();

    const btnC = freshButton('#btn-t3-cooperate');
    const btnD = freshButton('#btn-t3-defect');
    btnC.addEventListener('click', () => handleTurn3('C'));
    btnD.addEventListener('click', () => handleTurn3('D'));

    showScreen('screen-turn3');
    startChoiceTimer(
      'screen-turn3',
      ['#btn-t3-cooperate', '#btn-t3-defect'],
      () => handleTurn3('D') // Auto-defect on timeout
    );
  }

  function handleTurn3(choice) {
    if (activeChoiceInterval) {
      clearInterval(activeChoiceInterval);
      activeChoiceInterval = null;
    }
    const rt = Math.round(performance.now() - state.timestamps.turn3Start);
    const round = state.currentRound;
    const payoffs = PAYOFFS[round];
    const cond = state.condition;
    const fmt = cond.formatReward;

    const outcome = choice === 'C' ? payoffs.cc : payoffs.dc;
    state.rounds[round].turn3Choice = choice;
    state.rounds[round].turn3Rt = rt;
    state.rounds[round].participantReward = outcome.participant;
    state.rounds[round].aiReward = outcome.ai;
    state.totalReward += outcome.participant;

    // Data is saved in state.rounds[round]

    setProgress(round === 1 ? 16 : 22);

    let html = '';
    if (choice === 'C') {
      html += `<p>You chose <strong class="text-cooperate">Cooperate (C)</strong>.</p>`;
    } else {
      html += `<p>You chose <strong class="text-defect">Defect (D)</strong>.</p>`;
    }

    html += `<p>Your reward this round: <strong>${fmt(outcome.participant)}</strong><br>`;
    html += `Opponent's reward this round: <strong>${fmt(outcome.ai)}</strong></p>`;

    if (round === 1) {
      html += `<p>Round 1 is now complete. You will proceed to <strong>Round 2</strong> with your current total of <strong>${fmt(state.totalReward)}</strong>.</p>`;
      html += `<p class="text-muted-sm">If you understand, press 'Next' to proceed to Round 2.</p>`;
    } else {
      html += `<p>Round 2 is now complete.</p>`;
      html += `<p>Your final total reward across both rounds: <strong class="text-accent">${fmt(state.totalReward)}</strong></p>`;
    }

    $('#turn3-result-content').innerHTML = html;

    const btn = freshButton('#btn-t3r-next');
    btn.addEventListener('click', () => afterRound());
    showScreen('screen-turn3-result');
  }

  // ═══ AFTER ROUND ════════════════════════════════════════════
  function afterRound() {
    if (state.currentRound === 1) {
      showRound2Intro();
    } else {
      showSurvey();
    }
  }

  function showRound2Intro() {
    setProgress(17);
    const cond = state.condition;
    const fmt = cond.formatReward;
    const p = PAYOFFS[2];

    let tableHtml = `
      <h3>Round 2 Rewards (2× stakes)</h3>
      <table class="payoff-table payoff-table-compact">
        <thead><tr><th>Your Choice</th><th>Your Reward</th><th>Opponent's Reward</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="text-cooperate">Cooperate</span></td>
            <td class="payoff-positive">${fmt(p.cc.participant)}</td>
            <td class="payoff-positive">${fmt(p.cc.ai)}</td>
          </tr>
          <tr>
            <td><span class="text-defect">Defect</span></td>
            <td class="payoff-positive">${fmt(p.dc.participant)}</td>
            <td class="payoff-negative">${fmt(p.dc.ai)}</td>
          </tr>
        </tbody>
      </table>`;
    $('#round2-payoff-section').innerHTML = tableHtml;

    const btn = freshButton('#btn-r2-next');
    btn.addEventListener('click', () => beginRound(2));
    showScreen('screen-round2-intro');
  }

  function showSurvey() {
    setProgress(23);
    
    // Update currency values based on condition
    document.querySelectorAll('#post-game-survey [data-cur-val]').forEach(el => {
      const val = parseInt(el.getAttribute('data-cur-val'));
      el.textContent = state.condition.formatReward(val).replace('+', '').replace('-', '');
    });

    // Initialize visibility based on actual game choices
    if (state.rounds[1].turn1Choice === 'D') {
      document.getElementById('r1-turn3-questions').style.display = 'none';
    }
    if (state.rounds[2].turn1Choice === 'D') {
      document.getElementById('r2-turn3-questions').style.display = 'none';
    }

    // Handle conditional hiding for Round 1
    const r1t1Choice = document.querySelectorAll('input[name="r1_t1_choice"]');
    r1t1Choice.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const qDiv = document.getElementById('r1-turn3-questions');
        if (e.target.value === 'D') {
          qDiv.style.display = 'none';
        } else {
          qDiv.style.display = 'block';
        }
      });
    });

    // Handle conditional hiding for Round 2
    const r2t1Choice = document.querySelectorAll('input[name="r2_t1_choice"]');
    r2t1Choice.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const qDiv = document.getElementById('r2-turn3-questions');
        if (e.target.value === 'D') {
          qDiv.style.display = 'none';
        } else {
          qDiv.style.display = 'block';
        }
      });
    });

    showScreen('screen-survey');
    
    const form = document.getElementById('post-game-survey');
    
    // Remove the old button listener if there was any, but we are using form submit now
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-submit-survey');
      const error = $('#survey-error');
      
      error.classList.remove('visible');
      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const formData = new FormData(form);
        const surveyData = Object.fromEntries(formData.entries());

        // Aggregate all data to send in one batch
        const finalData = {
          cloudResearchId: state.cloudResearchId,
          conditionNumber: state.conditionNumber,
          socialFraming: state.condition.socialFraming,
          rewardClarity: state.condition.rewardClarity,
          
          game_r1_turn1Choice: state.rounds[1].turn1Choice,
          game_r1_turn1Rt: state.rounds[1].turn1Rt,
          game_r1_turn3Choice: state.rounds[1].turn3Choice,
          game_r1_turn3Rt: state.rounds[1].turn3Rt,
          game_r1_participantReward: state.rounds[1].participantReward,
          game_r1_aiReward: state.rounds[1].aiReward,
          
          game_r2_turn1Choice: state.rounds[2].turn1Choice,
          game_r2_turn1Rt: state.rounds[2].turn1Rt,
          game_r2_turn3Choice: state.rounds[2].turn3Choice,
          game_r2_turn3Rt: state.rounds[2].turn3Rt,
          game_r2_participantReward: state.rounds[2].participantReward,
          game_r2_aiReward: state.rounds[2].aiReward,
          
          game_totalReward: state.totalReward,
          
          ...surveyData
        };

        await API.submitAllData(finalData);
        showComplete();
      } catch (err) {
        console.error(err);
        error.textContent = 'Failed to submit. Please try again.';
        error.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Submit Survey';
      }
    });
  }


  function showComplete() {
    setProgress(25);
    const cond = state.condition;
    const fmt = cond.formatReward;
    $('#final-total').textContent = fmt(state.totalReward);
    $('#completion-code').textContent = generateCompletionCode();

    // Show debriefing based on condition
    const debriefingSection = $('#debriefing-section');
    const debriefingText = $('#debriefing-text');
    let deceptionDetails = [];
    
    if (cond.socialFraming === 'high') {
      deceptionDetails.push("your opponent was actually an automated AI script, not a real human participant");
    }
    if (cond.rewardClarity === 'clear') {
      deceptionDetails.push("the monetary stakes ($) shown during the game were simulated for game immersion and do not represent actual bonus calculations");
    }
    
    if (deceptionDetails.length > 0) {
      debriefingText.innerHTML = `Specifically: <strong>${deceptionDetails.join(" / ")}</strong>.`;
      debriefingSection.style.display = 'block';
    }

    showScreen('screen-complete');
  }

  // ═══ BOOT ═══════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', init);

})();
