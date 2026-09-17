"use strict";

const DATA = Array.isArray(window.SIGHTLINES_SCENARIOS) ? window.SIGHTLINES_SCENARIOS : [];
const STORAGE_KEY = "sightlines-game-immersive-v3";

const app = document.getElementById("app");
const live = document.getElementById("live");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const progressbar = document.getElementById("progressbar");

const bgMusic = document.getElementById("bg-music");
const ambienceAudio = document.getElementById("ambience-audio");
const musicButton = document.getElementById("music-button");
const musicLabel = document.getElementById("music-label");
const voiceButton = document.getElementById("voice-button");
const voiceLabel = document.getElementById("voice-label");
const sceneTransition = document.getElementById("scene-transition");
const sceneTransitionLabel = document.getElementById("scene-transition-label");
const voiceCaption = document.getElementById("voice-caption");
const voiceCaptionSpeaker = document.getElementById("voice-caption-speaker");
const voiceCaptionText = document.getElementById("voice-caption-text");

const settingsModal = document.getElementById("settings-modal");
const settingsMusic = document.getElementById("settings-music");
const settingsSfx = document.getElementById("settings-sfx");
const settingsVoice = document.getElementById("settings-voice");
const settingsAmbience = document.getElementById("settings-ambience");
const settingsMotion = document.getElementById("settings-motion");
const volumeSlider = document.getElementById("volume-slider");
const volumeOutput = document.getElementById("volume-output");

const reducedMotionPreferred = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

let state = {
  completed: [],
  explored: {},
  reflections: {},
  lenses: [],
  prefs: {
    musicEnabled: false,
    sfxEnabled: false,
    voiceEnabled: false,
    ambienceEnabled: false,
    volume: 0.45,
    motionEnabled: !reducedMotionPreferred
  }
};

let currentId = null;
let physicalSeen = new Set();
let interpersonalFirst = null;
let lastFeedback = null;
let audioCtx = null;
let toastTimer = null;
let consequenceRunToken = 0;
let speechRunToken = 0;
let voiceCache = [];
let currentAmbienceScene = null;
let splashHasRun = false;
let lastVoiceCharacter = null;

const SFX_FILES = {
  inspect: "assets/sfx_discover.ogg",
  decision: "assets/sfx_click.ogg",
  dialogue: "assets/sfx_dialogue.ogg",
  success: "assets/sfx_success.ogg",
  complete: "assets/sfx_complete.ogg",
  summary: "assets/sfx_complete.ogg",
  toggle: "assets/sfx_click.ogg",
  reset: "assets/sfx_reset.ogg",
  transition: "assets/sfx_transition.ogg",
  start: "assets/sfx_start.ogg"
};
const sfxBank = new Map();


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scenario(id) {
  return DATA.find(s => s.id === id);
}

function setScene(name) {
  document.body.dataset.scene = name;
  stopSpeech();
  updateAmbienceForScene(name);
}

function announce(text) {
  live.textContent = "";
  setTimeout(() => { live.textContent = text; }, 20);
}

function scrollTopView() {
  window.scrollTo({ top: 0, behavior: state.prefs.motionEnabled ? "smooth" : "auto" });
  setTimeout(() => app.focus(), 80);
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save local state.", e);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const x = JSON.parse(raw);

    state.completed = Array.isArray(x.completed) ? x.completed : [];
    state.explored = x.explored && typeof x.explored === "object" ? x.explored : {};
    state.reflections = x.reflections && typeof x.reflections === "object" ? x.reflections : {};
    state.lenses = Array.isArray(x.lenses) ? x.lenses : [];

    if (x.prefs && typeof x.prefs === "object") {
      state.prefs.musicEnabled = Boolean(x.prefs.musicEnabled);
      state.prefs.sfxEnabled = Boolean(x.prefs.sfxEnabled);
      state.prefs.voiceEnabled = Boolean(x.prefs.voiceEnabled);
      state.prefs.ambienceEnabled = Boolean(x.prefs.ambienceEnabled);
      state.prefs.volume = Number.isFinite(Number(x.prefs.volume))
        ? Math.min(1, Math.max(0, Number(x.prefs.volume)))
        : 0.45;
      state.prefs.motionEnabled = typeof x.prefs.motionEnabled === "boolean"
        ? x.prefs.motionEnabled
        : !reducedMotionPreferred;
    }

    // Compatibility with the prior build's single sound preference.
    if ("soundEnabled" in x && !x.prefs) {
      state.prefs.sfxEnabled = Boolean(x.soundEnabled);
    }
  } catch (e) {
    console.warn("Could not restore local state.", e);
  }
}

/* =========================================================
   PROGRESS / EXPLORATION
   ========================================================= */

function updateProgress() {
  const n = state.completed.length;
  const total = DATA.length;
  progressText.textContent = `${n} / ${total} scenarios completed`;
  progressFill.style.width = `${total ? (n / total) * 100 : 0}%`;
  progressbar.setAttribute("aria-valuemax", String(total));
  progressbar.setAttribute("aria-valuenow", String(n));
}

function markExplored(id, key) {
  state.explored[id] ||= [];
  if (!state.explored[id].includes(key)) {
    state.explored[id].push(key);
  }
  save();
}

function exploredCount(id) {
  return state.explored[id]?.length || 0;
}

function allExploredCount() {
  return Object.values(state.explored).reduce((a, b) => a + b.length, 0);
}

function markLenses(lenses) {
  for (const lens of lenses || []) {
    if (!state.lenses.includes(lens)) state.lenses.push(lens);
  }
  save();
}

function complete(id) {
  if (!state.completed.includes(id)) state.completed.push(id);
  save();
  updateProgress();
}

function approachTarget(s) {
  if (s.type === "physical") return s.choices.length;
  if (s.type === "digital") return new Set(Object.values(s.repairEvaluation).map(x => x.routeKey)).size;
  if (s.type === "interpersonal") return s.secondChoices.length;
  return 3;
}

function totalApproachTarget() {
  return DATA.reduce((sum, s) => sum + approachTarget(s), 0);
}

/* =========================================================
   MUSIC / SOUND / MOTION
   ========================================================= */

function applyPreferences() {
  document.body.classList.toggle("motion-off", !state.prefs.motionEnabled);

  bgMusic.volume = Math.min(1, Math.max(0, state.prefs.volume * 0.50));
  ambienceAudio.volume = Math.min(1, Math.max(0, state.prefs.volume * 0.22));

  musicButton.setAttribute("aria-pressed", String(state.prefs.musicEnabled));
  musicLabel.textContent = state.prefs.musicEnabled ? "Music on" : "Music off";
  voiceButton.setAttribute("aria-pressed", String(state.prefs.voiceEnabled));
  voiceLabel.textContent = state.prefs.voiceEnabled ? "Voices on" : "Voices off";

  settingsMusic.setAttribute("aria-checked", String(state.prefs.musicEnabled));
  settingsSfx.setAttribute("aria-checked", String(state.prefs.sfxEnabled));
  settingsVoice.setAttribute("aria-checked", String(state.prefs.voiceEnabled));
  settingsAmbience.setAttribute("aria-checked", String(state.prefs.ambienceEnabled));
  settingsMotion.setAttribute("aria-checked", String(state.prefs.motionEnabled));

  volumeSlider.value = String(Math.round(state.prefs.volume * 100));
  volumeOutput.value = `${Math.round(state.prefs.volume * 100)}%`;
  volumeOutput.textContent = `${Math.round(state.prefs.volume * 100)}%`;

  if (state.prefs.ambienceEnabled) updateAmbienceForScene(document.body.dataset.scene || "home");
}

async function setMusic(enabled) {
  state.prefs.musicEnabled = Boolean(enabled);
  applyPreferences();
  save();

  if (state.prefs.musicEnabled) {
    try {
      bgMusic.currentTime = Number.isFinite(bgMusic.currentTime) ? bgMusic.currentTime : 0;
      await bgMusic.play();
      showToast("Background music enabled");
    } catch (error) {
      console.warn("Music playback was blocked by the browser.", error);
      showToast("Press Music once more if playback is blocked");
    }
  } else {
    bgMusic.pause();
    showToast("Background music paused");
  }
}

function toggleMusic() {
  setMusic(!state.prefs.musicEnabled);
}

function setSfx(enabled) {
  state.prefs.sfxEnabled = Boolean(enabled);
  applyPreferences();
  save();
  if (enabled) playSfx("toggle");
}

function setMotion(enabled) {
  state.prefs.motionEnabled = Boolean(enabled);
  applyPreferences();
  save();
}

function setVolume(value) {
  state.prefs.volume = Math.min(1, Math.max(0, value));
  applyPreferences();
  save();
}



const AMBIENCE_FILES = {
  home: "assets/ambience_campus.ogg",
  physical: "assets/ambience_campus.ogg",
  digital: "assets/ambience_digital.ogg",
  interpersonal: "assets/ambience_room.ogg",
  summary: "assets/ambience_campus.ogg"
};

function refreshVoiceCache() {
  if (!("speechSynthesis" in window)) return;
  voiceCache = window.speechSynthesis.getVoices() || [];
}

if ("speechSynthesis" in window) {
  refreshVoiceCache();
  window.speechSynthesis.onvoiceschanged = refreshVoiceCache;
}

function voiceProfile(character = "Narrator") {
  const profiles = {
    Narrator: { names: ["Aria", "Samantha", "Jenny", "Zira", "Google US English"], rate: 0.94, pitch: 1.02 },
    You: { names: ["Guy", "Daniel", "David", "Alex", "Google UK English Male"], rate: 1.00, pitch: 0.93 },
    Alex: { names: ["Guy", "Daniel", "David", "Google UK English Male"], rate: 1.00, pitch: 0.90 },
    Jamie: { names: ["Jenny", "Samantha", "Zira", "Google US English"], rate: 1.02, pitch: 1.08 },
    Taylor: { names: ["Aria", "Samantha", "Jenny", "Google UK English Female"], rate: 0.98, pitch: 1.04 },
    "Group member": { names: ["Aria", "Samantha", "Jenny", "Google UK English Female"], rate: 0.98, pitch: 1.04 },
    "Approaching student": { names: ["Aria", "Samantha", "Jenny", "Google UK English Female"], rate: 0.98, pitch: 1.04 }
  };
  return profiles[character] || profiles.Narrator;
}

function chooseVoice(character) {
  refreshVoiceCache();
  const profile = voiceProfile(character);
  const english = voiceCache.filter(v => /^en[-_]/i.test(v.lang || "") || /English/i.test(v.name || ""));
  for (const wanted of profile.names) {
    const found = english.find(v => (v.name || "").toLowerCase().includes(wanted.toLowerCase()));
    if (found) return found;
  }
  return english[0] || voiceCache[0] || null;
}

