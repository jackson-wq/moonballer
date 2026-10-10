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
  let sel = { shotId: null, intensity: 'firme', recovery: 'centro' };
  let opts = [];
  let anim = null;
  let lastBounce = null;

  // ---------- desenho ----------
  function baseView() {
    return {
      players: ['A', 'B'].map((id) => ({
        pos: s.players[id].pos, color: id === 'A' ? R.COLORS.me : R.COLORS.opp, facing: id === 'A' ? 1 : -1, swing: 0,
      })),
    };
  }

  function frame(now) {
    let v;
    if (anim) v = animView(now);
    else if (s) {
      v = baseView();
      if (mode === 'decide') decorateDecision(v);
      if (s.point && !s.point.over && mode !== 'decide') v.ball = { x: s.point.contact.x, z: s.point.contact.z, y: 1 };
      if (lastBounce) v.bounce = lastBounce;
    } else v = { players: [] };
    R.draw(ctx, v);
    requestAnimationFrame(frame);
  }

  function decorateDecision(v) {
    const pt = s.point;
    v.ball = { x: pt.contact.x, z: pt.contact.z, y: pt.serve ? 2.6 : 0.95 };
    v.targets = opts.map((o, i) => ({ x: o.aimW.x, z: o.aimW.z, label: String(i + 1), selected: o.shot.id === sel.shotId }));
    const cur = opts.find((o) => o.shot.id === sel.shotId);
    if (cur) {
      const peak = R.peakFor(cur.shot.kind);
      v.path = {
        pts: R.arcPoints(pt.contact, cur.aimW, pt.serve ? 2.6 : 1, 0, peak, 24),
        color: R.COLORS.me, dash: [10, 6], width: 3.5, far: false,
      };
      try {
        v.zones = E.openCourt(s, sel).filter((z) => z.m < 0.15);
      } catch (e) { v.zones = []; }
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
    anim = { ev, t0: performance.now(), dur, pts, done };
    mode = 'anim';
    setNarr('');
  }

  function animView(now) {
    const a = anim, ev = a.ev;
    const t = Math.min(1, (now - a.t0) / a.dur);
    const v = { players: [] };
    for (const id of ['A', 'B']) {
      const f = ev.from[id], to = ev.to[id];
      v.players.push({
        pos: { x: f.x + (to.x - f.x) * t, z: f.z + (to.z - f.z) * t },
        color: id === 'A' ? R.COLORS.me : R.COLORS.opp, facing: id === 'A' ? 1 : -1,
        swing: id === ev.striker ? Math.max(0, 1 - t * 4) : 0,
      });
    }
    const i = Math.min(a.pts.length - 1, Math.floor(t * (a.pts.length - 1)));
    v.ball = a.pts[i];
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
    E.startPoint(s);
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
    $('ovBtn').textContent = btn;
    $('ovBtn').onclick = ev.setWon ? newMatch : nextPoint;
    setNarr('');
    $('overlay').hidden = false;
    $('ovBtn').focus();
  }

  // ---------- menu ----------
  function openMenu() {
    mode = 'decide';
    const pt = s.point;
    const list = E.availableShots(s);
    if (!list.find((o) => o.id === sel.shotId)) sel.shotId = list[0].id;
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
    if (A.broken) parts.push('Seu equilíbrio quebrou: só dá para se defender.');
    else if (A.mIn < 0) parts.push('Você chegou esticado.');
    else if (c.contact.z > 2.5 && !c.atNet) parts.push('Bola curta: janela de ataque.');
    else if (A.mIn > 0.6) parts.push('Você chegou com tempo para armar.');
    if (A.nml) parts.push('Você estava no meio da quadra e a bola veio no pé.');
    if (c.atNet) parts.push('Você está na rede.');
    const h = E.readHint(s);
    if (h) parts.push(h);
    return parts.join(' ');
  }

  function refreshOptions() {
    opts = E.availableShots(s).map((o) => E.evaluate(s, o, sel.intensity, true));
    const box = $('shots');
    box.innerHTML = '';
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'shot' + (o.shot.id === sel.shotId ? ' sel' : '');
      b.innerHTML = '<span class="k">' + (i + 1) + '</span><span class="n"></span><span class="p"></span>';
      b.querySelector('.n').textContent = o.shot.name;
      b.querySelector('.p').textContent = pct(o.pExec) + ' · ' + pct(o.conv);
      b.onclick = () => { sel.shotId = o.shot.id; refreshOptions(); };
      box.appendChild(b);
    });
    const cur = opts.find((o) => o.shot.id === sel.shotId) || opts[0];
    sel.shotId = cur.shot.id;
    $('pExec').textContent = pct(cur.pExec);
    $('conv').textContent = pct(cur.conv);
    const press = cur.shot.dmg * E.INTENSITY[sel.intensity].dmg;
    $('desc').textContent = cur.shot.tag + ' · pressão nele: ' + (press >= 24 ? 'alta' : press >= 13 ? 'média' : 'baixa') +
      ' · erro ' + pct(cur.pErr) + ' · sai curta ' + pct(cur.pMed);
    chips('ints', Object.keys(E.INTENSITY).map((k) => [k, E.INTENSITY[k].label]), sel.intensity, (k) => { sel.intensity = k; refreshOptions(); });
    chips('recs', [['centro', 'Voltar ao centro'], ['ficar', 'Ficar'], ['rede', 'Subir à rede']], sel.recovery, (k) => { sel.recovery = k; refreshOptions(); });
  }

  function chips(id, items, current, onPick) {
    const box = $(id);
    box.innerHTML = '';
    for (const [k, label] of items) {
      const b = document.createElement('button');
      b.className = 'chip' + (k === current ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => onPick(k);
      box.appendChild(b);
    }
  }

  function pct(p) { return Math.round(p * 100) + '%'; }

  function confirm() {
    if (mode !== 'decide') return;
    mode = 'anim';
    resolve({ shotId: sel.shotId, intensity: sel.intensity, recovery: sel.recovery });
  }

  $('go').onclick = confirm;
  document.addEventListener('keydown', (e) => {
    if (mode === 'decide') {
      const n = Number(e.key);
      if (n >= 1 && n <= opts.length) { sel.shotId = opts[n - 1].shot.id; refreshOptions(); }
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
  $('ovText').textContent = 'Tênis tático por turnos. A cada bola você escolhe o golpe, a intensidade e para onde voltar.\n' +
    'Cada golpe mostra duas chances: acertar o alvo e, se acertar, ganhar o ponto na hora.\n' +
    'Áreas vermelhas na quadra = lugares onde você não chega se ele bater lá.\n\nVocê contra R. Duarte, um set.';
  $('ovBtn').textContent = 'Começar partida';
  $('ovBtn').onclick = newMatch;
  $('overlay').hidden = false;

  requestAnimationFrame(frame);
})();
