// Desenho da quadra na câmera de TV (perspectiva 2D em canvas).
(function (root) {
  'use strict';
  const L = 23.77, NET = L / 2, W = 5.485, SG = 4.115;
  const CAM = { f: 1915, h: 12.7, d: 30, hz: -341, cx: 640 };

  const COLORS = {
    stands: '#141F33', standsRow: '#1B2A44', surround: '#3F6B4C', court: '#2C5A8F', line: '#FFFFFF',
    me: '#F59E3B', opp: '#5B8DEF', ball: '#E8F24C', ballEdge: '#9AA82A',
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

  function drawCourt(ctx) {
    ctx.fillStyle = COLORS.stands; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#0E1626'; ctx.fillRect(0, 0, 1280, 70);
    ctx.fillStyle = COLORS.standsRow;
    for (let y = 18; y < 70; y += 22) ctx.fillRect(0, y, 1280, 8);
    ctx.fillStyle = COLORS.surround; poly(ctx, [[-9, -2.5], [9, -2.5], [9, 27.5], [-9, 27.5]], true); ctx.fill();
    ctx.fillStyle = '#0E1A40'; poly(ctx, [[-9, 27.5, 0], [9, 27.5, 0], [9, 27.5, 1.1], [-9, 27.5, 1.1]], true); ctx.fill();
    ctx.fillStyle = COLORS.court; poly(ctx, [[-W, 0], [W, 0], [W, L], [-W, L]], true); ctx.fill();
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    poly(ctx, [[-W, 0], [W, 0], [W, L], [-W, L]], true); ctx.stroke();
    const lines = [
      [[-SG, 0], [-SG, L]], [[SG, 0], [SG, L]], [[-SG, NET - 6.4], [SG, NET - 6.4]], [[-SG, NET + 6.4], [SG, NET + 6.4]],
      [[0, NET - 6.4], [0, NET + 6.4]], [[0, 0], [0, 0.35]], [[0, L], [0, L - 0.35]],
    ];
    for (const l of lines) { poly(ctx, l); ctx.stroke(); }
  }

  function drawNet(ctx) {
    ctx.fillStyle = 'rgba(11,19,34,0.55)';
    poly(ctx, [[-6.4, NET, 0], [6.4, NET, 0], [6.4, NET, 1.07], [0, NET, 0.914], [-6.4, NET, 1.07]], true); ctx.fill();
    ctx.strokeStyle = '#F2F5FA'; ctx.lineWidth = 3;
    poly(ctx, [[-6.4, NET, 1.07], [0, NET, 0.914], [6.4, NET, 1.07]]); ctx.stroke();
    ctx.strokeStyle = '#C9D4E5';
    poly(ctx, [[-6.4, NET, 0], [-6.4, NET, 1.07]]); ctx.stroke();
    poly(ctx, [[6.4, NET, 0], [6.4, NET, 1.07]]); ctx.stroke();
  }

  function rr(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }

  // Boneco: pés em (0,0), cabeça em -100 (1,85 m).
  function drawFigure(ctx, pos, shirt, facing, swing) {
    const p = P(pos.x, pos.z, 0);
    const s = (CAM.f * 1.85) / p.D / 100;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(facing * s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    const skin = facing > 0 ? '#E8C9A8' : '#D9B48F';
    rr(ctx, -12, -48, 8, 46, 3, skin);
    rr(ctx, 4, -48, 8, 46, 3, skin);
    rr(ctx, -14, -6, 10, 6, 2, '#FFFFFF');
    rr(ctx, 4, -6, 10, 6, 2, '#FFFFFF');
    rr(ctx, -13, -58, 26, 14, 3, facing > 0 ? '#1D2B4A' : '#E9EDF3');
    rr(ctx, -14, -86, 28, 32, 7, shirt);
    rr(ctx, -19, -82, 7, 24, 3, skin);
    ctx.save(); ctx.translate(15, -82); ctx.rotate(-0.4 - swing * 1.2); rr(ctx, -3, 0, 7, 24, 3, skin);
    ctx.strokeStyle = '#222222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(0, 38); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 47, 7, 10, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = facing > 0 ? '#3B2A20' : skin;
    ctx.beginPath(); ctx.arc(0, -93, 8, 0, Math.PI * 2); ctx.fill();
    if (facing < 0) { ctx.fillStyle = '#2A1E16'; ctx.beginPath(); ctx.moveTo(-8, -95); ctx.quadraticCurveTo(0, -105, 8, -95); ctx.fill(); }
    ctx.restore();
  }

  function drawBall(ctx, b) {
    const sh = P(b.x, b.z, 0), p = P(b.x, b.z, b.y);
    const r = Math.max(3, (CAM.f * 0.12) / p.D);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ball; ctx.strokeStyle = COLORS.ballEdge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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

  function draw(ctx, v) {
    drawCourt(ctx);
    for (const z of v.zones || []) {
      groundEllipse(ctx, z.x, z.z, 1.1);
      if (z.m < -0.1) { ctx.fillStyle = 'rgba(229,72,77,0.6)'; ctx.fill(); }
      ctx.save(); ctx.strokeStyle = '#FF8A8E'; ctx.lineWidth = 2; ctx.setLineDash(z.m < -0.1 ? [] : [4, 4]); ctx.stroke(); ctx.restore();
    }
    for (const t of v.targets || []) {
      ctx.save();
      ctx.setLineDash(t.selected ? [] : [5, 5]);
      ctx.strokeStyle = t.selected ? COLORS.me : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = t.selected ? 3 : 2;
      groundEllipse(ctx, t.x, t.z, 0.8); ctx.stroke();
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
    far.forEach((pl) => drawFigure(ctx, pl.pos, pl.color, pl.facing, pl.swing || 0));
    if (v.path && v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    drawNet(ctx);
    if (v.path && !v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    if (v.bounce) { ctx.strokeStyle = COLORS.ball; ctx.lineWidth = 2.5; groundEllipse(ctx, v.bounce.x, v.bounce.z, 0.3); ctx.stroke(); }
    near.sort((a, b) => b.pos.z - a.pos.z).forEach((pl) => drawFigure(ctx, pl.pos, pl.color, pl.facing, pl.swing || 0));
    if (v.ball) drawBall(ctx, v.ball);
  }

  root.MoonRender = { draw, arcPoints, peakFor, COLORS, P };
})(typeof self !== 'undefined' ? self : this);