function speakerKey(character) {
  return String(character || "narrator").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function setSpeakerVisual(character, active) {
  const key = speakerKey(character);
  document.querySelectorAll(`[data-voice-speaker="${key}"]`).forEach(el => el.classList.toggle("speaking", active));
  document.body.classList.toggle("voice-speaking", active);
}

function duckSound(active) {
  const factor = active ? 0.32 : 1;
  bgMusic.volume = Math.min(1, Math.max(0, state.prefs.volume * 0.50 * factor));
  ambienceAudio.volume = Math.min(1, Math.max(0, state.prefs.volume * 0.22 * (active ? 0.42 : 1)));
}

function stopSpeech() {
  speechRunToken += 1;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  document.querySelectorAll(".speaking").forEach(el => el.classList.remove("speaking"));
  document.body.classList.remove("voice-speaking");
  lastVoiceCharacter = null;
  voiceCaption?.classList.add("hidden");
  duckSound(false);
}

function speakLine(character, text, options = {}) {
  return new Promise(resolve => {
    if (!state.prefs.voiceEnabled || !("speechSynthesis" in window) || !text) {
      resolve(false);
      return;
    }

    const token = speechRunToken;
    const profile = voiceProfile(character);
    const utter = new SpeechSynthesisUtterance(String(text));
    const selectedVoice = chooseVoice(character);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = selectedVoice?.lang || "en-US";
    utter.rate = options.rate || profile.rate;
    utter.pitch = options.pitch || profile.pitch;
    utter.volume = Math.min(1, Math.max(0.1, state.prefs.volume * 1.25));

    utter.onstart = () => {
      if (token !== speechRunToken) return;
      lastVoiceCharacter = character;
      setSpeakerVisual(character, true);
      if (voiceCaption) {
        voiceCaptionSpeaker.textContent = character;
        voiceCaptionText.textContent = String(text);
        voiceCaption.classList.remove("hidden");
      }
      duckSound(true);
    };
    const finish = () => {
      setSpeakerVisual(character, false);
      if (lastVoiceCharacter === character) {
        lastVoiceCharacter = null;
        setTimeout(() => { if (!lastVoiceCharacter) voiceCaption?.classList.add("hidden"); }, 180);
      }
      duckSound(false);
      resolve(true);
    };
    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
  });
}

async function speakSequence(lines, options = {}) {
  if (!state.prefs.voiceEnabled) return;
  const token = ++speechRunToken;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  for (const item of lines) {
    if (token !== speechRunToken) return;
    if (item.delay) await new Promise(r => setTimeout(r, item.delay));
    if (token !== speechRunToken) return;
    await speakLine(item.character || "Narrator", item.text || "", item);
  }
}

function setVoice(enabled) {
  state.prefs.voiceEnabled = Boolean(enabled);
  if (!enabled) stopSpeech();
  applyPreferences();
  save();
  if (enabled) {
    playSfx("toggle");
    speakLine("Narrator", "Character voices enabled.");
  }
}

function toggleVoice() {
  setVoice(!state.prefs.voiceEnabled);
}

async function updateAmbienceForScene(sceneName) {
  const file = AMBIENCE_FILES[sceneName] || AMBIENCE_FILES.home;
  currentAmbienceScene = sceneName;
  if (!state.prefs.ambienceEnabled || !file) {
    ambienceAudio.pause();
    return;
  }
  const current = ambienceAudio.getAttribute("src") || "";
  if (!current.endsWith(file)) {
    ambienceAudio.src = file;
    ambienceAudio.load();
  }
  ambienceAudio.volume = Math.min(1, Math.max(0, state.prefs.volume * 0.22));
  try { await ambienceAudio.play(); } catch (e) { /* user gesture may be required */ }
}

function setAmbience(enabled) {
  state.prefs.ambienceEnabled = Boolean(enabled);
  applyPreferences();
  save();
  if (enabled) updateAmbienceForScene(document.body.dataset.scene || "home");
  else ambienceAudio.pause();
}

function flashSceneTransition(label = "Loading scene…") {
  if (!state.prefs.motionEnabled || !sceneTransition) return;
  sceneTransitionLabel.textContent = label;
  sceneTransition.classList.remove("active");
  void sceneTransition.offsetWidth;
  sceneTransition.classList.add("active");
  playSfx("transition");
  setTimeout(() => sceneTransition.classList.remove("active"), 780);
}

function playSfx(kind = "inspect") {
  if (!state.prefs.sfxEnabled) return;

  const src = SFX_FILES[kind] || SFX_FILES.inspect;
  try {
    const audio = sfxBank.get(src) || new Audio(src);
    sfxBank.set(src, audio);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0.05, state.prefs.volume * 0.8));
    audio.play().catch(() => {});
  } catch (error) {
    console.warn("SFX playback unavailable.", error);
  }
}

function spawnConfetti(count = 45) {
  if (!state.prefs.motionEnabled) return;

  const layer = document.getElementById("confetti-layer");
  const colors = ["#0c69b7", "#44b9d4", "#26a98f", "#e6a93d", "#7158c8", "#e16475"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty("--fall", `${2.1 + Math.random() * 1.7}s`);
    piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 4200);
  }
}

/* =========================================================
   SHARED UI
   ========================================================= */

function journey(labels, active) {
  return `<nav class="journey" aria-label="Scenario learning process">
    ${labels.map((label, i) => `
      <div class="jstep ${i < active ? "done" : i === active ? "active" : ""}">
        <i>${i < active ? "✓" : i + 1}</i>${esc(label)}
      </div>
      ${i < labels.length - 1 ? `<div class="jline ${i < active ? "done" : ""}"></div>` : ""}
    `).join("")}
  </nav>`;
}

function toolbar(s) {
  return `<div class="toolbar">
    <button class="back" data-action="home" type="button">← Scenario menu</button>
    <span>${esc(s.category)}</span>
  </div>`;
}

function titleBlock(s, index) {
  return `<div class="scenario-title-row">
    <div>
      <span class="badge">${esc(s.category)}</span>
      <h1>${esc(s.title)}</h1>
      <p class="scenario-sub">${esc(s.subtitle)}</p>
    </div>
    <span class="big-no" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
  </div>`;
}

function briefing(s) {
  return `<section class="briefing">
    <div><p class="label">Your role</p><p>${esc(s.context.role)}</p></div>
    <div><p class="label">Context</p><p>${esc(s.context.location)}${s.context.time ? " · " + esc(s.context.time) : ""}</p></div>
    <div><p class="label">Learning focus</p><p>${esc(s.learningGoal)}</p></div>
  </section>`;
}

function knownUnknown(s) {
  return `<details class="details">
    <summary>What is known — and what should not be assumed?</summary>
    <div class="known-grid">
      <div>
        <h3>Known from the situation</h3>
        <ul>${s.context.whatIsKnown.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div>
        <h3>Not known yet</h3>
        <ul>${s.context.whatIsUnknown.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </div>
  </details>`;
}

function choiceButton(ch, i, action) {
  return `<button class="choice" type="button" data-action="${action}" data-index="${i}">
    <span class="choice-no">${i + 1}</span>
    <span class="choice-text">${esc(ch.text)}</span>
    <span class="choice-arrow" aria-hidden="true">→</span>
  </button>`;
}

function thumbClass(s) {
  if (s.type === "physical") return "thumb-physical";
  if (s.type === "digital") return "thumb-digital";
  return "thumb-interpersonal";
}


function introArtClass(s) {
  if (s.type === "physical") return "intro-physical";
  if (s.type === "digital") return "intro-digital";
  return "intro-interpersonal";
}

function introPortrait(s) {
  if (s.type === "physical") return "assets/player-you.png";
  if (s.type === "digital") return "assets/reflection-student.png";
  return "assets/taylor.png";
}

function portraitForSpeaker(name) {
  const map = {
    "Alex": "assets/alex.png",
    "Jamie": "assets/jamie.png",
    "You": "assets/player-you.png",
    "Group member": "assets/taylor.png",
    "Taylor": "assets/taylor.png"
  };
  return map[name] || "assets/player-you.png";
}

function renderScenarioIntro(s) {
  currentId = s.id;
  setScene(s.type);

  const idx = DATA.indexOf(s);
  const completed = state.completed.includes(s.id);

  app.innerHTML = `
    <section class="screen content scenario-intro-wrap">
      ${toolbar(s)}

      <article class="scenario-intro ${introArtClass(s)}">
        <div class="intro-vignette"></div>
        <div class="floating-leaf leaf-1" aria-hidden="true"></div>
        <div class="floating-leaf leaf-2" aria-hidden="true"></div>
        <div class="floating-leaf leaf-3" aria-hidden="true"></div>

        <div class="intro-copy">
          <span class="chapter-label">Scenario ${String(idx + 1).padStart(2, "0")} · ${esc(s.shortCategory)}</span>
          <h1>${esc(s.title)}</h1>
          <p class="intro-subtitle">${esc(s.subtitle)}</p>

          <div class="intro-objective">
            <span class="objective-icon" aria-hidden="true">◈</span>
            <div>
              <small>Learning objective</small>
              <strong>${esc(s.learningGoal)}</strong>
            </div>
          </div>

          <div class="intro-meta">
            <span>◆ ${esc(s.context.location)}</span>
            <span>◆ ${esc(s.skills.slice(0, 2).join(" · "))}</span>
            <span>◆ ${exploredCount(s.id)} / ${approachTarget(s)} approaches explored</span>
          </div>

          <div class="actions">
            <button class="primary intro-start" type="button" data-action="begin-scenario">
              ${completed ? "Explore Again" : "Enter Scenario"} →
            </button>
            <button class="secondary intro-back" type="button" data-action="home">Back to Scenario Menu</button>
          </div>
        </div>

        <aside class="intro-character" aria-hidden="true">
          <div class="portrait-halo"></div>
          <img src="${introPortrait(s)}" alt="">
          <div class="intro-character-card">
            <strong>${s.type === "physical" ? "You · Campus peer" : s.type === "digital" ? "You · Student-club editor" : "Project group"}</strong>
            <span>${s.type === "physical" ? "Observe before assuming" : s.type === "digital" ? "Repair the public source" : "Listen, then adapt"}</span>
          </div>
        </aside>
      </article>
    </section>
  `;

  bind();
  scrollTopView();
  playSfx("dialogue");
  announce(`${s.title}. Scenario introduction.`);
  setTimeout(() => speakSequence([
    { character: "Narrator", text: `Scenario ${idx + 1}. ${s.title}.` },
    { character: "Narrator", text: s.context.situation, delay: 120 }
  ]), 420);
}

function enterScenario(id) {
  const s = scenario(id);
  if (!s) return;

  currentId = id;
  flashSceneTransition(s.shortCategory + " scene");
  setScene(s.type);

  if (s.type === "physical") renderPhysicalObserve(s);
  else if (s.type === "digital") renderDigital(s);
  else renderInterpersonal(s);
}


function renderSplash() {
  stopSpeech();
  document.body.classList.add("splash-mode");
  document.body.dataset.scene = "home";

  app.innerHTML = `
    <section class="screen splash-screen" aria-label="SightLines title screen">
      <div class="splash-campus">
        <div class="splash-cloud cloud-one"></div>
        <div class="splash-cloud cloud-two"></div>
        <div class="splash-birds" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="splash-walker walker-one" aria-hidden="true"></div>
        <div class="splash-walker walker-two" aria-hidden="true"></div>
        <div class="splash-character" aria-hidden="true">
          <div class="splash-character-glow"></div>
          <img src="assets/player-you.png" alt="">
        </div>
        <div class="splash-copy">
          <div class="splash-logo"><span class="brand-mark"><i></i><b></b></span><strong>SightLines</strong></div>
          <p class="splash-kicker">A campus accessibility decision game</p>
          <h1>Notice. Decide. See what changes.</h1>
          <p>
            Three campus situations. Different people, different information, and choices that visibly change the scene.
          </p>
          <div class="splash-actions">
            <button class="primary splash-primary" type="button" data-action="splash-sound">Enter with sound & voices →</button>
            <button class="secondary splash-secondary" type="button" data-action="splash-muted">Continue quietly</button>
          </div>
          <small>Audio can be changed at any time in Settings. Dialogue always remains captioned.</small>
        </div>
        <div class="splash-prompt" aria-hidden="true"><span></span> Click to begin</div>
      </div>
    </section>`;

  bind();
  scrollTopView();
}

async function enterFromSplash(withSound) {
  splashHasRun = true;
  document.body.classList.remove("splash-mode");

  if (withSound) {
    state.prefs.musicEnabled = true;
    state.prefs.sfxEnabled = true;
    state.prefs.voiceEnabled = true;
    state.prefs.ambienceEnabled = true;
    state.prefs.volume = Math.max(state.prefs.volume, 0.50);
    applyPreferences();
    save();
    playSfx("start");
    try { await bgMusic.play(); } catch (e) {}
    await updateAmbienceForScene("home");
  } else {
    state.prefs.musicEnabled = false;
    state.prefs.sfxEnabled = false;
    state.prefs.voiceEnabled = false;
    state.prefs.ambienceEnabled = false;
    bgMusic.pause();
    ambienceAudio.pause();
    applyPreferences();
    save();
  }

  flashSceneTransition("Welcome to SightLines");
  renderHome();
  if (withSound) {
    setTimeout(() => speakLine("Narrator", "Welcome to SightLines. Notice the barrier, decide what you would do, and watch how the scene changes."), 650);
  }
}

/* =========================================================
   HOME
   ========================================================= */

