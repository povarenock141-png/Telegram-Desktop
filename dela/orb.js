/* Шар AI «Галактика в стекле»: стеклянная сфера, внутри вращается спиральная галактика из света.
   Состояния: idle (ждёт), listen (слушает), think (думает), speak (говорит).
   GalaxyOrb(canvas, { energy, light }) → { set(state), light(bool), amp(fn), stop() } */
(function (root) {
  'use strict';
  function GalaxyOrb(canvas, opt) {
    opt = opt || {};
    var E = opt.energy || 1.2, LIGHT = !!opt.light, ext = null;
    var st = { s: 'idle', amp: 0, rot: 0, swirl: 0, t0: 0, last: 0, raf: 0 };
    var rnd = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })(7);
    var P = [], SP = [], ARMS = 6, i;
    for (i = 0; i < 520; i++) {
      var free = rnd() < 0.34, core = rnd() < 0.3;
      P.push({ arm: i % ARMS, r: free ? (core ? 0.04 + 0.3 * rnd() : 0.1 + 0.88 * Math.sqrt(rnd())) : Math.pow(rnd(), 0.9) * 1.02, j: (rnd() - 0.5) * 0.42, s: 0.5 + rnd() * 1.4,
        tw: rnd() * 6.28, blue: rnd() < 0.16, a0: rnd() * 6.28, free: free });
    }
    for (i = 0; i < 16; i++) SP.push({ a: rnd() * 6.28, r: 1.12 + rnd() * 0.38, s: 0.7 + rnd() * 1.2, tw: rnd() * 6.28, d: (rnd() - 0.5) * 0.25 });
    function armAngle(r, arm) { return st.rot + arm * 2 * Math.PI / ARMS + (2.2 + st.swirl * 1.8) * Math.pow(r, 0.85); }
    function frame(now) {
      st.raf = requestAnimationFrame(frame);
      var cssW = canvas.clientWidth; if (!cssW) return;
      var dpr = Math.min(2, root.devicePixelRatio || 1), px = Math.round(cssW * dpr);
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
      var g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var W = cssW, C = W / 2, R = W * 0.33;
      if (!st.t0) st.t0 = now;
      var t = (now - st.t0) / 1000, dt = Math.min(0.05, (now - (st.last || now)) / 1000); st.last = now;
      var s = st.s;
      var target = s === 'listen' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 3.4) * Math.sin(t * 1.9 + 1))
        : s === 'speak' ? (ext ? ext() : 0.3 + 0.7 * Math.abs(Math.sin(t * 6.8)) * (0.6 + 0.4 * Math.sin(t * 1.4)))
        : s === 'think' ? 0.5 : 0.12;
      st.amp += (target - st.amp) * 0.18;
      var amp = Math.min(1.5, st.amp * E);
      st.rot += dt * { idle: 0.22, listen: 0.45, think: 2.6, speak: 0.4 }[s] * E;
      st.swirl += ((s === 'think' ? 1 : 0) - st.swirl) * 0.06;
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.6 * E);
      var Rb = R * (1 + (s === 'listen' ? amp * 0.05 : 0) + 0.01 * pulse);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.clearRect(0, 0, W, W);

      if (LIGHT) { var sh = g.createRadialGradient(C, C + Rb * 1.12, 2, C, C + Rb * 1.12, Rb * 0.9); sh.addColorStop(0, 'rgba(28,26,58,.22)'); sh.addColorStop(1, 'rgba(28,26,58,0)'); g.save(); g.translate(0, C + Rb * 1.12); g.scale(1, 0.18); g.translate(0, -(C + Rb * 1.12)); g.fillStyle = sh; g.beginPath(); g.arc(C, C + Rb * 1.12, Rb * 0.9, 0, Math.PI * 2); g.fill(); g.restore(); }
      /* стекло изнутри: на светлой теме — тёмный «космос», чтобы свет читался на бумаге */
      var gi = g.createRadialGradient(C - Rb * 0.25, C - Rb * 0.3, Rb * 0.1, C, C, Rb);
      if (LIGHT) { gi.addColorStop(0, '#34476A'); gi.addColorStop(1, '#1A2333'); }
      else { gi.addColorStop(0, 'rgba(140,180,230,.07)'); gi.addColorStop(0.8, 'rgba(140,180,230,.10)'); gi.addColorStop(1, 'rgba(170,205,245,.22)'); }
      g.fillStyle = gi; g.beginPath(); g.arc(C, C, Rb, 0, Math.PI * 2); g.fill();
      

      g.globalCompositeOperation = 'lighter';
      /* мягкое свечение ядра */
      var ga = g.createRadialGradient(C, C, 0, C, C, Rb * 1.05);
      ga.addColorStop(0, 'rgba(255,175,85,' + (0.42 + 0.18 * pulse + amp * 0.2) + ')');
      ga.addColorStop(0.35, 'rgba(255,140,60,.14)'); ga.addColorStop(1, 'rgba(255,120,50,0)');
      g.fillStyle = ga; g.beginPath(); g.arc(C, C, Rb * 1.05, 0, Math.PI * 2); g.fill();

      /* рукава галактики */
      var sg = g.createRadialGradient(C, C, 0, C, C, Rb * 1.12);
      sg.addColorStop(0, 'rgba(255,245,215,1)'); sg.addColorStop(0.45, 'rgba(255,185,95,.9)');
      sg.addColorStop(0.9, 'rgba(255,150,70,.35)'); sg.addColorStop(1, 'rgba(255,150,70,0)');
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (var a = 0; a < ARMS; a++) {
        for (var pass = 0; pass < 3; pass++) {
          var off = pass === 2 ? 0.16 : 0;
          g.beginPath();
          var lenMax = s === 'speak' ? 1.0 + amp * 0.12 : 1.1;
          for (var r = 0.03; r <= lenMax; r += 0.018) {
            var th = armAngle(r, a) + off;
            if (s === 'listen' || s === 'speak') th += Math.sin(r * 11 - t * 8) * amp * 0.05;
            var rr = r * Rb, x = C + Math.cos(th) * rr, y = C + Math.sin(th) * rr;
            if (r === 0.03) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.strokeStyle = sg;
          if (pass === 0) { g.globalAlpha = 0.16 + amp * 0.08; g.lineWidth = 7; }
          else if (pass === 1) { g.globalAlpha = 0.85; g.lineWidth = 1.4; }
          else { g.globalAlpha = 0.35; g.lineWidth = 0.8; }
          g.stroke();
        }
      }
      /* искры внутри: по рукавам и россыпью, внутренние быстрее */
      for (var k = 0; k < P.length; k++) {
        var p = P[k], pr = p.r * (1 + (s === 'listen' ? amp * 0.08 * Math.sin(p.tw + t * 6) : 0));
        var ang = p.free ? p.a0 + st.rot * (1.7 - p.r) + t * 0.15 * E : armAngle(p.r, p.arm) + p.j + t * 0.25 * (1 - p.r) * E;
        var qx = C + Math.cos(ang) * pr * Rb, qy = C + Math.sin(ang) * pr * Rb;
        if (pr > 0.97) continue;
        var tw = 0.55 + 0.45 * Math.sin(t * 3 * E + p.tw);
        g.globalAlpha = tw * (0.35 + 0.65 * (1 - p.r * 0.6));
        g.fillStyle = p.blue ? '#CFE6FF' : '#FFC274';
        var sz = p.s * (0.7 + 0.5 * (1 - p.r));
        g.fillRect(qx - sz / 2, qy - sz / 2, sz, sz);
      }
      /* ядро */
      var bl = g.createRadialGradient(C, C, 0, C, C, Rb * 0.45);
      bl.addColorStop(0, 'rgba(255,220,150,' + (0.55 + 0.2 * pulse + amp * 0.25) + ')'); bl.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = bl; g.beginPath(); g.arc(C, C, Rb * 0.45, 0, Math.PI * 2); g.fill();
      var cr = Rb * (0.2 + 0.03 * pulse + (s === 'speak' ? amp * 0.1 : 0) + (s === 'think' ? 0.04 : 0));
      var gc = g.createRadialGradient(C, C, 0, C, C, cr);
      gc.addColorStop(0, 'rgba(255,255,245,1)'); gc.addColorStop(0.3, 'rgba(255,225,160,.9)'); gc.addColorStop(1, 'rgba(255,160,70,0)');
      g.globalAlpha = 1; g.fillStyle = gc; g.beginPath(); g.arc(C, C, cr, 0, Math.PI * 2); g.fill();
      /* «говорю»: кольца-импульсы внутри стекла */
      if (s === 'speak') {
        for (var w = 0; w < 2; w++) {
          var ph = ((t * 1.4 * E) + w / 2) % 1;
          g.globalAlpha = (1 - ph) * 0.5 * Math.min(1, amp + 0.2); g.strokeStyle = 'rgba(255,190,110,1)'; g.lineWidth = 1.2;
          g.beginPath(); g.arc(C, C, Rb * (0.2 + ph * 0.78), 0, Math.PI * 2); g.stroke();
        }
      }
      /* «думаю»: светящаяся дуга бежит по стеклу */
      if (s === 'think') {
        g.globalAlpha = 0.8; g.strokeStyle = 'rgba(255,200,130,1)'; g.lineWidth = 2;
        var a0 = t * 3.4 * E; g.beginPath(); g.arc(C, C, Rb + 0.5, a0, a0 + 0.9); g.stroke();
      }
      /* искры снаружи */
      for (var q = 0; q < SP.length; q++) {
        var sp = SP[q]; sp.a += sp.d * dt * E * (s === 'think' ? 4 : 1);
        var sr = sp.r * Rb * (s === 'listen' ? 1 - amp * 0.08 : 1) + Math.sin(t * 0.8 + sp.tw) * 3;
        var sx = C + Math.cos(sp.a) * sr, sy = C + Math.sin(sp.a) * sr;
        var al = 0.45 + 0.55 * Math.sin(t * 2.2 + sp.tw);
        if (al < 0.05) continue;
        var gs = g.createRadialGradient(sx, sy, 0, sx, sy, 5 * sp.s);
        gs.addColorStop(0, LIGHT ? 'rgba(230,130,40,' + al + ')' : 'rgba(255,200,120,' + al + ')'); gs.addColorStop(1, 'rgba(255,160,70,0)');
        g.globalAlpha = 1; g.fillStyle = gs; g.beginPath(); g.arc(sx, sy, 5 * sp.s, 0, Math.PI * 2); g.fill();
      }

      /* край стекла и блик */
      g.globalCompositeOperation = 'source-over';
      var rim = g.createLinearGradient(C - Rb, C - Rb, C + Rb, C + Rb);
      rim.addColorStop(0, 'rgba(225,240,255,.95)'); rim.addColorStop(0.55, 'rgba(160,200,240,.35)'); rim.addColorStop(1, 'rgba(255,190,120,.8)');
      g.globalAlpha = 1; g.strokeStyle = rim; g.lineWidth = 1.8; g.beginPath(); g.arc(C, C, Rb, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.25; g.lineWidth = 1; g.strokeStyle = 'rgba(200,225,255,1)'; g.beginPath(); g.arc(C, C, Rb - 4, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineCap = 'round';
      g.globalAlpha = 0.14; g.lineWidth = 7; g.beginPath(); g.arc(C, C, Rb - 7, Math.PI * 1.08, Math.PI * 1.45); g.stroke();
      g.globalAlpha = 0.6; g.lineWidth = 2; g.beginPath(); g.arc(C, C, Rb - 7, Math.PI * 1.12, Math.PI * 1.38); g.stroke();
      g.globalAlpha = 1;
    }
    st.raf = requestAnimationFrame(frame);
    return {
      set: function (s) { st.s = s === 'listen' || s === 'think' || s === 'speak' ? s : 'idle'; },
      light: function (v) { LIGHT = !!v; },
      amp: function (fn) { ext = fn; },
      stop: function () { cancelAnimationFrame(st.raf); }
    };
  }
  root.GalaxyOrb = GalaxyOrb;
})(window);
