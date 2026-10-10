// Simula partidas IA x IA e imprime estatísticas para ajustar os números.
// Uso: node tools/simulate.js [pontos] [seed]
const E = require('../src/engine.js');

function simulate(nPoints, seed) {
  const s = E.newMatch({ seed, control: { A: 'ai', B: 'ai' }, A: { name: 'A' } });
  const stats = { points: 0, shots: 0, maxRally: 0, endings: {}, shots_by: {}, quality: {}, rallies: [] };
  for (let i = 0; i < nPoints; i++) {
    if (s.score.winner) { s.score = { points: { A: 0, B: 0 }, games: { A: 0, B: 0 }, server: 'B', winner: null }; }
    E.startPoint(s);
    let guard = 0, ev;
    do {
      ev = E.play(s, E.aiChoose(s));
      stats.shots_by[ev.shot.id] = (stats.shots_by[ev.shot.id] || 0) + 1;
      stats.quality[ev.quality] = (stats.quality[ev.quality] || 0) + 1;
      if (++guard > 400) throw new Error('ponto infinito');
    } while (!ev.pointOver);
    const kind = ev.text.split(/[.!]/)[0].replace(/Você|A |B /g, '').trim().split(' ')[0];
    stats.endings[kind] = (stats.endings[kind] || 0) + 1;
    stats.points++;
    stats.shots += s.point.rally;
    stats.rallies.push(s.point.rally);
    stats.maxRally = Math.max(stats.maxRally, s.point.rally);
  }
  return stats;
}

if (require.main === module) {
  const n = Number(process.argv[2] || 5000), seed = Number(process.argv[3] || 7);
  const st = simulate(n, seed);
  const pct = (v, t) => (100 * v / t).toFixed(1) + '%';
  console.log('pontos', st.points, '| golpes por ponto', (st.shots / st.points).toFixed(2), '| maior rally', st.maxRally);
  const r = st.rallies.sort((a, b) => a - b);
  console.log('mediana rally', r[Math.floor(r.length / 2)], '| p90', r[Math.floor(r.length * 0.9)]);
  console.log('como os pontos acabam:');
  for (const [k, v] of Object.entries(st.endings).sort((a, b) => b[1] - a[1])) console.log('  ', k.padEnd(14), pct(v, st.points));
  console.log('golpes escolhidos:');
  const tot = Object.values(st.shots_by).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(st.shots_by).sort((a, b) => b[1] - a[1])) console.log('  ', k.padEnd(14), pct(v, tot));
  console.log('qualidade:', Object.entries(st.quality).map(([k, v]) => k + ' ' + pct(v, tot)).join(' | '));
}

module.exports = { simulate };