function renderHome() {
  currentId = null;
  interpersonalFirst = null;
  document.body.classList.remove("splash-mode");
  setScene("home");

  app.innerHTML = `
    <section class="screen home-screen">
      <section class="hero-game">
        <div class="home-motion-layer" aria-hidden="true">
          <span class="home-cloud hc1"></span><span class="home-cloud hc2"></span>
          <span class="home-bird hb1"></span><span class="home-bird hb2"></span><span class="home-bird hb3"></span>
          <span class="home-pedestrian hp1"></span><span class="home-pedestrian hp2"></span><span class="home-pedestrian hp3"></span>
          <span class="home-leaf hl1"></span><span class="home-leaf hl2"></span><span class="home-leaf hl3"></span>
        </div>
        <div class="hero-character-showcase" aria-hidden="true">
          <div class="hero-character-glow"></div>
          <img src="assets/player-you.png" alt="">
          <div class="hero-character-tag">
            <strong>Your role</strong>
            <span>Sighted campus peer</span>
          </div>
        </div>

        <div class="hero-panel">
          <p class="eyebrow">Scenario-Based Serious Game · Proof of Concept</p>
          <h1>Small campus decisions can remove — or reproduce — accessibility barriers.</h1>
          <p class="hero-copy">
            Play as a sighted campus peer. Notice what is actually happening, make a decision,
            examine the consequence, reflect, and replay alternatives across physical, digital and interpersonal situations.
          </p>
          <div class="hero-actions">
            <button class="primary" type="button" data-action="start">Begin Experience →</button>
            <button class="secondary" type="button" data-modal="about">About SightLines</button>
          </div>
        </div>

        <div class="hero-bottom">
          <p>
            SightLines does <strong>not</strong> simulate blindness or low vision. It practises barrier recognition,
            autonomy-supporting judgement and inclusive action from the sighted peer's real role.
          </p>
          <span class="sound-hint">
            <span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            Optional original soundtrack available
          </span>
        </div>
      </section>

      <section class="learning-grid" aria-label="Learning goals">
        <article><span class="num">01</span><strong>Recognise barriers</strong><p>Identify environmental, information and group-practice barriers before assuming the person is the problem.</p></article>
        <article><span class="num">02</span><strong>Respect autonomy</strong><p>Ask, listen and adapt rather than assuming assistance is automatically wanted or useful.</p></article>
        <article><span class="num">03</span><strong>Change systems</strong><p>Compare individual workarounds with responses that improve shared access for more people.</p></article>
      </section>

      <section>
        <div class="section-head">
          <div>
            <p class="kicker">Choose your scenario</p>
            <h2>Three campus situations, three interaction styles</h2>
            <p>
              Each scenario uses the same learning loop — <strong>notice → decide → consequence → explanation → reflection → replay</strong> —
              but the interaction changes from scene investigation to accessibility repair to adaptive dialogue.
            </p>
          </div>
          <span class="pill">${state.completed.length} of ${DATA.length} completed</span>
        </div>

        <div class="scenario-grid">
          ${DATA.map((s, i) => `
            <article class="scenario-card ${state.completed.includes(s.id) ? "complete" : ""}">
              <div class="scenario-thumb ${thumbClass(s)}">
                <span class="scenario-number-art">${String(i + 1).padStart(2, "0")}</span>
                <span class="scenario-type-art">${esc(s.shortCategory)}</span>
              </div>
              <div class="scenario-card-body">
                <h3>${esc(s.title)}</h3>
                <p class="subtitle">${esc(s.subtitle)}</p>
                <p class="desc">${esc(s.shortDescription)}</p>
                <div class="skill-area">
                  <strong>Practice areas</strong>
                  <div class="chips">${s.skills.map(k => `<span class="skill-chip">${esc(k)}</span>`).join("")}</div>
                </div>
                <button class="secondary" type="button" data-action="open" data-id="${s.id}">
                  ${state.completed.includes(s.id) ? "Explore again" : "Enter scenario"} →
                </button>
                <span class="explore-state">
                  ${state.completed.includes(s.id) ? "✓ Completed · " : ""}${exploredCount(s.id)} of ${approachTarget(s)} approaches explored
                </span>
              </div>
            </article>
          `).join("")}
        </div>

        <div class="notice">
          <span class="notice-mark">i</span>
          <div>
            <strong>Prototype representation remains provisional.</strong>
            <p>
              The scenarios are literature-informed design material. They are not claimed to represent every blind or low-vision person's experience
              and would require future compensated review/co-design with blind and low-vision contributors and accessibility expertise.
            </p>
          </div>
        </div>
      </section>
    </section>
  `;

  bind();
  scrollTopView();
}

/* =========================================================
   ROUTING
   ========================================================= */

function openScenario(id) {
  const s = scenario(id);
  if (!s) return;
  interpersonalFirst = null;
  flashSceneTransition(s.title);
  renderScenarioIntro(s);
}

/* =========================================================
   SCENARIO 1: PHYSICAL
   ========================================================= */

function renderPhysicalObserve(s) {
  physicalSeen = new Set();
  const idx = DATA.indexOf(s);

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Notice", "Decide", "Consequence", "Reflect"], 0)}

      <article class="card">
        ${titleBlock(s, idx)}
        ${briefing(s)}

        <section class="situation">
          <p class="label">Situation</p>
          <p>${esc(s.context.situation)}</p>
        </section>

        <div class="scene-layout">
          <div class="physical-stage" aria-label="Illustrated campus library pathway with a delivery trolley partly blocking the route">
            <div class="campus-stage-ambient" aria-hidden="true">
              <i class="stage-cloud sc1"></i><i class="stage-cloud sc2"></i>
              <i class="stage-bird sb1"></i><i class="stage-bird sb2"></i>
              <i class="stage-leaf sl1"></i><i class="stage-leaf sl2"></i><i class="stage-leaf sl3"></i>
              <span class="ambient-student as1"></span><span class="ambient-student as2"></span>
            </div>
            ${s.observations.map((o, i) => `
              <button class="hotspot h${i}" type="button" data-action="inspect" data-index="${i}" aria-label="${esc(o.label)}">
                ${esc(o.label)}
              </button>
            `).join("")}
            <div class="scene-caption">
              <span>Explore the highlighted areas</span>
              <span id="scene-cue-count">0 / ${s.observations.length} cues found</span>
            </div>
          </div>

          <section class="interaction-panel">
            <p class="label">Scene investigation</p>
            <h2>What information is actually available to you?</h2>
            <p>
              Inspect at least two cues. The game deliberately separates observable information from assumptions about the student's preferences.
            </p>

            <div class="inspect-list">
              ${s.observations.map((o, i) => `
                <button class="inspect-btn" type="button" data-action="inspect" data-index="${i}">
                  ${esc(o.label)}
                </button>
              `).join("")}
            </div>

            <div id="observation" class="observation">
              Select a highlighted element or a cue button to inspect it.
            </div>

            <div class="continue-block">
              <span id="seen-count">0 of ${s.observations.length} observations inspected</span>
              <button id="continue-physical" class="primary" type="button" data-action="physical-decision" disabled>
                Continue to Decision →
              </button>
            </div>
          </section>
        </div>

        <section class="physical-character-strip" aria-label="People and roles in this scenario">
          <article class="character-card you-card">
            <img src="assets/player-you.png" alt="">
            <div><small>Your role</small><strong>Campus peer</strong><span>You can observe the obstruction, but not another person's preference.</span></div>
          </article>
          <div class="character-link" aria-hidden="true">↔</div>
          <article class="character-card student-card">
            <img src="assets/reflection-student.png" alt="">
            <div><small>Approaching student</small><strong>Preference not yet known</strong><span>Do not infer whether help is wanted merely from appearance.</span></div>
          </article>
        </section>

        ${knownUnknown(s)}
      </article>
    </section>
  `;

  bind();
  scrollTopView();
  announce("Blocked Pathway. Inspect the campus scene before deciding.");
}

function inspectPhysical(i) {
  const s = scenario(currentId);
  const o = s?.observations?.[i];
  if (!o) return;

  const wasNew = !physicalSeen.has(i);
  physicalSeen.add(i);

  document.querySelectorAll(`[data-action="inspect"][data-index="${i}"]`).forEach(el => {
    el.classList.add("seen");
  });

  document.getElementById("observation").innerHTML = `
    <strong>${esc(o.title)}</strong>
    ${esc(o.text)}
    <br><small>Accessibility lens: ${esc(o.lens)}</small>
  `;

  document.getElementById("seen-count").textContent =
    `${physicalSeen.size} of ${s.observations.length} observations inspected`;
  document.getElementById("scene-cue-count").textContent =
    `${physicalSeen.size} / ${s.observations.length} cues found`;

  document.getElementById("continue-physical").disabled = physicalSeen.size < 2;

  if (wasNew) {
    playSfx("inspect");
    showToast(`Cue found · ${o.lens}`);
    stopSpeech();
    speakLine("Narrator", `${o.title}. ${o.text}`);
  }
}

function renderPhysicalDecision() {
  stopSpeech();
  const s = scenario(currentId);
  if (!s) return;

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Notice", "Decide", "Consequence", "Reflect"], 1)}

      <article class="card">
        <p class="eyebrow">Decision point</p>
        <h1>${esc(s.decisionPrompt)}</h1>
        <p class="decision-note">${esc(s.decisionNote)}</p>

        <div class="choice-list">
          ${s.choices.map((ch, i) => choiceButton(ch, i, "physical-choice")).join("")}
        </div>

        <div class="path-note">
          ${exploredCount(s.id)} of ${approachTarget(s)} approaches explored.
          Replay lets you compare how different actions affect access, autonomy and the shared environment.
        </div>
      </article>
    </section>
  `;

  bind();
  scrollTopView();
  setTimeout(() => speakLine("Narrator", s.decisionPrompt), 380);
}

function choosePhysical(i) {
  const s = scenario(currentId);
  const ch = s?.choices?.[i];
  if (!ch) return;

  markExplored(s.id, ch.routeKey);
  lastFeedback = {
    scenarioId: s.id,
    choice: ch,
    scene: ch.sceneResult || null,
    checks: null,
    motionKey: ch.routeKey
  };

  playSfx("decision");
  renderConsequenceCinematic();
}

/* =========================================================
   SCENARIO 2: DIGITAL REPAIR
   ========================================================= */

