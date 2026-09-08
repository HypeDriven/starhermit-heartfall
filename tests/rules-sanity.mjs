import '../js/rng.js';
import '../js/rules.js';
import '../js/content.js';
const Rules = globalThis.HFRules, Content = globalThis.HFContent;
if (!Rules) throw new Error('HFRules not exposed');
for (const players of [2,3,4]) {
  for (let seed = 1; seed <= 5; seed++) {
    const cfg = { id:'t', seed, players, threshold:50, maxRounds:0, passCycle:['left','right','across','none'], passCount:3, eclipseRule:'others', noPenaltyFirstTrick:true, ai:{level:'normal'}, goal:{type:'win',value:0} };
    let g = Rules.createGame(cfg);
    let steps = 0;
    while (!g.terminal && steps < 5000) {
      const cmd = Rules.aiChoose(g, g.actor);
      if (!cmd) throw new Error('no AI cmd, phase='+g.phase+' actor='+g.actor);
      const r = Rules.applyCommand(g, cmd);
      if (!r.ok) throw new Error('AI illegal: '+r.reason+' '+JSON.stringify(cmd));
      g = r.state; steps++;
    }
    if (!g.terminal) throw new Error('match never ended p='+players+' seed='+seed);
    let g2 = Rules.createGame(cfg);
    if (Rules.hashState(g2) !== Rules.hashState(Rules.deserialize(Rules.serialize(g2)))) throw new Error('ser/deser mismatch');
  }
  console.log('players='+players+' ok');
}
// journey + challenge configs all terminate under AI self-play
for (const lv of Content.JOURNEY.concat(Content.CHALLENGES)) {
  let g = Rules.createGame(JSON.parse(JSON.stringify(lv)));
  let steps = 0;
  while (!g.terminal && steps < 8000) {
    const cmd = Rules.aiChoose(g, g.actor);
    if (!cmd) throw new Error(lv.id+': no AI cmd');
    const r = Rules.applyCommand(g, cmd);
    if (!r.ok) throw new Error(lv.id+': AI illegal '+r.reason);
    g = r.state; steps++;
  }
  if (!g.terminal) throw new Error(lv.id+': never terminates');
}
console.log('journey+challenge termination ok');
console.log('rules sanity PASS');
