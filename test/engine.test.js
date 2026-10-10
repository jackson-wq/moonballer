const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');
const { simulate } = require('../tools/simulate.js');

test('todo ponto termina e o placar anda', () => {
  const s = E.newMatch({ seed: 42, control: { A: 'ai', B: 'ai' } });
  for (let i = 0; i < 300 && !s.score.winner; i++) {
    E.startPoint(s);
    let ev, n = 0;
    do { ev = E.play(s, E.aiChoose(s)); assert.ok(++n < 400, 'ponto infinito'); } while (!ev.pointOver);
  }
  assert.ok(s.score.winner, 'o set deveria terminar em 300 pontos');
});

test('as chances mostradas são números válidos', () => {
  const s = E.newMatch({ seed: 3 });
  E.startPoint(s);
  for (const o of E.options(s)) {
    for (const k of ['pExec', 'conv', 'pErr', 'pMed']) assert.ok(o[k] >= 0 && o[k] <= 1, o.shot.id + ' ' + k + '=' + o[k]);
  }
});

test('o equilíbrio do jogo fica numa faixa razoável', () => {
  const st = simulate(3000, 11);
  const avg = st.shots / st.points;
  assert.ok(avg > 2.5 && avg < 9, 'golpes por ponto fora da faixa: ' + avg);
});

test('ficar parado na lateral deixa o outro lado aberto', () => {
  const s = E.newMatch({ seed: 5 });
  E.startPoint(s);
  s.point.serve = null;
  s.point.striker = 'A';
  s.players.A.pos = { x: 3.8, z: 0.5 };
  s.point.contact = s.players.A.pos;
  s.players.B.pos = { x: 0, z: 24.5 };
  const farSide = (rec) => E.openCourt(s, { shotId: 'forehand_cruz', intensity: 'firme', recovery: rec }).find((z) => z.x < -2 && z.z < 4).m;
  assert.ok(farSide('ficar') < 0, 'parado na direita, a bola na esquerda deveria ser inalcançável');
  assert.ok(farSide('centro') > 0, 'voltando ao centro, deveria chegar');
});

test('todos os golpes e direções ficam sempre disponíveis', () => {
  const s = E.newMatch({ seed: 8 });
  E.startPoint(s);
  assert.strictEqual(E.availableShots(s).length, 6, 'saque: 2 tipos x 3 direções');
  s.point.serve = null;
  s.players[s.point.striker].broken = true;
  assert.strictEqual(E.availableShots(s).length, 21, 'rally: 7 golpes x 3 direções, mesmo quebrado');
});

test('escolha sem sentido fica difícil e diz por quê', () => {
  const s = E.newMatch({ seed: 4 });
  E.startPoint(s);
  s.point.serve = null;
  s.point.striker = 'A';
  s.players.A.pos = { x: 2.5, z: -0.5 };
  s.point.contact = s.players.A.pos;
  const smash = E.evaluate(s, E.SHOTS.find((o) => o.id === 'smash_meio'), 'firme', true);
  const fh = E.evaluate(s, E.SHOTS.find((o) => o.id === 'forehand_cruz'), 'firme', true);
  assert.ok(smash.pExec < fh.pExec - 0.3, 'smash em bola baixa do fundo deveria ser bem pior');
  assert.ok(smash.mods.some((m) => /smash/.test(m.text)), 'o motivo deveria aparecer');
});

test('ponto perdido vem com explicação', () => {
  const s = E.newMatch({ seed: 21 });
  let found = 0;
  for (let i = 0; i < 200 && found < 5; i++) {
    E.startPoint(s);
    const decisions = [];
    let ev;
    do {
      const ch = E.aiChoose(s);
      if (s.point.striker === 'A') decisions.push(E.review(s, ch));
      ev = E.play(s, ch);
    } while (!ev.pointOver);
    if (s.score.winner) s.score = { points: { A: 0, B: 0 }, games: { A: 0, B: 0 }, server: 'B', winner: null };
    if (ev.winner === 'B' && ev.ending !== 'ace') {
      const x = E.explain(s, ev, decisions, 'A');
      assert.ok(x.lost && x.cause.length > 0, 'sem causa para ' + ev.ending);
      found++;
    }
  }
  assert.ok(found >= 5);
});
