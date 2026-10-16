/* Шар AI «D-спираль»: сфера из точек, соединённых одной спиральной линией, вокруг шкала-эквалайзер.
   Состояния: idle (ждёт), listen (слушает), think (думает), speak (говорит).
   AIOrb(canvas, { energy, light }) → { set(state), light(bool), amp(fn), stop() } */
(function (root) {
  'use strict';
  function AIOrb(canvas, opt) {
    opt = opt || {};
    var E = opt.energy || 1.3, LIGHT = !!opt.light, ext = null;
    var st = { s: 'idle', amp: 0, rot: 0, band: 0, t0: 0, last: 0, raf: 0 };
    var N = opt.points || 620, P = [], i;
    for (i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 0.21;
      P.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, lat: Math.asin(y), hot: i % 27 === 0, tw: (i * 0.618) % 6.283, bx: 0, by: 0, d: 0 });
    }
    function frame(now) {
      st.raf = requestAnimationFrame(frame);
      var cssW = canvas.clientWidth; if (!cssW) return;
      var dpr = Math.min(2, root.devicePixelRatio || 1), px = Math.round(cssW * dpr);
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
      var g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var W = cssW, C = W / 2, R = W * 0.3;
      var INK = LIGHT ? '28,26,58' : '236,232,218', ACC = LIGHT ? '#6E6E22' : '#C9C96A', INKC = LIGHT ? '#1C1A3A' : '#ECE8DA';
      if (!st.t0) st.t0 = now;
      var t = (now - st.t0) / 1000, dt = Math.min(0.05, (now - (st.last || now)) / 1000); st.last = now;
      var s = st.s;
      var target = s === 'listen' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 3.4) * Math.sin(t * 1.9 + 1))
        : s === 'speak' ? ((ext && ext()) || 0.3 + 0.7 * Math.abs(Math.sin(t * 6.8)) * (0.6 + 0.4 * Math.sin(t * 1.4)))
        : s === 'think' ? 0.45 : 0.12;
      st.amp += (target - st.amp) * 0.18;
      var amp = Math.min(1.6, st.amp * E);
      st.rot += dt * { idle: 0.45, listen: 0.9, think: 2.6, speak: 0.7 }[s] * E;
      st.band += ((s === 'think' ? 1 : 0) - st.band) * 0.08;
      var Rb = R * (1 + 0.03 * Math.sin(t * 1.4 * E) + (s === 'listen' ? amp * 0.07 : 0));
      var cr = Math.cos(st.rot), sr = Math.sin(st.rot), ct = Math.cos(0.36), sn = Math.sin(0.36);
      g.clearRect(0, 0, W, W); g.lineCap = 'round';
      /* шкала вокруг: в «слушаю» и «говорю» — эквалайзер */
      var r1 = R * 1.42;
      for (var q = 0; q < 72; q++) {
        var a = q / 72 * Math.PI * 2 - Math.PI / 2;
        var lvl = (s === 'listen' || s === 'speak') ? amp * (0.3 + 0.7 * Math.abs(Math.sin(q * 0.9 + t * (s === 'speak' ? 10 : 6)))) : 0;
        var r2 = r1 + (q % 6 === 0 ? 6 : 3) + lvl * 12;
        g.lineWidth = q % 6 === 0 ? 1.3 : 0.8;
        g.strokeStyle = lvl > 0.75 ? ACC : 'rgba(' + INK + ',' + (q % 6 === 0 ? 0.7 : 0.35) + ')';
        g.beginPath(); g.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); g.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2); g.stroke();
      }
      if (s === 'think') {
        g.strokeStyle = ACC; g.lineWidth = 1.8; g.globalAlpha = 0.9;
        for (var z = 0; z < 2; z++) { var a0 = t * 3 * E + z * Math.PI; g.beginPath(); g.arc(C, C, R * 1.32, a0, a0 + 0.8); g.stroke(); }
        g.globalAlpha = 1;
      }
      /* точки спирали */
      var band = st.band;
      for (var j = 0; j < N; j++) {
        var p = P[j], X = p.x, Y = p.y, Z = p.z;
        if (band > 0.01) { var qy = Math.round(Y * 6) / 6; Y += (qy - Y) * band * 0.85; }
        var d = 0;
        if (s === 'listen') d = amp * 0.22 * Math.sin(p.x * 5 + t * 5) * Math.sin(p.y * 6 - t * 4);
        else if (s === 'speak') d = amp * 0.24 * Math.sin(p.lat * 6 - t * 10);
        else d = 0.03 * Math.sin(p.lat * 4 - t * 1.6 * E);
        X *= 1 + d; Y *= 1 + d; Z *= 1 + d;
        var x1 = X * cr - Z * sr, z1 = X * sr + Z * cr;
        var y2 = Y * ct - z1 * sn, z2 = Y * sn + z1 * ct;
        p.bx = C + x1 * Rb; p.by = C - y2 * Rb; p.d = Math.max(0, Math.min(1, (z2 + 1) / 2));
      }
      g.lineWidth = 0.8;
      for (var w = 1; w < N; w++) {
        var A = P[w - 1], B = P[w];
        g.strokeStyle = 'rgba(' + INK + ',' + (0.05 + 0.4 * B.d * B.d).toFixed(3) + ')';
        g.beginPath(); g.moveTo(A.bx, A.by); g.lineTo(B.bx, B.by); g.stroke();
      }
      for (var h = 0; h < N; h++) {
        var Q = P[h], twk = 0.75 + 0.25 * Math.sin(t * 4 * E + Q.tw);
        g.globalAlpha = (0.1 + 0.9 * Q.d) * twk;
        g.fillStyle = Q.hot ? ACC : INKC;
        var sz = (Q.hot ? 1.5 : 0.75) + 1.5 * Q.d;
        g.fillRect(Q.bx - sz / 2, Q.by - sz / 2, sz, sz);
      }
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
  root.AIOrb = AIOrb;
})(window);
