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
  const farSide = (rec) => E.openCourt(s, { shotId: 'cruzada', intensity: 'firme', recovery: rec }).find((z) => z.x < -2 && z.z < 4).m;
  assert.ok(farSide('ficar') < 0, 'parado na direita, a bola na esquerda deveria ser inalcançável');
  assert.ok(farSide('centro') > 0, 'voltando ao centro, deveria chegar');
});
