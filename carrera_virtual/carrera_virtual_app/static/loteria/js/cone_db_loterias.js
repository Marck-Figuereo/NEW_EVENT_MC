/* =====================================================================
   ADAPTADOR DE DATOS · VISOR LOTERÍAS
   ---------------------------------------------------------------------
   Dos fuentes:
     1) API real (VISOR_CONFIG.api.url)            -> producción
     2) Simulador local (?test=1 o api.url = null) -> diseño / pruebas

   El resto del visor solo ve esto:
     VisorDatos.obtener() -> Promise<{
        servidor: Date | null,
        resultados: { [id]: { fecha: 'YYYY-MM-DD', numeros: ['07','19','26'], extras?: {mas:'05'} } }
     }>
   Un id por sorteo/modalidad, con el ÚLTIMO resultado que exista
   (si la fecha es hoy = RESULTADO; si es anterior se muestra como "anterior").

   Marcas: // >>> AJUSTAR CONTRATO
   ===================================================================== */
(function () {
  var params = new URLSearchParams(location.search);

  /* ---------------- Tiempo del visor ----------------
     ?hora=14:25        simula esa hora (el reloj sigue corriendo)
     ?fecha=2026-10-21  simula ese día
     server_time de la API corrige el reloj de la TV. */
  var desfase = 0;
  (function () {
    var h = params.get('hora'), f = params.get('fecha');
    if (!h && !f) return;
    var real = new Date(), sim = new Date(real.getTime());
    if (f) { var p = f.split('-'); sim.setFullYear(+p[0], +p[1] - 1, +p[2]); }
    if (h) { var q = h.split(':'); sim.setHours(+q[0], +(q[1] || 0), +(q[2] || 0), 0); }
    desfase = sim.getTime() - real.getTime();
  })();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  window.VisorTiempo = {
    ahora: function () { return new Date(Date.now() + desfase); },
    hoy: function () { return iso(this.ahora()); },
    iso: iso,
    pad: pad,
    sincronizar: function (serverDate) {
      if (params.get('hora') || params.get('fecha')) return; // la simulación manda
      var d = serverDate.getTime() - Date.now();
      if (Math.abs(d - desfase) > 2000) desfase = d;
    },
    /** 'HH:MM' en el día `base` -> Date */
    enDia: function (hhmm, base) {
      var p = hhmm.split(':'), d = new Date(base.getTime());
      d.setHours(+p[0], +p[1], 0, 0); return d;
    }
  };

  var cfg = window.VISOR_CONFIG || {};
  var modoPrueba = params.get('test') === '1' || !(cfg.api && cfg.api.url);

  /* ---------------- 1) API real ---------------- */
  function desdeApi() {
    // >>> AJUSTAR CONTRATO: ruta, método y forma de la respuesta.
    // Respuesta propuesta:
    // {
    //   "server_time": "2026-10-23T14:35:10-04:00",
    //   "resultados": [
    //     { "id": "NN",   "fecha": "2026-10-22", "numeros": ["64","34","50"] },
    //     { "id": "LOTO", "fecha": "2026-10-21", "numeros": ["03","11","17","22","30","36"],
    //       "extras": { "mas": "05", "super_mas": "11" } }
    //   ]
    // }
    return fetch(cfg.api.url, { method: cfg.api.metodo || 'GET', credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var out = { servidor: j.server_time ? new Date(j.server_time) : null, resultados: {} };
        (j.resultados || []).forEach(function (r) {
          out.resultados[r.id] = {
            fecha: r.fecha,
            numeros: (r.numeros || []).map(function (n) { return pad(+n); }),
            extras: r.extras || null
          };
        });
        return out;
      });
  }

  /* ---------------- 2) Simulador ----------------
     Genera resultados estables por (id, fecha). Un sorteo "sale" 3 min
     después de su hora, así se ven los estados PRÓXIMO -> ESPERANDO -> RESULTADO. */
  var RETRASO_MIN = 3;

  function semilla(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function distintos(rnd, n, min, max) {
    var s = [], g = 0;
    while (s.length < n && g++ < 500) { var v = min + Math.floor(rnd() * (max - min + 1)); if (s.indexOf(v) < 0) s.push(v); }
    return s;
  }
  function horaDe(s, dia) { return ((dia.getDay() === 0 && s.hora_dom) ? s.hora_dom : s.hora) || s.cierre; }

  function simular() {
    var cat = window.VISOR_CATALOGO, ahora = VisorTiempo.ahora(), out = { servidor: null, resultados: {} };

    function ultimoDia(item, diasValidos) {
      for (var k = 0; k < 8; k++) {
        var d = new Date(ahora.getTime()); d.setDate(d.getDate() - k);
        if (diasValidos && diasValidos.indexOf(d.getDay()) < 0) continue;
        var sale = VisorTiempo.enDia(horaDe(item, d), d); sale.setMinutes(sale.getMinutes() + RETRASO_MIN);
        if (ahora >= sale) return d;
      }
      return null;
    }

    cat.casas.forEach(function (casa) {
      casa.sorteos.forEach(function (s) {
        var d = ultimoDia(s); if (!d) return;
        var f = iso(d), rnd = semilla(s.id + f);
        out.resultados[s.id] = { fecha: f, numeros: distintos(rnd, 3, 0, 99).map(pad) };
      });
    });
    cat.modalidades.forEach(function (m) {
      var d = ultimoDia(m, m.dias); if (!d) return;
      var f = iso(d), rnd = semilla(m.id + f);
      var nums = distintos(rnd, m.cantidad, m.rango[0], m.rango[1]);
      if (m.tipo === 'kino' || m.tipo === 'loto') nums.sort(function (a, b) { return a - b; });
      var r = { fecha: f, numeros: nums.map(pad) };
      if (m.extras) { r.extras = {}; m.extras.forEach(function (e) { r.extras[e.clave] = pad(distintos(rnd, 1, e.rango[0], e.rango[1])[0]); }); }
      out.resultados[m.id] = r;
    });
    return Promise.resolve(out);
  }

  window.VisorDatos = {
    modoPrueba: modoPrueba,
    obtener: function () {
      if (modoPrueba) return simular();
      return desdeApi().then(function (d) {
        if (d.servidor && !isNaN(d.servidor)) VisorTiempo.sincronizar(d.servidor);
        return d;
      });
    }
  };
})();
