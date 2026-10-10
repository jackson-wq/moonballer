// Desenho da quadra na câmera de TV (perspectiva 2D em canvas).
(function (root) {
  'use strict';
  const L = 23.77, NET = L / 2, W = 5.485, SG = 4.115;
  const CAM = { f: 1915, h: 12.7, d: 30, hz: -341, cx: 640 };
  const BASE_CX = 640;

  const COLORS = {
    surround: '#3D6B4D', surroundNear: '#4A7C5B', court: '#2C5A8F', courtLight: '#3A6FA8', line: '#F4F7FB',
    me: '#F59E3B', meDark: '#C97A22', opp: '#5B8DEF', oppDark: '#3F6CC4', ball: '#E8F24C', ballEdge: '#9AA82A',
    wall: '#0E1A40', wallText: '#E8EEF7',
  };

  function P(x, z, y) {
    const D = z + CAM.d;
    return { x: CAM.cx + (CAM.f * x) / D, y: CAM.hz + (CAM.f * (CAM.h - (y || 0))) / D, D };
  }

  function poly(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach((q, i) => { const p = P(q[0], q[1], q[2]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    if (close) ctx.closePath();
  }

  function groundEllipse(ctx, x, z, r) {
    const p = P(x, z, 0);
    const rx = (CAM.f * r) / p.D;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, rx * 0.32, 0, 0, Math.PI * 2);
  }

  // ---------- fundo (torcida) em cache ----------
  let crowd = null;
  function makeCrowd() {
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 720;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 720);
    bg.addColorStop(0, '#0A101C'); bg.addColorStop(1, '#162238');
    g.fillStyle = bg; g.fillRect(0, 0, 1600, 720);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const shirts = ['#3A4F7A', '#6B7A93', '#8FA6C8', '#B65A4A', '#C9A35A', '#4F7A5A', '#D9D2C5', '#2A3550', '#7A4F6B'];
    for (let y = 8; y < 720; y += 11) {
      const row = Math.floor(y / 11);
      for (let x = (row % 2) * 6; x < 1600; x += 12) {
        if (rnd() < 0.12) continue;
        const shade = 0.55 + 0.45 * (y / 720);
        g.globalAlpha = shade;
        g.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
        g.fillRect(x, y + 3, 8, 7);
        g.fillStyle = rnd() < 0.5 ? '#E0BC9A' : '#8A5E42';
        g.beginPath(); g.arc(x + 4, y + 1.5, 3, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    return c;
  }

  // ---------- quadra ----------
  // Linha com espessura real (em metros), para ficar mais fina ao fundo.
  function courtLine(ctx, x1, z1, x2, z2, w) {
    const h = w / 2;
    if (Math.abs(x1 - x2) < 1e-6) poly(ctx, [[x1 - h, z1], [x1 + h, z1], [x2 + h, z2], [x2 - h, z2]], true);
    else poly(ctx, [[x1, z1 - h], [x2, z2 - h], [x2, z2 + h], [x1, z1 + h]], true);
    ctx.fill();
  }

  function boardText(ctx, x, z, y, text, sizeM, color) {
    const p = P(x, z, y);
    const px = (CAM.f * sizeM) / p.D;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '700 ' + px.toFixed(1) + 'px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }

  function drawCourt(ctx) {
    if (!crowd) crowd = makeCrowd();
    ctx.drawImage(crowd, -160 + (CAM.cx - BASE_CX) * 0.4, 0);

    // muros de propaganda
    ctx.fillStyle = COLORS.wall;
    poly(ctx, [[-10, 28, 0], [10, 28, 0], [10, 28, 1.2], [-10, 28, 1.2]], true); ctx.fill();
    poly(ctx, [[-10, -7.5, 0], [-10, 28, 0], [-10, 28, 1.2], [-10, -7.5, 1.2]], true); ctx.fill();
    poly(ctx, [[10, -7.5, 0], [10, 28, 0], [10, 28, 1.2], [10, -7.5, 1.2]], true); ctx.fill();
    boardText(ctx, -4.5, 28, 0.6, 'MOONBALLER', 0.8, COLORS.wallText);
    boardText(ctx, 4.5, 28, 0.6, 'OPEN', 0.8, COLORS.ball);

    // piso em volta
    const top = P(0, 28, 0).y, bottom = P(0, -7.5, 0).y;
    const sg = ctx.createLinearGradient(0, top, 0, bottom);
    sg.addColorStop(0, COLORS.surround); sg.addColorStop(1, COLORS.surroundNear);
    ctx.fillStyle = sg; poly(ctx, [[-10, -7.5], [10, -7.5], [10, 28], [-10, 28]], true); ctx.fill();

    // quadra com luz no centro
    poly(ctx, [[-W, 0], [W, 0], [W, L], [-W, L]], true);
    ctx.save(); ctx.clip();
    const c = P(0, NET, 0);
    const rg = ctx.createRadialGradient(c.x, c.y, 40, c.x, c.y, 520);
    rg.addColorStop(0, COLORS.courtLight); rg.addColorStop(1, COLORS.court);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, 1280, 720);
    // marcas de uso perto das linhas de base
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (const z of [-0.2, L + 0.2]) { groundEllipse(ctx, 0, z, 2.6); ctx.fill(); groundEllipse(ctx, 1.4, z, 1.6); ctx.fill(); groundEllipse(ctx, -1.6, z, 1.5); ctx.fill(); }
    ctx.restore();

    // linhas
    ctx.fillStyle = COLORS.line;
    courtLine(ctx, -W, 0, W, 0, 0.1); courtLine(ctx, -W, L, W, L, 0.1);
    courtLine(ctx, -W, 0, -W, L, 0.05); courtLine(ctx, W, 0, W, L, 0.05);
    courtLine(ctx, -SG, 0, -SG, L, 0.05); courtLine(ctx, SG, 0, SG, L, 0.05);
    courtLine(ctx, -SG, NET - 6.4, SG, NET - 6.4, 0.05); courtLine(ctx, -SG, NET + 6.4, SG, NET + 6.4, 0.05);
    courtLine(ctx, 0, NET - 6.4, 0, NET + 6.4, 0.05);
    courtLine(ctx, 0, 0, 0, 0.3, 0.05); courtLine(ctx, 0, L - 0.3, 0, L, 0.05);
  }

  function drawUmpire(ctx) {
    const x = -7.2, z = NET;
    ctx.strokeStyle = '#2A3550'; ctx.lineWidth = 3;
    for (const dx of [-0.35, 0.35]) { poly(ctx, [[x + dx, z, 0], [x + dx, z, 1.9]]); ctx.stroke(); }
    ctx.fillStyle = '#2A3550'; poly(ctx, [[x - 0.45, z, 1.9], [x + 0.45, z, 1.9], [x + 0.45, z, 2.05], [x - 0.45, z, 2.05]], true); ctx.fill();
    const seat = P(x, z, 2.05), s = (CAM.f * 0.9) / seat.D / 100;
    ctx.save(); ctx.translate(seat.x, seat.y); ctx.scale(s, s);
    rr(ctx, -16, -60, 32, 46, 8, '#1D2B4A');
    rr(ctx, -14, -16, 28, 16, 6, '#D9D2C5');
    ctx.fillStyle = '#D9B48F'; ctx.beginPath(); ctx.arc(0, -72, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F4F7FB'; ctx.beginPath(); ctx.ellipse(0, -80, 13, 5, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  function drawNet(ctx) {
    // sombra da rede
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    poly(ctx, [[-6.4, NET + 0.05, 0], [6.4, NET + 0.05, 0], [6.4, NET - 0.9, 0], [-6.4, NET - 0.9, 0]], true); ctx.fill();
    // malha
    poly(ctx, [[-6.4, NET, 0], [6.4, NET, 0], [6.4, NET, 1.07], [0, NET, 0.914], [-6.4, NET, 1.07]], true);
    ctx.fillStyle = 'rgba(10,16,28,0.42)'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(220,228,240,0.18)'; ctx.lineWidth = 1;
    for (let x = -6.4; x <= 6.4; x += 0.18) { poly(ctx, [[x, NET, 0], [x, NET, 1.07]]); ctx.stroke(); }
    for (let y = 0.08; y < 1.07; y += 0.08) { poly(ctx, [[-6.4, NET, y], [6.4, NET, y]]); ctx.stroke(); }
    ctx.restore();
    // fita branca e faixa central
    ctx.fillStyle = '#F4F7FB';
    poly(ctx, [[-6.4, NET, 1.07], [0, NET, 0.914], [6.4, NET, 1.07], [6.4, NET, 1.0], [0, NET, 0.844], [-6.4, NET, 1.0]], true); ctx.fill();
    poly(ctx, [[-0.03, NET, 0], [0.03, NET, 0], [0.03, NET, 0.88], [-0.03, NET, 0.88]], true); ctx.fill();
    // postes
    ctx.fillStyle = '#1D2B4A';
    for (const x of [-6.4, 6.4]) { poly(ctx, [[x - 0.06, NET, 0], [x + 0.06, NET, 0], [x + 0.06, NET, 1.1], [x - 0.06, NET, 1.1]], true); ctx.fill(); }
  }

  function rr(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }

  // ---------- jogador ----------
  // Pés em (0,0), topo da cabeça em -100 (1,85 m). facing +1 = de costas (você), -1 = de frente (adversário).
  // pl.run: 0..1 o quanto está correndo; pl.phase: ciclo da passada; pl.stroke: 0..1 progresso do golpe;
  // pl.prep: 0..1 preparação (raquete para trás); pl.lean: -1..1 inclinação lateral.
  function drawFigure(ctx, pl) {
    const p = P(pl.pos.x, pl.pos.z, 0);
    const s = (CAM.f * 1.85) / p.D / 115;
    const back = pl.facing > 0;
    const run = pl.run || 0, ph = pl.phase || 0;
    const legA = Math.sin(ph) * 0.55 * run, bob = -Math.abs(Math.sin(ph)) * 4 * run;
    const shirt = pl.color, shirtDark = pl.colorDark || pl.color;
    const skin = back ? '#E8C9A8' : '#D9B48F', skinDark = back ? '#C9A887' : '#B8946F';

    ctx.save();
    ctx.translate(p.x, p.y);
    // sombra
    const sh = ctx.createRadialGradient(0, 0, 1, 0, 0, 26 * s);
    sh.addColorStop(0, 'rgba(0,0,0,0.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(4 * s, 0, 28 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.scale((back ? 1 : -1) * s, s);
    ctx.rotate((pl.lean || 0) * 0.12);
    ctx.translate(0, bob);

    // pernas
    const leg = (x, ang, front) => {
      ctx.save(); ctx.translate(x, -50); ctx.rotate(ang);
      rr(ctx, -4.5, 0, 9, 26, 4, front ? skin : skinDark);
      rr(ctx, -4.5, 22, 9, 22, 4, front ? skin : skinDark);
      rr(ctx, -4.5, 36, 9, 8, 2, '#F4F7FB');
      rr(ctx, -6, 43, 13, 7, 3, '#F4F7FB');
      ctx.restore();
    };
    leg(-7, legA, false);
    leg(7, -legA, true);

    // shorts e camisa
    rr(ctx, -15, -60, 30, 17, 4, back ? '#1D2B4A' : '#E9EDF3');
    rr(ctx, -16, -90, 32, 36, 9, shirt);
    rr(ctx, back ? 6 : -16, -90, 10, 36, 9, shirtDark);
    if (back) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, -66); }

    // braço livre
    ctx.save(); ctx.translate(-15, -86); ctx.rotate(0.25 + Math.sin(ph) * 0.4 * run - (pl.prep || 0) * 0.6);
    rr(ctx, -3.5, 0, 7, 26, 3.5, skin); ctx.restore();

    // braço da raquete
    const prep = pl.prep || 0, st = pl.stroke || 0;
    let ang = -0.35 - Math.sin(ph) * 0.3 * run;
    if (st > 0 && st < 1) ang = -2.5 + st * 3.9;
    else if (prep > 0) ang = -0.35 - prep * 2.1;
    ctx.save(); ctx.translate(15, -86); ctx.rotate(ang);
    rr(ctx, -3.5, 0, 7, 26, 3.5, skin);
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(0, 38); ctx.stroke();
    ctx.fillStyle = 'rgba(240,240,230,0.35)'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 48, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (st > 0.15 && st < 0.85) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * Math.sin(st * Math.PI)).toFixed(2) + ')';
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(15, -86, 58, -2.5 + Math.PI / 2, -2.5 + st * 3.9 + Math.PI / 2); ctx.stroke();
    }

    // cabeça
    ctx.fillStyle = skin; ctx.fillRect(-3.5, -98, 7, 9);
    if (back) {
      ctx.fillStyle = '#3B2A20'; ctx.beginPath(); ctx.arc(0, -105, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F4F7FB'; ctx.fillRect(-9.5, -109, 19, 3.5);
    } else {
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -105, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pl.color; ctx.beginPath(); ctx.ellipse(0, -110, 10.5, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(-2, -110, 15, 3);
    }
    ctx.restore();
  }

  // ---------- bola ----------
  function drawBall(ctx, b, trail) {
    if (trail && trail.length > 1) {
      for (let i = 0; i < trail.length; i++) {
        const q = P(trail[i].x, trail[i].z, trail[i].y);
        const a = (i + 1) / trail.length;
        ctx.fillStyle = 'rgba(232,242,76,' + (0.35 * a).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, (CAM.f * 0.09 * a) / q.D), 0, Math.PI * 2); ctx.fill();
      }
    }
    const sh = P(b.x, b.z, 0), p = P(b.x, b.z, b.y);
    const r = Math.max(3, (CAM.f * 0.12) / p.D);
    const k = Math.max(0.35, 1 - b.y / 5);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * k).toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * (1.3 - k * 0.3), r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, '#F8FFB0'); g.addColorStop(1, COLORS.ball);
    ctx.fillStyle = g; ctx.strokeStyle = COLORS.ballEdge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawMarks(ctx, marks, now) {
    for (const m of marks || []) {
      const age = (now - m.t0) / 1000;
      if (age > 2.5) continue;
      const a = Math.max(0, 1 - age / 2.5);
      ctx.fillStyle = 'rgba(200,220,240,' + (0.35 * a).toFixed(2) + ')';
      groundEllipse(ctx, m.x, m.z, 0.22); ctx.fill();
      if (age < 0.4) {
        ctx.strokeStyle = 'rgba(232,242,76,' + (0.8 * (1 - age / 0.4)).toFixed(2) + ')';
        ctx.lineWidth = 2;
        groundEllipse(ctx, m.x, m.z, 0.2 + age * 2); ctx.stroke();
      }
    }
  }

  function drawPath(ctx, pts, color, dash, width) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width || 3; ctx.setLineDash(dash || []); ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => { const p = P(q.x, q.z, q.y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    ctx.restore();
  }

  // Trajetória: origem -> quique -> contato, com altura em parábola.
  function arcPoints(a, b, h0, h1, peak, n) {
    const out = [];
    n = n || 20;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: h0 + (h1 - h0) * t + 4 * peak * t * (1 - t) });
    }
    return out;
  }

  function peakFor(kind) {
    return { lob: 5.5, drop: 1.6, slice: 0.7, serve: 0.2, smash: 0.1, volley: 0.4 }[kind] || 1.3;
  }

  let vignette = null;
  function drawVignette(ctx) {
    if (!vignette) {
      vignette = ctx.createRadialGradient(640, 330, 380, 640, 360, 820);
      vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    }
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1280, 720);
  }

  function draw(ctx, v) {
    const now = v.now || 0;
    // câmera acompanha a bola de leve
    const want = BASE_CX - (v.camX || 0) * 14;
    CAM.cx += (want - CAM.cx) * 0.06;

    drawCourt(ctx);
    drawMarks(ctx, v.marks, now);
    for (const z of v.zones || []) {
      groundEllipse(ctx, z.x, z.z, 1.1);
      if (z.m < -0.1) { ctx.fillStyle = 'rgba(229,72,77,0.55)'; ctx.fill(); }
      ctx.save(); ctx.strokeStyle = '#FF8A8E'; ctx.lineWidth = 2; ctx.setLineDash(z.m < -0.1 ? [] : [4, 4]); ctx.stroke(); ctx.restore();
    }
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    for (const t of v.targets || []) {
      ctx.save();
      ctx.setLineDash(t.selected ? [] : [5, 5]);
      ctx.strokeStyle = t.selected ? COLORS.me : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = t.selected ? 3 : 2;
      groundEllipse(ctx, t.x, t.z, t.selected ? 0.8 + pulse * 0.15 : 0.8); ctx.stroke();
      if (t.selected) { ctx.fillStyle = 'rgba(245,158,59,0.25)'; ctx.fill(); }
      const p = P(t.x, t.z, 0);
      ctx.fillStyle = t.selected ? '#FFD39A' : '#FFFFFF';
      ctx.font = '700 14px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(t.label, p.x, p.y + 5);
      ctx.restore();
    }
    if (v.recovery) {
      const a = P(v.recovery.from.x, v.recovery.from.z, 0), b = P(v.recovery.to.x, v.recovery.to.z, 0);
      ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore();
    }
    const far = [], near = [];
    for (const pl of v.players) (pl.pos.z > NET ? far : near).push(pl);
    far.forEach((pl) => drawFigure(ctx, pl));
    const ballFar = v.ball && v.ball.z > NET;
    if (ballFar) drawBall(ctx, v.ball, v.trail);
    if (v.path && v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    drawUmpire(ctx);
    drawNet(ctx);
    if (v.path && !v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    if (v.bounce) { ctx.strokeStyle = COLORS.ball; ctx.lineWidth = 2.5; groundEllipse(ctx, v.bounce.x, v.bounce.z, 0.3); ctx.stroke(); }
    near.sort((a, b) => b.pos.z - a.pos.z).forEach((pl) => drawFigure(ctx, pl));
    if (v.ball && !ballFar) drawBall(ctx, v.ball, v.trail);
    drawVignette(ctx);
  }

  root.MoonRender = { draw, arcPoints, peakFor, COLORS, P };
})(typeof self !== 'undefined' ? self : this);
