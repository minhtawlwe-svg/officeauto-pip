// Wardrobe: change each character's colours, eyes, accessories and (where offered) hair style.
// Looks are saved per character in settings.looks[charId] = { colors: {slot: '#hex'}, eyes, acc, accColor, hair }.
// A character takes part by having an entry in CHAR_LOOKS (extra characters add their own entry):
//   slots: colour slot -> CSS selectors ('|stroke' recolours the outline instead of the fill)
//   heads: where eyes / accessories go (viewBox units): l/r = eye centres, top = top of the head,
//          w = head width, bob = which .bob group the head moves with
//   hairs: optional hair styles [id, label]; the character's own CSS reacts to #pip[data-hair="id"]
const CHAR_LOOKS = {
  pip: { slots: { body: ['.char-pip .body', '.char-pip .arm'], tie: ['.char-pip .tie'] }, heads: [{ l: [62, 64], r: [98, 64], top: 20, w: 100 }] },
  bears: {
    slots: { fur: ['.char-bears .body.brown'], fur2: ['.char-bears .body.milk'], bow: ['.char-bears .bow'] },
    heads: [{ l: [50, 68], r: [78, 68], top: 40, w: 72, bob: 0 }, { l: [142, 68], r: [170, 68], top: 40, w: 72, bob: 1 }],
  },
  cat: { slots: { fur: ['.char-cat .body', '.char-cat .tail|stroke'] }, heads: [{ l: [64, 68], r: [96, 68], top: 36, w: 84 }] },
  dog: { slots: { fur: ['.char-dog .body', '.char-dog .tail|stroke'], ears: ['.char-dog .ear'], collar: ['.char-dog .collar'] }, heads: [{ l: [65, 68], r: [95, 68], top: 36, w: 76 }] },
  capy: { slots: { fur: ['.char-capy .body'], yuzu: ['.char-capy .yuzu'] }, heads: [{ l: [58, 58], r: [102, 58], top: 38, w: 92 }] },
  penguin: { slots: { body: ['.char-penguin .body', '.char-penguin .flip'], scarf: ['.char-penguin .scarf'] }, heads: [{ l: [68, 70], r: [92, 70], top: 42, w: 80 }] },
};
const SLOT_LABELS = { hair: 'Hair', fur: 'Fur', fur2: '2nd fur', top: 'Top', dress: 'Dress', bottom: 'Bottom', shoes: 'Shoes', skin: 'Skin',
  body: 'Body', tie: 'Tie', scarf: 'Scarf', collar: 'Collar', bow: 'Bow', yuzu: 'Yuzu', ears: 'Ears', sash: 'Sash' };
const EYE_STYLES = [['normal', 'Normal'], ['sparkle', 'Sparkle ✨'], ['happy', 'Happy ^^'], ['heart', 'Hearts 😍'], ['wink', 'Wink 😉']];
const ACCESSORIES = [['none', 'None'], ['glasses', 'Glasses'], ['sunglasses', 'Sunglasses 😎'], ['cap', 'Cap'], ['bow', 'Bow'],
  ['flower', 'Flower'], ['headphones', 'Headphones'], ['crown', 'Crown 👑']];

let lookDrafts = null;   // while Settings is open: edited looks, not saved yet
const lookOf = (id) => ((lookDrafts || settings.looks || {})[id]) || {};

