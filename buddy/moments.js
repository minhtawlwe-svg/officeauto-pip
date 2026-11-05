// Life: little "moments" when the buddy is idle (a cat visits, a butterfly, a ball, a bird, tea, a stretch)
// and FEELINGS - each reply starts with [[FEEL:x]] and the character shows it (tears, hearts, sparkles...).
// Works for every character: positions come from CHAR_LOOKS[...].heads (customize.js).

const sceneEl = document.createElement('div');
sceneEl.id = 'scene';
document.body.appendChild(sceneEl);

const fxSound = (fn) => { if (settings.sound === false) return; try { fn(audio().currentTime + 0.02); } catch { } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const look = (dir) => { if (dir) pipEl.dataset.look = dir; else delete pipEl.dataset.look; };

// the character's head in window pixels (top of the head and eye level)
function headPoint() {
  const id = pipEl.dataset.char, svg = pipEl.querySelector(`svg.char-${id}`), def = CHAR_LOOKS[id];
  const r = (svg || pipEl).getBoundingClientRect();
  if (!svg || !def) return { x: r.left + r.width / 2, top: r.top + r.height * 0.15, eye: r.top + r.height * 0.4, left: r.left, scale: 1 };
  const k = r.width / svg.viewBox.baseVal.width, h = def.heads[0];
  return { x: r.left + ((h.l[0] + h.r[0]) / 2) * k, top: r.top + h.top * k, eye: r.top + h.l[1] * k, left: r.left, scale: k };
}
function sprite(svg, cls = '') {
  const d = document.createElement('div');
  d.className = 'sprite ' + cls;
  d.innerHTML = svg;
  sceneEl.appendChild(d);
  return d;
}

// ---------------------------------------------------------------- sprites
const CAT_SVG = `<svg viewBox="0 0 64 44" width="58" height="40"><path d="M9 22Q1 10 7 3" fill="none" stroke="#e8954a" stroke-width="5" stroke-linecap="round" class="ctail"/>
  <rect class="lg1" x="15" y="29" width="5" height="12" rx="2.5" fill="#d9823a"/><rect class="lg2" x="22" y="29" width="5" height="12" rx="2.5" fill="#d9823a"/>
  <rect class="lg1" x="32" y="29" width="5" height="12" rx="2.5" fill="#d9823a"/><rect class="lg2" x="39" y="29" width="5" height="12" rx="2.5" fill="#d9823a"/>
  <ellipse cx="27" cy="25" rx="18" ry="10" fill="#f4a259"/><circle cx="47" cy="16" r="11" fill="#f4a259"/>
  <path d="M39 9L41 -1L47 6ZM49 6L55 -1L56 9Z" fill="#f4a259"/><circle cx="51" cy="14" r="1.8" fill="#222"/>
  <ellipse cx="57" cy="17.5" rx="1.6" ry="1.1" fill="#ff7f9b"/><path d="M55 21q2 1.5 4 0" stroke="#5a3a20" stroke-width="1.1" fill="none"/></svg>`;
const BUTTERFLY_SVG = `<svg viewBox="0 0 30 24" width="30" height="24"><g class="wing"><ellipse cx="9" cy="9" rx="8" ry="7" fill="#b48cff"/><ellipse cx="10" cy="18" rx="5" ry="4.5" fill="#ff9fd2"/></g>
  <g class="wing w2"><ellipse cx="21" cy="9" rx="8" ry="7" fill="#b48cff"/><ellipse cx="20" cy="18" rx="5" ry="4.5" fill="#ff9fd2"/></g><rect x="14" y="5" width="2" height="16" rx="1" fill="#3a2a40"/></svg>`;
const BALL_SVG = `<svg viewBox="0 0 26 26" width="24" height="24"><circle cx="13" cy="13" r="12" fill="#e64a5d" stroke="#9e2236" stroke-width="1"/><path d="M1 13h24M13 1v24" stroke="#fff" stroke-width="2.4"/></svg>`;
const BIRD_SVG = `<svg viewBox="0 0 30 22" width="30" height="22"><ellipse cx="14" cy="13" rx="10" ry="7.5" fill="#4d9bff"/><circle cx="22" cy="8" r="5.5" fill="#4d9bff"/>
  <circle cx="23.5" cy="7" r="1.3" fill="#111"/><path d="M27 8l3 1.5l-3 1.5z" fill="#ffb43b"/><path class="wing" d="M9 11q4-9 10-2q-4 4-10 2z" fill="#2f78d6"/><path d="M4 12l-4-3l1 6z" fill="#2f78d6"/></svg>`;
const TEA_SVG = `<svg viewBox="0 0 34 34" width="32" height="32"><path class="steam" d="M12 10q-3-4 0-8M18 10q-3-4 0-8" stroke="#c9c2ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M6 13h20l-2 15q-8 4-16 0z" fill="#fff" stroke="#c9a37a" stroke-width="1.2"/><path d="M26 16q6 0 5 5q-1 4-6 3" fill="none" stroke="#c9a37a" stroke-width="1.8"/>
  <ellipse cx="16" cy="14" rx="9.5" ry="2" fill="#a0683c"/></svg>`;

// ---------------------------------------------------------------- moments
async function catVisit() {
  const target = Math.max(10, headPoint().left - 66);
  const cat = sprite(CAT_SVG, 'walking');
  cat.style.left = '-70px'; cat.style.top = 'auto'; cat.style.bottom = '6px';
  look('left');
  await cat.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${target + 70}px)` }], { duration: (target + 70) * 16, easing: 'linear', fill: 'forwards' }).finished;
  cat.classList.remove('walking');
  fxSound((t) => S.meow(t, 1.35));
  mood('happy', 2500);
  say('Aww, a kitty came to visit! 🐱', 3500);
  await wait(3800);
  cat.classList.add('walking', 'flip');
  await cat.animate([{ transform: `translateX(${target + 70}px) scaleX(-1)` }, { transform: 'translateX(-80px) scaleX(-1)' }], { duration: (target + 150) * 14, easing: 'linear', fill: 'forwards' }).finished;
  cat.remove();
}
async function butterflyVisit() {
  const h = headPoint(), b = sprite(BUTTERFLY_SVG, 'flutter');
  b.style.left = '0px'; b.style.top = '0px';
  look('up');
  say('Ooh, a butterfly! 🦋', 4000);
  mood('happy', 2500);
  const pts = [[-40, h.top - 60], [h.x - 70, h.top - 30], [h.x - 20, h.top - 45], [h.x + 30, h.top - 25], [h.x + 10, h.top - 55], [h.x - 50, h.top - 15], [h.x - 10, h.top - 40], [h.x - 160, h.top - 140]];
  await b.animate(pts.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })), { duration: 7000, easing: 'ease-in-out', fill: 'forwards' }).finished;
  b.remove();
}
async function ballPlay() {
  const target = Math.max(20, headPoint().left - 20), ground = window.innerHeight - 30;
  const ball = sprite(BALL_SVG, 'rolling');
  ball.style.left = '0px'; ball.style.top = '0px';
  look('left');
  const frames = [];
  for (let i = 0; i <= 6; i++) frames.push({ transform: `translate(${-30 + (target + 30) * i / 6}px, ${ground - (i % 2 ? 40 - i * 4 : 0)}px) rotate(${i * 120}deg)` });
  await ball.animate(frames, { duration: 1800, easing: 'ease-out', fill: 'forwards' }).finished;
  fxSound((t) => tone(t, { type: 'triangle', dur: 0.18, vol: 0.3, path: [[0, 300], [0.18, 620]] }));
  mood('happy', 2000);
  charSound('hello');
  say('Hehe, kick! ⚽', 2500);
  await ball.animate([{ transform: `translate(${target}px, ${ground}px)` }, { transform: `translate(${target * 0.5}px, ${ground - 90}px) rotate(-200deg)` },
    { transform: `translate(-60px, ${ground}px) rotate(-420deg)` }], { duration: 1600, easing: 'ease-out', fill: 'forwards' }).finished;
  ball.remove();
}
async function birdVisit() {
  const h = headPoint(), bird = sprite(BIRD_SVG, 'flapping');
  bird.style.left = '0px'; bird.style.top = '0px';
  look('up');
  const land = [h.x - 15, h.top - 20 * Math.max(0.6, h.scale)];
  await bird.animate([{ transform: 'translate(-40px, 20px)' }, { transform: `translate(${land[0] - 60}px, ${land[1] - 70}px)` }, { transform: `translate(${land[0]}px, ${land[1]}px)` }],
    { duration: 2200, easing: 'ease-out', fill: 'forwards' }).finished;
  bird.classList.remove('flapping');
  fxSound((t) => S.chirp(t));
  say('Tweet tweet! A little bird on my head 🐦', 3500);
  mood('happy', 2500);
  await wait(3200);
  bird.classList.add('flapping');
  await bird.animate([{ transform: `translate(${land[0]}px, ${land[1]}px)` }, { transform: `translate(${land[0] + 120}px, -60px)` }], { duration: 1600, easing: 'ease-in', fill: 'forwards' }).finished;
  bird.remove();
}
async function teaTime() {
  const h = headPoint(), cup = sprite(TEA_SVG, 'tea');
  cup.style.left = `${h.left - 30}px`; cup.style.top = `${h.eye + 30}px`;
  cup.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, fill: 'forwards' });
  mood('talk', 1600);
  say('Tea break ☕ Ahh... remember to drink some water too!', 5000);
  await wait(5200);
  await cup.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
  cup.remove();
}
async function stretchTime() {
  const base = pipEl.style.transform || '';
  say('Stretch time! 🙆 Roll your shoulders with me.', 4500);
  mood('happy', 2500);
  await pipEl.animate([{ transform: `${base} scaleY(1)` }, { transform: `${base} scaleY(1.08) translateY(-4px)` }, { transform: `${base} scaleY(1)` }], { duration: 1300, iterations: 2, easing: 'ease-in-out' }).finished;
  fxSound((t) => tone(t, { type: 'triangle', dur: 0.5, vol: 0.18, path: [[0, 420], [0.5, 300]] }));
}

const MOMENTS = { cat: catVisit, butterfly: butterflyVisit, ball: ballPlay, bird: birdVisit, tea: teaTime, stretch: stretchTime };
let momentBusy = false;
async function runMoment(name) {
  if (momentBusy) return;
  momentBusy = true;
  const keys = Object.keys(MOMENTS);
  const play = MOMENTS[name] || MOMENTS[keys[Math.floor(Math.random() * keys.length)]];
  try { await play(); }
  catch (e) { console.warn('moment failed', e); }
  finally { look(null); sceneEl.innerHTML = ''; momentBusy = false; }
}
// now and then while idle (panel closed, not talking, not asleep)
function scheduleMoment(first) {
  setTimeout(() => {
    const idle = !busy && !isSpeaking() && panel.classList.contains('hidden') && !pipEl.classList.contains('sleep') && !dragging;
    if (settings.moments !== false && idle) runMoment();
    scheduleMoment(false);
  }, first ? 2.5 * 60000 : (4 + Math.random() * 5) * 60000);
}
scheduleMoment(true);

// ---------------------------------------------------------------- feelings
// [[FEEL:x]] at the start of a reply -> face + small effect + matching sound; the voice is tuned in renderer.js
const FEELINGS = {
  happy: { mood: 'happy', fx: 'stars1' }, excited: { mood: 'happy', fx: 'stars', sound: 'hello' }, laugh: { mood: 'happy', fx: 'laugh', sound: 'pet' },
  love: { mood: 'happy', fx: 'hearts', sound: 'pet' }, shy: { fx: 'shy' }, sad: { mood: 'worried', fx: 'tears', sound: 'error' },
  sorry: { mood: 'worried', fx: 'sweat' }, surprised: { fx: 'surprise', sound: 'hello' }, worried: { mood: 'worried', fx: 'sweat' },
  thinking: { mood: 'think', fx: 'question' }, proud: { mood: 'happy', fx: 'stars1' }, calm: {},
};
let feelTimer = null;
function feelSVG(h, fx) {
  const [lx, ly] = h.l, [rx, ry] = h.r, cx = (lx + rx) / 2, w = h.w, top = h.top, s = Math.max((rx - lx) / 30, w / 48);
  const star = (x, y, r) => `<path class="fxStar" d="M${f1(x)} ${f1(y - r)}L${f1(x + r * 0.3)} ${f1(y - r * 0.3)}L${f1(x + r)} ${f1(y)}L${f1(x + r * 0.3)} ${f1(y + r * 0.3)}L${f1(x)} ${f1(y + r)}L${f1(x - r * 0.3)} ${f1(y + r * 0.3)}L${f1(x - r)} ${f1(y)}L${f1(x - r * 0.3)} ${f1(y - r * 0.3)}Z"/>`;
  const drop = (x, y, r, cls) => `<path class="${cls}" d="M${f1(x)} ${f1(y - r * 1.6)}Q${f1(x + r)} ${f1(y)} ${f1(x)} ${f1(y + r)}Q${f1(x - r)} ${f1(y)} ${f1(x)} ${f1(y - r * 1.6)}Z"/>`;
  const mark = (t) => `<text class="fxMark" x="${f1(cx + w * 0.42)}" y="${f1(top + 2)}" font-size="${f1(16 * s)}">${t}</text>`;
  const blush = `<ellipse class="fxBlush" cx="${f1(lx - 3 * s)}" cy="${f1(ly + 8 * s)}" rx="${f1(6 * s)}" ry="${f1(3.4 * s)}"/><ellipse class="fxBlush" cx="${f1(rx + 3 * s)}" cy="${f1(ry + 8 * s)}" rx="${f1(6 * s)}" ry="${f1(3.4 * s)}"/>`;
  switch (fx) {
    case 'stars': return star(cx - w * 0.55, top + 6, 5 * s) + star(cx + w * 0.55, top + 2, 6 * s) + star(cx + w * 0.4, top - 10, 3.5 * s);
    case 'stars1': return star(cx + w * 0.5, top + 2, 5 * s);
    case 'laugh': return [h.l, h.r].map(([x, y]) => `<path class="lkLine" stroke-width="${f1(2.4 * s)}" d="M${f1(x - 5 * s)} ${f1(y + 1.5 * s)}Q${f1(x)} ${f1(y - 5 * s)} ${f1(x + 5 * s)} ${f1(y + 1.5 * s)}"/>`).join('');
    case 'hearts': return `<path class="fxHeart" d="${heartPath(cx + w * 0.45, top + 4, 5 * s)}"/><path class="fxHeart h2" d="${heartPath(cx - w * 0.5, top + 10, 4 * s)}"/>`;
    case 'shy': return blush + drop(cx + w * 0.48, top + w * 0.2, 2.6 * s, 'fxSweat');
    case 'tears': return drop(lx, ly + 7 * s, 2.2 * s, 'fxTear') + drop(rx, ry + 7 * s, 2.2 * s, 'fxTear t2');
    case 'sweat': return drop(cx + w * 0.48, top + w * 0.2, 2.8 * s, 'fxSweat');
    case 'surprise': return mark('!');
    case 'question': return mark('?');
  }
  return '';
}
function showFeeling(name) {
  const f = FEELINGS[name];
  if (!f) return;
  clearTimeout(feelTimer);
  pipEl.querySelectorAll('.feelFx').forEach((e) => e.remove());
  pipEl.dataset.feel = name;
  if (f.mood) mood(f.mood, 2500);
  if (f.sound) charSound(f.sound);
  const id = pipEl.dataset.char, def = CHAR_LOOKS[id], svg = pipEl.querySelector(`svg.char-${id}`);
  if (def && svg && f.fx) {
    const bobs = svg.querySelectorAll('.bob');
    def.heads.forEach((h) => (bobs[h.bob || 0] || svg).insertAdjacentHTML('beforeend', `<g class="feelFx">${feelSVG(h, f.fx)}</g>`));
  }
  feelTimer = setTimeout(clearFeeling, 9000);
}
function clearFeeling() {
  clearTimeout(feelTimer);
  delete pipEl.dataset.feel;
  pipEl.querySelectorAll('.feelFx').forEach((e) => e.remove());
}
