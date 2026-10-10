// Motor do ponto: regras, probabilidades e IA. Não desenha nada.
// Funciona no navegador (window.MoonEngine) e no Node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoonEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Quadra em metros. Mundo = visão do jogador A (você): sua linha de base em z=0,
  // a do adversário em z=L. x positivo = sua direita.
  const L = 23.77;
  const NET = L / 2;
  const SW = 4.115; // meia largura da quadra de simples

  const T = {
    react: 0.28, // tempo de reação normal (s)
    reactServe: 0.18,
    reversal: 0.22, // pegar o adversário no contrapé
    leanRight: -0.08, // adivinhou o lado
    leanWrong: 0.22, // adivinhou errado
    speed: 5.6, // m/s em velocidade máxima
    netZ: 8, // a partir daqui (local) o jogador está na rede
    rallyFrom: 4, // depois de N golpes o erro começa a subir
  };

  const INTENSITY = {
    controle: { label: 'Controle', exec: 8, pace: 0.9, dmg: 0.8, perf: -0.1, stam: 0 },
    firme: { label: 'Firme', exec: 0, pace: 1, dmg: 1, perf: 0, stam: 0.4 },
    tudo: { label: 'Tudo', exec: -10, pace: 1.12, dmg: 1.25, perf: 0.15, stam: 1.2 },
  };

  const RECOVERY = {
    centro: 'Voltar ao centro',
    ficar: 'Ficar onde está',
    rede: 'Subir à rede',
  };

  // Golpes: todo golpe sai em três direções e todas as combinações ficam sempre
  // disponíveis. Escolha que não faz sentido na situação continua possível, só fica
  // bem mais difícil (ver execProbs, que guarda o motivo de cada desconto).
  // lr=true: direções são esquerda/meio/direita (absolutas). Senão cruzada/meio/paralela.
  const STROKES = [
    { id: 'forehand', name: 'Forehand', kind: 'drive', wing: 'fh', exec: 86, risk: 0.35, dmg: 12, pace: 18.5, z: 21.2, xw: 2.9,
      desc: 'Golpe de fundo do lado direito. Seu golpe mais confiável quando a bola vem desse lado.' },
    { id: 'backhand', name: 'Backhand', kind: 'drive', wing: 'bh', exec: 86, risk: 0.35, dmg: 12, pace: 18.5, z: 21.2, xw: 2.9,
      desc: 'Golpe de fundo do lado esquerdo. Do lado do forehand fica torto e perde força.' },
    { id: 'slice', name: 'Slice', kind: 'slice', exec: 92, risk: 0.2, dmg: 4, pace: 13, z: 20.4, xw: 2.6,
      desc: 'Bola cortada, baixa e lenta. Segura e boa para ganhar tempo, mas não machuca.' },
    { id: 'deixada', name: 'Deixadinha', kind: 'drop', lr: true, exec: 56, risk: 0.5, dmg: 18, pace: 11, z: 13.4, xw: 1.6,
      desc: 'Bola curta logo depois da rede. Funciona de perto e com ele no fundo; de longe é um presente.' },
    { id: 'voleio', name: 'Voleio', kind: 'volley', lr: true, exec: 80, risk: 0.4, dmg: 26, pace: 18, z: 19.6, xw: 3.4,
      desc: 'Bater antes de quicar. Na rede é o golpe mais forte; do fundo vira meia-volei.' },
    { id: 'smash', name: 'Smash', kind: 'smash', lr: true, exec: 78, risk: 0.4, dmg: 42, pace: 29, z: 19.4, xw: 2.6,
      desc: 'Pancada por cima da cabeça. Só funciona em bola alta.' },
    { id: 'balao', name: 'Balão', kind: 'lob', exec: 82, risk: 0.4, dmg: 8, pace: 12, z: 21, xw: 1.6,
      desc: 'Bola alta e funda. Defende com tempo e castiga quem está colado na rede.' },
  ];
  const SERVE_KINDS = [
    { id: 'chapado', name: 'Saque chapado', kind: 'serve', exec: 62, risk: 0.85, dmg: 20, pace: 39, z: 17.8,
      desc: 'Saque reto e forte. Faz aces, mas erra muito.' },
    { id: 'spin', name: 'Saque com spin', kind: 'serve', exec: 88, risk: 0.6, dmg: 8, pace: 28, z: 16.8,
      desc: 'Saque com efeito, mais lento e seguro. Bom como segundo saque.' },
  ];
  const DIRS = {
    cruz: { label: 'Cruzado', exec: 0, risk: 0, dmg: 1 },
    meio: { label: 'Meio', exec: 5, risk: -0.15, dmg: 0.6 },
    par: { label: 'Paralelo', exec: -12, risk: 0.25, dmg: 1.6 },
  };
  const LR = { esq: 'Esquerda', meio: 'Meio', dir: 'Direita' };
  const SERVE_DIRS = {
    aberto: { label: 'Aberto', x: 3.6, exec: -2, risk: 0, dmg: 1.1 },
    corpo: { label: 'Corpo', x: 1.9, exec: 4, risk: -0.05, dmg: 0.85 },
    t: { label: 'No T', x: 0.35, exec: 0, risk: 0, dmg: 1 },
  };
  const DIR_NAME = { cruz: 'cruzado', meio: 'no meio', par: 'paralelo', esq: 'na esquerda', dir: 'na direita', aberto: 'aberto', corpo: 'no corpo', t: 'no T' };

  const SHOTS = [], SERVES = [];
  for (const st of STROKES) {
    for (const d of st.lr ? ['esq', 'meio', 'dir'] : ['cruz', 'meio', 'par']) {
      SHOTS.push(Object.assign({}, st, { id: st.id + '_' + d, stroke: st.id, strokeName: st.name, dir: d, name: st.name + ' ' + DIR_NAME[d] }));
    }
  }
  for (const st of SERVE_KINDS) {
    for (const d of ['aberto', 'corpo', 't']) {
      SERVES.push(Object.assign({}, st, { id: 'saque_' + st.id + '_' + d, stroke: st.id, strokeName: st.name, dir: d, name: st.name + ' ' + DIR_NAME[d] }));
    }
  }
  const ALL_SHOTS = SHOTS.concat(SERVES);
  const DEFENSIVE = (o, geo) => o.kind === 'slice' || o.kind === 'lob' || geo === 'meio';

  // Números concretos de uma opção na situação atual (alvo no referencial de quem bate).
  function spec(o, c) {
    if (o.kind === 'serve') {
      const d = SERVE_DIRS[o.dir];
      return { o, geo: o.dir, exec: o.exec + d.exec, risk: o.risk + d.risk, dmg: o.dmg * d.dmg, pace: o.pace,
        aimL: { x: -c.serve.side * d.x, z: o.z + (o.dir === 'aberto' ? 0 : 0.1) } };
    }
    let x, geo;
    if (o.lr) {
      x = o.dir === 'esq' ? -o.xw : o.dir === 'dir' ? o.xw : 0;
      geo = x === 0 ? 'meio' : Math.sign(x) === c.s ? 'par' : 'cruz';
    } else {
      geo = o.dir;
      x = geo === 'meio' ? 0 : geo === 'cruz' ? -c.s * o.xw : c.s * o.xw * 1.07;
    }
    const d = DIRS[geo];
    let z = o.z + (geo === 'meio' ? 0.4 : 0);
    if (o.kind === 'volley' && geo === 'cruz') z -= 1.4; // voleio cruzado sai mais curto e angulado
    return { o, geo, exec: o.exec + d.exec, risk: clamp(o.risk + d.risk, 0.05, 0.95), dmg: o.dmg * d.dmg, pace: o.pace, aimL: { x, z } };
  }

  // ---------- utilidades ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sig(x) { return 1 / (1 + Math.exp(-x)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function norm(v) { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; }
  function sub(a, b) { return { x: a.x - b.x, z: a.z - b.z }; }
  function add(a, b, k) { return { x: a.x + b.x * k, z: a.z + b.z * k }; }
  function dot(a, b) { return a.x * b.x + a.z * b.z; }
  function local(pid, p) { return pid === 'A' ? { x: p.x, z: p.z } : { x: -p.x, z: L - p.z }; }
  const world = local; // a transformação é a própria inversa
  function other(pid) { return pid === 'A' ? 'B' : 'A'; }

  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePlayer(id, cfg) {
    return {
      id,
      name: cfg.name,
      hand: cfg.hand || 'R',
      attrs: Object.assign({ fh: 75, bh: 70, volley: 65, serve: 72, speed: 75, reading: 70 }, cfg.attrs),
      aggression: cfg.aggression == null ? 0.3 : cfg.aggression,
      pos: { x: 0, z: 0 },
      vel: { x: 0, z: 0 },
      bal: 100,
      stam: 100,
      broken: false,
      mIn: 1, // folga com que chegou na bola atual (s)
      nml: false, // estava parado no meio da quadra
      lean: null, // lado que a IA está esperando ('L' | 'R')
    };
  }

  function speedOf(p) {
    return T.speed * (0.85 + 0.15 * p.attrs.speed / 80) * (0.75 + 0.25 * p.stam / 100);
  }

  // ---------- partida ----------
  function newMatch(cfg) {
    cfg = cfg || {};
    const s = {
      rng: makeRng(cfg.seed || Date.now()),
      players: {
        A: makePlayer('A', cfg.A || { name: 'Você' }),
        B: makePlayer('B', cfg.B || { name: 'R. Duarte', attrs: { fh: 80, bh: 62, volley: 58, reading: 72 } }),
      },
      control: cfg.control || { A: 'human', B: 'ai' },
      score: { points: { A: 0, B: 0 }, games: { A: 0, B: 0 }, server: cfg.firstServer || 'B', winner: null },
      history: { A: [], B: [] }, // lados ('L'/'R') dos últimos golpes de cada um
      point: null,
      log: [],
    };
    return s;
  }

  function serveSide(s) {
    const n = s.score.points.A + s.score.points.B;
    return n % 2 === 0 ? 1 : -1; // +1 deuce (direita de quem saca), -1 vantagem
  }

  function startPoint(s) {
    const srv = s.score.server, rcv = other(srv);
    const side = serveSide(s);
    for (const pid of ['A', 'B']) {
      const p = s.players[pid];
      p.bal = 100; p.broken = false; p.mIn = 1; p.nml = false; p.lean = null; p.vel = { x: 0, z: 0 };
      p.stam = clamp(p.stam + 3, 0, 100);
    }
    s.players[srv].pos = world(srv, { x: side * 0.8, z: -0.4 });
    s.players[rcv].pos = world(rcv, { x: side * 1.9, z: -1.2 });
    s.point = { striker: srv, serve: { side, second: false }, rally: 0, contact: s.players[srv].pos, high: false, over: false, events: [] };
    return s.point;
  }

  // Contexto de quem vai bater (tudo no referencial local dele).
  function context(s) {
    const pt = s.point, S = s.players[pt.striker], R = s.players[other(pt.striker)];
    const contact = local(S.id, pt.contact);
    const recv = local(S.id, R.pos);
    const recvVel = S.id === 'A' ? R.vel : { x: -R.vel.x, z: -R.vel.z };
    const sgn = contact.x >= 0.3 ? 1 : contact.x <= -0.3 ? -1 : (S.hand === 'R' ? 1 : -1);
    return {
      s: sgn,
      contact,
      recv,
      recvVel,
      atNet: contact.z >= T.netZ,
      recvAtNet: recv.z <= L - T.netZ,
      high: !!pt.high,
      broken: S.broken,
      serve: pt.serve,
    };
  }

  // Todas as opções, sempre. No saque, só os saques.
  function availableShots(s) {
    return s.point.serve ? SERVES.slice() : SHOTS.slice();
  }

  function fhSide(S) { return S.hand === 'R' ? 1 : -1; }

  function wingAttr(S, c, o) {
    if (o.kind === 'serve') return S.attrs.serve;
    if (o.kind === 'volley' || o.kind === 'smash') return S.attrs.volley;
    if (o.wing === 'fh') return S.attrs.fh;
    if (o.wing === 'bh') return S.attrs.bh;
    return c.s === fhSide(S) ? S.attrs.fh : S.attrs.bh;
  }

  // Chance de execução (0..1), divisão das saídas e os motivos de cada ajuste.
  function execProbs(s, o, intensity) {
    const pt = s.point, S = s.players[pt.striker];
    const c = context(s), it = INTENSITY[intensity], sp = spec(o, c);
    const mods = [];
    const mod = (d, text) => { if (Math.abs(d) >= 0.5) mods.push({ d, text }); };
    const kindTxt = { drive: o.strokeName.toLowerCase(), slice: 'slice', drop: 'deixadinha', volley: 'voleio', smash: 'smash', lob: 'balão', serve: 'saque' }[o.kind];
    const wa = (wingAttr(S, c, o) - 70) * 0.5;
    mod(wa, wa > 0 ? 'é um golpe forte seu' : 'é um golpe fraco seu');
    mod(it.exec, 'intensidade ' + it.label);
    mod(-(100 - S.bal) * 0.22, S.broken ? 'equilíbrio zerado' : 'equilíbrio baixo');
    mod(-Math.max(0, 60 - S.stam) * 0.3, 'pouco fôlego');
    if (!c.serve) {
      const lowBall = !c.high;
      if (S.mIn < 0) mod(-(6 + 18 * Math.min(1, -S.mIn / 0.35)), 'você chegou esticado');
      else if (S.mIn < 0.3) mod(-6, 'você chegou correndo');
      else if (S.mIn > 0.6 && sp.risk >= 0.5) mod(5, 'teve tempo para armar');
      if (S.nml) mod(-10, 'estava parado no meio da quadra');
      mod(-Math.max(0, pt.rally - T.rallyFrom) * 1.0, 'rally longo');
      if (c.contact.z > 2.5 && !c.atNet && sp.risk >= 0.5) mod(7, 'bola curta para atacar');
      if (c.contact.z < -1.5 && sp.risk >= 0.5) mod(-8, 'bola funda para golpe arriscado');
      if (c.broken) mod(DEFENSIVE(o, sp.geo) ? -10 : -28, DEFENSIVE(o, sp.geo) ? 'equilíbrio quebrado' : 'equilíbrio quebrado: era hora de defender');
      if (c.high && o.kind !== 'smash' && o.kind !== 'lob') mod(-4, 'bola alta');
      // Escolhas que não combinam com a situação.
      if (o.kind === 'volley' && !c.atNet) mod(c.contact.z > 3 ? -14 : -30, 'voleio longe da rede vira meia-volei');
      if (o.kind === 'smash' && lowBall) mod(pt.sitter ? -16 : -40, pt.sitter ? 'smash em bola que não está alta' : 'smash em bola baixa');
      else if (o.kind === 'smash' && c.contact.z < 3) mod(-12, 'smash do fundo da quadra');
      if ((o.kind === 'drive' || o.kind === 'slice' || o.kind === 'lob') && c.atNet) mod(-10, kindTxt + ' estando na rede');
      if (o.kind === 'drop' && c.contact.z < 0) mod(-22, 'deixadinha do fundo da quadra');
      else if (o.kind === 'drop' && c.contact.z < 1.5) mod(-12, 'deixadinha de longe');
      if (o.kind === 'drop' && c.recvAtNet) mod(-15, 'deixadinha com ele na rede');
      if (o.wing && Math.abs(c.contact.x) >= 0.3) {
        const fhs = c.s === fhSide(S);
        if (o.wing === 'fh' && !fhs) mod(-8, 'forehand com a bola do lado do backhand');
        if (o.wing === 'bh' && fhs) mod(-14, 'backhand com a bola do lado do forehand');
      }
    }
    const e = sp.exec + mods.reduce((t, m) => t + m.d, 0);
    const pExec = clamp(e, 5, 97) / 100;
    const pPerf = pExec * clamp(0.25 + it.perf, 0.05, 0.6);
    const fail = 1 - pExec;
    const errShare = clamp(0.35 + sp.risk * 0.6, 0.2, 0.95);
    mods.sort((a, b) => a.d - b.d);
    return { pExec, pPerf, pBom: pExec - pPerf, pErr: fail * errShare, pMed: fail * (1 - errShare), mods, base: sp.exec };
  }

  // Alvo real (mundo) para cada saída.
  function landing(s, o, quality, aimL) {
    const pt = s.point, S = s.players[pt.striker];
    let b;
    if (quality === 'perfeito') b = { x: aimL.x, z: aimL.z };
    else if (quality === 'bom') b = { x: aimL.x * 0.85, z: aimL.z - 0.5 };
    else b = { x: aimL.x * 0.3, z: o.kind === 'serve' ? 15.5 : 15.6 }; // mediano: curta, no meio
    if (quality === 'bom' && s.rng) {
      b.x += (s.rng() - 0.5) * 0.6;
      b.z += (s.rng() - 0.5) * 0.8;
    }
    b.x = clamp(b.x, -SW + 0.15, SW - 0.15);
    b.z = clamp(b.z, NET + 0.6, L - 0.2);
    return world(S.id, b);
  }

  // Onde quem recebe encontra a bola, e quanto tempo ela leva.
  function flight(originW, bounceW, o, paceMul, R) {
    // Deixadinha de longe precisa ir mais forte: quica mais para frente e para menos no ar.
    const far = o.kind === 'drop' ? clamp(dist(originW, bounceW) - 10, 0, 6) : 0;
    const dir = norm(sub(bounceW, originW));
    const rl = local(R.id, R.pos);
    let contact, high = o.kind === 'lob';
    const volley = rl.z >= T.netZ && o.kind !== 'lob' && o.kind !== 'drop' && o.kind !== 'serve';
    if (volley) {
      const seg = sub(bounceW, originW), len = Math.hypot(seg.x, seg.z);
      const t = clamp(dot(sub(R.pos, originW), seg) / (len * len), 0.45, 1);
      contact = add(originW, seg, t);
    } else {
      const [kmin, kmax] = o.kind === 'drop' ? [0.3, 1.6 + far * 0.7] : o.kind === 'lob' ? [1, 6] : o.kind === 'slice' ? [0.8, 5] : [0.8, 7];
      const k = clamp(dot(sub(R.pos, bounceW), dir), kmin, kmax);
      contact = add(bounceW, dir, k);
    }
    const pace = o.pace * paceMul;
    const time = dist(originW, contact) / pace + (o.kind === 'lob' ? 0.6 : o.kind === 'drop' ? 0.75 - far * 0.15 : 0.12);
    return { contact, time, high, volley, dir };
  }

  function needTime(R, contactW, isServe) {
    let t = (isServe ? T.reactServe : T.react) + dist(R.pos, contactW) / speedOf(R);
    const to = norm(sub(contactW, R.pos));
    if (Math.hypot(R.vel.x, R.vel.z) > 0.2 && dot(norm(R.vel), to) < -0.3) t += T.reversal;
    if (R.lean) {
      const side = contactW.x >= 0 ? 'R' : 'L';
      t += side === R.lean ? T.leanRight : T.leanWrong;
    }
    return t;
  }

  function reachProbs(m, o, R, quality) {
    const pReach = sig((m + 0.25) / 0.08);
    let pFE = 0.02 + 0.35 * sig(-(m + 0.05) / 0.1) + (R.bal < 30 ? 0.08 : 0) + (o.dmg / 100) * 0.12;
    if (quality === 'mediano') pFE *= 0.3;
    pFE = clamp(pFE, 0.01, 0.9);
    return { pReach, pFE, conv: 1 - pReach + pReach * pFE };
  }

  // Avalia uma opção: chance de acerto e chance de ganhar o ponto se entrar.
  // estimate=true usa o que quem bate consegue ver (sem saber para onde ele está "adivinhando").
  function evaluate(s, o, intensity, estimate) {
    const pt = s.point, S = s.players[pt.striker], R = s.players[other(pt.striker)];
    const c = context(s), it = INTENSITY[intensity];
    const sp = spec(o, c), aimL = sp.aimL;
    o = Object.assign({}, o, { dmg: sp.dmg, risk: sp.risk });
    const pr = execProbs(s, o, intensity);
    const lean = R.lean;
    if (estimate) R.lean = null;
    const convOf = (q) => {
      const b = landing(Object.assign({}, s, { rng: null }), o, q, aimL);
      const f = flight(pt.contact, b, o, it.pace * (q === 'perfeito' ? 1.08 : q === 'mediano' ? 0.7 : 1), R);
      const m = f.time - needTime(R, f.contact, o.kind === 'serve');
      if (q === 'bom') mExp = m;
      return reachProbs(m, o, R, q).conv;
    };
    let mExp = 0;
    const cPerf = convOf('perfeito'), cBom = convOf('bom');
    R.lean = lean;
    const conv = pr.pExec > 0 ? (pr.pPerf * cPerf + pr.pBom * cBom) / pr.pExec : 0;
    return Object.assign({ shot: ALL_SHOTS.find((x) => x.id === o.id), intensity, aimL, aimW: world(S.id, aimL), conv, mExp, dmg: sp.dmg, geo: sp.geo }, pr);
  }

  function options(s) {
    return availableShots(s).map((o) => evaluate(s, o, 'firme', true));
  }

  function recoveryPoint(S, kind, aimL, contactL) {
    if (kind === 'ficar') return world(S.id, contactL);
    if (kind === 'rede') return world(S.id, { x: clamp(aimL.x * 0.35, -2.5, 2.5), z: 8.6 });
    return world(S.id, { x: clamp(aimL.x * 0.22, -1.2, 1.2), z: -0.8 });
  }

  function moveToward(p, target, duration) {
    const d = dist(p.pos, target);
    const can = Math.max(0, duration - 0.25) * speedOf(p);
    const k = d > 0 ? Math.min(1, can / d) : 0;
    const to = add(p.pos, sub(target, p.pos), k);
    const moved = d * k;
    p.vel = moved > 0.05 ? norm(sub(target, p.pos)) : { x: 0, z: 0 };
    p.pos = to;
    p.stam = clamp(p.stam - moved * 0.15, 0, 100);
    return { to, moved };
  }

  // A IA (ou leitura do adversário) decide para que lado vai se adiantar.
  function decideLean(s, R, strikerId) {
    const h = s.history[strikerId].slice(-4);
    R.lean = null;
    if (h.length >= 3) {
      const r = h.filter((x) => x === 'R').length, l = h.length - r;
      const side = r >= 3 ? 'R' : l >= 3 ? 'L' : null;
      if (side && s.rng() < R.attrs.reading / 100) R.lean = side;
    }
    if (!R.lean && s.rng() < 0.12) R.lean = s.rng() < 0.5 ? 'L' : 'R';
  }

  // Texto de leitura que quem bate consegue perceber.
  function readHint(s) {
    const pt = s.point, S = s.players[pt.striker], R = s.players[other(pt.striker)];
    if (!R.lean || pt.serve) return null;
    const seed = Math.floor(R.pos.x * 1000 + R.pos.z * 7 + pt.rally * 13);
    if ((Math.abs(Math.sin(seed)) * 100) > S.attrs.reading) return null;
    const c = context(s);
    const sideL = local(S.id, { x: R.lean === 'R' ? 1 : -1, z: 0 }).x >= 0 ? 1 : -1;
    const kind = sideL === c.s ? 'a paralela' : 'a cruzada';
    return R.name + ' parece estar esperando ' + kind + '.';
  }

  function prepareTurn(s) {
    const pt = s.point, R = s.players[other(pt.striker)];
    if (!pt.serve) decideLean(s, R, pt.striker); else R.lean = null;
  }

  function sideOf(pW) { return pW.x >= 0 ? 'R' : 'L'; }

  // Resolve a escolha de quem está batendo. Devolve um evento para animar.
  function play(s, choice) {
    const pt = s.point, S = s.players[pt.striker], R = s.players[other(pt.striker)];
    const shot = ALL_SHOTS.find((x) => x.id === choice.shotId);
    const it = INTENSITY[choice.intensity || 'firme'];
    const c = context(s);
    const sp = spec(shot, c), aimL = sp.aimL;
    const o = Object.assign({}, shot, { dmg: sp.dmg, risk: sp.risk });
    const pr = execProbs(s, o, choice.intensity || 'firme');
    const r = s.rng();
    const quality = r < pr.pPerf ? 'perfeito' : r < pr.pExec ? 'bom' : r < pr.pExec + pr.pMed ? 'mediano' : 'erro';
    const originW = pt.contact;
    const ev = {
      striker: S.id, receiver: R.id, shot, intensity: choice.intensity || 'firme', recovery: choice.recovery || 'centro',
      quality, origin: originW, rally: pt.rally, probs: pr, from: { [S.id]: S.pos, [R.id]: R.pos },
    };
    S.stam = clamp(S.stam - 0.3 - it.stam, 0, 100);
    pt.rally += 1;

    if (quality === 'erro') {
      const net = s.rng() < 0.5 || o.kind === 'drop';
      const oL = local(S.id, originW);
      let outL;
      if (net) {
        const t = clamp((NET - oL.z) / Math.max(0.1, aimL.z - oL.z), 0, 1);
        outL = { x: oL.x + (aimL.x - oL.x) * t, z: NET };
      } else if (Math.abs(aimL.x) > 2.5) outL = { x: Math.sign(aimL.x) * (SW + 0.7), z: aimL.z };
      else outL = { x: aimL.x, z: L + 0.7 };
      ev.bounce = world(S.id, outL);
      ev.errorKind = net ? 'rede' : 'fora';
      ev.time = 0.9;
      ev.to = { [S.id]: S.pos, [R.id]: R.pos };
      if (o.kind === 'serve' && !pt.serve.second) {
        ev.fault = true;
        ev.text = (S.id === 'A' ? 'Seu primeiro saque' : 'Primeiro saque de ' + S.name) + (net ? ' bate na rede.' : ' sai.') + ' Segundo saque.';
        pt.serve.second = true;
        pt.events.push(ev);
        return ev;
      }
      const why = o.kind === 'serve' ? 'Dupla falta' : net ? 'Na rede' : 'Fora';
      ev.ending = o.kind === 'serve' ? 'dupla' : 'erro';
      return endPoint(s, ev, R.id, why + '. ' + (S.id === 'A' ? 'Você errou ' : S.name + ' errou ') + lower(o.name) + '.');
    }

    const paceMul = it.pace * (quality === 'perfeito' ? 1.08 : quality === 'mediano' ? 0.7 : 1);
    const bounce = landing(s, o, quality, aimL);
    const f = flight(originW, bounce, o, paceMul, R);
    ev.bounce = bounce;
    ev.contact = f.contact;
    ev.time = f.time;
    ev.volley = f.volley;
    s.history[S.id].push(sideOf(bounce));

    // Quem bateu se recupera enquanto a bola viaja.
    const contactL = local(S.id, originW);
    const target = recoveryPoint(S, ev.recovery, aimL, contactL);
    moveToward(S, target, f.time);
    ev.recoveryTarget = target;
    const sl = local(S.id, S.pos);
    S.nml = sl.z > 1.5 && sl.z < T.netZ - 0.5;

    // Quem recebe corre para a bola.
    const m = f.time - needTime(R, f.contact, o.kind === 'serve');
    const rp = reachProbs(m, o, R, quality);
    ev.margin = m;
    const reached = s.rng() < rp.pReach;
    if (!reached) {
      moveToward(R, f.contact, f.time);
      ev.to = { [S.id]: S.pos, [R.id]: R.pos };
      const what = o.kind === 'serve' ? 'Ace' : 'Winner';
      ev.ending = o.kind === 'serve' ? 'ace' : 'winner';
      return endPoint(s, ev, S.id, what + ' (' + lower(o.name) + ')! ' + (R.id === 'A' ? 'Você não chegou.' : R.name + ' não chegou.'));
    }
    const runFrom = R.pos;
    R.vel = norm(sub(f.contact, runFrom));
    R.stam = clamp(R.stam - dist(runFrom, f.contact) * 0.15, 0, 100);
    R.pos = f.contact;
    R.lean = null;
    ev.to = { [S.id]: S.pos, [R.id]: R.pos };

    // Dano no equilíbrio de quem recebe.
    const shortBall = c.contact.z > 2.5 && !c.atNet && o.risk >= 0.5;
    let dmg = o.dmg * it.dmg * clamp(1.3 - m * 1.2, 0.3, 1.8) * (quality === 'perfeito' ? 1.2 : 1) * (shortBall ? 1.25 : 1);
    if (o.kind === 'lob' && local(R.id, runFrom).z >= T.netZ) dmg = 28 * clamp(1.3 - m, 0.5, 1.6);
    if (quality === 'mediano') dmg *= 0.2;
    R.bal = clamp(R.bal - dmg, 0, 100);
    if (m > 0.6 || quality === 'mediano') R.bal = clamp(R.bal + 10, 0, 100);
    if (R.bal <= 0) R.broken = true;
    else if (R.broken && R.bal >= 20) R.broken = false;
    ev.damage = Math.round(dmg);

    if (s.rng() < rp.pFE) {
      ev.ending = 'forcado';
      return endPoint(s, ev, S.id, (R.id === 'A' ? 'Você chega ' : R.name + ' chega ') + (m < 0 ? 'esticado' : 'pressionado') + ' e erra. Ponto ' + (S.id === 'A' ? 'seu' : 'dele') + '.');
    }

    // O ponto continua: quem recebeu vira quem bate.
    R.mIn = m;
    R.nml = R.nml && local(R.id, f.contact).z <= local(R.id, runFrom).z + 0.5;
    pt.striker = R.id;
    pt.contact = f.contact;
    pt.high = f.high;
    pt.sitter = quality === 'mediano';
    pt.serve = null;
    ev.text = describe(S, R, o, quality, m);
    pt.events.push(ev);
    prepareTurn(s);
    return ev;
  }

  function lower(t) { return t.charAt(0).toLowerCase() + t.slice(1); }

  function describe(S, R, o, quality, m) {
    const who = S.id === 'A' ? 'Você' : S.name;
    const q = { perfeito: 'perfeita', bom: 'boa', mediano: 'que saiu curta, no meio da quadra' }[quality];
    let tail;
    if (quality === 'mediano') tail = (R.id === 'A' ? 'Você tem' : R.name + ' tem') + ' uma bola para atacar.';
    else if (m < 0) tail = (R.id === 'A' ? 'Você chega' : R.name + ' chega') + ' esticado.';
    else if (m < 0.3) tail = (R.id === 'A' ? 'Você chega' : R.name + ' chega') + ' correndo.';
    else tail = (R.id === 'A' ? 'Você chega' : R.name + ' chega') + ' com tempo.';
    return who + ': ' + lower(o.name) + ' ' + q + '. ' + tail;
  }

  const POINT_NAMES = ['0', '15', '30', '40'];

  function endPoint(s, ev, winner, text) {
    const pt = s.point;
    ev.pointOver = true;
    ev.winner = winner;
    ev.text = text;
    pt.over = true;
    pt.winner = winner;
    pt.events.push(ev);
    const sc = s.score, loser = other(winner);
    sc.points[winner] += 1;
    const pw = sc.points[winner], pl = sc.points[loser];
    if (pw >= 4 && pw - pl >= 2) {
      sc.games[winner] += 1;
      sc.points = { A: 0, B: 0 };
      sc.server = other(sc.server);
      ev.gameWon = winner;
      const gw = sc.games[winner], gl = sc.games[loser];
      if ((gw >= 6 && gw - gl >= 2) || gw === 7) { sc.winner = winner; ev.setWon = winner; }
    }
    s.log.push({ winner, rally: pt.rally, text, shot: ev.shot.id, quality: ev.quality, by: ev.striker });
    return ev;
  }

  function scoreText(s) {
    const p = s.score.points;
    if (p.A >= 3 && p.B >= 3) {
      if (p.A === p.B) return { A: '40', B: '40', label: 'Iguais' };
      return p.A > p.B ? { A: 'AD', B: '40', label: 'Vantagem' } : { A: '40', B: 'AD', label: 'Vantagem' };
    }
    return { A: POINT_NAMES[p.A], B: POINT_NAMES[p.B], label: '' };
  }

  // Quanto uma opção vale, considerando o ponto na hora e a pressão que deixa nele.
  function value(s, e) {
    const adv = 0.05 + (e.dmg * INTENSITY[e.intensity].dmg) / 80 - clamp(e.mExp - 0.4, 0, 1) * 0.15;
    let u = e.pExec * (e.conv + (1 - e.conv) * adv) - e.pErr - e.pMed * 0.3;
    if (e.shot.kind === 'serve' && !s.point.serve.second) u += e.pErr * 0.6; // primeiro saque tem segunda chance
    return u;
  }

  function allChoices(s) {
    const out = [];
    for (const o of availableShots(s)) for (const k of Object.keys(INTENSITY)) {
      const e = evaluate(s, o, k, true);
      out.push({ e, v: value(s, e) });
    }
    return out;
  }

  // Foto da decisão antes de bater: o que foi escolhido e o que havia de melhor.
  function review(s, choice) {
    const pt = s.point, S = s.players[pt.striker];
    const all = allChoices(s).sort((a, b) => b.v - a.v);
    const chosen = all.find((x) => x.e.shot.id === choice.shotId && x.e.intensity === (choice.intensity || 'firme'));
    const recov = {};
    if (!pt.serve) {
      for (const r of Object.keys(RECOVERY)) {
        recov[r] = openCourt(s, Object.assign({}, choice, { recovery: r })).filter((z) => z.m < 0).length;
      }
    }
    return { pid: S.id, choice, chosen, ranked: all.slice(0, 6), recov, serve: !!pt.serve, rally: pt.rally };
  }

  function pc(p) { return Math.round(p * 100) + '%'; }
  function art(o) { return o.stroke === 'deixada' ? 'a ' : 'o '; }
  function optName(e) { return e.shot.name + ', ' + INTENSITY[e.intensity].label.toLowerCase(); }

  // Por que o ponto acabou como acabou, do ponto de vista do jogador `pid`.
  // decisions: reviews das jogadas de pid neste ponto, em ordem.
  function explain(s, ev, decisions, pid) {
    pid = pid || 'A';
    const lost = ev.winner !== pid;
    const last = decisions.filter((d) => d.pid === pid).slice(-1)[0];
    const out = { lost, cause: [], better: [] };
    const opp = s.players[other(pid)].name;
    if (ev.striker === pid) {
      const pr = ev.probs;
      const bad = pr.mods.filter((m) => m.d <= -3).slice(0, 3);
      if (lost) {
        out.cause.push('Você errou ' + art(ev.shot) + lower(ev.shot.name) + (ev.errorKind ? ' (' + ev.errorKind + ')' : '') + '. Esse golpe tinha ' + pc(pr.pExec) + ' de acerto.');
        if (pr.base < 75) out.cause.push(ev.shot.name + ' já é difícil por natureza: começa em ' + pr.base + '% antes de contar a situação.');
        if (bad.length) out.cause.push('Pesou contra: ' + bad.map((m) => m.text + ' (' + Math.round(m.d) + ')').join(', ') + '.');
        if (pr.pExec >= 0.75) out.cause.push('Foi uma escolha boa que não entrou: com ' + pc(pr.pExec) + ', uma em cada ' + Math.max(2, Math.round(1 / (1 - pr.pExec))) + ' sai.');
      } else if (pr.pExec < 0.45) {
        out.cause.push('Deu certo, mas ' + art(ev.shot) + lower(ev.shot.name) + ' tinha só ' + pc(pr.pExec) + ' de acerto.');
      }
    } else if (lost) {
      if (ev.ending === 'ace') out.cause.push('Ace de ' + opp + '. Na devolução não há decisão sua: foi o risco dele que entrou.');
      else if (ev.ending === 'winner') out.cause.push(opp + ' bateu ' + lower(ev.shot.name) + ' e você não chegou.');
      else out.cause.push('Você chegou ' + (ev.margin < 0 ? 'esticado' : 'pressionado') + (ev.shot.stroke === 'deixada' ? ' na ' : ' no ') + lower(ev.shot.name) + ' dele e errou.');
      const events = s.point.events;
      const prev = events.slice(0, -1).filter((e) => e.striker === pid).slice(-1)[0];
      if (prev && ev.ending !== 'ace') {
        if (prev.quality === 'mediano') out.cause.push('Sua bola anterior saiu curta, no meio da quadra, e deu a ele uma bola para atacar.');
        else if (prev.margin > 0.6) out.cause.push('Sua bola anterior (' + lower(prev.shot.name) + ') chegou confortável: ele teve tempo para armar.');
        if (last && last.recov && last.recov[last.choice.recovery] != null) {
          const r = last.choice.recovery, n = last.recov[r];
          // Só sugere voltar ao centro ou ficar: o modelo de áreas não pune quem sobe à rede contra balão.
          const bestR = ['centro', 'ficar'].sort((a, b) => last.recov[a] - last.recov[b])[0];
          if (last.recov[bestR] <= n - 2) {
            out.cause.push('Depois de bater você escolheu "' + RECOVERY[r] + '" e deixou ' + n + ' de 5 áreas fora do seu alcance. "' + RECOVERY[bestR] + '" deixaria ' + last.recov[bestR] + '.');
          }
        }
      }
    }
    if (last && last.chosen && ev.ending !== 'ace' && (lost || out.cause.length)) {
      const ch = last.chosen;
      out.chosen = { name: optName(ch.e), pExec: ch.e.pExec, conv: ch.e.conv };
      for (const x of last.ranked) {
        if (out.better.length >= 3) break;
        if (x.v < ch.v + 0.04) break;
        if (out.better.some((b) => b.shotId === x.e.shot.id)) continue;
        out.better.push({ shotId: x.e.shot.id, name: optName(x.e), pExec: x.e.pExec, conv: x.e.conv });
      }
    }
    return out;
  }

  // ---------- IA ----------
  function aiChoose(s) {
    const pt = s.point, S = s.players[pt.striker];
    const cands = allChoices(s).map((x) => ({ e: x.e, u: x.v + S.aggression * x.e.pExec * x.e.conv * 0.5 }));
    const temp = 0.06;
    const max = Math.max.apply(null, cands.map((c) => c.u));
    const ws = cands.map((c) => Math.exp((c.u - max) / temp));
    let r = s.rng() * ws.reduce((a, b) => a + b, 0);
    let pick = cands[0];
    for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) { pick = cands[i]; break; } }
    const o = pick.e.shot;
    const cL = local(S.id, pt.contact);
    let recovery = 'centro';
    const aggressive = o.kind === 'volley' || o.kind === 'smash' || pick.e.geo === 'par' || pick.e.dmg >= 18;
    if (cL.z >= T.netZ - 1) recovery = 'rede';
    else if (cL.z > 1.5 && aggressive && o.kind !== 'serve' && s.rng() < S.attrs.volley / 110) recovery = 'rede';
    else if (S.stam < 40 && Math.abs(cL.x) < 2.5 && cL.z > -1.5) recovery = 'ficar';
    return { shotId: o.id, intensity: pick.e.intensity, recovery };
  }

  // Onde o adversário poderia te machucar se você voltar para `recovery`.
  function openCourt(s, choice) {
    const pt = s.point, S = s.players[pt.striker], R = s.players[other(pt.striker)];
    const o = ALL_SHOTS.find((x) => x.id === choice.shotId);
    const c = context(s);
    const aimL = spec(o, c).aimL;
    const it = INTENSITY[choice.intensity || 'firme'];
    const bounce = landing(Object.assign({}, s, { rng: null }), o, 'bom', aimL);
    const f = flight(pt.contact, bounce, o, it.pace, R);
    const ghost = { id: S.id, attrs: S.attrs, stam: S.stam, pos: S.pos, vel: { x: 0, z: 0 }, lean: null, hand: S.hand };
    const target = recoveryPoint(S, choice.recovery || 'centro', aimL, local(S.id, pt.contact));
    const d = dist(ghost.pos, target);
    const can = Math.max(0, f.time - 0.25) * speedOf(ghost);
    const k = d > 0 ? Math.min(1, can / d) : 0;
    ghost.pos = add(ghost.pos, sub(target, ghost.pos), k);
    ghost.vel = k > 0 && d > 0.05 ? norm(sub(target, S.pos)) : { x: 0, z: 0 };
    // golpes que ele teria a partir do ponto de contato
    const rc = local(R.id, f.contact);
    const sg = rc.x >= 0.3 ? 1 : rc.x <= -0.3 ? -1 : 1;
    const gl = local(R.id, ghost.pos);
    const aims = [
      { x: -sg * 2.9, z: 21.2 }, { x: sg * 3.1, z: 21.2 }, { x: -sg * 3.8, z: 16.6 }, { x: -sg * 1.4, z: 13.4 },
      { x: (gl.x >= 0 ? -1 : 1) * 3.7, z: 19.5 },
    ];
    return aims.map((a) => {
      const bw = world(R.id, { x: a.x * 0.85, z: a.z - 0.5 });
      const ff = flight(f.contact, bw, { kind: a.z < 15 ? 'drop' : 'drive', pace: a.z < 15 ? 11 : 21 }, 1, ghost);
      const m = ff.time - needTime(ghost, ff.contact, false);
      return { x: bw.x, z: bw.z, m };
    });
  }

  return {
    L, NET, SW, INTENSITY, RECOVERY, SHOTS, SERVES, STROKES, SERVE_KINDS, DIRS, LR, SERVE_DIRS,
    newMatch, startPoint, options, evaluate, availableShots, play, aiChoose, openCourt, prepareTurn, review, explain, spec,
    readHint, scoreText, local, world, other, context,
  };
});
