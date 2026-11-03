// Character sounds, synthesized with Web Audio (no audio files): meows, purrs, woofs, honks...
// charSound(event) plays the active character's sound for: hello, reply, alert, pet, sleep, error.
let audioCtx = null, master = null;

function audio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    master = audioCtx.createGain();
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  master.gain.value = 0.45 * (settings.soundVolume ?? 0.6);
  return audioCtx;
}

// ---------------------------------------------------------------- building blocks
function env(g, t0, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}
function noiseSource(ctx, dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf; return s;
}
function filter(ctx, type, freq, q = 1) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
function vibrato(ctx, param, t0, dur, rate, depth) {
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = rate; lg.gain.value = depth;
  lfo.connect(lg); lg.connect(param); lfo.start(t0); lfo.stop(t0 + dur);
}
// a pitched tone with a frequency path [[time, hz], ...]
function tone(t0, { type = 'sine', path, dur, vol = 0.5, attack = 0.02, release = 0.08, bp, lp, vib }) {
  const ctx = audio(), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(path[0][1], t0);
  for (const [t, hz] of path.slice(1)) o.frequency.linearRampToValueAtTime(hz, t0 + t);
  if (vib) vibrato(ctx, o.frequency, t0, dur, vib[0], vib[1]);
  let node = o;
  if (bp) { const f = filter(ctx, 'bandpass', bp[0], bp[1]); if (bp[2]) { f.frequency.setValueAtTime(bp[0], t0); for (const [t, hz] of bp[2]) f.frequency.linearRampToValueAtTime(hz, t0 + t); } node.connect(f); node = f; }
  if (lp) { const f = filter(ctx, 'lowpass', lp); node.connect(f); node = f; }
  node.connect(g); g.connect(master);
  env(g, t0, vol, attack, Math.max(0, dur - attack - release), release);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, { dur, vol = 0.4, type = 'bandpass', freq = 800, q = 1, attack = 0.01, release = 0.1, am }) {
  const ctx = audio(), s = noiseSource(ctx, dur + 0.1), f = filter(ctx, type, freq, q), g = ctx.createGain();
  s.connect(f); f.connect(g);
  if (am) {   // amplitude flutter (purr / snore rumble)
    const amg = ctx.createGain(); amg.gain.value = 0.5;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = 'triangle'; lfo.frequency.value = am; lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(amg.gain); lfo.start(t0); lfo.stop(t0 + dur + 0.1);
    g.connect(amg); amg.connect(master);
  } else g.connect(master);
  env(g, t0, vol, attack, Math.max(0, dur - attack - release), release);
  s.start(t0); s.stop(t0 + dur + 0.1);
}