// ---------------------------------------------------------------- drawing
const f1 = (n) => Math.round(n * 10) / 10;
function heartPath(x, y, r) {
  return `M${f1(x)} ${f1(y + r * 0.9)}C${f1(x - r * 1.6)} ${f1(y - r * 0.2)} ${f1(x - r * 0.6)} ${f1(y - r * 1.3)} ${f1(x)} ${f1(y - r * 0.4)}` +
    `C${f1(x + r * 0.6)} ${f1(y - r * 1.3)} ${f1(x + r * 1.6)} ${f1(y - r * 0.2)} ${f1(x)} ${f1(y + r * 0.9)}Z`;
}
function eyesSVG(h, style) {
  const s = (h.r[0] - h.l[0]) / 30, eyes = [h.l, h.r];
  const arc = ([x, y]) => `<path class="lkLine" stroke-width="${f1(2.4 * s)}" d="M${f1(x - 5 * s)} ${f1(y + 1.5 * s)}Q${f1(x)} ${f1(y - 5 * s)} ${f1(x + 5 * s)} ${f1(y + 1.5 * s)}"/>`;
  if (style === 'sparkle') return eyes.map(([x, y]) => `<circle class="lkSpark" cx="${f1(x + 2.6 * s)}" cy="${f1(y - 3 * s)}" r="${f1(2.2 * s)}"/><circle class="lkSpark" cx="${f1(x - 1.8 * s)}" cy="${f1(y + 2.2 * s)}" r="${f1(1.1 * s)}"/>`).join('');
  if (style === 'happy') return eyes.map(arc).join('');
  if (style === 'heart') return eyes.map(([x, y]) => `<path class="lkHeart" d="${heartPath(x, y, 5.5 * s)}"/>`).join('');
  if (style === 'wink') return arc(h.r);
  return '';
}
function accSVG(h, kind, color) {
  const [lx, ly] = h.l, [rx, ry] = h.r, cx = (lx + rx) / 2, d = rx - lx, s = d / 30, w = h.w, top = h.top;
  const c = color || '#e64a5d';
  switch (kind) {
    case 'glasses': {
      const r = d * 0.32;
      return `<g class="lkFrame" stroke="${c}" stroke-width="${f1(2 * s)}"><circle cx="${lx}" cy="${ly}" r="${f1(r)}"/><circle cx="${rx}" cy="${ry}" r="${f1(r)}"/>` +
        `<path d="M${f1(lx + r)} ${ly}Q${f1(cx)} ${f1(ly - 3 * s)} ${f1(rx - r)} ${ry}"/></g>`;
    }
    case 'sunglasses': {
      const r = d * 0.34;
      return `<g><rect class="lkShade" x="${f1(lx - r * 1.05)}" y="${f1(ly - r * 0.72)}" width="${f1(r * 2.1)}" height="${f1(r * 1.45)}" rx="${f1(r * 0.55)}"/>` +
        `<rect class="lkShade" x="${f1(rx - r * 1.05)}" y="${f1(ry - r * 0.72)}" width="${f1(r * 2.1)}" height="${f1(r * 1.45)}" rx="${f1(r * 0.55)}"/>` +
        `<path class="lkFrame" stroke="#111" stroke-width="${f1(2 * s)}" d="M${f1(lx + r)} ${f1(ly - r * 0.3)}H${f1(rx - r)}"/>` +
        `<path class="lkLine" stroke="#fff" stroke-width="${f1(1.2 * s)}" opacity=".6" d="M${f1(lx - r * 0.6)} ${f1(ly - r * 0.3)}l${f1(r * 0.4)} ${f1(-r * 0.25)}M${f1(rx - r * 0.6)} ${f1(ry - r * 0.3)}l${f1(r * 0.4)} ${f1(-r * 0.25)}"/></g>`;
    }
    case 'cap':
      return `<g><path fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2" d="M${f1(cx - w * 0.49)} ${f1(top + w * 0.26)}C${f1(cx - w * 0.5)} ${f1(top - w * 0.14)} ${f1(cx + w * 0.5)} ${f1(top - w * 0.14)} ${f1(cx + w * 0.49)} ${f1(top + w * 0.26)}Z"/>` +
        `<ellipse fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2" cx="${f1(cx + w * 0.3)}" cy="${f1(top + w * 0.26)}" rx="${f1(w * 0.36)}" ry="${f1(w * 0.07)}"/>` +
        `<circle fill="rgba(0,0,0,.25)" cx="${f1(cx)}" cy="${f1(top - w * 0.05)}" r="${f1(w * 0.035)}"/></g>`;
    case 'bow': {
      const x = cx + w * 0.3, y = top + w * 0.08, k = w * 0.13;
      return `<g fill="${c}" stroke="rgba(0,0,0,.3)" stroke-width="1"><path d="M${f1(x)} ${f1(y)}L${f1(x - k)} ${f1(y - k * 0.7)}V${f1(y + k * 0.7)}Z"/>` +
        `<path d="M${f1(x)} ${f1(y)}L${f1(x + k)} ${f1(y - k * 0.7)}V${f1(y + k * 0.7)}Z"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(k * 0.32)}"/></g>`;
    }
    case 'flower': {
      const x = cx + w * 0.33, y = top + w * 0.1, r = w * 0.055;
      return `<g fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width=".7">` + [0, 72, 144, 216, 288].map((a) => {
        const t = a * Math.PI / 180;
        return `<circle cx="${f1(x + Math.cos(t) * r * 1.3)}" cy="${f1(y + Math.sin(t) * r * 1.3)}" r="${f1(r)}"/>`;
      }).join('') + `<circle fill="#ffd34d" stroke="none" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.7)}"/></g>`;
    }
    case 'headphones':
      return `<g><path fill="none" stroke="${c}" stroke-width="${f1(w * 0.07)}" stroke-linecap="round" d="M${f1(cx - w * 0.52)} ${f1(top + w * 0.42)}Q${f1(cx)} ${f1(top - w * 0.36)} ${f1(cx + w * 0.52)} ${f1(top + w * 0.42)}"/>` +
        `<rect fill="${c}" stroke="rgba(0,0,0,.35)" x="${f1(cx - w * 0.6)}" y="${f1(ly - w * 0.12)}" width="${f1(w * 0.14)}" height="${f1(w * 0.26)}" rx="${f1(w * 0.06)}"/>` +
        `<rect fill="${c}" stroke="rgba(0,0,0,.35)" x="${f1(cx + w * 0.46)}" y="${f1(ry - w * 0.12)}" width="${f1(w * 0.14)}" height="${f1(w * 0.26)}" rx="${f1(w * 0.06)}"/></g>`;
    case 'crown': {
      const W = w * 0.5, H = w * 0.22, y0 = top + w * 0.05;
      return `<g><path fill="#f4c430" stroke="#c99a06" stroke-width="1.2" stroke-linejoin="round" d="M${f1(cx - W / 2)} ${f1(y0)}V${f1(y0 - H)}L${f1(cx - W / 4)} ${f1(y0 - H * 0.5)}L${f1(cx)} ${f1(y0 - H * 1.05)}` +
        `L${f1(cx + W / 4)} ${f1(y0 - H * 0.5)}L${f1(cx + W / 2)} ${f1(y0 - H)}V${f1(y0)}Z"/><circle fill="${c}" cx="${f1(cx)}" cy="${f1(y0 - H * 0.3)}" r="${f1(w * 0.03)}"/></g>`;
    }
  }
  return '';
}

