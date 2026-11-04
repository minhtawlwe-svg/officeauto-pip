// The two characters of this app: Tom and Eaindra.
// Drawn as SVG and plugged into the same character system as Pip (moods, sounds, voices).
(function () {
  const extras = '\n    <g class="dots"><circle cx="128" cy="30" r="4"/><circle cx="140" cy="19" r="5"/><circle cx="152" cy="7" r="6"/></g>' +
    '\n    <g class="zzz"><text x="122" y="30">z</text><text x="134" y="18">z</text></g>' +
    '\n    <g class="waves"><path d="M140 70q6 10 0 20M148 64q10 16 0 32" fill="none"/></g>';

  // ---------------------------------------------------------------- Tom
  const tom = `
  <svg class="char-tom" viewBox="0 0 160 170" width="132" height="140" aria-label="Tom">
    <ellipse class="shadow" cx="80" cy="163" rx="36" ry="5"/>
    <g class="bob">
      <!-- sneakers -->
      <rect class="shoe" x="55" y="147" width="24" height="11" rx="5"/><rect class="sole" x="55" y="154" width="24" height="4.5" rx="2"/>
      <rect class="shoe" x="81" y="147" width="24" height="11" rx="5"/><rect class="sole" x="81" y="154" width="24" height="4.5" rx="2"/>
      <path class="lace" d="M63 150.5h7M63 153h7M89 150.5h7M89 153h7" fill="none"/>
      <!-- khaki trousers -->
      <rect class="pantL" x="60" y="118" width="19" height="31"/><rect class="pantR" x="80" y="118" width="19" height="31"/>
      <rect class="cuff" x="60" y="143" width="19" height="6" rx="2"/><rect class="cuff" x="80" y="143" width="19" height="6" rx="2"/>
      <!-- arms (left hangs, right is the waving one) -->
      <rect class="skin" x="45" y="106" width="9" height="26" rx="4.5"/><circle class="skin" cx="49.5" cy="134" r="5"/>
      <g class="armR"><rect class="skin" x="106" y="106" width="9" height="26" rx="4.5"/><circle class="skin" cx="110.5" cy="134" r="5"/></g>
      <!-- white shirt -->
      <path class="shirt" d="M57 90Q80 84 103 90L117 105L107 111L103 106L102 122L58 122L57 106L53 111L43 105Z"/>
      <path class="shirtShade" d="M90 88L102 90L102 122L92 122Z"/>
      <path class="collar" d="M71 86L80 95L89 86L86 84L80 89L74 84Z"/>
      <path class="zip" d="M80 95V108" fill="none"/><circle class="zipDot" cx="80" cy="102" r="1.3"/><circle class="zipDot" cx="80" cy="107" r="1.3"/>
      <!-- head -->
      <rect class="neck" x="74" y="78" width="12" height="10" rx="3"/>
      <circle class="skin" cx="50" cy="58" r="7"/><circle class="skin" cx="110" cy="58" r="7"/>
      <ellipse class="face" cx="80" cy="55" rx="30" ry="28"/>
      <path class="hair hSpiky" d="M51 46L54 25L63 33L68 14L77 28L85 11L91 28L100 15L103 32L111 23L110 47Z"/>
      <g class="hair hCurly"><circle cx="57" cy="34" r="8"/><circle cx="66" cy="25" r="8.5"/><circle cx="77" cy="21" r="8.5"/><circle cx="88" cy="21" r="8.5"/><circle cx="98" cy="26" r="8.5"/><circle cx="105" cy="35" r="8"/></g>
      <path class="hair" d="M50 62Q44 25 80 21Q116 24 111 62Q107 47 99 41Q93 50 85 43Q78 51 71 44Q63 51 57 45Q52 51 50 62Z"/>
      <path class="hair hTuft" d="M77 24Q79 12 91 14Q84 17 85 24Z"/>
      <path class="hPart" d="M89 23Q86 30 88 38" fill="none"/>
      <path class="hairShine" d="M60 33Q70 28 81 30M66 39Q77 34 89 36" fill="none"/>
      <path class="browSoft" d="M62 47Q68 43 74 46M86 46Q92 43 98 47" fill="none"/>
      <path class="brow" d="M62 45l12 3M98 45l-12 3" fill="none"/>
      <g class="eyes">
        <g class="eye"><ellipse class="pupil" cx="68" cy="57" rx="4.6" ry="5.6"/><circle class="shine" cx="69.8" cy="55" r="1.6"/></g>
        <g class="eye"><ellipse class="pupil" cx="92" cy="57" rx="4.6" ry="5.6"/><circle class="shine" cx="93.8" cy="55" r="1.6"/></g>
        <path class="lid" d="M63 57.5q5 4 10 0M87 57.5q5 4 10 0" fill="none"/>
      </g>
      <ellipse class="cheek" cx="60" cy="66" rx="5.5" ry="3"/><ellipse class="cheek" cx="100" cy="66" rx="5.5" ry="3"/>
      <path class="noseLine" d="M79 63q-1 3 2 3" fill="none"/>
      <path class="mouth smile" d="M72 70Q80 76 88 70" fill="none"/>
      <ellipse class="mouth talk" cx="80" cy="72" rx="4" ry="3"/>
      <path class="mouth flat" d="M73 72h14" fill="none"/>
    </g>${extras}
  </svg>`;

  // ---------------------------------------------------------------- Eaindra
  const eaindra = `
  <svg class="char-eaindra" viewBox="0 0 160 170" width="132" height="140" aria-label="Eaindra">
    <ellipse class="shadow" cx="80" cy="163" rx="34" ry="5"/>
    <g class="bob">
      <path class="hair hLong" d="M51 52Q45 100 53 132L107 132Q115 100 109 52Z"/>
      <!-- legs + blue sandals -->
      <rect class="skin" x="68" y="134" width="8" height="24" rx="3"/><rect class="skin" x="84" y="134" width="8" height="24" rx="3"/>
      <ellipse class="soleB" cx="72" cy="159" rx="8" ry="3.2"/><ellipse class="soleB" cx="88" cy="159" rx="8" ry="3.2"/>
      <path class="strap" d="M66 154l6 4l6-4M82 154l6 4l6-4" fill="none"/>
      <!-- hair falling behind the shoulders -->
      <path class="hair hLocks" d="M58 66L56 98L67 97L68 76Z"/><path class="hair hLocks" d="M102 66L104 98L93 97L92 76Z"/>
      <!-- pleated skirt -->
      <path class="dress" d="M60 118L100 118L112 140L48 140Z"/>
      <path class="pleat" d="M68 120L63 139M76 120L74 139M84 120L86 139M92 120L97 139" fill="none"/>
      <rect class="band" x="60" y="113" width="40" height="7" rx="2"/>
      <!-- left arm down, right arm waving -->
      <rect class="skin" x="51" y="96" width="8" height="27" rx="4"/><circle class="skin" cx="55" cy="125" r="5"/>
      <g class="armR"><path class="armUp" d="M104 95L117 75" fill="none"/><circle class="skin" cx="118.5" cy="71" r="5.5"/></g>
      <!-- bodice, puff sleeves, collar, buttons -->
      <rect class="dress" x="61" y="86" width="38" height="29" rx="4"/>
      <circle class="dress" cx="59" cy="93" r="8.5"/><circle class="dress" cx="101" cy="93" r="8.5"/>
      <rect class="neck" x="75" y="78" width="10" height="10" rx="3"/>
      <ellipse class="collarW" cx="74" cy="89" rx="7.5" ry="4"/><ellipse class="collarW" cx="86" cy="89" rx="7.5" ry="4"/>
      <circle class="btn" cx="80" cy="97" r="1.9"/><circle class="btn" cx="80" cy="103" r="1.9"/><circle class="btn" cx="80" cy="109" r="1.9"/>
      <!-- head: black bob with straight bangs -->
      <circle class="skin" cx="52" cy="58" r="6"/><circle class="skin" cx="108" cy="58" r="6"/>
      <ellipse class="face" cx="80" cy="55" rx="28" ry="27"/>
      <path class="hair hPony" d="M103 34Q124 38 120 68Q117 84 109 92Q113 70 99 50Z"/><circle class="hTie" cx="106" cy="38" r="3.6"/>
      <g class="hair hBuns"><circle cx="57" cy="27" r="11"/><circle cx="103" cy="27" r="11"/></g>
      <path class="hair" d="M50 68Q45 23 80 21Q115 23 110 68L104 68L104 46Q80 50 56 46L56 68Z"/>
      <path class="hairShine" d="M62 31Q72 27 84 29M64 38Q76 34 90 36" fill="none"/>
      <path class="brow" d="M63 47l11 3M97 47l-11 3" fill="none"/>
      <g class="eyes">
        <g class="eye"><ellipse class="pupil" cx="70" cy="58" rx="4.3" ry="5.2"/><circle class="shine" cx="71.7" cy="56" r="1.5"/></g>
        <g class="eye"><ellipse class="pupil" cx="90" cy="58" rx="4.3" ry="5.2"/><circle class="shine" cx="91.7" cy="56" r="1.5"/></g>
        <path class="lid" d="M65 58.5q5 4 10 0M85 58.5q5 4 10 0" fill="none"/>
      </g>
      <ellipse class="cheek" cx="61" cy="66" rx="5.5" ry="3"/><ellipse class="cheek" cx="99" cy="66" rx="5.5" ry="3"/>
      <path class="noseLine" d="M79 63q-1 3 2 3" fill="none"/>
      <path class="mouth smile" d="M74 69Q80 74 86 69" fill="none"/>
      <ellipse class="mouth talk" cx="80" cy="71" rx="3.6" ry="2.8"/>
      <path class="mouth flat" d="M75 71h10" fill="none"/>
    </g>${extras}
  </svg>`;

  const css = `
  #pip[data-char="tom"] .char-tom, #pip[data-char="eaindra"] .char-eaindra { display: block; }
  .char-tom .skin, .char-tom .face, .char-tom .neck { fill: #f2c7a0; stroke: #c9946b; stroke-width: 1.2; }
  .char-tom .neck { fill: #e6b48a; }
  .char-tom .hair { fill: #1e1e1e; }
  .char-tom .hairShine, .char-eaindra .hairShine { stroke: #4a4a4a; stroke-width: 2.2; stroke-linecap: round; }
  .char-tom .shirt { fill: #fdfdfd; stroke: #d6dbe1; stroke-width: 1.3; stroke-linejoin: round; }
  .char-tom .shirtShade { fill: rgba(40,60,90,.07); }
  /* hair styles (Settings > Look > Hair style) */
  .char-tom .hSpiky, .char-tom .hCurly, .char-tom .hPart, .char-eaindra .hLong, .char-eaindra .hPony, .char-eaindra .hTie, .char-eaindra .hBuns { display: none; }
  #pip[data-hair="spiky"] .char-tom .hSpiky, #pip[data-hair="curly"] .char-tom .hCurly, #pip[data-hair="neat"] .char-tom .hPart { display: inline; }
  #pip[data-hair="spiky"] .char-tom .hTuft, #pip[data-hair="neat"] .char-tom .hTuft, #pip[data-hair="curly"] .char-tom .hTuft { display: none; }
  .char-tom .hPart { stroke: #555; stroke-width: 1.6; stroke-linecap: round; }
  #pip[data-hair="long"] .char-eaindra .hLong, #pip[data-hair="ponytail"] .char-eaindra .hPony, #pip[data-hair="ponytail"] .char-eaindra .hTie, #pip[data-hair="buns"] .char-eaindra .hBuns { display: inline; }
  #pip[data-hair="long"] .char-eaindra .hLocks, #pip[data-hair="ponytail"] .char-eaindra .hLocks, #pip[data-hair="buns"] .char-eaindra .hLocks { display: none; }
  .char-eaindra .hTie { fill: #e64a5d; }
  .char-tom .collar { fill: #eef1f4; stroke: #c9d0d8; stroke-width: 1; }
  .char-tom .zip { stroke: #9aa6b2; stroke-width: 1.4; }
  .char-tom .zipDot { fill: #9aa6b2; }
  .char-tom .pantL { fill: #c9ae7a; } .char-tom .pantR { fill: #b99b68; }
  .char-tom .cuff { fill: #d6bf90; }
  .char-tom .shoe { fill: #7a5233; } .char-tom .sole { fill: #fafafa; stroke: #ddd; stroke-width: .6; }
  .char-tom .lace { stroke: #f2e6d8; stroke-width: 1.4; stroke-linecap: round; }
  .char-tom .browSoft { stroke: #3a2a20; stroke-width: 3; stroke-linecap: round; }
  #pip.worried .char-tom .browSoft { opacity: 0; }
  .char-eaindra .skin, .char-eaindra .face, .char-eaindra .neck { fill: #f3cba4; stroke: #cf9a70; stroke-width: 1.2; }
  .char-eaindra .neck { fill: #e8b88f; }
  .char-eaindra .hair { fill: #1d1d1d; }
  .char-eaindra .dress { fill: #8ec5ea; stroke: #6aa8d4; stroke-width: 1.4; }
  .char-eaindra .band { fill: #6fb0dc; stroke: none; }
  .char-eaindra .pleat { stroke: #6aa8d4; stroke-width: 1.3; }
  .char-eaindra .collarW { fill: #fff; stroke: #cfd8e0; stroke-width: 1; }
  .char-eaindra .btn { fill: #fff; }
  .char-eaindra .armUp { stroke: #f3cba4; stroke-width: 8.5; stroke-linecap: round; }
  .char-eaindra .soleB { fill: #d3e6f5; }
  .char-eaindra .strap { stroke: #4a90c8; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .char-tom .pupil, .char-eaindra .pupil { fill: #1d1d1d; }
  .char-tom .cheek, .char-eaindra .cheek { fill: #f4a3a3; opacity: .65; }
  .char-tom .noseLine, .char-eaindra .noseLine { stroke: #c9946b; stroke-width: 1.4; stroke-linecap: round; }
  .char-tom .mouth { stroke: #8a4b3a; stroke-width: 2.6; }
  .char-eaindra .mouth { stroke: #c0583f; stroke-width: 2.4; }
  .char-tom .mouth.talk, .char-eaindra .mouth.talk { fill: #a3354e; stroke-width: 1.2; }
  .char-tom .lid, .char-eaindra .lid, .char-tom .brow, .char-eaindra .brow { stroke: #2a1e18; }`;

  const pipEl = document.getElementById('pip');
  pipEl.insertAdjacentHTML('afterbegin', tom + eaindra);
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // this app has only these two characters
  for (const k of Object.keys(CHAR_NAMES)) delete CHAR_NAMES[k];
  CHAR_NAMES.eaindra = 'Eaindra';
  CHAR_NAMES.tom = 'Tom';

  CHAR_PERSONAS.eaindra = 'You are Eaindra, a sweet, polite and cheerful girl in a light-blue dress who lives above the Windows taskbar and helps the user through the office day. ' +
    'In Burmese you call yourself "ကျွန်မ". Be warm and encouraging, but clear, practical and useful.';
  CHAR_PERSONAS.tom = 'You are Tom, a friendly, easy-going young guy in a white shirt who lives above the Windows taskbar and helps the user through the office day. ' +
    'In Burmese you call yourself "ကျွန်တော်". Be upbeat and helpful, with a bit of humour, but clear, practical and useful.';

  CHAR_STYLE.eaindra = {
    pitch: 1.25, rate: 1.0, voiceHint: /Zira|Aria|Jenny|Ava|Emma|Female/i,
    neural: { my: 'my-MM-NilarNeural', en: 'en-US-AnaNeural', pitch: '+8Hz', rate: '+0%' },
    hi: 'Hi hi~ 👋', pet: 'Hehe~ thank you! 💙', sleepy: 'Eaindra is resting a little... zzz',
  };
  CHAR_STYLE.tom = {
    pitch: 1.05, rate: 1.05, voiceHint: /David|Mark|Guy|Andrew|Male/i,
    neural: { my: 'my-MM-ThihaNeural', en: 'en-US-AndrewNeural', pitch: '+6Hz', rate: '+5%' },
    hi: 'Hey! 👋', pet: 'Haha, thanks! 😄', sleepy: 'Tom is taking a nap... zzz',
  };
  CHAR_SOUNDS.eaindra = {
    hello: (t) => { tone(t, { dur: 0.14, vol: 0.3, path: [[0, 740], [0.12, 930]] }); tone(t + 0.15, { dur: 0.2, vol: 0.3, path: [[0, 1050], [0.18, 1400]] }); },
    reply: (t) => S.chime(t),
    alert: (t) => { S.chime(t); S.chime(t + 0.35); },
    pet: (t) => { [1300, 1170, 1050, 1230].forEach((hz, i) => tone(t + i * 0.08, { dur: 0.07, vol: 0.22, path: [[0, hz]], attack: 0.005, release: 0.04 })); },
    sleep: (t) => { [440, 494, 392].forEach((hz, i) => tone(t + i * 0.45, { type: 'triangle', dur: 0.42, vol: 0.18, path: [[0, hz]], lp: 1200 })); },
    error: (t) => tone(t, { dur: 0.45, vol: 0.28, path: [[0, 720], [0.45, 430]], vib: [6, 10] }),
  };
  CHAR_SOUNDS.tom = {
    hello: (t) => { tone(t, { type: 'triangle', dur: 0.12, vol: 0.35, path: [[0, 520], [0.12, 660]] }); tone(t + 0.13, { type: 'triangle', dur: 0.16, vol: 0.35, path: [[0, 660], [0.16, 880]] }); },
    reply: (t) => tone(t, { type: 'triangle', dur: 0.18, vol: 0.3, path: [[0, 880], [0.18, 990]], release: 0.1 }),
    alert: (t) => { tone(t, { type: 'triangle', dur: 0.3, vol: 0.38, path: [[0, 659]], release: 0.2 }); tone(t + 0.32, { type: 'triangle', dur: 0.45, vol: 0.38, path: [[0, 523]], release: 0.35 }); },   // ding-dong
    pet: (t) => { [600, 750, 600, 750].forEach((hz, i) => tone(t + i * 0.1, { type: 'triangle', dur: 0.08, vol: 0.25, path: [[0, hz]] })); },
    sleep: (t) => S.snore(t),
    error: (t) => S.lowhum(t),
  };

  // wardrobe (customize.js): colour slots, where eyes/accessories go, hair styles
  CHAR_LOOKS.tom = {
    slots: { hair: ['.char-tom .hair'], top: ['.char-tom .shirt'], bottom: ['.char-tom .pantL', '.char-tom .pantR', '.char-tom .cuff'], shoes: ['.char-tom .shoe'], skin: ['.char-tom .skin', '.char-tom .face', '.char-tom .neck'] },
    heads: [{ l: [68, 57], r: [92, 57], top: 22, w: 62 }],
    hairs: [['tuft', 'Tuft (default)'], ['spiky', 'Spiky'], ['neat', 'Neat side part'], ['curly', 'Curly']],
  };
  CHAR_LOOKS.eaindra = {
    slots: { hair: ['.char-eaindra .hair'], dress: ['.char-eaindra .dress'], band: ['.char-eaindra .band'], shoes: ['.char-eaindra .strap|stroke'], skin: ['.char-eaindra .skin', '.char-eaindra .face', '.char-eaindra .neck', '.char-eaindra .armUp|stroke'] },
    heads: [{ l: [70, 58], r: [90, 58], top: 21, w: 62 }],
    hairs: [['bob', 'Bob (default)'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['buns', 'Two buns']],
  };
  SLOT_LABELS.band = 'Belt';

  const sel = document.getElementById('sChar');
  sel.innerHTML = '<option value="eaindra">Eaindra (light-blue dress)</option><option value="tom">Tom (white shirt)</option>';
  if (typeof settings === 'object' && CHAR_NAMES[settings.character]) applyCharacter();
})();
