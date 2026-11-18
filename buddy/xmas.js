// Christmas theme for the desktop buddy (on from 15 Nov to 7 Jan, off by itself after that): a Santa hat on the
// character, snow falling around them, a little twinkling tree beside them, and a Merry Christmas hello once a day.
// The chat side gets a festive mood from renderer.js (xmasSeason()). Uses CHAR_LOOKS (customize.js) for head positions.
'use strict';
function xmasSeason(d = new Date()) {
  const m = d.getMonth(), day = d.getDate();
  return (m === 10 && day >= 15) || m === 11 || (m === 0 && day <= 7);
}
(function () {
  if (!xmasSeason()) return;
  const pipEl = document.getElementById('pip'); if (!pipEl) return;

  const css = `
  #pip svg { overflow: visible; }
  .xmasHat { pointer-events: none; }
  .xmasSnow { position: absolute; left: -40px; right: -40px; top: -70px; bottom: 0; pointer-events: none; overflow: hidden; z-index: 0;
    -webkit-mask-image: linear-gradient(180deg, transparent, #000 25%, #000 80%, transparent); }
  .xmasSnow i { position: absolute; top: -8px; border-radius: 50%; background: #fff; box-shadow: 0 0 3px rgba(120,150,200,.9);
    animation: xmasFall linear infinite; }
  @keyframes xmasFall { 0% { transform: translate(0,-8px); } 50% { transform: translate(10px, 110px); } 100% { transform: translate(-4px, 230px); } }
  .xmasTree { position: absolute; left: 2px; bottom: 2px; width: 40px; height: 56px; pointer-events: none; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
  .xmasTree .bulb { animation: xmasBlink 1.3s infinite alternate; } .xmasTree .bulb:nth-of-type(2n) { animation-delay: .65s; }
  @keyframes xmasBlink { 0% { opacity: .35; } 100% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .xmasSnow { display: none; } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---- snow around the character
  const snow = document.createElement('div'); snow.className = 'xmasSnow';
  for (let i = 0; i < 18; i++) {
    const f = document.createElement('i'), s = 2 + Math.random() * 3;
    f.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${5 + Math.random() * 5}s;animation-delay:${-Math.random() * 10}s;opacity:${0.6 + Math.random() * 0.4}`;
    snow.appendChild(f);
  }
  pipEl.insertBefore(snow, pipEl.firstChild);

  // ---- a little Christmas tree beside them
  const C = ['#ff4d4d', '#ffd23f', '#4dd2ff', '#ff7ad9', '#7dff7a'];
  const bulbs = [[17, 22], [25, 27], [13, 35], [24, 39], [10, 46], [20, 48], [30, 46]]
    .map(([x, y], i) => `<circle class="bulb" cx="${x}" cy="${y}" r="1.9" fill="${C[i % C.length]}"/>`).join('');
  const tree = document.createElement('div'); tree.className = 'xmasTree';
  tree.innerHTML = `<svg viewBox="0 0 40 56" width="40" height="56"><rect x="17" y="49" width="6" height="7" rx="1" fill="#8a5a2b"/>
    <path d="M20 7 L32 24 H26 L35 38 H29 L38 51 H2 L11 38 H5 L14 24 H8 Z" fill="#1f9d55"/>${bulbs}
    <path d="M20 0 L21.8 4 L26 4.3 L22.8 7 L23.9 11.2 L20 8.8 L16.1 11.2 L17.2 7 L14 4.3 L18.2 4 Z" fill="#ffd700"/></svg>`;
  pipEl.appendChild(tree);

  // ---- Santa hat on every head of the character that is showing (again after a character / outfit change)
  function hats() {
    const id = pipEl.dataset.char, def = typeof CHAR_LOOKS !== 'undefined' && CHAR_LOOKS[id];
    const svg = pipEl.querySelector(`svg.char-${id}`);
    if (!def || !svg || svg.querySelector('.xmasHat')) return;
    const bobs = svg.querySelectorAll('.bob');
    def.heads.forEach((h) => {
      const c = (h.l[0] + h.r[0]) / 2, t = h.top, w = h.w, by = t + 5;
      (bobs[h.bob || 0] || svg).insertAdjacentHTML('beforeend', `<g class="xmasHat">
        <path d="M${c - w * 0.47} ${by} Q${c - w * 0.15} ${t - w * 0.58} ${c + w * 0.5} ${t - w * 0.31} Q${c + w * 0.28} ${t - w * 0.12} ${c + w * 0.47} ${by} Z" fill="#e63946"/>
        <rect x="${c - w * 0.56}" y="${by - w * 0.08}" width="${w * 1.12}" height="${w * 0.17}" rx="${w * 0.085}" fill="#fff"/>
        <circle cx="${c + w * 0.52}" cy="${t - w * 0.31}" r="${w * 0.095}" fill="#fff"/></g>`);
    });
  }
  new MutationObserver(hats).observe(pipEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-char'] });
  setTimeout(hats, 500); setInterval(hats, 4000);

  // ---- Merry Christmas once a day, in the speech hint
  try {
    const key = 'xmasHello', today = new Date().toDateString();
    if (localStorage.getItem(key) !== today) {
      setTimeout(() => {
        const hint = document.getElementById('hint'); if (!hint || !hint.classList.contains('hidden')) return;
        hint.textContent = new Date().getMonth() === 0 ? 'Happy New Year! 🎉 ပျော်ရွှင်စရာ နှစ်သစ်ပါ' : 'Merry Christmas! 🎄🎅 ခရစ္စမတ်ပွဲတော် ပျော်ရွှင်ပါစေ';
        hint.classList.remove('hidden');
        setTimeout(() => hint.classList.add('hidden'), 7000);
        localStorage.setItem(key, today);
      }, 6000);
    }
  } catch { }
})();