const toHex = (rgb) => {
  const m = String(rgb).match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return '#888888';
  return '#' + m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('');
};
// the colour a slot currently shows (for the colour pickers)
function slotColor(id, slot) {
  const [sel] = CHAR_LOOKS[id].slots[slot], [css, prop] = sel.split('|');
  const el = pipEl.querySelector(css.replace(/^\.char-[\w-]+ /, `svg.char-${id} `));
  return el ? toHex(getComputedStyle(el)[prop === 'stroke' ? 'stroke' : 'fill']) : '#888888';
}

// ---------------------------------------------------------------- apply
function applyLook() {
  // colours of every character with a saved (or draft) look
  let css = '';
  for (const [id, look] of Object.entries(lookDrafts || settings.looks || {})) {
    const def = CHAR_LOOKS[id];
    if (!def || !look.colors) continue;
    for (const [slot, color] of Object.entries(look.colors)) {
      if (!def.slots[slot] || !/^#[0-9a-f]{6}$/i.test(color)) continue;
      for (const sel of def.slots[slot]) {
        const [s, prop] = sel.split('|');
        css += `#pip ${s} { ${prop === 'stroke' ? 'stroke' : 'fill'}: ${color} !important; }\n`;
      }
    }
  }
  let st = document.getElementById('lookStyle');
  if (!st) { st = document.createElement('style'); st.id = 'lookStyle'; document.head.appendChild(st); }
  st.textContent = css;

  // eyes + accessory overlays, hair style: only for the character on screen
  pipEl.querySelectorAll('.lkOverlay').forEach((e) => e.remove());
  const id = pipEl.dataset.char, def = CHAR_LOOKS[id], look = lookOf(id);
  pipEl.dataset.eyes = look.eyes || 'normal';
  pipEl.dataset.hair = look.hair || '';
  if (!def) return;
  const svg = pipEl.querySelector(`svg.char-${id}`);
  if (!svg) return;
  const bobs = svg.querySelectorAll('.bob');
  def.heads.forEach((h) => {
    const g = bobs[h.bob || 0] || svg;
    g.insertAdjacentHTML('beforeend', `<g class="lkOverlay"><g class="lkEyes">${eyesSVG(h, look.eyes)}</g>${look.acc && look.acc !== 'none' ? accSVG(h, look.acc, look.accColor) : ''}</g>`);
  });
}

// ---------------------------------------------------------------- Settings editor
function lookEditorFor(id) {
  const def = CHAR_LOOKS[id], box = $('#lookBox');
  box.classList.toggle('hidden', !def);
  if (!def) return;
  const look = (lookDrafts[id] = lookDrafts[id] || {});
  const colors = $('#lookColors'); colors.innerHTML = '';
  for (const slot of Object.keys(def.slots)) {
    const lab = document.createElement('label'); lab.className = 'lookSwatch';
    const inp = document.createElement('input'); inp.type = 'color';
    inp.value = (look.colors && look.colors[slot]) || slotColor(id, slot);
    inp.oninput = () => { look.colors = { ...(look.colors || {}), [slot]: inp.value }; applyLook(); };
    lab.appendChild(inp); lab.appendChild(document.createTextNode(' ' + (SLOT_LABELS[slot] || slot)));
    colors.appendChild(lab);
  }
  const fill = (sel, list, val) => { sel.innerHTML = list.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); sel.value = val; };
  fill($('#lookEyes'), EYE_STYLES, look.eyes || 'normal');
  fill($('#lookAcc'), ACCESSORIES, look.acc || 'none');
  $('#lookAccColor').value = look.accColor || '#e64a5d';
  $('#hairRow').classList.toggle('hidden', !def.hairs);
  if (def.hairs) fill($('#lookHair'), def.hairs, look.hair || def.hairs[0][0]);
  $('#lookEyes').onchange = () => { look.eyes = $('#lookEyes').value; applyLook(); };
  $('#lookAcc').onchange = () => { look.acc = $('#lookAcc').value; applyLook(); };
  $('#lookAccColor').oninput = () => { look.accColor = $('#lookAccColor').value; applyLook(); };
  $('#lookHair').onchange = () => { look.hair = $('#lookHair').value; applyLook(); };
  $('#lookReset').onclick = () => { lookDrafts[id] = {}; previewCharacter(id); };
}
// show a character (and its draft look) while Settings is open, without saving
function previewCharacter(id) {
  pipEl.dataset.char = id;
  applyLook();
  lookEditorFor(id);
}
function openLookEditor() {
  lookDrafts = JSON.parse(JSON.stringify(settings.looks || {}));
  previewCharacter($('#sChar').value || pipEl.dataset.char);
}
function closeLookEditor(save) {
  const looks = lookDrafts;
  lookDrafts = null;
  for (const id of Object.keys(looks || {})) if (!Object.keys(looks[id]).length) delete looks[id];
  return save ? looks : null;
}
$('#sChar').addEventListener('change', () => { if (lookDrafts) previewCharacter($('#sChar').value); });