function renderDigital(s) {
  const idx = DATA.indexOf(s);
  const selected = new Set();

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Inspect", "Repair", "Check", "Reflect"], 1)}

      <article class="card">
        ${titleBlock(s, idx)}
        ${briefing(s)}

        <section class="situation">
          <p class="label">Situation</p>
          <p>${esc(s.context.situation)}</p>
        </section>

        <div class="repair-layout">
          <section class="mock-post" aria-label="Preview of the student club event post">
            <div class="digital-live-ambient" aria-hidden="true"><i class="notif n1">1</i><i class="notif n2">+</i><span class="cursor-ghost">↖</span></div>
            <div class="mock-post-head">
              <span class="avatar" aria-hidden="true">C</span>
              <div><strong>Campus Events Club</strong><small>Public post · preview</small></div>
            </div>

            <img class="poster-img" src="assets/music-poster.svg" alt="Illustrated Campus Music Night poster">

            <div id="digital-preview" class="preview-stack"></div>

            <div id="digital-warning" class="mock-warning">
              Current issue: essential information and registration instructions depend on the image.
            </div>
          </section>

          <section class="repair-panel">
            <p class="label">Accessibility repair task</p>
            <h2>Improve the public post before publishing</h2>
            <p>
              Select any changes you think are useful. The access check will distinguish public barrier-level repairs
              from individual workarounds.
            </p>

            <div class="access-meter" aria-label="Public accessibility repair progress">
              <span class="meter-label">Public repair</span>
              <span class="meter-dot" id="meter-text" title="Page text"></span>
              <span class="meter-dot" id="meter-alt" title="Alternative text"></span>
              <span class="meter-dot" id="meter-link" title="Registration link"></span>
            </div>

            <div class="repair-list">
              ${s.repairOptions.map((o, i) => `
                <div class="repair-option">
                  <input id="repair-${i}" type="checkbox" value="${esc(o.id)}" data-repair="${esc(o.id)}">
                  <label for="repair-${i}">${esc(o.label)}</label>
                </div>
              `).join("")}
            </div>

            <button class="primary publish" type="button" data-action="publish">
              Publish Revised Post & Run Access Check →
            </button>

            <div class="path-note">
              ${exploredCount(s.id)} of ${approachTarget(s)} outcome patterns explored. There is no score for selecting more boxes.
            </div>
          </section>
        </div>

        ${knownUnknown(s)}
      </article>
    </section>
  `;

  bind();
  updateDigitalPreview();
  scrollTopView();
  announce("Image-Only Event Information. Repair the public post and run an access check.");
  setTimeout(() => speakLine("Narrator", "The event details are currently locked inside the poster image. Repair the public post before publishing."), 480);
}

function digitalSelected() {
  return Array.from(document.querySelectorAll("[data-repair]:checked")).map(x => x.value);
}

function handleRepairChange(changedInput) {
  const all = Array.from(document.querySelectorAll("[data-repair]"));

  if (changedInput.value === "leave-unchanged" && changedInput.checked) {
    all.forEach(input => {
      if (input.value !== "leave-unchanged") input.checked = false;
    });
  } else if (changedInput.value !== "leave-unchanged" && changedInput.checked) {
    const none = all.find(input => input.value === "leave-unchanged");
    if (none) none.checked = false;
  }

  updateDigitalPreview();
  playSfx("inspect");
  const repairLabel = changedInput.closest(".repair-option")?.querySelector("label")?.textContent?.trim();
  if (changedInput.checked && repairLabel) { stopSpeech(); speakLine("Narrator", repairLabel, { rate: 1.05 }); }
}

function updateDigitalPreview() {
  if (currentId !== "image-only-event") return;

  const s = scenario(currentId);
  const selected = digitalSelected();
  const preview = document.getElementById("digital-preview");
  const warning = document.getElementById("digital-warning");
  if (!preview || !warning) return;

  const hasText = selected.includes("page-text");
  const hasAlt = selected.includes("alt-text");
  const hasLink = selected.includes("accessible-link");
  const hasPrivate = selected.includes("private-message");

  preview.innerHTML = `
    ${hasText ? `
      <div class="preview-card good">
        <strong>Accessible page text added</strong>
        ${esc(s.poster.title)} — ${esc(s.poster.date)}, ${esc(s.poster.time)}, ${esc(s.poster.venue)}.
        ${esc(s.poster.registration)}. ${esc(s.poster.schedule)}.
      </div>` : ""}
    ${hasAlt ? `
      <div class="preview-card good">
        <strong>Meaningful alternative text added</strong>
        Poster for Campus Music Night. Full date, time, venue, schedule and registration information is available in the page text.
      </div>` : ""}
    ${hasLink ? `
      <div class="preview-card good">
        <strong>Accessible registration control added</strong>
        <span style="color:var(--primary);text-decoration:underline">Register for Campus Music Night</span>
      </div>` : ""}
    ${hasPrivate ? `
      <div class="preview-card">
        <strong>Private message prepared</strong>
        One student can receive a separate copy, but this does not change the public post by itself.
      </div>` : ""}
  `;

  document.getElementById("meter-text")?.classList.toggle("on", hasText);
  document.getElementById("meter-alt")?.classList.toggle("on", hasAlt);
  document.getElementById("meter-link")?.classList.toggle("on", hasLink);

  if (selected.includes("leave-unchanged") || selected.length === 0) {
    warning.textContent = "Current issue: essential information and registration instructions depend on the image.";
  } else if (hasText || hasAlt || hasLink) {
    warning.textContent = "Preview updated. Publish the revision to see which public barriers are resolved and which remain.";
  } else {
    warning.textContent = "A private workaround is prepared, but the public post itself has not changed.";
  }
}

function publishDigital() {
  const s = scenario(currentId);
  if (!s) return;

  const selected = digitalSelected();
  const hasText = selected.includes("page-text");
  const hasAlt = selected.includes("alt-text");
  const hasLink = selected.includes("accessible-link");
  const hasPrivate = selected.includes("private-message");

  let outcome;
  let motionKey;
  if (hasText && hasAlt && hasLink) {
    outcome = s.repairEvaluation.excellent;
    motionKey = "full-public-repair";
  } else if (hasText) {
    outcome = s.repairEvaluation.goodText;
    motionKey = "text-public-repair";
  } else if (hasAlt) {
    outcome = s.repairEvaluation.altOnly;
    motionKey = "alt-only";
  } else if (hasPrivate) {
    outcome = s.repairEvaluation.privateOnly;
    motionKey = "private-workaround";
  } else {
    outcome = s.repairEvaluation.unchanged;
    motionKey = "unchanged";
  }

  const checks = [
    {
      state: hasText ? "good" : "warn",
      text: hasText
        ? "✓ Essential logistics are available as ordinary page text."
        : "○ Essential logistics are still not fully available as ordinary page text."
    },
    {
      state: hasAlt ? "good" : "warn",
      text: hasAlt
        ? "✓ The poster has a meaningful text alternative."
        : "○ The poster still lacks a meaningful text alternative."
    },
    {
      state: hasLink ? "good" : "warn",
      text: hasLink
        ? "✓ Registration is available through a clearly labelled page control."
        : "○ Registration still depends partly on visual-only information."
    },
    {
      state: (hasText && hasAlt && hasLink) ? "good" : hasPrivate ? "warn" : "bad",
      text: (hasText && hasAlt && hasLink)
        ? "✓ The main public barriers in this prototype task are addressed at the source."
        : hasPrivate
          ? "○ One person may receive a workaround, but unresolved barriers remain in the public post."
          : "○ Some visitors still need extra work or another tool/person to recover the information."
    }
  ];

  const chosenLabels = selected.length
    ? selected.map(id => s.repairOptions.find(o => o.id === id)?.label).filter(Boolean).join(" · ")
    : "No changes selected before publishing.";

  markExplored(s.id, outcome.routeKey);

  lastFeedback = {
    scenarioId: s.id,
    choice: {
      ...outcome,
      text: chosenLabels
    },
    scene: null,
    checks,
    motionKey,
    digitalState: { hasText, hasAlt, hasLink, hasPrivate }
  };

  playSfx(hasText && hasAlt && hasLink ? "success" : "decision");
  renderConsequenceCinematic();
}

/* =========================================================
   SCENARIO 3: INTERPERSONAL
   ========================================================= */

function renderInterpersonal(s) {
  const idx = DATA.indexOf(s);

  const firstChoice = Number.isInteger(interpersonalFirst) ? s.firstChoices[interpersonalFirst] : null;

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Listen", "Respond", "Adapt", "Reflect"], firstChoice ? 2 : 1)}

      <article class="card">
        ${titleBlock(s, idx)}
        ${briefing(s)}

        <section class="situation">
          <p class="label">Situation</p>
          <p>${esc(s.context.situation)}</p>
        </section>

        <div class="group-visual" aria-label="Illustrated project group working together around a shared diagram">
          <div class="meeting-motion-layer" aria-hidden="true">
            <span class="pointer-hand ph1"></span><span class="pointer-hand ph2"></span>
            <span class="talk-wave tw1"></span><span class="talk-wave tw2"></span>
            <span class="screen-pulse"></span>
          </div>
          <span class="group-visual-caption">Shared project meeting · visual references are being used heavily</span>
        </div>

        <div class="dialogue-scene">
          <div class="diagram">
            <div class="diagram-title">PROJECT FLOW</div>
            <div class="diagram-row"><span>A</span><i></i><span>B</span><i></i><span>C</span></div>
            <div class="diagram-row"><span>D</span><i></i><span>E</span></div>
            <div class="diagram-note">The group is pointing at this visual structure while speaking.</div>
          </div>

          <div class="dialogue-list character-dialogue-list">
            ${s.dialogue.map((line, i) => `
              <div class="dialogue-entry ${i === 1 ? "reverse" : ""}">
                <img class="dialogue-avatar" data-voice-speaker="${speakerKey(line.speaker)}" src="${portraitForSpeaker(line.speaker)}" alt="">
                <div class="bubble ${i === 0 ? "a" : i === 1 ? "b" : "you"}" data-voice-speaker="${speakerKey(line.speaker)}">
                  <strong>${esc(line.speaker)}</strong>
                  <p>${esc(line.text)}</p>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <section class="dialogue-decision">
          <p class="label">First decision</p>
          <h2>${esc(s.firstDecisionPrompt)}</h2>
          <p class="decision-note">
            Choose how you would respond before the group member has told you their preference.
          </p>
          <div class="choice-list">
            ${s.firstChoices.map((ch, i) => choiceButton(ch, i, "interpersonal-first")).join("")}
          </div>
        </section>

        ${firstChoice ? `
          <section class="followup">
            <div class="character-response character-response-rich" data-voice-speaker="${speakerKey(firstChoice.followUpSpeaker || "Group member")}">
              <img data-voice-speaker="${speakerKey(firstChoice.followUpSpeaker || "Group member")}" src="${portraitForSpeaker(firstChoice.followUpSpeaker || "Group member")}" alt="">
              <div>
                <strong>${esc(firstChoice.followUpSpeaker || "Group member")}</strong>
                <span class="type-reveal">${esc(firstChoice.followUpResponse)}</span>
              </div>
            </div>
            <div class="followup-note">${esc(firstChoice.followUpNote || "You now have new information from the person directly.")}</div>

            <p class="label">Second decision · use the new information</p>
            <h2>${esc(s.secondDecisionPrompt)}</h2>
            <p class="decision-note">Now adapt your group response using what the member actually told you.</p>

            <div class="choice-list">
              ${s.secondChoices.map((ch, i) => choiceButton(ch, i, "interpersonal-second")).join("")}
            </div>
          </section>
        ` : ""}

        <div class="path-note">
          ${exploredCount(s.id)} of ${approachTarget(s)} final approaches explored.
          Replay lets you compare how different group practices affect participation and shared responsibility.
        </div>

        ${knownUnknown(s)}
      </article>
    </section>
  `;

  bind();

  if (firstChoice) {
    setTimeout(() => speakLine(firstChoice.followUpSpeaker || "Group member", firstChoice.followUpResponse), 320);
    setTimeout(() => document.querySelector(".followup")?.scrollIntoView({
      behavior: state.prefs.motionEnabled ? "smooth" : "auto",
      block: "start"
    }), 120);
  } else {
    scrollTopView();
    setTimeout(() => speakSequence(s.dialogue.map((line, i) => ({ character: line.speaker, text: line.text, delay: i ? 120 : 0 }))), 420);
  }

  announce(firstChoice
    ? "New information has been provided by the group member. Make a second decision."
    : "The Visual Group Activity. Respond to the discussion before you know the member's preference.");
}

function chooseInterpersonalFirst(i) {
  stopSpeech();
  const s = scenario(currentId);
  if (!s?.firstChoices?.[i]) return;

  interpersonalFirst = i;
  playSfx("dialogue");
  renderInterpersonal(s);
}

function chooseInterpersonalSecond(i) {
  const s = scenario(currentId);
  const ch = s?.secondChoices?.[i];
  if (!ch) return;

  const first = s.firstChoices[interpersonalFirst];
  markExplored(s.id, ch.routeKey);

  lastFeedback = {
    scenarioId: s.id,
    choice: {
      ...ch,
      text: `First response: ${first.text} Second response: ${ch.text}`
    },
    scene: null,
    checks: null,
    motionKey: ch.routeKey,
    firstChoice: first
  };

  playSfx("decision");
  renderConsequenceCinematic();
}

/* =========================================================
   ANIMATED CONSEQUENCE STAGES
   ========================================================= */

function impactDetails(type, key) {
  const physical = {
    "barrier-first": {
      headline: "The shared route changes before personal help is assumed.",
      changed: "The trolley is moved away from the pedestrian line, reopening the route.",
      remains: "Whether any personal assistance is wanted still belongs to the student.",
      wider: "Other students using the same route benefit from the barrier being removed.",
      watch: "Check safety, ownership and local procedure before moving equipment."
    },
    "physical-guidance": {
      headline: "One person is redirected, but the environmental barrier stays.",
      changed: "The student may be guided around the obstruction in the immediate moment.",
      remains: "The trolley still blocks the shared path for the next person.",
      wider: "Unexpected physical contact can reduce autonomy even when the intention is helpful.",
      watch: "Offer and wait for a response before initiating physical guidance when there is time."
    },
    "warning-only": {
      headline: "Useful information is provided, but the same barrier persists.",
      changed: "The student receives a warning and can adjust their route.",
      remains: "The trolley remains in the path, so the access problem repeats.",
      wider: "Every later route user may have to solve the same obstruction again.",
      watch: "A warning can be appropriate when moving the object is unsafe or not permitted."
    }
  };

  const digital = {
    "full-public-repair": {
      headline: "The public post changes from image-dependent to multi-format.",
      changed: "Page text, meaningful alternative text and an accessible registration control are added.",
      remains: "Real-world testing is still needed to confirm the whole flow works with assistive technologies.",
      wider: "Everyone can use the same public information source instead of requesting a separate version.",
      watch: "Alt text should support the image's purpose rather than duplicate an entire accessible page."
    },
    "text-public-repair": {
      headline: "The largest information barrier is reduced at the source.",
      changed: "Essential logistics are added as ordinary selectable page text.",
      remains: "The image description or registration control may still need refinement.",
      wider: "Public information becomes searchable, scalable and easier to reuse.",
      watch: "Accessibility is a complete user flow, not a single technical checkbox."
    },
    "alt-only": {
      headline: "The image is described, but the information structure is still weak.",
      changed: "A meaningful text alternative is added to the poster.",
      remains: "Detailed logistics still depend too heavily on one image description.",
      wider: "Users gain context, but dense event information is still better as page content.",
      watch: "Alt text complements accessible content; it should not carry an entire complex page."
    },
    "private-workaround": {
      headline: "One person receives information while the public post stays unchanged.",
      changed: "A direct message can solve one immediate access need.",
      remains: "The original public barrier is still present for everyone else.",
      wider: "Access depends on identifying who needs a separate version and sending it manually.",
      watch: "A private message can help, but it should not replace fixing a correctable public source."
    },
    "unchanged": {
      headline: "The attractive poster remains visually complete but access remains fragile.",
      changed: "Nothing in the public information structure changes.",
      remains: "Visitors may still need OCR, another person or extra effort to recover details.",
      wider: "The extra repair work is shifted onto the user rather than the publisher.",
      watch: "Assistive technology is valuable, but it is not a reason to leave avoidable barriers in place."
    }
  };

  const interpersonal = {
    "shared-practice": {
      headline: "The group's shared communication practice changes.",
      changed: "Visual references are named clearly and shared materials gain meaningful labels.",
      remains: "The group still needs to keep checking individual preference as the task changes.",
      wider: "Clearer descriptions reduce ambiguity for the whole group, not only one member.",
      watch: "Do not freeze one preference into a permanent rule; keep asking when context changes."
    },
    "separate-role": {
      headline: "The workflow feels simpler, but participation narrows.",
      changed: "The blind or low-vision member is moved away from diagram work.",
      remains: "The group's inaccessible visual communication practice is unchanged.",
      wider: "A process barrier has been converted into a restriction on one person's role.",
      watch: "Task division is normal; the problem is assigning limits based on assumed capability."
    },
    "individual-burden": {
      headline: "The meeting continues, but access repair is pushed onto one person.",
      changed: "The group explicitly permits questions and clarification requests.",
      remains: "Visual shorthand continues, so repeated repair requests are still necessary.",
      wider: "The person most affected must notice and fix each communication breakdown.",
      watch: "Self-advocacy matters, but it should not be the only mechanism for access."
    }
  };

  return (type === "physical" ? physical : type === "digital" ? digital : interpersonal)[key] || {
    headline: "Your action changes part of the situation.",
    changed: "An immediate outcome becomes visible.",
    remains: "Some contextual factors remain unresolved.",
    wider: "Different people can experience the result differently.",
    watch: "Treat the feedback as a principle to consider, not a universal rule."
  };
}

function consequenceExperience(type, key) {
  const map = {
    physical: {
      "barrier-first": {
        decision: "Clear the shared route first, then ask if help is wanted.",
        phases: ["You act on the barrier", "The student responds", "The shared route changes", "The new state settles"],
        states: [
          { label: "Route", value: "Clear", tone: "good" },
          { label: "Personal help", value: "Not assumed", tone: "good" },
          { label: "Shared barrier", value: "Removed", tone: "good" }
        ],
        log: [
          "The trolley moves out of the pedestrian line.",
          "The student continues without being redirected.",
          "The next route user also meets a clear path."
        ]
      },
      "physical-guidance": {
        decision: "Guide the student around the trolley immediately.",
        phases: ["You move toward the student", "The student reacts to the contact", "The trolley stays in place", "The route remains obstructed"],
        states: [
          { label: "Route", value: "Still blocked", tone: "warn" },
          { label: "Personal help", value: "Assumed", tone: "risk" },
          { label: "Shared barrier", value: "Remains", tone: "warn" }
        ],
        log: [
          "You close the distance and initiate guidance.",
          "The student asks you to check first.",
          "The next person still encounters the trolley."
        ]
      },
      "warning-only": {
        decision: "Warn the student, but leave the trolley where it is.",
        phases: ["You describe the obstacle", "The student changes route", "The trolley remains", "The same barrier can repeat"],
        states: [
          { label: "Route", value: "Still blocked", tone: "warn" },
          { label: "Information", value: "Shared", tone: "good" },
          { label: "Shared barrier", value: "Remains", tone: "warn" }
        ],
        log: [
          "The warning gives useful immediate information.",
          "The student detours around the trolley.",
          "Later route users still need another workaround."
        ]
      }
    },
    digital: {
      "full-public-repair": {
        decision: "Publish page text, meaningful alt text and an accessible registration link.",
        phases: ["Changes are published", "The public post updates", "Multiple formats become available", "One shared source now carries the information"],
        states: [
          { label: "Page text", value: "Present", tone: "good" },
          { label: "Image context", value: "Described", tone: "good" },
          { label: "Registration", value: "Accessible", tone: "good" }
        ],
        log: [
          "Essential event details appear as page text.",
          "The poster receives a meaningful alternative.",
          "Registration is reachable without reading the image."
        ]
      },
      "text-public-repair": {
        decision: "Add essential event details as ordinary page text.",
        phases: ["Text changes are published", "Essential logistics appear", "The biggest information barrier reduces", "Some interface details still need work"],
        states: [
          { label: "Page text", value: "Present", tone: "good" },
          { label: "Image context", value: "Incomplete", tone: "warn" },
          { label: "Registration", value: "Needs review", tone: "warn" }
        ],
        log: [
          "Dates, venue and schedule become selectable text.",
          "Visitors no longer depend entirely on the poster image.",
          "The remaining image/registration details still need review."
        ]
      },
      "alt-only": {
        decision: "Add meaningful alternative text to the poster.",
        phases: ["Alternative text is published", "The poster gains context", "Dense logistics still live in the image", "The source improves only partially"],
        states: [
          { label: "Page text", value: "Still missing", tone: "warn" },
          { label: "Image context", value: "Described", tone: "good" },
          { label: "Detailed logistics", value: "Image-dependent", tone: "warn" }
        ],
        log: [
          "The poster's purpose is now described.",
          "A visitor gains context without seeing the graphic.",
          "Detailed event logistics still need a stronger text structure."
        ]
      },
      "private-workaround": {
        decision: "Send the details privately to one student.",
        phases: ["A private message is sent", "One person receives the details", "The public post does not change", "Other visitors meet the same source"],
        states: [
          { label: "Private workaround", value: "Sent", tone: "good" },
          { label: "Public source", value: "Unchanged", tone: "risk" },
          { label: "Shared access", value: "Still limited", tone: "warn" }
        ],
        log: [
          "One student receives a separate copy of the information.",
          "The public announcement remains image-dependent.",
          "Future visitors still need another workaround."
        ]
      },
      "unchanged": {
        decision: "Leave the public post unchanged.",
        phases: ["No public repair is applied", "The poster remains image-only", "Visitors need an extra recovery step", "The access burden stays with the user"],
        states: [
          { label: "Page text", value: "Missing", tone: "risk" },
          { label: "Public source", value: "Image-only", tone: "risk" },
          { label: "Extra user work", value: "Required", tone: "warn" }
        ],
        log: [
          "The polished poster stays exactly as published.",
          "Basic event information still depends on visual extraction.",
          "Visitors may need OCR, another person or extra effort."
        ]
      }
    },
    interpersonal: {
      "shared-practice": {
        decision: "Name visual references clearly and improve the shared material.",
        phases: ["The group changes how it speaks", "Taylor stays in the same task", "The diagram gains clearer references", "Access becomes part of the group process"],
        states: [
          { label: "Participation", value: "Maintained", tone: "good" },
          { label: "Communication", value: "Adapted", tone: "good" },
          { label: "Access burden", value: "Shared", tone: "good" }
        ],
        log: [
          "Alex starts naming the diagram sections instead of saying 'this' and 'that'.",
          "Taylor remains involved in the diagram work.",
          "The shared material becomes easier for the whole group to follow."
        ]
      },
      "separate-role": {
        decision: "Move Taylor to a separate non-visual task.",
        phases: ["The group reallocates the role", "Taylor moves away from diagram work", "Visual shorthand continues", "An access problem becomes a participation limit"],
        states: [
          { label: "Participation", value: "Narrowed", tone: "risk" },
          { label: "Communication", value: "Unchanged", tone: "risk" },
          { label: "Role", value: "Restricted by assumption", tone: "warn" }
        ],
        log: [
          "Taylor is assigned to notes rather than the diagram.",
          "The group's visual communication does not change.",
          "The process feels simpler because one person's role became smaller."
        ]
      },
      "individual-burden": {
        decision: "Keep the visual shorthand and ask Taylor to interrupt when needed.",
        phases: ["The discussion continues", "Taylor requests clarification", "The same shorthand repeats", "Repair work keeps returning to one person"],
        states: [
          { label: "Participation", value: "Maintained with friction", tone: "warn" },
          { label: "Communication", value: "Unchanged", tone: "warn" },
          { label: "Access burden", value: "Individual", tone: "risk" }
        ],
        log: [
          "The group keeps using visual shorthand.",
          "Taylor interrupts to ask which section is being discussed.",
          "The same clarification cycle can happen again moments later."
        ]
      }
    }
  };

  return map[type]?.[key] || {
    decision: "Your decision is applied to the scene.",
    phases: ["Action", "Human response", "World state", "Outcome"],
    states: [
      { label: "Immediate state", value: "Changed", tone: "good" },
      { label: "Context", value: "Still matters", tone: "warn" },
      { label: "Next step", value: "Reflect", tone: "good" }
    ],
    log: ["The action occurs.", "People respond.", "The new state becomes visible."]
  };
}

function phaseHud(experience) {
  return `<div class="scene-phase-hud" aria-label="Consequence sequence">
    <div class="phase-steps">
      ${experience.phases.map((label, i) => `<div class="phase-step" data-phase-step="${i}"><i>${i + 1}</i><span>${esc(label)}</span></div>`).join("")}
    </div>
    <div id="phase-copy" class="phase-copy">${esc(experience.phases[0])}</div>
  </div>`;
}

function stateStrip(experience) {
  return `<div class="scene-state-strip" aria-label="Resulting scene state">
    ${experience.states.map((item, i) => `<div class="scene-state-chip ${esc(item.tone)}" data-state-chip="${i}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("")}
  </div>`;
}

function sceneLog(experience) {
  return `<section class="scene-log" aria-label="What happened in the scene">
    <p class="label">Scene log</p>
    <div class="scene-log-grid">
      ${experience.log.map((item, i) => `<div class="scene-log-item" data-log-item="${i}"><i>${i + 1}</i><p>${esc(item)}</p></div>`).join("")}
    </div>
  </section>`;
}

function physicalCinematic(key) {
  const copy = {
    "barrier-first": {
      player: "I'll clear the route first.",
      student: "Thanks — I can continue from here.",
      flag: "Barrier removed · choice preserved"
    },
    "physical-guidance": {
      player: "I'll guide you around it.",
      student: "Wait — please ask me first.",
      flag: "Immediate help · autonomy risk · barrier remains"
    },
    "warning-only": {
      player: "There's a trolley ahead.",
      student: "Okay, I'll go around.",
      flag: "Information shared · barrier remains"
    }
  }[key] || {};

  return `
    <div class="consequence-scene physical-consequence route-${esc(key)}" aria-label="Animated consequence of the physical-accessibility choice">
      <div class="physical-clean-bg"></div>
      <div class="scene-decision-echo"><small>Your decision</small><strong>${esc(consequenceExperience("physical", key).decision)}</strong></div>
      <div class="path-glow"></div>
      <div class="shared-route-users" aria-hidden="true"><span class="route-user ru1"></span><span class="route-user ru2"></span></div>
      <div class="animated-trolley" aria-hidden="true">
        <span class="cargo c1"></span><span class="cargo c2"></span><span class="cart-base"></span><i></i><i></i>
      </div>
      <div class="route-arrow" aria-hidden="true"></div>

      <div class="cine-portrait player-portrait" data-voice-speaker="you">
        <img src="assets/player-you.png" alt="">
        <span class="portrait-name">You</span>
      </div>
      <div class="cine-portrait student-portrait" data-voice-speaker="approaching-student">
        <img src="assets/reflection-student.png" alt="">
        <span class="portrait-name">Approaching student</span>
      </div>

      <div class="cine-speech player-speech" data-voice-speaker="you">${esc(copy.player || "You act on the situation.")}</div>
      <div class="cine-speech student-speech" data-voice-speaker="approaching-student">${esc(copy.student || "The situation changes.")}</div>
      <div class="contact-ripple" aria-hidden="true"></div>
      <div class="barrier-stamp">${esc(copy.flag || "Consequence visible")}</div>
    </div>`;
}

function digitalCinematic(key) {
  const st = lastFeedback?.digitalState || {};
  return `
    <div class="consequence-scene digital-consequence route-${esc(key)}" aria-label="Animated publication consequence">
      <div class="scene-decision-echo dark"><small>Your decision</small><strong>${esc(consequenceExperience("digital", key).decision)}</strong></div>
      <div class="publish-browser">
        <div class="browser-bar"><i></i><i></i><i></i><span>Campus Events · public post</span></div>
        <div class="publish-layout">
          <div class="publish-poster-wrap">
            <img class="publish-poster" src="assets/music-poster.svg" alt="">
            <span class="image-only-badge">Image-only source</span>
          </div>
          <div class="published-content">
            <div class="pub-block pub-text ${st.hasText ? "enabled" : ""}">
              <strong>Event details as page text</strong><span>Friday · 7 PM · Student Activity Hall A</span>
            </div>
            <div class="pub-block pub-alt ${st.hasAlt ? "enabled" : ""}">
              <strong>Alternative text</strong><span>Meaningful description connected to the page context</span>
            </div>
            <div class="pub-block pub-link ${st.hasLink ? "enabled" : ""}">
              <strong>Registration</strong><span class="fake-link">Register for Campus Music Night</span>
            </div>
            <div class="pub-block pub-private ${st.hasPrivate ? "enabled" : ""}">
              <strong>Private message</strong><span>One student receives a separate copy</span>
            </div>
          </div>
        </div>
        <div class="publish-scan-line" aria-hidden="true"></div>
        <div class="publish-cursor" aria-hidden="true">↖</div>
        <div class="publish-complete-toast" aria-hidden="true"><i>✓</i><span>Public post updated</span></div>
      </div>
      <div class="audience-flow" aria-hidden="true"><span>A</span><span>B</span><span>C</span></div>
      <div class="viewer-reaction">
        <img src="assets/reflection-student.png" alt="">
        <div>
          <strong>Public access preview</strong>
          <span>${key === "full-public-repair" ? "The same public source now carries accessible information." : key === "private-workaround" ? "The direct message helps one person, but the public source has not changed." : key === "unchanged" ? "The public source still depends on a visual-only poster." : "The post improves, but some public access work remains."}</span>
        </div>
      </div>
    </div>`;
}

function interpersonalCinematic(key) {
  const config = {
    "shared-practice": {
      flag: "Shared practice adapts",
      taylor: "Yes — naming the diagram parts works for me.",
      alex: "I'll say which box I'm referring to.",
      diagram: "clear"
    },
    "separate-role": {
      flag: "Participation narrows",
      taylor: "I'd rather stay involved in the diagram work.",
      alex: "We'll keep the diagram discussion as it is.",
      diagram: "same"
    },
    "individual-burden": {
      flag: "Clarification burden repeats",
      taylor: "Could you describe which section you mean?",
      alex: "This box — over here.",
      diagram: "burden"
    }
  }[key] || {};

  return `
    <div class="consequence-scene interpersonal-consequence route-${esc(key)}" aria-label="Animated group-work consequence">
      <div class="group-clean-bg"></div>
      <div class="scene-decision-echo"><small>Your decision</small><strong>${esc(consequenceExperience("interpersonal", key).decision)}</strong></div>
      <div class="meeting-board ${esc(config.diagram || "same")}">
        <span class="node n1">A</span><i class="edge e1"></i><span class="node n2">B</span><i class="edge e2"></i><span class="node n3">C</span>
        <b class="board-caption">${key === "shared-practice" ? "Named visual references" : key === "separate-role" ? "Visual shorthand unchanged" : "Repeated clarification requests"}</b>
        <div class="board-labels" aria-hidden="true"><span>Opening</span><span>Evidence</span><span>Conclusion</span></div>
      </div>
      <div class="participation-route" aria-hidden="true"><i class="pr1"></i><i class="pr2"></i><i class="pr3"></i></div>

      <div class="meeting-person alex-person" data-voice-speaker="alex"><img src="assets/alex.png" alt=""><span>Alex</span></div>
      <div class="meeting-person jamie-person"><img src="assets/jamie.png" alt=""><span>Jamie</span></div>
      <div class="meeting-person taylor-person" data-voice-speaker="taylor"><img src="assets/taylor.png" alt=""><span>Taylor</span></div>
      <div class="meeting-person you-person"><img src="assets/player-you.png" alt=""><span>You</span></div>

      <div class="meeting-bubble alex-reaction" data-voice-speaker="alex">${esc(config.alex || "The group reacts.")}</div>
      <div class="meeting-bubble taylor-reaction" data-voice-speaker="taylor">${esc(config.taylor || "New information changes the next step.")}</div>
      <div class="clarification-stack" aria-hidden="true"><i>?</i><i>?</i><i>?</i></div>
      <div class="role-card" aria-hidden="true"><strong>Notes only</strong><span>Role narrowed by assumption</span></div>
      <div class="barrier-stamp">${esc(config.flag || "Group consequence")}</div>
    </div>`;
}

function renderConsequenceCinematic() {
  if (!lastFeedback) return;
  const s = scenario(lastFeedback.scenarioId);
  const key = lastFeedback.motionKey || lastFeedback.choice.routeKey || "default";
  const meta = impactDetails(s.type, key);
  const experience = consequenceExperience(s.type, key);
  currentId = s.id;
  setScene(s.type);

  const sceneHtml = s.type === "physical"
    ? physicalCinematic(key)
    : s.type === "digital"
      ? digitalCinematic(key)
      : interpersonalCinematic(key);

  app.innerHTML = `
    <section class="screen content consequence-screen">
      ${toolbar(s)}
      ${journey(["Notice", "Decide", "Scene Response", "Reflect"], 2)}

      <article class="card consequence-card">
        <div class="consequence-heading">
          <div>
            <p class="eyebrow">What happens next</p>
            <h1>${esc(meta.headline)}</h1>
            <p>The scene plays in four beats: your action, the human response, the world state, and the resulting access condition.</p>
          </div>
          <span id="simulation-status" class="simulation-status"><i></i> Action starting…</span>
        </div>

        ${phaseHud(experience)}
        ${sceneHtml}
        ${stateStrip(experience)}
        ${sceneLog(experience)}

        <div class="impact-timeline" aria-label="Consequence information timeline">
          <article class="impact-card beat-1"><span>01</span><strong>What changed</strong><p>${esc(meta.changed)}</p></article>
          <article class="impact-card beat-2"><span>02</span><strong>What remains</strong><p>${esc(meta.remains)}</p></article>
          <article class="impact-card beat-3"><span>03</span><strong>Who else is affected</strong><p>${esc(meta.wider)}</p></article>
          <article class="impact-card beat-4"><span>04</span><strong>What to keep in mind</strong><p>${esc(meta.watch)}</p></article>
        </div>

        <div class="consequence-actions">
          <button id="continue-analysis" class="primary" type="button" data-action="analysis" disabled>See why it matters →</button>
          <button class="secondary" type="button" data-action="replay-consequence">Replay consequence</button>
          <button class="ghost-button" type="button" data-action="skip-animation">Skip</button>
        </div>
      </article>
    </section>`;

  bind();
  scrollTopView();
  setTimeout(runConsequenceAnimation, 80);
  announce("Animated consequence scene. Watch how the situation changes after your decision.");
}

function setConsequencePhase(index, text) {
  document.querySelectorAll("[data-phase-step]").forEach((el, i) => {
    el.classList.toggle("active", i === index);
    el.classList.toggle("done", i < index);
  });
  const copy = document.getElementById("phase-copy");
  if (copy && text) {
    copy.classList.remove("phase-copy-enter");
    void copy.offsetWidth;
    copy.textContent = text;
    copy.classList.add("phase-copy-enter");
  }
}

function revealLog(index) {
  document.querySelector(`[data-log-item="${index}"]`)?.classList.add("visible");
}

function revealStateStrip() {
  document.querySelectorAll("[data-state-chip]").forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), state.prefs.motionEnabled ? i * 90 : 0);
  });
}

