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

  // Tudo que não se mexe (arquibancada, quadra, linhas) é desenhado uma vez numa camada separada.
  let bgLayer = null;

  function vgrad(ctx, z0, z1, c0, c1) {
    const g = ctx.createLinearGradient(0, P(0, z0, 0).y, 0, P(0, z1, 0).y);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }

  function drawStands(ctx) {
    const top = P(0, 27.5, 1.1).y;
    const g = ctx.createLinearGradient(0, 0, 0, top);
    g.addColorStop(0, '#0A1120'); g.addColorStop(1, '#17243C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, top);
    // Torcida: cabeças em fileiras, com cores fixas (semente constante).
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const shirts = ['#3A4C6E', '#5B6F94', '#8A5A4A', '#B0846A', '#4F7A64', '#6B5B8E', '#C9D4E5', '#9B4E5C'];
    for (let row = 0, y = 10; y < top - 6; row++, y += 13) {
      ctx.fillStyle = row % 2 ? '#131E33' : '#16233B'; ctx.fillRect(0, y + 7, 1280, 5);
      for (let x = (row % 2) * 7; x < 1280; x += 14) {
        if (rnd() < 0.18) continue;
        ctx.globalAlpha = 0.35 + 0.35 * (y / top);
        ctx.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
        ctx.fillRect(x - 4, y + 3, 8, 5);
        ctx.fillStyle = rnd() < 0.5 ? '#C9A27E' : '#7A5A44';
        ctx.beginPath(); ctx.arc(x, y + 1, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCourt(ctx) {
    ctx.fillStyle = COLORS.stands; ctx.fillRect(0, 0, 1280, 720);
    drawStands(ctx);
    // O piso vai até z = -8 para preencher a parte de baixo da tela.
    ctx.fillStyle = vgrad(ctx, 27.5, -8, '#2F5440', '#4A7A58');
    poly(ctx, [[-14, -8], [14, -8], [14, 27.5], [-14, 27.5]], true); ctx.fill();
    // Muro do fundo com faixa de patrocínio.
    ctx.fillStyle = '#0E1A40'; poly(ctx, [[-14, 27.5, 0], [14, 27.5, 0], [14, 27.5, 1.1], [-14, 27.5, 1.1]], true); ctx.fill();
    ctx.fillStyle = '#16275A'; poly(ctx, [[-14, 27.5, 0.75], [14, 27.5, 0.75], [14, 27.5, 1.1], [-14, 27.5, 1.1]], true); ctx.fill();
    const w = P(0, 27.5, 0.38);
    ctx.fillStyle = 'rgba(232,242,76,0.85)'; ctx.font = '700 12px "Press Start 2P", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MOONBALLER', w.x - 260, w.y); ctx.fillText('MOONBALLER', w.x + 260, w.y);
    ctx.fillStyle = 'rgba(238,242,248,0.7)'; ctx.font = '700 13px "Chakra Petch", sans-serif';
    ctx.fillText('OPEN · QUADRA CENTRAL', w.x, w.y);
    ctx.textBaseline = 'alphabetic';
    // Quadra com leve degradê (mais clara perto da câmera).
    ctx.fillStyle = vgrad(ctx, L, 0, '#27507F', '#3166A0');
    poly(ctx, [[-W, 0], [W, 0], [W, L], [-W, L]], true); ctx.fill();
    // Desgaste perto das linhas de base, onde se pisa mais.
    for (const zb of [0.6, L - 0.6]) {
      const c = P(0, zb, 0), rx = (CAM.f * 3.2) / c.D;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rx);
      g.addColorStop(0, 'rgba(120,170,220,0.16)'); g.addColorStop(1, 'rgba(120,170,220,0)');
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.3); ctx.translate(-c.x, -c.y);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.strokeStyle = COLORS.line; ctx.lineJoin = 'round';
    const lines = [
      [[-W, 0], [W, 0]], [[W, 0], [W, L]], [[W, L], [-W, L]], [[-W, L], [-W, 0]],
      [[-SG, 0], [-SG, L]], [[SG, 0], [SG, L]], [[-SG, NET - 6.4], [SG, NET - 6.4]], [[-SG, NET + 6.4], [SG, NET + 6.4]],
      [[0, NET - 6.4], [0, NET + 6.4]], [[0, 0], [0, 0.35]], [[0, L], [0, L - 0.35]],
    ];
    // Espessura acompanha a distância: linhas do fundo mais finas.
    for (const l of lines) {
      const zMid = (l[0][1] + l[1][1]) / 2;
      ctx.lineWidth = Math.max(1.5, (CAM.f * 0.05) / (zMid + CAM.d));
      poly(ctx, l); ctx.stroke();
    }
  }

  function drawBackground(ctx) {
    if (typeof document === 'undefined') return drawCourt(ctx);
    if (!bgLayer) {
      const k = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      bgLayer = document.createElement('canvas');
      bgLayer.width = 1280 * k; bgLayer.height = 720 * k;
      const b = bgLayer.getContext('2d');
      b.scale(k, k);
      drawCourt(b);
      // Refaz quando a fonte do placar de fundo terminar de carregar.
      if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { bgLayer = null; });
    }
    ctx.drawImage(bgLayer, 0, 0, 1280, 720);
  }

  function drawNet(ctx) {
    // Sombra da rede no chão (luz vindo de trás da câmera).
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    poly(ctx, [[-6.4, NET, 0], [6.4, NET, 0], [6.4, NET + 0.9, 0], [-6.4, NET + 0.9, 0]], true); ctx.fill();
    ctx.fillStyle = 'rgba(11,19,34,0.45)';
    poly(ctx, [[-6.4, NET, 0], [6.4, NET, 0], [6.4, NET, 1.07], [0, NET, 0.914], [-6.4, NET, 1.07]], true); ctx.fill();
    // Malha.
    ctx.save();
    poly(ctx, [[-6.4, NET, 0], [6.4, NET, 0], [6.4, NET, 1.07], [0, NET, 0.914], [-6.4, NET, 1.07]], true); ctx.clip();
    ctx.strokeStyle = 'rgba(220,228,240,0.16)'; ctx.lineWidth = 1;
    for (let x = -6.4; x <= 6.4; x += 0.25) { poly(ctx, [[x, NET, 0], [x, NET, 1.1]]); ctx.stroke(); }
    for (let y = 0.12; y < 1.07; y += 0.12) { poly(ctx, [[-6.4, NET, y], [6.4, NET, y]]); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#F2F5FA'; ctx.lineWidth = 4;
    poly(ctx, [[-6.4, NET, 1.07], [0, NET, 0.914], [6.4, NET, 1.07]]); ctx.stroke();
    ctx.lineWidth = 2;
    poly(ctx, [[0, NET, 0], [0, NET, 0.914]]); ctx.stroke();
    ctx.strokeStyle = '#8C9AB3'; ctx.lineWidth = 5;
    poly(ctx, [[-6.4, NET, 0], [-6.4, NET, 1.07]]); ctx.stroke();
    poly(ctx, [[6.4, NET, 0], [6.4, NET, 1.07]]); ctx.stroke();
  }

  function drawVignette(ctx) {
    const g = ctx.createRadialGradient(640, 340, 300, 640, 360, 820);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
  }

  function rr(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }

  // Boneco: pés em (0,0), cabeça em -100 (1,85 m).
  function drawFigure(ctx, pos, shirt, facing, swing, run) {
    const p = P(pos.x, pos.z, 0);
    const s = (CAM.f * 1.85) / p.D / 100;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(facing * s, s);
    // Sombra projetada para trás e para a direita, com borda suave.
    const sg = ctx.createRadialGradient(6, -2, 2, 6, -2, 26);
    sg.addColorStop(0, 'rgba(0,0,0,0.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(6, -2, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    const skin = facing > 0 ? '#E8C9A8' : '#D9B48F';
    // Correndo: pernas alternam e o corpo sobe e desce um pouco.
    const st = run == null ? 0 : Math.sin(run);
    const bob = run == null ? 0 : -Math.abs(Math.cos(run)) * 3;
    rr(ctx, -12 + st * 4, -48, 8, 46 - Math.max(0, st) * 6, 3, skin);
    rr(ctx, 4 - st * 4, -48, 8, 46 - Math.max(0, -st) * 6, 3, skin);
    rr(ctx, -14 + st * 4, -6 - Math.max(0, st) * 6, 10, 6, 2, '#FFFFFF');
    rr(ctx, 4 - st * 4, -6 - Math.max(0, -st) * 6, 10, 6, 2, '#FFFFFF');
    ctx.translate(0, bob);
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

  function drawBall(ctx, b, trail) {
    const sh = P(b.x, b.z, 0), p = P(b.x, b.z, b.y);
    const r = Math.max(3, (CAM.f * 0.12) / p.D);
    // Sombra fica menor e mais fraca quanto mais alta a bola.
    const k = 1 / (1 + (b.y || 0) * 0.35);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.4 * k).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * (0.6 + 0.6 * k), r * 0.4 * (0.6 + 0.6 * k), 0, 0, Math.PI * 2); ctx.fill();
    if (trail && trail.length > 1) {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = P(trail[i - 1].x, trail[i - 1].z, trail[i - 1].y), c = P(trail[i].x, trail[i].z, trail[i].y);
        ctx.strokeStyle = 'rgba(232,242,76,' + (0.45 * i / trail.length).toFixed(3) + ')';
        ctx.lineWidth = r * 1.6 * (i / trail.length);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.restore();
    }
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, '#FBFFB0'); g.addColorStop(0.6, COLORS.ball); g.addColorStop(1, COLORS.ballEdge);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Marca do quique: anel que abre e some.
  function drawBounce(ctx, b) {
    const age = b.age == null ? 1 : Math.min(1, b.age);
    if (b.age != null && age < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
      groundEllipse(ctx, b.x, b.z, 0.3 + age * 0.9); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(232,242,76,0.25)'; ctx.strokeStyle = COLORS.ball; ctx.lineWidth = 2.5;
    groundEllipse(ctx, b.x, b.z, 0.3); ctx.fill(); ctx.stroke();
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
    drawBackground(ctx);
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
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = t.selected ? COLORS.me : 'rgba(11,19,34,0.75)'; ctx.fill();
      ctx.fillStyle = t.selected ? '#0B1322' : '#FFFFFF';
      ctx.font = '700 13px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label, p.x, p.y + 1);
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
    if (v.bounce && v.bounce.z > NET) drawBounce(ctx, v.bounce);
    far.forEach((pl) => drawFigure(ctx, pl.pos, pl.color, pl.facing, pl.swing || 0, pl.run));
    // Bola do lado de lá da rede é desenhada antes dela, para a malha passar na frente.
    const ballFar = v.ball && v.ball.z > NET;
    if (ballFar) drawBall(ctx, v.ball, v.trail);
    if (v.path && v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    drawNet(ctx);
    if (v.path && !v.path.far) drawPath(ctx, v.path.pts, v.path.color, v.path.dash, v.path.width);
    if (v.bounce && v.bounce.z <= NET) drawBounce(ctx, v.bounce);
    near.sort((a, b) => b.pos.z - a.pos.z).forEach((pl) => drawFigure(ctx, pl.pos, pl.color, pl.facing, pl.swing || 0, pl.run));
    if (v.ball && !ballFar) drawBall(ctx, v.ball, v.trail);
    drawVignette(ctx);
  }

  root.MoonRender = { draw, arcPoints, peakFor, COLORS, P };
})(typeof self !== 'undefined' ? self : this);