// ---------------------------------------------------------------- the sounds
const S = {
  // cat: "mi-aow" = rising then falling pitch through a vowel-like sweeping band
  meow: (t, p = 1) => tone(t, { type: 'sawtooth', dur: 0.6, vol: 0.55, path: [[0, 430 * p], [0.2, 820 * p], [0.6, 520 * p]],
    bp: [1000, 4, [[0.18, 2000], [0.6, 900]]], vib: [6, 12 * p], attack: 0.05, release: 0.18 }),
  mrrp: (t) => { noise(t, { dur: 0.18, vol: 0.25, type: 'lowpass', freq: 500, am: 30 }); tone(t + 0.12, { type: 'triangle', dur: 0.22, vol: 0.4, path: [[0, 520], [0.22, 760]], bp: [1200, 3] }); },
  purr: (t, dur = 1.6) => noise(t, { dur, vol: 0.55, type: 'lowpass', freq: 260, am: 26, attack: 0.25, release: 0.4 }),
  hiss: (t) => noise(t, { dur: 0.35, vol: 0.18, type: 'highpass', freq: 3500, attack: 0.03, release: 0.15 }),
  // dog
  woof: (t, p = 1) => { tone(t, { type: 'sawtooth', dur: 0.2, vol: 0.6, path: [[0, 260 * p], [0.2, 120 * p]], bp: [650 * p, 1.6], attack: 0.008, release: 0.12 });
    noise(t, { dur: 0.12, vol: 0.25, freq: 900 * p, q: 1.2, attack: 0.005, release: 0.08 }); },
  yip: (t) => tone(t, { type: 'sawtooth', dur: 0.14, vol: 0.45, path: [[0, 700], [0.06, 1000], [0.14, 650]], bp: [1300, 2], attack: 0.006, release: 0.07 }),
  pant: (t) => { for (let i = 0; i < 4; i++) noise(t + i * 0.22, { dur: 0.12, vol: 0.18, freq: 1800, q: 0.8, attack: 0.02, release: 0.06 }); },
  whimper: (t) => tone(t, { type: 'sine', dur: 0.55, vol: 0.35, path: [[0, 950], [0.55, 520]], vib: [7, 25], attack: 0.05, release: 0.2 }),
  // capybara: little chirps and whistles
  chirp: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.13, { dur: 0.08, vol: 0.32, path: [[0, 1150], [0.08, 1600]], attack: 0.01, release: 0.04 }); },
  whistle: (t) => tone(t, { dur: 0.45, vol: 0.32, path: [[0, 1500], [0.2, 2200], [0.45, 1700]], attack: 0.04, release: 0.12 }),
  // penguin: nasal honk + squeak
  honk: (t, p = 1) => tone(t, { type: 'square', dur: 0.26, vol: 0.32, path: [[0, 520 * p], [0.26, 600 * p]], bp: [1300 * p, 3], vib: [28, 18], attack: 0.015, release: 0.08 }),
  squeak: (t) => tone(t, { dur: 0.12, vol: 0.32, path: [[0, 1400], [0.12, 2100]], attack: 0.01, release: 0.05 }),
  // bears / pip / shared
  hum: (t) => { tone(t, { type: 'triangle', dur: 0.35, vol: 0.32, path: [[0, 262], [0.35, 270]], lp: 900 }); tone(t + 0.22, { type: 'triangle', dur: 0.4, vol: 0.28, path: [[0, 330], [0.4, 340]], lp: 1200 }); },
  chime: (t) => { tone(t, { dur: 0.6, vol: 0.28, path: [[0, 1047]], attack: 0.005, release: 0.5 }); tone(t + 0.08, { dur: 0.6, vol: 0.22, path: [[0, 1319]], attack: 0.005, release: 0.5 }); },
  lowhum: (t) => tone(t, { type: 'triangle', dur: 0.45, vol: 0.3, path: [[0, 200], [0.45, 160]], lp: 700, release: 0.2 }),
  snore: (t) => noise(t, { dur: 1.4, vol: 0.3, type: 'lowpass', freq: 380, am: 18, attack: 0.7, release: 0.5 }),
  beep: (t, hz = 880, d = 0.1) => tone(t, { type: 'square', dur: d, vol: 0.18, path: [[0, hz]], lp: 2500, attack: 0.005, release: 0.03 }),
  powerdown: (t) => tone(t, { dur: 0.55, vol: 0.28, path: [[0, 800], [0.55, 120]], release: 0.2 }),
  buzz: (t) => tone(t, { type: 'square', dur: 0.22, vol: 0.15, path: [[0, 140]], lp: 900 }),
};

// event -> sound, per character
const CHAR_SOUNDS = {
  cat: { hello: (t) => S.meow(t), reply: (t) => S.mrrp(t), alert: (t) => { S.meow(t, 1.1); S.meow(t + 0.7, 0.95); }, pet: (t) => S.purr(t, 2.2), sleep: (t) => S.purr(t, 1.8), error: (t) => S.hiss(t) },
  dog: { hello: (t) => S.woof(t), reply: (t) => S.yip(t), alert: (t) => { S.woof(t); S.woof(t + 0.3, 1.05); }, pet: (t) => S.pant(t), sleep: (t) => S.snore(t), error: (t) => S.whimper(t) },
  capy: { hello: (t) => S.chirp(t), reply: (t) => S.purr(t, 0.7), alert: (t) => S.whistle(t), pet: (t) => S.purr(t, 1.8), sleep: (t) => S.snore(t), error: (t) => S.lowhum(t) },
  penguin: { hello: (t) => S.honk(t), reply: (t) => S.squeak(t), alert: (t) => { S.honk(t); S.honk(t + 0.35, 1.1); }, pet: (t) => { S.squeak(t); S.squeak(t + 0.18); }, sleep: (t) => S.snore(t), error: (t) => S.honk(t, 0.7) },
  bears: { hello: (t) => S.hum(t), reply: (t) => S.chime(t), alert: (t) => { S.chime(t); S.chime(t + 0.35); }, pet: (t) => S.chime(t), sleep: (t) => S.snore(t), error: (t) => S.lowhum(t) },
  pip: { hello: (t) => { S.beep(t, 880); S.beep(t + 0.13, 660, 0.12); }, reply: (t) => S.beep(t, 1320, 0.06), alert: (t) => { S.beep(t, 990); S.beep(t + 0.2, 990); S.beep(t + 0.4, 1320, 0.15); }, pet: (t) => S.beep(t, 1500, 0.06), sleep: (t) => S.powerdown(t), error: (t) => S.buzz(t) },
};