function revealImpactCards() {
  document.querySelectorAll(".impact-card").forEach((el, i) => {
    setTimeout(() => el.classList.add("impact-visible"), state.prefs.motionEnabled ? i * 120 : 0);
  });
}


function consequenceVoiceLines(type, key) {
  const physical = {
    "barrier-first": [
      { character: "You", text: "I'll clear the route first." },
      { character: "Approaching student", text: "Thanks. I can continue from here." }
    ],
    "physical-guidance": [
      { character: "You", text: "I'll guide you around it." },
      { character: "Approaching student", text: "Wait. Please ask me first." }
    ],
    "warning-only": [
      { character: "You", text: "There's a trolley ahead." },
      { character: "Approaching student", text: "Okay. I'll go around." }
    ]
  };
  const digital = {
    "full-public-repair": [
      { character: "Narrator", text: "The public post updates. Event details, image context, and registration are now available without relying on the poster alone." }
    ],
    "text-public-repair": [
      { character: "Narrator", text: "The essential event details now appear as page text, but some parts of the public flow still need review." }
    ],
    "alt-only": [
      { character: "Narrator", text: "The poster now has context, but dense event logistics are still carried mainly by the image." }
    ],
    "private-workaround": [
      { character: "Narrator", text: "One student receives the details privately. The public post itself has not changed." }
    ],
    "unchanged": [
      { character: "Narrator", text: "No public repair is applied. Visitors still need an extra step to recover the information." }
    ]
  };
  const interpersonal = {
    "shared-practice": [
      { character: "Alex", text: "I'll say which box I'm referring to." },
      { character: "Taylor", text: "Yes. Naming the diagram parts works for me." }
    ],
    "separate-role": [
      { character: "Alex", text: "We'll keep the diagram discussion as it is." },
      { character: "Taylor", text: "I'd rather stay involved in the diagram work." }
    ],
    "individual-burden": [
      { character: "Alex", text: "This box, over here." },
      { character: "Taylor", text: "Could you describe which section you mean?" }
    ]
  };
  return ({ physical, digital, interpersonal })[type]?.[key] || [];
}

