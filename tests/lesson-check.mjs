import '../js/rng.js';
import '../js/rules.js';
import '../js/content.js';
const Rules = globalThis.HFRules, Content = globalThis.HFContent;

function start(lesson) {
  const cfg = Object.assign({}, lesson.cfg);
  const st = Rules.createGame(cfg);
  if (lesson.fixture) { lesson.fixture(st); st.events = []; }
  return st;
}
function noDupes(st, label) {
  const seen = {};
  st.hands.forEach(h => h.forEach(c => { if (seen[c]) throw new Error(label+': dup card '+c); seen[c]=1; }));
  st.trick.forEach(e => { if (seen[e.card]) throw new Error(label+': trick dup '+e.card); seen[e.card]=1; });
}
const L = Content.tutorialLessons();

// t1: forced follow
let g = start(L[0]); noDupes(g,'t1');
let legal = Rules.legalPlays(g, 0);
if (legal.length !== 1 || legal[0] !== 26+5) throw new Error('t1 legal: '+JSON.stringify(legal));
let r = Rules.applyCommand(g, {type:'play', p:0, card:legal[0]});
if (!r.ok) throw new Error('t1 play rejected');
if (!r.events.some(e=>e.type==='trick' && e.winner===1)) throw new Error('t1: p1 should win trick');
console.log('t1 ok');

// t2: pass phase
g = start(L[1]);
if (g.phase !== 'pass') throw new Error('t2 not pass phase');
r = Rules.applyCommand(g, {type:'pass', p:0, cards:g.hands[0].slice(0,3)});
if (!r.ok) throw new Error('t2 pass rejected: '+r.reason);
console.log('t2 ok');

// t3: duck — player void in diamonds, both cards legal, 2♠ loses trick
g = start(L[2]); noDupes(g,'t3');
legal = Rules.legalPlays(g, 0);
if (legal.length !== 2) throw new Error('t3 legal: '+JSON.stringify(legal));
r = Rules.applyCommand(g, {type:'play', p:0, card:0}); // 2♠
if (!r.ok) throw new Error('t3 play rejected: '+r.reason);
const t3trick = r.events.find(e=>e.type==='trick');
if (!t3trick || t3trick.winner !== 1) throw new Error('t3 winner: '+JSON.stringify(t3trick));
console.log('t3 ok');

// t4: dump the queen
g = start(L[3]); noDupes(g,'t4');
r = Rules.applyCommand(g, {type:'play', p:0, card:Rules.QUEEN_SPADES});
if (!r.ok) throw new Error('t4 queen rejected: '+r.reason);
if (!r.events.some(e=>e.type==='queen' && e.p===0)) throw new Error('t4 no queen event');
console.log('t4 ok');

// t5: eclipse
g = start(L[4]); noDupes(g,'t5');
legal = Rules.legalPlays(g, 0);
if (legal.length !== 1 || legal[0] !== 26+12) throw new Error('t5 legal: '+JSON.stringify(legal));
r = Rules.applyCommand(g, {type:'play', p:0, card:legal[0]});
if (!r.ok) throw new Error('t5 play rejected');
if (!r.events.some(e=>e.type==='eclipse' && e.p===0)) throw new Error('t5 no eclipse: '+JSON.stringify(r.events));
if (!r.events.some(e=>e.type==='round-end')) throw new Error('t5 no round-end');
console.log('t5 ok');

// t6: legal play then serialize/deserialize (undo)
g = start(L[5]); noDupes(g,'t6');
legal = Rules.legalPlays(g, 0);
const snap = Rules.serialize(g);
r = Rules.applyCommand(g, {type:'play', p:0, card:legal[0]});
if (!r.ok) throw new Error('t6 play rejected');
const back = Rules.deserialize(snap);
if (Rules.hashState(back) !== Rules.hashState(g)) throw new Error('t6 undo restore mismatch');
console.log('t6 ok');

// round summaries carry per-round hearts
const cfg = { id:'x', seed:42, players:4, threshold:25, maxRounds:0, passCycle:['none'], passCount:3, eclipseRule:'others', noPenaltyFirstTrick:true, ai:{level:'easy'}, goal:{type:'win',value:0} };
g = Rules.createGame(cfg);
while (!g.terminal) { const c = Rules.aiChoose(g, g.actor); g = Rules.applyCommand(g, c).state; }
if (!g.roundSummaries.length || typeof g.roundSummaries[0].hearts[0] !== 'number') throw new Error('no hearts in summaries');
const sum = g.roundSummaries.reduce((a,r)=>a+r.hearts.reduce((x,y)=>x+y,0),0);
if (sum !== 13*g.roundSummaries.length) throw new Error('heart counts wrong: '+sum);
console.log('round summary hearts ok');

// daily configs: 7 consecutive days, varied and terminating
for (let i=0;i<7;i++) {
  const d = Content.utcDateString(Date.now()-i*86400000);
  const dc = Content.dailyConfig(d);
  let dg = Rules.createGame(JSON.parse(JSON.stringify(dc)));
  let steps=0;
  while (!dg.terminal && steps<8000) { const c=Rules.aiChoose(dg,dg.actor); dg=Rules.applyCommand(dg,c).state; steps++; }
  if (!dg.terminal) throw new Error('daily '+d+' never ends');
}
console.log('daily configs ok');
console.log('LESSON CHECKS PASS');
