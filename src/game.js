// Fluxo do jogo: turnos, animação entre decisões e o menu.
(function () {
  'use strict';
  const E = window.MoonEngine, R = window.MoonRender;
  const $ = (id) => document.getElementById(id);
  const canvas = $('court'), ctx = canvas.getContext('2d');

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 1280 * dpr; canvas.height = 720 * dpr;
  ctx.scale(dpr, dpr);

  function fit() {
    const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    $('stage').style.transform = 'scale(' + k + ')';
  }
  window.addEventListener('resize', fit); fit();

  let s = null;
  let mode = 'idle'; // idle | decide | anim | over
  let sel = { stroke: 'forehand', dir: 0, intensity: 'firme', recovery: 'centro' };
  let opts = [];
  let decisions = [];
  let showOdds = false;
  try { showOdds = localStorage.getItem('moonballer.dicas') === '1'; } catch (e) { /* sem armazenamento */ }
  let anim = null;
  let lastBounce = null;
  let marks = [];
  let trail = [];
  const figs = { A: { phase: 0, run: 0, last: null }, B: { phase: 0, run: 0, last: null } };
  let lastNow = 0;

  // ---------- desenho ----------
  function fig(id, pos, extra) {
    return Object.assign({
      pos, facing: id === 'A' ? 1 : -1,
      color: id === 'A' ? R.COLORS.me : R.COLORS.opp, colorDark: id === 'A' ? R.COLORS.meDark : R.COLORS.oppDark,
    }, extra || {});
  }

  function baseView() {
    return { players: ['A', 'B'].map((id) => fig(id, s.players[id].pos)) };
  }

  // Passada: a velocidade na tela vira corrida das pernas.
  function animateLegs(v, now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    v.players.forEach((pl, i) => {
      const f = figs[i === 0 ? 'A' : 'B'];
      const sp = f.last ? Math.hypot(pl.pos.x - f.last.x, pl.pos.z - f.last.z) / dt : 0;
      f.last = { x: pl.pos.x, z: pl.pos.z };
      f.run += (Math.min(1, sp / 3.5) - f.run) * 0.25;
      f.phase += sp * dt * 3.4;
      pl.run = f.run; pl.phase = f.phase;
      if (f.run < 0.05) pl.phase = 0;
      pl.lean = sp > 0.5 ? Math.max(-1, Math.min(1, (pl.pos.x - (f.prevX == null ? pl.pos.x : f.prevX)) * 8)) : 0;
      f.prevX = pl.pos.x;
    });
  }

  function frame(now) {
    let v;
    if (anim) v = animView(now);
    else if (s) {
      v = baseView();
      if (mode === 'decide') decorateDecision(v);
      if (s.point && !s.point.over && mode !== 'decide') v.ball = { x: s.point.contact.x, z: s.point.contact.z, y: 1 };
      if (lastBounce) v.bounce = lastBounce;
      trail = [];
    } else v = { players: [] };
    v.now = now;
    v.marks = marks;
    if (v.ball) v.camX = v.ball.x;
    animateLegs(v, now);
    R.draw(ctx, v);
    requestAnimationFrame(frame);
  }

  function decorateDecision(v) {
    const pt = s.point;
    v.ball = { x: pt.contact.x, z: pt.contact.z, y: pt.serve ? 2.6 : 0.95 };
    v.players[0].prep = 1;
    v.targets = opts.map((o, i) => ({ x: o.aimW.x, z: o.aimW.z, label: DIR_KEYS[i].toUpperCase(), selected: i === sel.dir }));
    const cur = opts[sel.dir];
    if (cur) {
      const peak = R.peakFor(cur.shot.kind);
      v.path = {
        pts: R.arcPoints(pt.contact, cur.aimW, pt.serve ? 2.6 : 1, 0, peak, 24),
        color: R.COLORS.me, dash: [10, 6], width: 3.5, far: false,
      };
      if (showOdds) {
        try {
          v.zones = E.openCourt(s, choice()).filter((z) => z.m < 0.15);
        } catch (e) { v.zones = []; }
      }
      const S = s.players.A;
      const aim = cur.aimL;
      const to = sel.recovery === 'ficar' ? null
        : sel.recovery === 'rede' ? { x: Math.max(-2.5, Math.min(2.5, aim.x * 0.35)), z: 8.6 }
          : { x: Math.max(-1.2, Math.min(1.2, aim.x * 0.22)), z: -0.8 };
      if (to) v.recovery = { from: S.pos, to: E.world('A', to) };
    }
  }

  // ---------- animação ----------
  function playEvent(ev, done) {
    const dur = Math.max(550, Math.min(2200, (ev.time || 0.9) * 1000));
    const h0 = ev.shot.kind === 'serve' ? 2.6 : 1;
    const peak = R.peakFor(ev.shot.kind);
    let segs;
    if (ev.quality === 'erro') {
      const toNet = ev.errorKind === 'rede';
      segs = [R.arcPoints(ev.origin, ev.bounce, h0, toNet ? 0.5 : 0, toNet ? 0.6 : peak, 30)];
    } else if (ev.volley) {
      segs = [R.arcPoints(ev.origin, ev.contact, h0, 0.9, 0.3, 30)];
    } else {
      segs = [R.arcPoints(ev.origin, ev.bounce, h0, 0, peak, 30), R.arcPoints(ev.bounce, ev.contact, 0, 0.9, ev.shot.kind === 'lob' ? 2 : 0.5, 20)];
    }
    const pts = [].concat.apply([], segs);
    const bounceIdx = ev.quality === 'erro' || ev.volley ? pts.length - 1 : segs[0].length - 1;
    anim = { ev, t0: performance.now(), dur, pts, done, bounceIdx, marked: false };
    mode = 'anim';
    setNarr('');
  }

  function animView(now) {
    const a = anim, ev = a.ev;
    const t = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
    const v = { players: [] };
    const sec = Math.max(0, (now - a.t0) / 1000);
    const ease = (u) => u * (2 - u);
    for (const id of ['A', 'B']) {
      const f = ev.from[id], to = ev.to[id];
      const u = id === ev.striker ? ease(Math.max(0, (t - 0.12) / 0.88)) : ease(t);
      v.players.push(fig(id, { x: f.x + (to.x - f.x) * u, z: f.z + (to.z - f.z) * u }, {
        stroke: id === ev.striker && sec < 0.4 ? sec / 0.4 : 0,
        prep: id !== ev.striker && t > 0.65 && ev.contact ? (t - 0.65) / 0.35 : 0,
      }));
    }
    const fi = t * (a.pts.length - 1), i0 = Math.floor(fi), i1 = Math.min(a.pts.length - 1, i0 + 1), k = fi - i0;
    const p0 = a.pts[i0], p1 = a.pts[i1];
    v.ball = { x: p0.x + (p1.x - p0.x) * k, z: p0.z + (p1.z - p0.z) * k, y: p0.y + (p1.y - p0.y) * k };
    trail.push(v.ball);
    if (trail.length > 8) trail.shift();
    v.trail = trail;
    if (!a.marked && fi >= a.bounceIdx && (ev.quality !== 'erro' || ev.errorKind === 'fora')) {
      a.marked = true;
      marks.push({ x: ev.bounce.x, z: ev.bounce.z, t0: now });
      if (marks.length > 6) marks.shift();
    }
    if (t > 0.5 && ev.quality !== 'erro') v.bounce = ev.bounce;
    if (t >= 1) {
      anim = null;
      lastBounce = ev.bounce;
      setTimeout(a.done, 250);
    }
    return v;
  }

  // ---------- fluxo ----------
  function newMatch() {
    s = E.newMatch({ seed: Date.now() });
    nextPoint();
  }

  function nextPoint() {
    $('overlay').hidden = true;
    lastBounce = null;
    marks = [];
    E.startPoint(s);
    decisions = [];
    hud();
    setNarr(s.score.server === 'A' ? 'Seu saque.' : s.players.B.name + ' vai sacar.');
    turn();
  }

  function turn() {
    hud();
    const pt = s.point;
    if (s.control[pt.striker] === 'ai') {
      mode = 'anim';
      setTimeout(() => resolve(E.aiChoose(s)), pt.serve ? 700 : 150);
    } else openMenu();
  }

  function resolve(choice) {
    $('menu').hidden = true;
    if (s.control[s.point.striker] === 'human') decisions.push(E.review(s, choice));
    const ev = E.play(s, choice);
    playEvent(ev, () => {
      hud();
      setNarr(ev.text || '');
      if (ev.pointOver) showPointOver(ev);
      else turn();
    });
  }

  function showPointOver(ev) {
    mode = 'over';
    hud();
    const mine = ev.winner === 'A';
    let title = mine ? 'Ponto seu!' : 'Ponto dele.';
    let btn = 'Próximo ponto';
    if (ev.gameWon) title = ev.gameWon === 'A' ? 'Game seu!' : 'Game dele.';
    if (ev.setWon) { title = ev.setWon === 'A' ? 'Você venceu o set!' : 'Ele venceu o set.'; btn = 'Nova partida'; }
    $('ovTitle').textContent = title;
    $('ovText').textContent = ev.text + '\nTrocas no ponto: ' + s.point.rally + '.';
    showWhy(E.explain(s, ev, decisions, 'A'));
    $('ovBtn').textContent = btn;
    $('ovBtn').onclick = ev.setWon ? newMatch : nextPoint;
    setNarr('');
    $('overlay').hidden = false;
    $('ovBtn').focus();
  }

  function showWhy(x) {
    const box = $('ovWhy');
    box.innerHTML = '';
    box.hidden = !(x && (x.cause.length || x.better.length));
    if (box.hidden) return;
    if (x.cause.length) {
      const h = document.createElement('h3');
      h.textContent = x.lost ? 'Por que você perdeu o ponto' : 'Olhando de novo';
      box.appendChild(h);
      for (const c of x.cause) { const p = document.createElement('p'); p.textContent = c; box.appendChild(p); }
    }
    if (x.better.length) {
      const h = document.createElement('h3');
      h.textContent = 'O que dava para fazer melhor';
      box.appendChild(h);
      const ul = document.createElement('ul');
      const row = (label, o, mine) => {
        const li = document.createElement('li');
        if (mine) li.className = 'mine';
        li.innerHTML = '<span class="n"></span><span class="p"></span>';
        li.querySelector('.n').textContent = label + o.name;
        li.querySelector('.p').textContent = 'acerto ' + pct(o.pExec) + ' · ponto ' + pct(o.conv);
        ul.appendChild(li);
      };
      x.better.forEach((b) => row('', b, false));
      if (x.chosen) row('Você jogou: ', x.chosen, true);
      box.appendChild(ul);
    }
  }

  // ---------- menu ----------
  const DIR_KEYS = ['a', 's', 'd'];

  function strokesNow() { return s.point.serve ? E.SERVE_KINDS : E.STROKES; }
  function dirsOf(st) {
    if (st.kind === 'serve') return ['aberto', 'corpo', 't'];
    return st.lr ? ['esq', 'meio', 'dir'] : ['cruz', 'meio', 'par'];
  }
  function dirLabel(st, d) {
    if (st.kind === 'serve') return E.SERVE_DIRS[d].label;
    return st.lr ? E.LR[d] : E.DIRS[d].label;
  }
  function shotIdOf(st, i) { return (st.kind === 'serve' ? 'saque_' : '') + st.id + '_' + dirsOf(st)[i]; }
  function curStroke() { return strokesNow().find((x) => x.id === sel.stroke) || strokesNow()[0]; }
  function choice() { return { shotId: shotIdOf(curStroke(), sel.dir), intensity: sel.intensity, recovery: sel.recovery }; }
  const shotById = (id) => E.SHOTS.concat(E.SERVES).find((o) => o.id === id);

  function openMenu() {
    mode = 'decide';
    const pt = s.point;
    if (pt.serve) {
      if (!E.SERVE_KINDS.find((x) => x.id === sel.stroke)) sel.stroke = pt.serve.second ? 'spin' : 'chapado';
    } else {
      // Começa no lado em que a bola está; o resto é escolha sua.
      const c = E.context(s);
      sel.stroke = c.atNet ? 'voleio' : (c.s > 0 ? 'forehand' : 'backhand');
    }
    sel.recovery = sel.recovery || 'centro';
    refreshOptions();
    $('prompt').textContent = pt.serve ? (pt.serve.second ? 'Segundo saque.' : 'Seu saque.') : 'O que você faz?';
    $('hint').textContent = situation();
    $('menu').hidden = false;
  }

  function situation() {
    const pt = s.point, A = s.players.A, c = E.context(s);
    if (pt.serve) return 'Lado ' + (pt.serve.side > 0 ? 'direito (iguais)' : 'esquerdo (vantagem)') + '.';
    const parts = [];
    parts.push('Bola no seu ' + (c.s > 0 ? 'forehand' : 'backhand') + (pt.high ? ', alta' : pt.sitter ? ', curta e fácil' : '') + '.');
    if (A.broken) parts.push('Seu equilíbrio quebrou.');
    else if (A.mIn < 0) parts.push('Você chegou esticado.');
    else if (c.contact.z > 2.5 && !c.atNet) parts.push('Você está dentro da quadra.');
    else if (A.mIn > 0.6) parts.push('Você chegou com tempo.');
    if (A.nml) parts.push('Você estava no meio da quadra e a bola veio no pé.');
    if (c.atNet) parts.push('Você está na rede.');
    else if (c.recvAtNet) parts.push(s.players.B.name + ' está na rede.');
    const h = E.readHint(s);
    if (h) parts.push(h);
    return parts.join(' ');
  }

  function refreshOptions() {
    const st = curStroke();
    sel.stroke = st.id;
    opts = [0, 1, 2].map((i) => E.evaluate(s, shotById(shotIdOf(st, i)), sel.intensity, true));
    $('menu').classList.toggle('odds', showOdds);
    const box = $('shots');
    box.innerHTML = '';
    strokesNow().forEach((x, i) => {
      const b = document.createElement('button');
      b.className = 'shot' + (x.id === sel.stroke ? ' sel' : '');
      b.innerHTML = '<span class="k">' + (i + 1) + '</span><span class="n"></span><span class="p"></span>';
      b.querySelector('.n').textContent = x.name;
      if (showOdds) {
        const e = E.evaluate(s, shotById(shotIdOf(x, sel.dir)), sel.intensity, true);
        b.querySelector('.p').textContent = pct(e.pExec) + ' · ' + pct(e.conv);
      }
      b.onclick = () => { sel.stroke = x.id; refreshOptions(); };
      box.appendChild(b);
    });
    chips('dirs', dirsOf(st).map((d, i) => [i, dirLabel(st, d), DIR_KEYS[i].toUpperCase()]), sel.dir, (i) => { sel.dir = i; refreshOptions(); });
    const cur = opts[sel.dir];
    $('pExec').textContent = pct(cur.pExec);
    $('conv').textContent = pct(cur.conv);
    $('strokeDesc').textContent = st.desc;
    if (showOdds) {
      const press = cur.dmg * E.INTENSITY[sel.intensity].dmg;
      const bad = cur.mods.filter((m) => m.d <= -5).slice(0, 2).map((m) => m.text);
      $('desc').textContent = 'Pressão nele: ' + (press >= 24 ? 'alta' : press >= 13 ? 'média' : 'baixa') +
        ' · erro ' + pct(cur.pErr) + ' · sai curta ' + pct(cur.pMed) + (bad.length ? ' · contra: ' + bad.join(', ') : '');
    } else $('desc').textContent = '';
    chips('ints', Object.keys(E.INTENSITY).map((k) => [k, E.INTENSITY[k].label]), sel.intensity, (k) => { sel.intensity = k; refreshOptions(); });
    chips('recs', [['centro', 'Voltar ao centro'], ['ficar', 'Ficar'], ['rede', 'Subir à rede']], sel.recovery, (k) => { sel.recovery = k; refreshOptions(); });
    $('oddsToggle').textContent = showOdds ? 'Esconder chances' : 'Mostrar chances';
  }

  function chips(id, items, current, onPick) {
    const box = $(id);
    box.innerHTML = '';
    for (const [k, label, key] of items) {
      const b = document.createElement('button');
      b.className = 'chip' + (k === current ? ' sel' : '');
      b.textContent = label;
      if (key) { const kb = document.createElement('kbd'); kb.textContent = key; b.appendChild(kb); }
      b.onclick = () => onPick(k);
      box.appendChild(b);
    }
  }

  function pct(p) { return Math.round(p * 100) + '%'; }

  function confirm() {
    if (mode !== 'decide') return;
    mode = 'anim';
    resolve(choice());
  }

  function toggleOdds() {
    showOdds = !showOdds;
    try { localStorage.setItem('moonballer.dicas', showOdds ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    if (mode === 'decide') refreshOptions();
  }

  $('go').onclick = confirm;
  $('oddsToggle').onclick = toggleOdds;
  document.addEventListener('keydown', (e) => {
    if (mode === 'decide') {
      const n = Number(e.key), k = e.key.toLowerCase();
      const list = strokesNow();
      if (n >= 1 && n <= list.length) { sel.stroke = list[n - 1].id; refreshOptions(); }
      else if (DIR_KEYS.includes(k)) { sel.dir = DIR_KEYS.indexOf(k); refreshOptions(); }
      else if (k === 'h') toggleOdds();
      else if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    } else if (mode === 'over' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); $('ovBtn').click();
    }
  });

  // ---------- HUD ----------
  function hud() {
    const sc = E.scoreText(s);
    for (const id of ['A', 'B']) {
      const p = s.players[id];
      $('games' + id).textContent = s.score.games[id];
      $('pts' + id).textContent = sc[id];
      $('bal' + id).style.width = p.bal + '%';
      $('bal' + id).classList.toggle('broken', p.broken);
      $('stam' + id).style.width = p.stam + '%';
    }
    $('nameB').textContent = s.players.B.name;
    document.querySelectorAll('#scorebug .srv').forEach((el) => el.classList.toggle('on', el.dataset.srv === s.score.server));
  }

  function setNarr(t) { $('narr').textContent = t; }

  // ---------- tela inicial ----------
  $('ovTitle').textContent = 'Moonballer';
  $('ovText').textContent = 'Tênis tático por turnos. A cada bola você escolhe o golpe, a direção, a intensidade e para onde voltar.\n' +
    'Todos os golpes ficam sempre liberados, até os que não fazem sentido. Cabe a você ler a bola.\n' +
    'As chances ficam escondidas. Quando perder um ponto, o jogo explica o porquê e mostra o que dava para fazer.\n' +
    'Teclas: 1 a 7 golpe, A S D direção, H mostra ou esconde as chances, Enter bate.\n\nVocê contra R. Duarte, um set.';
  $('ovWhy').hidden = true;
  $('ovBtn').textContent = 'Começar partida';
  $('ovBtn').onclick = newMatch;
  $('overlay').hidden = false;

  requestAnimationFrame(frame);
})();