function runConsequenceAnimation() {
  stopSpeech();
  const stage = document.querySelector(".consequence-scene");
  const card = document.querySelector(".consequence-card");
  const status = document.getElementById("simulation-status");
  const continueBtn = document.getElementById("continue-analysis");
  if (!stage || !card || !continueBtn || !lastFeedback) return;

  const s = scenario(lastFeedback.scenarioId);
  const key = lastFeedback.motionKey || lastFeedback.choice.routeKey || "default";
  const experience = consequenceExperience(s.type, key);
  const voiceLines = consequenceVoiceLines(s.type, key);
  const token = ++consequenceRunToken;

  stage.classList.remove("scene-running", "scene-resolved", "phase-action", "phase-response", "phase-state", "phase-outcome");
  card.classList.remove("timeline-resolved");
  document.querySelectorAll(".impact-card").forEach(el => el.classList.remove("impact-visible"));
  document.querySelectorAll("[data-log-item]").forEach(el => el.classList.remove("visible"));
  document.querySelectorAll("[data-state-chip]").forEach(el => el.classList.remove("visible"));
  document.querySelectorAll("[data-phase-step]").forEach(el => el.classList.remove("active", "done"));
  void stage.offsetWidth;

  continueBtn.disabled = true;
  stage.classList.add("scene-running", "phase-action");
  setConsequencePhase(0, experience.phases[0]);
  if (status) status.innerHTML = "<i></i> Action in progress";
  if (voiceLines[0]) speakLine(voiceLines[0].character, voiceLines[0].text);

  if (!state.prefs.motionEnabled) {
    stage.classList.add("phase-response", "phase-state", "phase-outcome", "scene-resolved");
    setConsequencePhase(3, experience.phases[3]);
    document.querySelectorAll("[data-log-item]").forEach(el => el.classList.add("visible"));
    document.querySelectorAll("[data-state-chip]").forEach(el => el.classList.add("visible"));
    document.querySelectorAll(".impact-card").forEach(el => el.classList.add("impact-visible"));
    card.classList.add("timeline-resolved");
    continueBtn.disabled = false;
    if (status) status.innerHTML = "<i></i> Consequence resolved";
    return;
  }

  setTimeout(() => {
    if (token !== consequenceRunToken) return;
    stage.classList.add("phase-response");
    setConsequencePhase(1, experience.phases[1]);
    revealLog(0);
    if (status) status.innerHTML = "<i></i> Human response";
    playSfx("dialogue");
    if (voiceLines[1]) speakLine(voiceLines[1].character, voiceLines[1].text);
  }, 850);

  setTimeout(() => {
    if (token !== consequenceRunToken) return;
    stage.classList.add("phase-state");
    setConsequencePhase(2, experience.phases[2]);
    revealLog(1);
    if (status) status.innerHTML = "<i></i> World state changing";
    playSfx(lastFeedback?.choice?.type === "constructive" ? "success" : "decision");
  }, 1850);

  setTimeout(() => {
    if (token !== consequenceRunToken) return;
    stage.classList.add("phase-outcome");
    setConsequencePhase(3, experience.phases[3]);
    revealLog(2);
    revealStateStrip();
    if (status) status.innerHTML = "<i></i> Outcome settling";
  }, 2850);

  setTimeout(() => {
    if (token !== consequenceRunToken) return;
    revealImpactCards();
    card.classList.add("timeline-resolved");
  }, 3350);

  setTimeout(() => {
    if (token !== consequenceRunToken) return;
    stage.classList.add("scene-resolved");
    continueBtn.disabled = false;
    if (status) status.innerHTML = "<i></i> Consequence resolved";
    announce("Consequence complete. You can review the scene state or continue to the explanation.");
  }, 4300);
}