let lastSound = 0;
function charSound(event) {
  if (settings.sound === false) return;
  const now = Date.now();
  if (event !== 'alert' && now - lastSound < 350) return;   // no machine-gun sounds
  lastSound = now;
  const set = CHAR_SOUNDS[settings.character] || CHAR_SOUNDS.pip;
  try { const ctx = audio(); (set[event] || set.reply)(ctx.currentTime + 0.02); } catch { }
}

// ---------------------------------------------------------------- personality: voice + bubble flavour
const CHAR_STYLE = {
  pip: { pitch: 1.1, rate: 1.05, hi: 'Beep-boop!', pet: 'Hehe, that tickles my circuits!', sleepy: 'Powering down... zzz' },
  bears: { pitch: 1.05, rate: 1.0, hi: 'Hi hi!', pet: 'Aww, a hug for you too! 🤍', sleepy: 'Mocha and Milk are napping... zzz' },
  cat: { pitch: 1.45, rate: 1.05, hi: 'Meow~', pet: 'Purrrr... 😺 right there, yes.', sleepy: 'Cat nap time... purr... zzz' },
  dog: { pitch: 1.25, rate: 1.12, hi: 'Woof!', pet: 'Woof woof! Best human ever! 🐾', sleepy: 'Kopi is snoozing... zzz' },
  capy: { pitch: 0.8, rate: 0.88, hi: '~chill~', pet: 'Mmm... very relaxing. 🍊', sleepy: 'Capy is soaking in a hot spring... zzz' },
  penguin: { pitch: 1.35, rate: 1.08, hi: 'Squeak!', pet: 'Honk! Thank you kindly. 🐧', sleepy: 'Pebble is sleeping on the ice... zzz' },
};
// natural (neural) voices per character: Burmese voice, English voice, pitch / speed tweaks
const NEURAL = {
  pip: { my: 'my-MM-ThihaNeural', en: 'en-US-GuyNeural', pitch: '+8Hz', rate: '+5%' },
  bears: { my: 'my-MM-NilarNeural', en: 'en-US-EmmaNeural', pitch: '+4Hz', rate: '+0%' },
  cat: { my: 'my-MM-NilarNeural', en: 'en-US-AnaNeural', pitch: '+12Hz', rate: '+5%' },
  dog: { my: 'my-MM-ThihaNeural', en: 'en-US-AndrewNeural', pitch: '+10Hz', rate: '+10%' },
  capy: { my: 'my-MM-ThihaNeural', en: 'en-US-BrianNeural', pitch: '-4Hz', rate: '-12%' },
  penguin: { my: 'my-MM-NilarNeural', en: 'en-US-JennyNeural', pitch: '+10Hz', rate: '+5%' },
};
for (const [id, n] of Object.entries(NEURAL)) if (CHAR_STYLE[id]) CHAR_STYLE[id].neural = n;
const charStyle = () => CHAR_STYLE[settings.character] || CHAR_STYLE.pip;

// Settings: preview the chosen character's sound with the chosen volume (before saving)
$('#sSoundTest').onclick = () => {
  const keep = { character: settings.character, sound: settings.sound, soundVolume: settings.soundVolume };
  Object.assign(settings, { character: $('#sChar').value, sound: true, soundVolume: Number($('#sVolume').value) });
  lastSound = 0; charSound('hello');
  Object.assign(settings, keep);
};

// pet the character: rest the mouse on it for 1.5 s
let petTimer = null, lastPet = 0;
pipEl.addEventListener('mouseenter', () => {
  clearTimeout(petTimer);
  petTimer = setTimeout(() => {
    if (Date.now() - lastPet < 20000 || pipEl.classList.contains('drag')) return;
    lastPet = Date.now();
    mood('happy', 2000);
    charSound('pet');
    if (panel.classList.contains('hidden')) say(charStyle().pet, 4000);
  }, 1500);
});
pipEl.addEventListener('mouseleave', () => clearTimeout(petTimer));
pipEl.addEventListener('mousedown', () => clearTimeout(petTimer));
