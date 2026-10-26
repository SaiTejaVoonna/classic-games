/* Racer vehicle art: vector drawings of rear views (sport sedan, rally car, electric sedan, hypercar,
   crossover, pickup, pod van, cargo truck, formula car). Each one is built as a standalone SVG and
   rasterised once into a small canvas, so the game just scales bitmaps. Classic Games prototype art. */
(function (root) {
  'use strict';
let defs='',gid=0;
const shade=(hex,k)=>{const n=parseInt(hex.slice(1),16);let r=n>>16,g=(n>>8)&255,b=n&255;const f=k<0?0:255,t=Math.abs(k);r=Math.round(r+(f-r)*t);g=Math.round(g+(f-g)*t);b=Math.round(b+(f-b)*t);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);};
// paint: sky reflection on top, saturated mid, dark lower, plus thin bright line near the bottom (ground bounce)
function paint(c){const id='p'+(gid++);defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c,.55)}"/><stop offset=".16" stop-color="${shade(c,.2)}"/><stop offset=".5" stop-color="${c}"/><stop offset=".86" stop-color="${shade(c,-.45)}"/><stop offset="1" stop-color="${shade(c,-.2)}"/></linearGradient>`;return `url(#${id})`;}
function lin(stops,x2=0,y2=1){const id='l'+(gid++);defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(s=>`<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2]??1}"/>`).join('')}</linearGradient>`;return `url(#${id})`;}
const glass=()=>lin([[0,'#7da2d6'],[.28,'#2a3d63'],[.7,'#0c1424'],[1,'#05080f']]);
const carbon=()=>lin([[0,'#2b303c'],[1,'#0a0c12']]);
const mir=s=>`${s}<g transform="scale(-1 1)">${s}</g>`;
function glowLine(y,x1,x2,h,col,core){return `<rect x="${x1}" y="${y-h*1.8}" width="${x2-x1}" height="${h*3.6}" rx="${h*1.8}" fill="${col}" opacity=".55" filter="url(#bl2)"/><rect x="${x1}" y="${y-h/2}" width="${x2-x1}" height="${h}" rx="${h/2}" fill="${core||col}"/>`;}
// Tyre geometry per vehicle (x of the right tyre, width, height) in sprite units. The game redraws the tread over
// these rectangles with a scrolling pattern, so the wheels look like they are turning.
const TYRE={sedan:[29,15,24],hyper:[29,15,24],ev:[30,14,23],cross:[30,15,27],pickup:[30,16,28],pod:[30,15,25],truck:[31,14,24],rally:[28,16,29]};
function tyrePair(type,rim){const [x0,w,h]=TYRE[type];
 const g=lin([[0,'#07080b'],[.55,'#171a22'],[1,'#2b303d']],1,0);
 return mir(`<path d="M${x0-3},${-h-2} Q${x0+w*.5},${-h-11} ${x0+w+3},${-h-2} L${x0+w+3},${-h*.55} L${x0-3},${-h*.55}Z" fill="#040508" opacity=".6"/>`
  +`<ellipse cx="${x0+w*.5}" cy="1" rx="${w*.75}" ry="${w*.2}" fill="#000" opacity=".55"/>`
  +`<rect x="${x0}" y="${-h}" width="${w}" height="${h}" rx="${w*.32}" fill="${g}"/>`
  +`<rect x="${x0+w*.12}" y="${-h+h*.04}" width="${w*.76}" height="${h*.06}" rx="${w*.1}" fill="#fff" opacity=".1"/>`
  +`<rect x="${x0+w*.86}" y="${-h*.9}" width="${w*.07}" height="${h*.74}" rx="${w*.04}" fill="${rim||'#aab4cb'}" opacity=".35"/>`);}
function underglow(col){return `<ellipse cx="0" cy="2" rx="54" ry="5" fill="#05070b" opacity=".55"/><ellipse cx="0" cy="1" rx="38" ry="2.6" fill="#000" opacity=".5"/>`;}
function plate(y){return `<rect x="-12" y="${y}" width="24" height="9" rx="1.5" fill="#f1f4fa"/><rect x="-9" y="${y+3.2}" width="18" height="1.6" fill="#8a93a6"/>`;}

function hyper(c,acc,brake){ // low wide supercar
 const lit=brake?'#ff6a7a':'#ff2d55', body=paint(c), cg=glass(), cb=carbon();
 let s=underglow(acc);
 // diffuser
 s+=`<path d="M-40,-22 L40,-22 L35,-5 Q0,0 -35,-5Z" fill="${cb}"/>`+[-24,-16,-8,0,8,16,24].map(x=>`<path d="M${x},-21 L${x*.9},-6" stroke="#3c4455" stroke-width="1.4"/>`).join('');
 s+=`<rect x="-6" y="-14" width="12" height="4" rx="1" fill="${lit}" opacity=".9"/>`+[-22,22].map(x=>`<circle cx="${x}" cy="-13" r="4.6" fill="#1a1d26"/><circle cx="${x}" cy="-13" r="3" fill="#07080b"/><circle cx="${x}" cy="-13" r="4.6" fill="none" stroke="#8da0c6" stroke-width=".8"/>`).join('');
 // body haunches
 s+=mir(`<path d="M0,-58 L28,-58 L43,-52 C50,-46 53,-34 51,-21 Q26,-16 0,-16Z" fill="${body}"/>`);
 s+=mir(`<path d="M2,-57 L28,-57 L42,-51.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none"/><path d="M45,-44 C49,-38 50,-30 49,-23" stroke="${acc}" stroke-width="1.6" fill="none" opacity=".9"/><path d="M33,-51 L45,-45 L46,-35 L36,-37Z" fill="#000" opacity=".28"/>`);
 // canopy
 s+=mir(`<path d="M0,-58 L27,-58 L21,-73 Q12,-79 0,-79Z" fill="${cg}"/>`);
 s+=mir(`<path d="M3,-76 Q12,-76 18,-72 L14,-60 L5,-60Z" fill="#fff" opacity=".13"/><path d="M0,-79 Q12,-79 21,-73 L27,-58" stroke="#e8f0ff" stroke-opacity=".6" stroke-width="1.2" fill="none"/>`);
 // engine vents
 s+=`<rect x="-20" y="-56" width="40" height="3" rx="1" fill="#0a0c12" opacity=".85"/><rect x="-16" y="-51" width="32" height="2" rx="1" fill="#0a0c12" opacity=".7"/>`;
 // wing
 s+=`<rect x="-3" y="-64" width="6" height="8" fill="${cb}"/><rect x="-47" y="-68" width="94" height="5" rx="2" fill="${cb}"/><rect x="-47" y="-68" width="94" height="1.6" rx=".8" fill="#fff" opacity=".35"/>`+mir(`<rect x="44" y="-74" width="3.4" height="13" rx="1.2" fill="${cb}"/><rect x="30" y="-64" width="3" height="8" fill="${cb}"/>`);
 // light bar: full width, brighter ends
 s+=glowLine(-37,-46,46,2.4,lit,'#ffd9de')+mir(`<path d="M30,-42 L47,-43 L46,-33 L33,-34Z" fill="${lit}"/><path d="M33,-40 L45,-41" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>`);
 s+=plate(-31);
 s+=tyrePair('hyper','#b9c4da');
 return s;}
function ev(c,acc,brake){ // smooth fastback sedan, glass roof, thin light bar
 const lit=brake?'#ff6a7a':'#ff3a52', body=paint(c), cg=glass();
 let s=underglow(acc);
 s+=`<path d="M-38,-20 L38,-20 L33,-6 Q0,-2 -33,-6Z" fill="${carbon()}"/><rect x="-24" y="-11" width="48" height="4" rx="1.5" fill="#06080c" opacity=".7"/>`;
 s+=mir(`<path d="M0,-46 L26,-46 C42,-44 49,-36 49,-24 L47,-17 Q24,-13 0,-13Z" fill="${body}"/>`);
 s+=mir(`<path d="M0,-46 L26,-46 C42,-44 49,-37 49,-30" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none"/>`);
 s+=mir(`<path d="M0,-46 L34,-46 C31,-60 24,-73 12,-77 Q6,-78 0,-78Z" fill="${cg}"/><path d="M4,-74 Q14,-73 20,-66 L24,-50 L6,-50Z" fill="#fff" opacity=".12"/>`);
 s+=`<path d="M-33,-46 C-30,-60 -23,-73 -12,-77 Q0,-80 12,-77" stroke="#e8f0ff" stroke-opacity=".5" stroke-width="1.2" fill="none"/>`;
 s+=`<path d="M-33,-47 Q0,-52 33,-47 L33,-44 Q0,-48 -33,-44Z" fill="${shade(c,-.3)}" opacity=".6"/>`;
 s+=glowLine(-35,-44,44,1.6,lit,'#ffe3e7')+mir(`<path d="M36,-40 L47,-38 L46,-31 L38,-33Z" fill="${lit}"/>`);
 s+=plate(-29);
 s+=tyrePair('ev','#cfd6e6');
 return s;}
function cross(c,acc,brake){ // sport crossover, split LED C-lights, roof spoiler, taller
 const lit=brake?'#ff6a7a':'#ff3a52', body=paint(c), cg=glass(), cb=carbon();
 let s=underglow(acc);
 s+=`<path d="M-40,-24 L40,-24 L36,-8 Q0,-3 -36,-8Z" fill="${cb}"/>`+[-14,14].map(x=>`<circle cx="${x*1.7}" cy="-14" r="4.2" fill="#07080b" stroke="#8da0c6" stroke-width=".8"/>`).join('')+`<rect x="-14" y="-15" width="28" height="4" rx="1.5" fill="#050609" opacity=".7"/>`;
 s+=mir(`<path d="M0,-56 L33,-56 C45,-54 50,-46 50,-36 L48,-20 Q24,-16 0,-16Z" fill="${body}"/>`);
 s+=mir(`<path d="M0,-56 L33,-56 C45,-54 50,-47 50,-40" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none"/>`);
 s+=mir(`<path d="M0,-56 L37,-56 L33,-80 Q31,-86 24,-86 L0,-86Z" fill="${cg}"/><path d="M5,-82 Q18,-82 25,-79 L28,-60 L9,-60Z" fill="#fff" opacity=".12"/>`);
 s+=`<path d="M-37,-56 L-33,-80 Q-31,-86 -24,-86 L24,-86 Q31,-86 33,-80 L37,-56" stroke="#e8f0ff" stroke-opacity=".45" stroke-width="1.2" fill="none"/>`;
 s+=`<path d="M-30,-88 L30,-88 L27,-92 L-27,-92Z" fill="${cb}"/><rect x="-8" y="-89" width="16" height="2" rx="1" fill="${lit}"/>`;
 s+=mir(`<path d="M44,-50 L47,-49 L47,-38 L40,-36 L40,-44 L26,-44 L26,-48 Z" fill="${lit}"/><path d="M26,-47 L44,-48" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>`)+`<rect x="-26" y="-45" width="52" height="2.2" rx="1" fill="${lit}" opacity=".9"/>`;
 s+=plate(-36);
 s+=tyrePair('cross','#aab4cb');
 return s;}
function pickup(c,acc,brake){ // faceted cyber-pickup: flat panels, steel
 const lit=brake?'#ff6a7a':'#ff3a52', st=paint(c), cg=glass(), cb=carbon(), dk=lin([[0,'#2a2f3c'],[1,'#12151c']]);
 let s=underglow(acc);
 s+=`<path d="M-42,-26 L42,-26 L38,-8 L-38,-8Z" fill="${cb}"/><rect x="-18" y="-18" width="36" height="6" rx="1" fill="#06070b"/>`;
 s+=`<path d="M-50,-26 L-48,-62 L-30,-66 L30,-66 L48,-62 L50,-26Z" fill="${st}"/>`;
 s+=`<path d="M-48,-62 L-30,-66 L30,-66 L48,-62" stroke="#fff" stroke-opacity=".75" stroke-width="1.5" fill="none"/>`;
 s+=`<path d="M-50,-26 L-48,-62 L-44,-62 L-45,-26Z" fill="${dk}"/><path d="M50,-26 L48,-62 L44,-62 L45,-26Z" fill="${dk}"/>`;
 s+=`<path d="M-30,-66 L-22,-92 L22,-92 L30,-66Z" fill="${cg}"/><path d="M-18,-89 L-6,-89 L-12,-69 L-24,-69Z" fill="#fff" opacity=".13"/><path d="M-30,-66 L-22,-92 L22,-92 L30,-66" stroke="#e8f0ff" stroke-opacity=".5" stroke-width="1.2" fill="none"/>`;
 s+=`<path d="M-40,-62 L-40,-70 L-34,-70 L-34,-64M40,-62 L40,-70 L34,-70 L34,-64" stroke="${cb}" stroke-width="3" fill="none"/>`;
 s+=`<rect x="-46" y="-56" width="92" height="30" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/><line x1="0" y1="-56" x2="0" y2="-26" stroke="#000" stroke-opacity=".18"/>`;
 s+=glowLine(-52,-46,46,2.6,lit,'#ffe3e7')+`<rect x="-3" y="-54" width="6" height="5" fill="${st}"/>`;
 s+=plate(-40);
 s+=tyrePair('pickup','#aab4cb');
 return s;}
function pod(c,acc,brake){ // futuristic van pod: tall, big glass, vertical light strips
 const lit=brake?'#ff6a7a':'#ff3a52', body=paint(c), cg=glass(), cb=carbon();
 let s=underglow(acc);
 s+=`<path d="M-40,-22 L40,-22 L36,-7 Q0,-3 -36,-7Z" fill="${cb}"/><rect x="-16" y="-14" width="32" height="4" rx="1.5" fill="#06080c" opacity=".7"/>`;
 s+=mir(`<path d="M0,-92 L30,-92 C44,-90 50,-80 50,-66 L50,-20 Q25,-15 0,-15Z" fill="${body}"/>`);
 s+=mir(`<path d="M0,-92 L30,-92 C44,-90 50,-81 50,-70" stroke="#fff" stroke-opacity=".65" stroke-width="1.6" fill="none"/>`);
 s+=mir(`<path d="M0,-86 L28,-86 C36,-85 40,-80 40,-72 L40,-44 L0,-44Z" fill="${cg}"/><path d="M6,-84 L20,-84 L14,-46 L6,-46Z" fill="#fff" opacity=".12"/>`);
 s+=mir(`<rect x="40" y="-84" width="5.5" height="52" rx="2.7" fill="${lit}" opacity=".5" filter="url(#bl2)"/><rect x="42" y="-84" width="2.8" height="52" rx="1.4" fill="${lit}"/>`);
 s+=`<rect x="-30" y="-36" width="60" height="2" rx="1" fill="${acc}" opacity=".9"/>`+glowLine(-36,-30,30,0,acc);
 s+=plate(-29);
 s+=tyrePair('pod','#aab4cb');
 return s;}
function truck(c,acc,brake){ // autonomous cargo truck: container with edge LEDs
 const lit=brake?'#ff6a7a':'#ff3a52', cont=lin([[0,'#f4f7fc'],[.5,'#cfd6e4'],[1,'#8a93a8']]), cb=carbon();
 let s=underglow(acc)+mir(`<rect x="36" y="-62" width="18" height="26" rx="7" fill="#101319"/><rect x="36" y="-92" width="18" height="26" rx="7" fill="#0e1015" opacity=".9"/>`);
 s+=`<rect x="-46" y="-34" width="92" height="12" rx="3" fill="${cb}"/>`;
 s+=`<rect x="-52" y="-176" width="104" height="146" rx="8" fill="${cont}"/><rect x="-52" y="-176" width="104" height="12" rx="6" fill="#fff"/><rect x="-52" y="-176" width="10" height="146" fill="#7b869e" opacity=".5"/><rect x="42" y="-176" width="10" height="146" fill="#7b869e" opacity=".5"/>`;
 s+=`<line x1="0" y1="-164" x2="0" y2="-36" stroke="#7b869e" stroke-width="1.6"/>`+[-130,-100,-70].map(y=>`<rect x="-44" y="${y}" width="88" height="1.2" fill="#8a93a8" opacity=".5"/>`).join('');
 s+=`<rect x="-52" y="-176" width="104" height="146" rx="8" fill="none" stroke="${acc}" stroke-width="1.8" opacity=".9"/>`;
 s+=`<rect x="-52" y="-176" width="104" height="146" rx="8" fill="none" stroke="${acc}" stroke-width="5" opacity=".35" filter="url(#bl2)"/>`;
 s+=`<rect x="-44" y="-110" width="88" height="10" fill="${c}"/><rect x="-44" y="-96" width="88" height="3" fill="#fff"/>`;
 s+=mir(`<path d="M44,-46 L50,-45 L50,-38 L40,-37Z" fill="${lit}"/><rect x="-46" y="-45" width="8" height="8" fill="${lit}" opacity="0"/>`)+glowLine(-41,-46,46,1.8,lit,'#ffe3e7')+plate(-29);
 s+=tyrePair('truck','#aab4cb');
 return s;}

function mud(seed,n,w,y0,y1){let s='',r=seed;const rnd=()=>{r=(r*9301+49297)%233280;return r/233280;};for(let i=0;i<n;i++){const x=(rnd()-.5)*w,y=y0+rnd()*(y1-y0),k=1+rnd()*2.2;s+=`<ellipse cx="${x}" cy="${y}" rx="${k*1.6}" ry="${k}" fill="#5a3f2a" opacity="${.18+rnd()*.25}"/>`;}return s;}
function sedan(c,acc,brake){
 const lit=brake?'#ff6a7a':'#ff2d46', body=paint(c), cg=glass(), cb=carbon();
 let s=underglow(acc);
 s+=`<path d="M-43,-25 L43,-25 L38,-6 Q0,-1 -38,-6Z" fill="${cb}"/>`+[-30,-22,22,30].map(x=>`<circle cx="${x}" cy="-13" r="3.7" fill="#0a0b0f" stroke="#b9c4da" stroke-width="1"/>`).join('')+[-12,-6,0,6,12].map(x=>`<line x1="${x}" y1="-22" x2="${x*.9}" y2="-8" stroke="#3c4455" stroke-width="1.2"/>`).join('');
 s+=mir(`<path d="M0,-58 L31,-58 C44,-57 50,-49 50,-37 L49,-21 Q25,-16 0,-16Z" fill="${body}"/>`);
 s+=mir(`<path d="M0,-24 L49,-26 L49,-21 Q25,-16 0,-16Z" fill="#000" opacity=".28"/><path d="M2,-57 L31,-57 C44,-56 49,-49 50,-42" stroke="#fff" stroke-opacity=".65" stroke-width="1.5" fill="none"/><path d="M8,-55 L28,-55" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`);
 s+=`<path d="M-39,-57 L-35,-63 L35,-63 L39,-57Z" fill="${cb}"/><path d="M-35,-63 L35,-63" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>`;
 s+=mir(`<path d="M0,-64 L35,-64 L30,-82 Q28,-88 21,-88 L0,-88Z" fill="${cg}"/><path d="M5,-85 Q17,-85 24,-82 L27,-68 L10,-68Z" fill="#fff" opacity=".12"/>`);
 s+=`<path d="M-30,-82 Q-28,-88 -21,-88 L21,-88 Q28,-88 30,-82" stroke="#e8f0ff" stroke-opacity=".55" stroke-width="1.2" fill="none"/>`;
 s+=mir(`<path d="M35,-64 L37,-66 L40,-64 L37,-60Z" fill="${shade(c,-.3)}"/>`);
 s+=`<path d="M-3,-89 L3,-89 L1,-93 Z" fill="${cb}"/>`;
 if(brake)s+=`<ellipse cx="0" cy="-47" rx="56" ry="13" fill="#ff3b4e" opacity=".3" filter="url(#bl2)"/>`;
 s+=mir(`<path d="M47,-53 L21,-53 L17,-49 L23,-46 L43,-46 L44,-36 L47,-36Z" fill="${lit}"/><path d="M44,-52 L24,-52" stroke="#fff" stroke-opacity=".75" stroke-width="1"/><rect x="25" y="-42" width="12" height="2.4" rx="1" fill="#fff" opacity=".35"/>`);
 s+=`<rect x="-18" y="-51" width="36" height="2.6" rx="1.3" fill="${lit}" opacity=".9"/>`+plate(-40);
 s+=tyrePair('sedan','#c6cfe2');
 return s;}
function rally(c,acc,brake){
 const lit=brake?'#ff6a7a':'#ff2d46', body=paint(c), cg=glass(), cb=carbon(), wh='#f2f5fa', st=paint('#ffcf33');
 let s=`<ellipse cx="0" cy="1" rx="62" ry="9" fill="#06080d" opacity=".5" filter="url(#bl)"/>`;
 s+=`<path d="M-40,-24 L40,-24 L36,-6 Q0,-1 -36,-6Z" fill="${cb}"/><circle cx="0" cy="-12" r="6" fill="#050608" stroke="#b9c4da" stroke-width="1.4"/><circle cx="0" cy="-12" r="3.4" fill="#000"/>`;
 s+=mir(`<rect x="26" y="-21" width="13" height="20" rx="2" fill="#0d0f14"/><rect x="29" y="-14" width="7" height="2.4" fill="#eef1f6"/><rect x="29" y="-9" width="7" height="1.6" fill="#ffd34a"/>`);
 s+=mir(`<path d="M0,-56 L33,-56 C44,-55 50,-48 50,-38 L50,-20 Q25,-15 0,-15Z" fill="${body}"/>`);
 s+=mir(`<path d="M28,-40 C41,-45 53,-40 54,-22 L47,-21 C46,-31 38,-34 28,-33Z" fill="${shade(c,-.28)}"/><circle cx="48" cy="-34" r="1.4" fill="#cfd6e6"/><circle cx="51" cy="-28" r="1.4" fill="#cfd6e6"/>`);
 s+=`<rect x="-50" y="-31" width="100" height="5" fill="${wh}"/><rect x="-50" y="-26" width="100" height="2.4" fill="${st}"/>`;
 s+=mir(`<path d="M0,-56 L34,-56 L30,-92 Q28,-97 22,-97 L0,-97Z" fill="${cg}"/><path d="M4,-93 Q16,-93 23,-91 L28,-60 L10,-60Z" fill="#fff" opacity=".1"/>`);
 s+=`<path d="M-30,-92 Q-28,-97 -22,-97 L22,-97 Q28,-97 30,-92 L31,-86 L-31,-86Z" fill="${body}" opacity="0"/>`;
 s+=`<path d="M-33,-56 L-30,-92 Q-28,-97 -22,-97 L22,-97 Q28,-97 30,-92 L33,-56" stroke="#e8f0ff" stroke-opacity=".45" stroke-width="1.2" fill="none"/><line x1="0" y1="-96" x2="0" y2="-60" stroke="#fff" stroke-opacity=".28"/>`;
 s+=`<path d="M-14,-100 L14,-100 L10,-96 L-10,-96Z" fill="${cb}"/><rect x="-8" y="-99" width="16" height="2" fill="#000" opacity=".6"/>`;
 // big rear wing
 s+=mir(`<rect x="30" y="-80" width="3" height="22" fill="${cb}"/>`)+`<rect x="-47" y="-88" width="94" height="6" rx="2" fill="${cb}"/><rect x="-47" y="-88" width="94" height="1.8" fill="#fff" opacity=".4"/><rect x="-44" y="-81" width="88" height="3" rx="1" fill="${st}"/>`+mir(`<path d="M47,-98 L51,-98 L51,-76 L47,-79Z" fill="${body}"/><rect x="47" y="-96" width="4" height="3" fill="${wh}"/>`);
 if(brake)s+=`<ellipse cx="0" cy="-46" rx="56" ry="13" fill="#ff3b4e" opacity=".3" filter="url(#bl2)"/>`;
 s+=mir(`<rect x="39" y="-54" width="9" height="22" rx="2.5" fill="${lit}"/><rect x="41" y="-52" width="2" height="18" fill="#fff" opacity=".6"/>`);
 s+=`<rect x="-5" y="-48" width="10" height="5" rx="1" fill="#ff2d46"/><rect x="-4" y="-40" width="8" height="3" rx="1" fill="#fff" opacity=".8"/>`;
 s+=mir(`<rect x="-44" y="-17" width="9" height="4" rx="2" fill="#ffd34a"/>`.replace('-44','-44'))+plate(-30).replace('#f1f4fa','#ffd34a');
 s+=tyrePair('rally','#ffd34a');
 s+=mud(7,26,92,-52,-8);
 return s;}
function f1(c,acc,brake){
 const lit=brake?'#ff6a7a':'#ff2d46', body=paint(c), cb=carbon(), tire='#0a0b0e';
 let s=`<ellipse cx="0" cy="1" rx="64" ry="9" fill="#06080d" opacity=".5" filter="url(#bl)"/>`;
 // wide slick rear tyres
 s+=mir(`<rect x="22" y="-38" width="28" height="38" rx="6" fill="${tire}"/><rect x="22" y="-38" width="28" height="38" rx="6" fill="none" stroke="#2b303b" stroke-width="1.2"/><rect x="22" y="-21" width="28" height="2.2" fill="#e5e9f2" opacity=".75"/><rect x="48" y="-33" width="2" height="28" fill="#ffd34a" opacity=".9"/><path d="M22,-34 L28,-30 L28,-8 L22,-4Z" fill="#171a21"/>`);
 // suspension arms, floor and diffuser
 s+=`<path d="M-24,-22 L-14,-26 M24,-22 L14,-26 M-24,-14 L-12,-18 M24,-14 L12,-18" stroke="#2a2f3a" stroke-width="2"/>`;
 s+=`<path d="M-22,-16 L22,-16 L18,-3 Q0,0 -18,-3Z" fill="${cb}"/>`+[-12,-6,0,6,12].map(x=>`<line x1="${x}" y1="-15" x2="${x*.8}" y2="-4" stroke="#4a5266" stroke-width="1"/>`).join('')+`<circle cx="0" cy="-22" r="3.4" fill="#05060a" stroke="#b9c4da" stroke-width=".9"/>`;
 s+=`<rect x="-26" y="-20" width="52" height="3" fill="${cb}"/><rect x="-24" y="-24" width="48" height="2" fill="#ffd34a" opacity=".9"/>`;
 // engine cover, shark fin, cockpit, helmet and halo
 s+=`<path d="M-15,-24 L15,-24 L11,-50 Q0,-57 -11,-50Z" fill="${body}"/><path d="M-1,-26 L1,-26 L1.4,-64 L-1.4,-62Z" fill="${shade(c,-.2)}"/>`;
 s+=`<path d="M-9,-52 Q0,-60 9,-52 L9,-46 L-9,-46Z" fill="#0a0c12"/><circle cx="0" cy="-53" r="6" fill="#ffd34a"/><path d="M-3,-54 Q0,-57 3,-54" stroke="#0a0c12" stroke-width="2.2" fill="none"/>`;
 s+=`<path d="M-12,-48 Q-11,-66 0,-69 Q11,-66 12,-48" stroke="#12151c" stroke-width="3" fill="none"/>`;
 // rear wing: main plane, flap, beam wing and endplates, rain light
 s+=`<rect x="-3" y="-66" width="6" height="30" fill="${cb}"/><rect x="-30" y="-48" width="60" height="4" rx="1" fill="${cb}"/><rect x="-30" y="-48" width="60" height="1.2" fill="#fff" opacity=".35"/>`;
 s+=`<path d="M-31,-78 L31,-78 L31,-70 L-31,-70Z" fill="${body}"/><path d="M-31,-69 L31,-69 L31,-62 L-31,-62Z" fill="${shade(c,-.25)}"/><rect x="-31" y="-78" width="62" height="1.6" fill="#fff" opacity=".6"/>`;
 s+=mir(`<path d="M31,-86 L35,-86 L35,-56 L31,-60Z" fill="${body}"/><rect x="31" y="-82" width="4" height="4" fill="#ffd34a"/>`);
 if(brake)s+=`<ellipse cx="0" cy="-58" rx="14" ry="8" fill="#ff3b4e" opacity=".5" filter="url(#bl2)"/>`;
 s+=`<rect x="-5" y="-62" width="10" height="9" rx="1.5" fill="${lit}"/><rect x="-3" y="-60" width="6" height="2" fill="#fff" opacity=".8"/>`;
 return s;}

  var types = { sedan: sedan, rally: rally, ev: ev, hyper: hyper, cross: cross, pickup: pickup, pod: pod, truck: truck, f1: f1 };
  var BOX = { truck: [-66, -190, 132, 204], f1: [-66, -114, 132, 128] };
  var DEFAULT_BOX = [-66, -112, 132, 126];
  function boxOf(type) { return BOX[type] || DEFAULT_BOX; }
  function svgOf(type, col, acc, brake) {
    defs = ''; gid = 0;
    var inner = types[type](col, acc || shade(col, .45), !!brake), b = boxOf(type);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + b.join(' ') + '" width="' + b[2] * 3 + '" height="' + b[3] * 3 + '"><defs>' + defs +
      '<filter id="bl" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
      '<filter id="bl2" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3.4"/></filter></defs>' + inner + '</svg>';
  }
  var cache = {};
  // Returns { canvas, box, ready }. ready turns true once the SVG has been rasterised.
  function sprite(type, col, acc, brake, px) {
    var key = type + '|' + col + '|' + (acc || '') + '|' + (brake ? 1 : 0) + '|' + (px || 320);
    if (cache[key]) return cache[key];
    var b = boxOf(type), width = px || 320, e = { canvas: root.document.createElement('canvas'), box: b, ready: false };
    e.canvas.width = width; e.canvas.height = Math.round(width * b[3] / b[2]);
    cache[key] = e;
    var img = new root.Image();
    img.onload = function () { try { e.canvas.getContext('2d').drawImage(img, 0, 0, e.canvas.width, e.canvas.height); e.ready = true; } catch (err) { e.ready = false; } };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOf(type, col, acc, brake));
    return e;
  }
  function thumb(type, col, acc) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOf(type, col, acc, false)); }
  root.RacerCars = { tyre: TYRE, sprite: sprite, thumb: thumb, svgOf: svgOf, types: Object.keys(types), box: boxOf };
})(window);