function skipConsequenceAnimation() {
  stopSpeech();
  consequenceRunToken += 1;
  const stage = document.querySelector(".consequence-scene");
  const card = document.querySelector(".consequence-card");
  const status = document.getElementById("simulation-status");
  const continueBtn = document.getElementById("continue-analysis");
  const s = lastFeedback ? scenario(lastFeedback.scenarioId) : null;
  const key = lastFeedback ? (lastFeedback.motionKey || lastFeedback.choice.routeKey || "default") : "default";
  const experience = s ? consequenceExperience(s.type, key) : null;

  stage?.classList.add("scene-running", "phase-action", "phase-response", "phase-state", "phase-outcome", "scene-resolved");
  card?.classList.add("timeline-resolved");
  document.querySelectorAll("[data-log-item]").forEach(el => el.classList.add("visible"));
  document.querySelectorAll("[data-state-chip]").forEach(el => el.classList.add("visible"));
  document.querySelectorAll(".impact-card").forEach(el => el.classList.add("impact-visible"));
  if (experience) setConsequencePhase(3, experience.phases[3]);
  if (continueBtn) continueBtn.disabled = false;
  if (status) status.innerHTML = "<i></i> Consequence resolved";
}

/* =========================================================
   FEEDBACK
   ========================================================= */

