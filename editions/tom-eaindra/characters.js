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
      <rect class="shoe" x="63" y="149" width="17" height="9" rx="4.5"/><rect class="sole" x="63" y="155" width="17" height="4" rx="2"/>
      <rect class="shoe" x="80" y="149" width="17" height="9" rx="4.5"/><rect class="sole" x="80" y="155" width="17" height="4" rx="2"/>
      <path class="lace" d="M68 152h6M86 152h6" fill="none"/>
      <!-- khaki trousers: thin child legs -->
      <rect class="pantL" x="67" y="115" width="12.5" height="36"/><rect class="pantR" x="80.5" y="115" width="12.5" height="36"/>
      <rect class="cuff" x="67" y="146" width="12.5" height="5" rx="2"/><rect class="cuff" x="80.5" y="146" width="12.5" height="5" rx="2"/>
      <!-- thin arms out of the sleeves (left hangs, right waves) -->
      <path class="armLine" d="M61 98Q58.5 110 59.5 121" fill="none"/><path class="armSkin" d="M61 98Q58.5 110 59.5 121" fill="none"/>
      <circle class="skin" cx="59.5" cy="123.5" r="3.9"/>
      <g class="armR">
        <path class="armLine" d="M99 98Q101.5 110 100.5 121" fill="none"/><path class="armSkin" d="M99 98Q101.5 110 100.5 121" fill="none"/>
        <circle class="skin" cx="100.5" cy="123.5" r="3.9"/>
      </g>
      <!-- white shirt: slim torso + short sleeves -->
      <path class="shirt" d="M68 86Q61 88 57 99L64.5 101.5L68 94Z"/><path class="shirt" d="M92 86Q99 88 103 99L95.5 101.5L92 94Z"/>
      <path class="shirt" d="M67 86Q80 82 93 86L94.5 117L65.5 117Z"/>
      <path class="shirtShade" d="M87 84L93 86L94.5 117L88.5 117Z"/>
      <path class="collar" d="M74 83L80 89L86 83L84 81L80 85L76 81Z"/>
      <path class="zip" d="M80 89V103" fill="none"/><circle class="zipDot" cx="80" cy="96" r="1.1"/><circle class="zipDot" cx="80" cy="100.5" r="1.1"/>
      <!-- head: big and round like a child, on a slim body -->
      <rect class="neck" x="76" y="75" width="8" height="10" rx="3"/>
      <g class="tomHead" transform="translate(80 80) scale(0.82) translate(-80 -80)">
        <circle class="skin" cx="50" cy="58" r="7"/><circle class="skin" cx="110" cy="58" r="7"/>
        <ellipse class="face" cx="80" cy="55" rx="30" ry="28"/>
        <path class="hair hSpiky" d="M51 46L54 25L63 33L68 14L77 28L85 11L91 28L100 15L103 32L111 23L110 47Z"/>
        <g class="hair hCurly"><circle cx="57" cy="34" r="8"/><circle cx="66" cy="25" r="8.5"/><circle cx="77" cy="21" r="8.5"/><circle cx="88" cy="21" r="8.5"/><circle cx="98" cy="26" r="8.5"/><circle cx="105" cy="35" r="8"/></g>
        <path class="hair hMohawk" d="M73 30L75 6L80 17L84 3L87 17L91 7L89 32Z"/>
        <path class="hair hMain" d="M50 62Q44 25 80 21Q116 24 111 62Q107 47 99 41Q93 50 85 43Q78 51 71 44Q63 51 57 45Q52 51 50 62Z"/>
        <path class="hair hBuzz" d="M53 52Q50 26 80 24Q110 26 107 52Q97 41 80 41Q63 41 53 52Z"/>
        <path class="hair hBowl" d="M49 61Q44 22 80 20Q116 22 111 61L106 61L106 47Q80 42 54 47L54 61Z"/>
        <path class="hair hSwept" d="M50 61Q44 23 80 20Q116 23 111 58Q101 45 88 46Q70 51 57 56Q52 58 50 61Z"/>
        <path class="hair hSlick" d="M51 52Q48 21 80 19Q112 21 109 52Q100 33 80 32Q60 33 51 52Z"/><path class="hSlickLine" d="M62 30Q80 23 98 30M60 37Q80 29 100 37" fill="none"/>
        <path class="hair hMessy" d="M58 32L47 23L62 27ZM100 30L112 20L105 32ZM86 23L93 10L92 25ZM70 24L66 12L76 22Z"/>
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
      </g>
    </g>${extras}
  </svg>`;

  // ---------------------------------------------------------------- Eaindra
  const eaindra = `
  <svg class="char-eaindra" viewBox="0 0 160 170" width="132" height="140" aria-label="Eaindra">
    <ellipse class="shadow" cx="80" cy="163" rx="34" ry="5"/>
    <g class="bob">
      <!-- long hair style sits behind everything -->
      <path class="hair hLong" d="M61 70Q57 100 60 128L66.5 128Q63.5 100 66.5 76Z"/><path class="hair hLong" d="M99 70Q103 100 100 128L93.5 128Q96.5 100 93.5 76Z"/>
      <path class="hair hTwin" d="M57 66Q50 90 56 114Q59 119 62 114Q58 92 63 72Z"/><path class="hair hTwin" d="M103 66Q110 90 104 114Q101 119 98 114Q102 92 97 72Z"/>
      <!-- thin legs + small blue sandals -->
      <rect class="skin" x="72" y="134" width="6" height="22" rx="3"/><rect class="skin" x="82" y="134" width="6" height="22" rx="3"/>
      <ellipse class="soleB" cx="74.5" cy="157.5" rx="6" ry="2.6"/><ellipse class="soleB" cx="85.5" cy="157.5" rx="6" ry="2.6"/>
      <path class="strap" d="M70 154l4.5 3l4.5-3M81 154l4.5 3l4.5-3" fill="none"/>
      <!-- hair falling behind the shoulders (bob) -->
      <path class="hair hLocks" d="M61.3 68.1L59.6 95.3L69 94.5L69.8 76.6Z"/><path class="hair hLocks" d="M98.7 68.1L100.4 95.3L91 94.5L90.2 76.6Z"/>
      <!-- slim pleated skirt -->
      <path class="dress" d="M66 114L94 114L102 138L58 138Z"/>
      <path class="pleat" d="M72 116L68.5 137M78 116L77 137M83 116L84 137M89 116L92.5 137" fill="none"/>
      <rect class="band" x="66" y="110" width="28" height="5.5" rx="2"/>
      <!-- thin arms: left down, right waving -->
      <path class="armLine" d="M63 94Q60 106 60.5 117" fill="none"/><path class="armSkin" d="M63 94Q60 106 60.5 117" fill="none"/>
      <circle class="skin" cx="60.5" cy="119.5" r="3.8"/>
      <g class="armR">
        <path class="armLine" d="M97 93L108 75" fill="none"/><path class="armSkin" d="M97 93L108 75" fill="none"/>
        <circle class="skin" cx="109.5" cy="72" r="4.4"/>
      </g>
      <!-- bodice, small puff sleeves, collar, buttons -->
      <rect class="dress" x="66" y="85" width="28" height="27" rx="4"/>
      <circle class="dress" cx="64.5" cy="90" r="6.2"/><circle class="dress" cx="95.5" cy="90" r="6.2"/>
      <rect class="neck" x="76.5" y="76" width="7" height="10" rx="3"/>
      <ellipse class="collarW" cx="75.5" cy="87" rx="5.8" ry="3.2"/><ellipse class="collarW" cx="84.5" cy="87" rx="5.8" ry="3.2"/>
      <circle class="btn" cx="80" cy="94" r="1.5"/><circle class="btn" cx="80" cy="99" r="1.5"/><circle class="btn" cx="80" cy="104" r="1.5"/>
      <g class="hair hBraid"><ellipse cx="66" cy="80" rx="4.6" ry="5.6"/><ellipse cx="65.2" cy="89" rx="4.4" ry="5.4"/><ellipse cx="64.5" cy="98" rx="4.2" ry="5.2"/><ellipse cx="64" cy="106.5" rx="4" ry="5"/><path d="M61.5 114Q64 123 66.5 114Z"/></g><circle class="hTie hBraidTie" cx="63.8" cy="112.5" r="2.4"/>
      <!-- head: big and round like a child -->
      <g class="kidHead" transform="translate(80 80) scale(0.85) translate(-80 -80)">
        <circle class="skin" cx="52" cy="58" r="6"/><circle class="skin" cx="108" cy="58" r="6"/>
        <ellipse class="face" cx="80" cy="55" rx="28" ry="27"/>
        <path class="hair hPony" d="M104 36Q118 42 116 68Q114 84 109 94Q111 70 101 50Z"/><circle class="hTie hPonyTie" cx="106" cy="38" r="3.6"/>
        <circle class="hair hHalf" cx="80" cy="17" r="9.5"/><circle class="hTie hHalfTie" cx="80" cy="26" r="3"/>
        <circle class="hTie hTwinTie" cx="55" cy="66" r="3.4"/><circle class="hTie hTwinTie" cx="105" cy="66" r="3.4"/>
        <g class="hair hBuns"><circle cx="57" cy="27" r="11"/><circle cx="103" cy="27" r="11"/></g>
        <path class="hair hPixie" d="M51 56Q46 24 80 21Q114 24 109 56Q105 41 93 38Q81 47 63 44Q56 46 51 56Z"/>
        <path class="hair hSide" d="M50 66Q45 23 80 21Q115 23 110 66L104 66L104 44Q88 53 66 39Q59 45 56 52L56 66Z"/>
        <path class="hair hFront" d="M50 68Q45 23 80 21Q115 23 110 68L104 68L104 46Q80 50 56 46L56 68Z"/>
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
      </g>
    </g>${extras}
  </svg>`;

  const css = `
  #pip[data-char="tom"] .char-tom, #pip[data-char="eaindra"] .char-eaindra { display: block; }
  .char-tom .skin, .char-tom .face, .char-tom .neck { fill: #f2c7a0; stroke: #c9946b; stroke-width: 1.2; }
  .char-tom .neck { fill: #e6b48a; }
  .char-tom .hair { fill: #1e1e1e; }
  .char-tom .hairShine, .char-eaindra .hairShine { stroke: #4a4a4a; stroke-width: 2.2; stroke-linecap: round; }
  .char-tom .armLine { stroke: #c9946b; stroke-width: 7.5; stroke-linecap: round; }
  .char-tom .armSkin { stroke: #f2c7a0; stroke-width: 5.5; stroke-linecap: round; }
  #pip svg.char-tom g.armR { transform-box: fill-box; transform-origin: 50% 0%; }   /* pivot at the shoulder */
  #pip.happy svg.char-tom g.armR { animation: tomWave .5s 4 alternate ease-in-out; }   /* raise the hand and wave */
  @keyframes tomWave { 0% { transform: rotate(-135deg); } 100% { transform: rotate(-165deg); } }
  .char-tom .shirt { fill: #fdfdfd; stroke: #d6dbe1; stroke-width: 1.3; stroke-linejoin: round; }
  .char-tom .shirtShade { fill: rgba(40,60,90,.07); }
  /* hair styles (Settings > Look > Hair style) */
  /* Tom hair styles: extra parts are hidden until their style is chosen */
  .char-tom .hSpiky, .char-tom .hCurly, .char-tom .hPart, .char-tom .hMohawk, .char-tom .hBuzz, .char-tom .hBowl, .char-tom .hSwept, .char-tom .hSlick, .char-tom .hSlickLine, .char-tom .hMessy { display: none; }
  #pip[data-hair="spiky"] .char-tom .hSpiky { display: inline; }
  #pip[data-hair="spiky"] .char-tom .hTuft { display: none; }
  #pip[data-hair="neat"] .char-tom .hPart { display: inline; }
  #pip[data-hair="neat"] .char-tom .hTuft { display: none; }
  #pip[data-hair="curly"] .char-tom .hCurly { display: inline; }
  #pip[data-hair="curly"] .char-tom .hTuft { display: none; }
  #pip[data-hair="buzz"] .char-tom .hBuzz { display: inline; }
  #pip[data-hair="buzz"] .char-tom .hTuft, #pip[data-hair="buzz"] .char-tom .hMain, #pip[data-hair="buzz"] .char-tom .hairShine { display: none; }
  #pip[data-hair="bowl"] .char-tom .hBowl { display: inline; }
  #pip[data-hair="bowl"] .char-tom .hTuft, #pip[data-hair="bowl"] .char-tom .hMain { display: none; }
  #pip[data-hair="swept"] .char-tom .hSwept { display: inline; }
  #pip[data-hair="swept"] .char-tom .hTuft, #pip[data-hair="swept"] .char-tom .hMain { display: none; }
  #pip[data-hair="mohawk"] .char-tom .hMohawk { display: inline; }
  #pip[data-hair="mohawk"] .char-tom .hTuft { display: none; }
  #pip[data-hair="slick"] .char-tom .hSlick, #pip[data-hair="slick"] .char-tom .hSlickLine { display: inline; }
  #pip[data-hair="slick"] .char-tom .hTuft, #pip[data-hair="slick"] .char-tom .hMain, #pip[data-hair="slick"] .char-tom .hairShine { display: none; }
  #pip[data-hair="messy"] .char-tom .hMessy { display: inline; }
  .char-tom .hSlickLine { stroke: #555; stroke-width: 1.5; stroke-linecap: round; }
  .char-tom .hPart { stroke: #555; stroke-width: 1.6; stroke-linecap: round; }

  /* Eaindra hair styles: extra parts are hidden until their style is chosen */
  .char-eaindra .hLong, .char-eaindra .hTwin, .char-eaindra .hBraid, .char-eaindra .hPony, .char-eaindra .hBuns, .char-eaindra .hPixie, .char-eaindra .hSide, .char-eaindra .hHalf, .char-eaindra .hTie { display: none; }
  #pip[data-hair="shortbob"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="pixie"] .char-eaindra .hPixie { display: inline; }
  #pip[data-hair="pixie"] .char-eaindra .hLocks, #pip[data-hair="pixie"] .char-eaindra .hFront { display: none; }
  #pip[data-hair="sidepart"] .char-eaindra .hSide { display: inline; }
  #pip[data-hair="sidepart"] .char-eaindra .hLocks, #pip[data-hair="sidepart"] .char-eaindra .hFront { display: none; }
  #pip[data-hair="long"] .char-eaindra .hLong { display: inline; }
  #pip[data-hair="long"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="braid"] .char-eaindra .hBraid, #pip[data-hair="braid"] .char-eaindra .hBraidTie { display: inline; }
  #pip[data-hair="braid"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="twintails"] .char-eaindra .hTwin, #pip[data-hair="twintails"] .char-eaindra .hTwinTie { display: inline; }
  #pip[data-hair="twintails"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="halfup"] .char-eaindra .hHalf, #pip[data-hair="halfup"] .char-eaindra .hHalfTie, #pip[data-hair="halfup"] .char-eaindra .hLong { display: inline; }
  #pip[data-hair="halfup"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="ponytail"] .char-eaindra .hPony, #pip[data-hair="ponytail"] .char-eaindra .hPonyTie { display: inline; }
  #pip[data-hair="ponytail"] .char-eaindra .hLocks { display: none; }
  #pip[data-hair="buns"] .char-eaindra .hBuns { display: inline; }
  #pip[data-hair="buns"] .char-eaindra .hLocks { display: none; }
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
  .char-eaindra .armLine { stroke: #cf9a70; stroke-width: 7.5; stroke-linecap: round; }
  .char-eaindra .armSkin { stroke: #f3cba4; stroke-width: 5.5; stroke-linecap: round; }
  #pip svg.char-eaindra g.armR { transform-box: fill-box; transform-origin: 0% 100%; }
  #pip.happy svg.char-eaindra g.armR { animation: eWave .45s 4 alternate ease-in-out; }
  @keyframes eWave { 0% { transform: rotate(-14deg); } 100% { transform: rotate(14deg); } }
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
    'In Burmese you call yourself "ကျွန်မ". Your name in Burmese script is exactly "အိန္ဒြာ" - always write it exactly like that, never any other spelling. ' +
    'Be warm and encouraging, but clear, practical and useful.';
  CHAR_PERSONAS.tom = 'You are Tom, a friendly, easy-going young guy in a white shirt who lives above the Windows taskbar and helps the user through the office day. ' +
    'In Burmese you call yourself "ကျွန်တော်". Always write your name in English letters as "Tom", even inside Burmese sentences (e.g. "ကျွန်တော် Tom ပါ") - never spell it in Burmese script. ' +
    'Be upbeat and helpful, with a bit of humour, but clear, practical and useful.';

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
    slots: { hair: ['.char-tom .hair'], top: ['.char-tom .shirt'], bottom: ['.char-tom .pantL', '.char-tom .pantR', '.char-tom .cuff'], shoes: ['.char-tom .shoe'], skin: ['.char-tom .skin', '.char-tom .face', '.char-tom .neck', '.char-tom .armSkin|stroke'] },
    heads: [{ l: [70.2, 61.1], r: [89.8, 61.1], top: 31.6, w: 51 }],
    hairs: [['tuft', 'Tuft (default)'], ['spiky', 'Spiky'], ['neat', 'Neat side part'], ['curly', 'Curly'], ['buzz', 'Buzz cut'],
      ['bowl', 'Bowl cut'], ['swept', 'Side-swept fringe'], ['mohawk', 'Mohawk'], ['slick', 'Slicked back'], ['messy', 'Messy']],
  };
  CHAR_LOOKS.eaindra = {
    slots: { hair: ['.char-eaindra .hair'], dress: ['.char-eaindra .dress'], band: ['.char-eaindra .band'], shoes: ['.char-eaindra .strap|stroke'], skin: ['.char-eaindra .skin', '.char-eaindra .face', '.char-eaindra .neck', '.char-eaindra .armSkin|stroke'] },
    heads: [{ l: [71.5, 61.3], r: [88.5, 61.3], top: 29.9, w: 53 }],
    hairs: [['bob', 'Bob (default)'], ['shortbob', 'Short bob'], ['pixie', 'Pixie (very short)'], ['sidepart', 'Side-swept short'],
      ['long', 'Long (slim)'], ['braid', 'Side braid'], ['twintails', 'Twin tails'], ['halfup', 'Half-up bun'], ['ponytail', 'Ponytail'], ['buns', 'Two buns']],
  };
  SLOT_LABELS.band = 'Belt';

  const sel = document.getElementById('sChar');
  sel.innerHTML = '<option value="eaindra">Eaindra (light-blue dress)</option><option value="tom">Tom (white shirt)</option>';
  if (typeof settings === 'object' && CHAR_NAMES[settings.character]) applyCharacter();
})();