function renderFeedback() {
  stopSpeech();
  if (!lastFeedback) return;

  const s = scenario(lastFeedback.scenarioId);
  const ch = lastFeedback.choice;
  currentId = s.id;
  setScene(s.type);

  markLenses(ch.lenses || []);

  const feedbackArtClass =
    s.type === "physical" ? "thumb-physical" :
    s.type === "digital" ? "thumb-digital" : "thumb-interpersonal";

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Notice", "Decide", "Consequence", "Reflect"], 2)}

      <article class="card">
        <div class="feedback-hero">
          <div class="feedback-art ${feedbackArtClass}" aria-hidden="true"></div>
          <div class="feedback-hero-copy">
          <p class="eyebrow">Your choice leads to…</p>
          <h1>Examine the consequence — not a “correct answer”.</h1>
          <p>
            SightLines uses consequences and explanation to help you compare decisions.
            The status below describes the response pattern; it is not a moral judgement of you as a player.
          </p>
          </div>
        </div>

        ${lastFeedback.scene ? `
          <section class="scene-change">
            <p class="label">The environment changes</p>
            <div class="state-grid">
              <div class="state">
                <small>Before</small>
                <strong>${esc(lastFeedback.scene.before)}</strong>
              </div>
              <div class="state-arrow" aria-hidden="true">→</div>
              <div class="state after">
                <small>After</small>
                <strong>${esc(lastFeedback.scene.after)}</strong>
              </div>
            </div>
            <p>${esc(lastFeedback.scene.message)}</p>
          </section>
        ` : ""}

        ${lastFeedback.checks ? `
          <section class="check-panel">
            <p class="label">Public-post access check</p>
            <div class="check-list">
              ${lastFeedback.checks.map(c => `<div class="check ${c.state}">${esc(c.text)}</div>`).join("")}
            </div>
          </section>
        ` : ""}

        <section class="feedback-section choice-review">
          <p class="label">Your approach</p>
          <p>${esc(ch.text)}</p>
        </section>

        <span class="status ${esc(ch.type)}">${esc(ch.status)}</span>

        <section class="feedback-section">
          <p class="label">Possible consequence</p>
          <p>${esc(ch.consequence)}</p>
        </section>

        <section class="feedback-section">
          <p class="label">Accessibility lenses</p>
          <div class="lens-row">${(ch.lenses || []).map(l => `<span class="lens">${esc(l)}</span>`).join("")}</div>
        </section>

        <section class="feedback-section explain">
          <p class="label">Why this matters</p>
          <p>${esc(ch.explanation)}</p>
        </section>

        <section class="feedback-section nuance">
          <p class="label">Why this is not a universal script</p>
          <p>${esc(ch.notUniversal || "Individual preferences and situational details can change what response is most useful. The transferable goal is to ask, listen, adapt and address barriers where feasible.")}</p>
        </section>

        <section class="feedback-section principle">
          <p class="label">Transferable principle</p>
          <p>${esc(s.takeaway)}</p>
        </section>

        <div class="actions">
          <button class="primary" type="button" data-action="reflect">Continue to Reflection →</button>
          <button class="secondary" type="button" data-action="replay">Replay & compare another approach</button>
        </div>
      </article>
    </section>
  `;

  bind();
  scrollTopView();
  announce(`Consequence feedback. ${ch.status}`);
  setTimeout(() => speakLine("Narrator", `${ch.status}. ${ch.consequence}`), 420);
}

/* =========================================================
   REFLECTION
   ========================================================= */

function renderReflection() {
  stopSpeech();
  const s = scenario(currentId);
  if (!s) return;

  const saved = state.reflections[s.id] || {};

  app.innerHTML = `
    <section class="screen content">
      ${toolbar(s)}
      ${journey(["Notice", "Decide", "Consequence", "Reflect"], 3)}

      <article class="card">
        <div class="reflection-layout">
          <div>
            <p class="eyebrow">Reflection</p>
            <h1>Turn the consequence into a reusable principle.</h1>

            <div class="reflection-box">
              <span class="question-mark">?</span>
              <p>${esc(s.reflection.question)}</p>
            </div>

            <fieldset class="reflection-options">
              <legend>Select the idea that currently stands out most to you</legend>
              <div class="radio-grid">
                ${s.reflection.options.map((o, i) => `
                  <div class="radio">
                    <input id="r-${i}" name="reflection" type="radio" value="${esc(o)}" ${saved.theme === o ? "checked" : ""}>
                    <label for="r-${i}">${esc(o)}</label>
                  </div>
                `).join("")}
              </div>
            </fieldset>
          </div>

          <aside class="reflection-side" aria-hidden="true">
            <div class="reflection-character-glow"></div>
            <img class="reflection-character" src="assets/reflection-student.png" alt="">
            <blockquote>“Notice the barrier. Ask rather than assume. Adapt to what the person tells you.”</blockquote>
          </aside>
        </div>

        <label class="note-label" for="reflection-note">
          ${esc(s.reflection.prompt)}
          <small>(optional in this PoC)</small>
        </label>

        <textarea id="reflection-note" rows="5" maxlength="600" placeholder="Write a short reflection if useful.">${esc(saved.note || "")}</textarea>
        <div class="count"><span id="char-count">${(saved.note || "").length}</span> / 600</div>

        <div class="reflection-reminder">
          <strong>Remember:</strong> individual preferences can vary. SightLines practises a flexible decision process rather than a fixed etiquette script.
        </div>

        <div class="actions">
          <button class="primary" type="button" data-action="complete">Complete scenario →</button>
          <button class="secondary" type="button" data-action="replay">Replay before continuing</button>
        </div>
      </article>
    </section>
  `;

  bind();

  const textarea = document.getElementById("reflection-note");
  textarea.addEventListener("input", () => {
    document.getElementById("char-count").textContent = textarea.value.length;
  });

  scrollTopView();
  announce("Reflection step.");
  setTimeout(() => speakLine("Narrator", s.reflection.question), 420);
}

function finishScenario() {
  const s = scenario(currentId);
  if (!s) return;

  const radio = document.querySelector('input[name="reflection"]:checked');
  const note = document.getElementById("reflection-note")?.value.trim() || "";

  state.reflections[s.id] = {
    theme: radio ? radio.value : "",
    note
  };

  complete(s.id);
  playSfx("complete");
  spawnConfetti(30);
  showToast(`Scenario complete · ${s.title}`);

  if (state.completed.length === DATA.length) {
    setTimeout(renderSummary, state.prefs.motionEnabled ? 280 : 0);
  } else {
    const next = DATA.find(x => !state.completed.includes(x.id));
    setTimeout(() => openScenario(next?.id || DATA[0].id), state.prefs.motionEnabled ? 260 : 0);
  }
}

/* =========================================================
   SUMMARY
   ========================================================= */

function renderSummary() {
  stopSpeech();
  setScene("summary");
  currentId = null;

  app.innerHTML = `
    <section class="screen content">
      <section class="summary-stage">
        <div class="summary-stage-copy">
          <p class="eyebrow">Journey complete</p>
          <h1>You completed the SightLines proof-of-concept loop.</h1>
          <p>
            Your summary reports exploration across accessibility knowledge, barrier recognition and respectful helping judgement.
            There is no moral score or leaderboard.
          </p>

          <div class="stats">
            <div><strong>${state.completed.length} / ${DATA.length}</strong><span>Scenarios completed</span></div>
            <div><strong>${allExploredCount()} / ${totalApproachTarget()}</strong><span>Approaches explored</span></div>
            <div><strong>${state.lenses.length}</strong><span>Accessibility lenses encountered</span></div>
          </div>
        </div>
      </section>

      <article class="card" style="margin-top:22px">
        <div class="domain-grid">
          <article><span class="num">01</span><strong>Accessibility knowledge</strong><p>Understanding why environments, information and group practices can create access barriers.</p></article>
          <article><span class="num">02</span><strong>Barrier recognition</strong><p>Identifying the access problem before assuming the disabled person is the problem.</p></article>
          <article><span class="num">03</span><strong>Helping judgement</strong><p>Balancing assistance, autonomy, individual preference and barrier-level action.</p></article>
        </div>

        <hr class="divider">

        <p class="kicker">Scenario exploration</p>
        <div class="summary-list">
          ${DATA.map(s => `
            <div class="summary-row">
              <strong>${esc(s.title)} · ${exploredCount(s.id)} of ${approachTarget(s)} approaches explored</strong>
              <p>${esc(s.takeaway)}</p>
            </div>
          `).join("")}
        </div>

        <hr class="divider">

        <p class="kicker">Accessibility lenses encountered</p>
        <div class="summary-lenses">
          ${state.lenses.length
            ? state.lenses.slice().sort().map(l => `<span class="lens">✓ ${esc(l)}</span>`).join("")
            : '<span class="lens">No lenses recorded yet</span>'}
        </div>

        <hr class="divider">

        <p class="kicker">Your reflections</p>
        <div class="summary-list">
          ${DATA.map(s => {
            const r = state.reflections[s.id] || {};
            return `
              <div class="summary-row">
                <strong>${esc(s.title)}</strong>
                <p><b>Selected principle:</b> ${esc(r.theme || "No principle selected.")}</p>
                ${r.note ? `<p><b>Your note:</b> “${esc(r.note)}”</p>` : ""}
              </div>
            `;
          }).join("")}
        </div>

        <div class="notice">
          <span class="notice-mark">i</span>
          <div>
            <strong>Prototype limitation</strong>
            <p>
              These scenarios are literature-informed design material, not validated representations of every blind or low-vision person's experience.
              The project proposes future compensated review and co-design before treating scenario content as final.
            </p>
          </div>
        </div>

        <div class="actions">
          <button class="primary" type="button" data-action="home">Explore more approaches</button>
          <button class="secondary" type="button" data-action="reset">Reset session</button>
        </div>
      </article>
    </section>
  `;

  bind();
  scrollTopView();
  playSfx("summary");
  spawnConfetti(70);
  announce("SightLines session complete.");
  setTimeout(() => speakLine("Narrator", "Journey complete. You can replay any scenario to compare more approaches."), 520);
}

/* =========================================================
   MODALS / INFORMATION
   ========================================================= */

const modalData = {
  how: {
    title: "How to play SightLines",
    html: `
      <p>SightLines is an exploration-based decision game, not a scored quiz.</p>
      <ol>
        <li><strong>Notice:</strong> inspect information a campus peer could reasonably observe.</li>
        <li><strong>Decide:</strong> choose an action or repair under realistic uncertainty.</li>
        <li><strong>Scene response:</strong> watch people, objects and information visibly react to your choice.</li>
        <li><strong>Consequence:</strong> compare what changed, what remains unresolved, and who else is affected.</li>
        <li><strong>Explain:</strong> connect the result to access, autonomy, communication and shared responsibility.</li>
        <li><strong>Reflect:</strong> identify a principle that transfers to another situation.</li>
        <li><strong>Replay:</strong> compare alternatives without receiving a moral score.</li>
      </ol>
      <p>
        The three scenarios deliberately use different interactions: scene investigation, a digital repair task,
        and a two-stage adaptive dialogue. Keyboard interaction is supported. Music, sound effects and decorative motion are optional.
      </p>
    `
  },

  about: {
    title: "About SightLines",
    html: `
      <p><strong>Purpose.</strong> SightLines addresses a knowledge-to-action gap: supportive intentions do not necessarily equip sighted peers to recognise accessibility barriers, judge whether help is wanted, communicate accessibly or avoid taking control.</p>
      <p><strong>Audience.</strong> The primary player audience is sighted university students aged 18–25.</p>
      <p><strong>Player role.</strong> Players remain sighted campus peers. The game does not simulate blindness or low vision.</p>
      <p><strong>PoC scope.</strong> Three end-to-end scenarios demonstrate physical, digital and interpersonal barriers through a complete notice → decide → consequence → explanation → reflection → replay loop.</p>
    `
  },

  evidence: {
    title: "Evidence & Design Principles",
    html: `
      <h3>Focus on environments and systems</h3>
      <p>Scenarios foreground blocked routes, inaccessible information and exclusionary group practices instead of framing the disabled body as the problem.</p>

      <h3>Ask, listen and preserve autonomy</h3>
      <p>Where personal assistance or preference matters, the design promotes consultation and adaptation rather than assuming help is automatically wanted.</p>

      <h3>Teach a process, not one universal script</h3>
      <p>Preferences, skills, technologies and access needs vary, so feedback includes context, limitations and transferable principles.</p>

      <h3>Use instructional support</h3>
      <p>Choice → consequence → explanation → reflection → replay connects actions to reasoning and encourages comparison rather than guesswork.</p>
    `
  },

  sources: {
    title: "Sources & Credits",
    html: `
      <p>The prototype content is based on the SightLines project paper and its literature review. Selected sources informing the design include:</p>
      <ul>
        <li>Lourens, Watermeyer & Swartz (2019) — relational dimensions of help and visual impairment.</li>
        <li>Mankoff, Hayes & Kasnitz (2010) — disability-studies framing and environment/system focus.</li>
        <li>Nario-Redmond, Gospodinov & Cobb (2017) and Silverman, Gwinn & Van Boven (2015) — risks of disability simulations.</li>
        <li>Croft (2020), Frank, McLinden & Douglas (2020), and Nwosu et al. (2024) — higher-education barriers and participation.</li>
        <li>Wouters et al. (2013) and Wouters & van Oostendorp (2013) — serious-game learning and instructional support.</li>
        <li>Manitsa et al. (2024) — participatory development logic from Vi-Connect.</li>
        <li>Taghikhah et al. (2019) — visible consequences and reflection as a design principle.</li>
      </ul>

      <p><strong>Original prototype assets.</strong> Campus, pathway, event-poster, group-room and summary illustrations are original vector assets created for this prototype. The optional background soundtrack is an original procedurally composed ambient loop generated for SightLines. Interface sound effects are generated locally with the Web Audio API.</p>
    `
  },

  accessibility: {
    title: "Accessibility in this Prototype",
    html: `
      <ul>
        <li>Core gameplay can be completed with keyboard input.</li>
        <li>Visible focus states are provided.</li>
        <li>Meaning is not conveyed by colour alone; status text accompanies colour.</li>
        <li>Text remains selectable and responsive.</li>
        <li>Background music and interface sound effects are optional and off by default.</li>
        <li>Decorative motion can be disabled and respects the browser's reduced-motion preference.</li>
        <li>No named account is required.</li>
        <li>Progress and reflections are stored only in local browser storage on the same device.</li>
      </ul>
      <p>Full assistive-technology compatibility is a target to be tested, not a validated claim at this stage.</p>
    `
  },

  ethics: {
    title: "Ethics & Representation",
    html: `
      <p>SightLines must not speak for lived experience, frame disability as tragedy or helplessness, or reward paternalistic assistance.</p>
      <ul>
        <li>Blind and low-vision people are not positioned as learners who must adapt to sighted behaviour.</li>
        <li>The game avoids impairment simulation.</li>
        <li>Feedback promotes asking, respecting preference and changing exclusionary systems.</li>
        <li>Scores do not label the player morally good or bad.</li>
        <li>Scenario wording and preferred responses remain provisional pending future paid review/co-design with blind and low-vision contributors and accessibility expertise.</li>
      </ul>
      <p>The source design does not claim that formal consultation, cultural clearance, user testing or effectiveness evaluation has already occurred.</p>
    `
  }
};

function openModal(kind) {
  const item = modalData[kind];
  if (!item) return;

  document.getElementById("modal-title").textContent = item.title;
  document.getElementById("modal-body").innerHTML = item.html;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modal-close").focus();
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function openSettings() {
  applyPreferences();
  settingsModal.classList.remove("hidden");
  document.getElementById("settings-close").focus();
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

/* =========================================================
   RESET / FULLSCREEN
   ========================================================= */

function reset() {
  if (!confirm("Reset all SightLines progress and reflections stored on this device?")) return;

  const prefs = { ...state.prefs };
  state = {
    completed: [],
    explored: {},
    reflections: {},
    lenses: [],
    prefs
  };

  save();
  updateProgress();
  playSfx("reset");
  showToast("Session progress reset");
  renderHome();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  } catch (error) {
    console.warn("Fullscreen is unavailable.", error);
    showToast("Fullscreen is unavailable in this browser");
  }
}

/* =========================================================
   CHOICE COMMIT MICRO-ANIMATIONS
   ========================================================= */

function commitChoiceAnimation(button, callback, delay = 520) {
  if (!button || button.dataset.committing === "true") return;
  button.dataset.committing = "true";

  const list = button.closest(".choice-list");
  list?.classList.add("choice-committing");
  button.classList.add("choice-selected");

  const marker = document.createElement("span");
  marker.className = "choice-confirm-marker";
  marker.textContent = "✓ Decision locked";
  button.appendChild(marker);

  const transition = document.createElement("div");
  transition.className = "decision-transition-note";
  transition.innerHTML = `<i></i><span>Scene responding to your choice…</span>`;
  list?.after(transition);

  playSfx("decision");
  setTimeout(callback, state.prefs.motionEnabled ? Math.max(delay, 620) : 0);
}

function commitPublishAnimation(button, callback) {
  if (!button || button.dataset.committing === "true") return;
  button.dataset.committing = "true";
  button.classList.add("publish-committing");
  button.innerHTML = `<span class="publish-spinner"></span> Publishing changes…`;
  playSfx("decision");
  setTimeout(callback, state.prefs.motionEnabled ? 680 : 0);
}


function setupScrollReveals() {
  const targets = Array.from(document.querySelectorAll(
    ".card > section, .card > .actions, .card > .details, .scenario-card, .summary-row, .domain-grid > article, .impact-card"
  ));
  if (!targets.length) return;
  targets.forEach((el, i) => {
    el.classList.add("scroll-reveal");
    el.style.setProperty("--reveal-delay", `${Math.min(i * 35, 210)}ms`);
  });
  if (!state.prefs.motionEnabled || !("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("revealed"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
  targets.forEach(el => observer.observe(el));
}

function setupTiltPolish() {
  if (!state.prefs.motionEnabled || !window.matchMedia?.("(pointer:fine)")?.matches) return;
  document.querySelectorAll(".scenario-card, .mock-post, .interaction-panel").forEach(el => {
    el.addEventListener("pointermove", event => {
      const r = el.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - .5;
      const y = (event.clientY - r.top) / r.height - .5;
      el.style.setProperty("--tilt-x", `${(-y * 2.2).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 2.2).toFixed(2)}deg`);
      el.classList.add("tilting");
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("tilting");
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
    });
  });
}

/* =========================================================
   EVENT BINDING
   ========================================================= */

function bind() {
  document.querySelectorAll("[data-action]").forEach(el => {
    el.onclick = () => {
      const action = el.dataset.action;

      if (action === "home") renderHome();
      else if (action === "splash-sound") enterFromSplash(true);
      else if (action === "splash-muted") enterFromSplash(false);
      else if (action === "start") {
        const next = DATA.find(s => !state.completed.includes(s.id)) || DATA[0];
        openScenario(next.id);
      }
      else if (action === "open") openScenario(el.dataset.id);
      else if (action === "inspect") inspectPhysical(Number(el.dataset.index));
      else if (action === "begin-scenario") enterScenario(currentId);
      else if (action === "physical-decision") renderPhysicalDecision();
      else if (action === "physical-choice") commitChoiceAnimation(el, () => choosePhysical(Number(el.dataset.index)));
      else if (action === "publish") commitPublishAnimation(el, publishDigital);
      else if (action === "interpersonal-first") commitChoiceAnimation(el, () => chooseInterpersonalFirst(Number(el.dataset.index)), 360);
      else if (action === "interpersonal-second") commitChoiceAnimation(el, () => chooseInterpersonalSecond(Number(el.dataset.index)));
      else if (action === "analysis") renderFeedback();
      else if (action === "replay-consequence") runConsequenceAnimation();
      else if (action === "skip-animation") skipConsequenceAnimation();
      else if (action === "reflect") renderReflection();
      else if (action === "replay") enterScenario(currentId);
      else if (action === "complete") finishScenario();
      else if (action === "reset") reset();
    };
  });

  document.querySelectorAll("[data-modal]").forEach(el => {
    el.onclick = () => openModal(el.dataset.modal);
  });

  document.querySelectorAll("[data-repair]").forEach(input => {
    input.onchange = () => handleRepairChange(input);
  });

  setupScrollReveals();
  setupTiltPolish();
}

/* =========================================================
   GLOBAL EVENTS
   ========================================================= */

document.getElementById("home-button").onclick = renderHome;
document.getElementById("how-button").onclick = () => openModal("how");
musicButton.onclick = toggleMusic;
voiceButton.onclick = toggleVoice;
document.getElementById("settings-button").onclick = openSettings;
document.getElementById("fullscreen-button").onclick = toggleFullscreen;

document.getElementById("modal-close").onclick = closeModal;
document.getElementById("modal").onclick = event => {
  if (event.target.id === "modal") closeModal();
};

document.getElementById("settings-close").onclick = closeSettings;
settingsModal.onclick = event => {
  if (event.target.id === "settings-modal") closeSettings();
};

settingsMusic.onclick = () => setMusic(!state.prefs.musicEnabled);
settingsSfx.onclick = () => setSfx(!state.prefs.sfxEnabled);
settingsVoice.onclick = () => setVoice(!state.prefs.voiceEnabled);
settingsAmbience.onclick = () => setAmbience(!state.prefs.ambienceEnabled);
settingsMotion.onclick = () => setMotion(!state.prefs.motionEnabled);

volumeSlider.oninput = event => {
  setVolume(Number(event.target.value) / 100);
};

document.querySelectorAll(".site-footer [data-modal]").forEach(el => {
  el.onclick = () => openModal(el.dataset.modal);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeSettings();
  }

  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  const number = Number(event.key);
  if (!(number >= 1 && number <= 3)) return;

  // Physical decision: number keys 1-3
  if (currentId === "blocked-pathway" && document.querySelector(".choice-list")) {
    const buttons = document.querySelectorAll(".choice");
    const button = buttons[number - 1];
    if (button) {
      event.preventDefault();
      button.click();
    }
  }

  // Interpersonal: activate whichever choice stage is currently visible.
  if (currentId === "group-activity" && document.querySelector(".choice-list")) {
    const lists = document.querySelectorAll(".choice-list");
    const activeList = lists[lists.length - 1];
    const button = activeList?.querySelectorAll(".choice")[number - 1];
    if (button) {
      event.preventDefault();
      button.click();
    }
  }
});

// If a returning user previously enabled music, resume after their first user gesture.
// Browsers correctly block autoplay before a gesture.
document.addEventListener("pointerdown", () => {
  if (state.prefs.musicEnabled && bgMusic.paused) bgMusic.play().catch(() => {});
  if (state.prefs.ambienceEnabled && ambienceAudio.paused) updateAmbienceForScene(document.body.dataset.scene || "home");
}, { once: true });


// Lightweight UI ripple feedback on every clickable control.
document.addEventListener("pointerdown", event => {
  const target = event.target.closest("button, .choice, .repair-option label");
  if (!target || !state.prefs.motionEnabled) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ui-ripple";
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  target.classList.add("ripple-host");
  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 620);
});

/* =========================================================
   START
   ========================================================= */

if (!DATA.length) {
  app.innerHTML = `
    <section class="card">
      <h1>Scenario data could not be loaded.</h1>
      <p>Please ensure <strong>scenario-data.js</strong> is in the same folder as index.html.</p>
    </section>
  `;
} else {
  load();
  applyPreferences();
  updateProgress();
  renderSplash();
}
