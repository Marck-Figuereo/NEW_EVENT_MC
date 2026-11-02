/* =====================================================================
   VISOR TV · LOTERÍAS — funcionamiento
   ---------------------------------------------------------------------
   Escenas que rotan:  QUINIELAS (n páginas) -> MODALIDADES -> HORARIOS
   Capas:              RESULTADO NUEVO (cuando entra un sorteo)
                       JUGADA QR (cuando un cliente genera números)

   API pública para integrar (WebSocket / Django):
     VisorTV.mostrarJugada({ nombre: 'Marck', numeros: [37, 9, 49], loteria: 'nacional' })
     VisorTV.anunciarResultado('NN')        // fuerza la pantalla de resultado
     VisorTV.recargar()                     // vuelve a pedir datos

   Parámetros de URL:
     ?test=1            datos simulados (por defecto si no hay api.url)
     ?hora=20:40        simula la hora   ?fecha=2026-10-21  simula el día
     ?escena=horarios   fija una escena (quinielas | modalidades | horarios)
     ?pagina=2          con escena=quinielas, fija la página
     ?demo=1            lanza resultados y jugadas de ejemplo solos
   Teclado: ← → escenas · R resultado · J jugada
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.VISOR_CONFIG, CAT = window.VISOR_CATALOGO, T = window.VisorTiempo, D = window.VisorDatos;
  var params = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };

  var DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  var DIAS_LARGOS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var PREMIOS = ['1ER PREMIO', '2DO PREMIO', '3ER PREMIO'];

  /* ------------------------------------------------------------------ iconos */
  var IC = {
    dia: '<svg class="ic-dia" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
    tarde: '<svg class="ic-tarde" viewBox="0 0 24 24"><path d="M5 16a7 7 0 0 1 14 0z" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 19.5h20M12 4v2.5M4.2 8.6l1.7 1.5M19.8 8.6l-1.7 1.5"/></g></svg>',
    noche: '<svg class="ic-noche" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="currentColor"/></svg>',
    corona: '<svg viewBox="0 0 32 32"><path d="M4 11l6 5 6-9 6 9 6-5-2.5 13h-19z" fill="currentColor"/><rect x="6.5" y="25.5" width="19" height="3" rx="1.2" fill="currentColor"/></svg>',
    antorcha: '<svg viewBox="0 0 32 32"><path d="M16 2c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 2 1.2 3 2.2 3.3C14.5 7.5 15 5 16 2z" fill="currentColor"/><path d="M10.5 15.5h11l-2.5 4h-6z" fill="currentColor"/><rect x="14" y="19.5" width="4" height="10" rx="1.5" fill="currentColor"/></svg>',
    palma: '<svg viewBox="0 0 32 32"><path d="M16.5 13c-1 5-1.2 10-.5 17h-3c-.4-6 .2-11.5 1.6-17z" fill="currentColor"/><path d="M15 13C12 7 6 7 3 10c4-.5 7 .5 9.5 3.5C9 12 5.5 13.5 4 17c3-2.5 7-3.5 10.5-3zM16 13c2-6 8-7.5 12-5-4 0-7 1.5-9.5 4.5 3.5-1 7 .5 9 3.5-3-1.5-7-2-11.5-2z" fill="currentColor"/></svg>',
    isla: '<svg viewBox="0 0 32 32"><circle cx="21" cy="10" r="5" fill="currentColor"/><path d="M2 21c3-2 5-2 7 0s4 2 7 0 4-2 7 0 4 2 7 0M2 27c3-2 5-2 7 0s4 2 7 0 4-2 7 0 4 2 7 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };


  /* ------------------------------------------------------------------ utilidades */
  function rgb(hex) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    return parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hora12(hhmm) {
    var p = hhmm.split(':'), h = +p[0], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + p[1] + ' ' + ap;
  }
  function fechaCorta(iso) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return DIAS[d.getDay()] + ' ' + (+p[2]) + ' ' + MESES[d.getMonth()]; }
  function cuenta(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + T.pad(m) : m) + ':' + T.pad(x);
  }
  function horarioDe(item, dia) {
    var dom = dia.getDay() === 0;
    var c = (dom && item.cierre_dom) || item.cierre, h = (dom && item.hora_dom) || item.hora || c;
    return { cierreTxt: c, horaTxt: h, sinHora: !item.hora, cierre: T.enDia(c, dia), hora: T.enDia(h, dia) };
  }
  /** 'Loteka Noche' en vez de 'Loteka · Loteka Noche'; 'Nacional · Noche' cuando hace falta la casa. */
  function nombreCorto(o) {
    var c = o.casa.nombre, s = o.s.nombre, sl = s.toLowerCase(), pal = c.toLowerCase().split(' ');
    var siglas = pal.map(function (p) { return p[0]; }).join('');
    var dice = pal.some(function (p) { return p.length > 2 && sl.indexOf(p) >= 0; }) || sl.split(' ')[0] === siglas;
    return dice ? s : c + ' · ' + s;
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function bolasHtml(nums, color, extraCls) {
    return '<div class="bolas ' + (extraCls || '') + '">' + nums.map(function (n, i) {
      return '<div class="bola b-' + color + '" style="--n:' + i + '"><span>' + esc(n) + '</span></div>';
    }).join('') + '</div>';
  }
  function placaHtml(item) {
    if (item.logo) {
      var f = item.logo_fondo || 'claro', cls = f === 'oscuro' ? 'oscuro' : f === 'claro' ? '' : 'color';
      return '<div class="placa ' + cls + '"' + (cls === 'color' ? ' style="--placa:' + f + '"' : '') + '><img src="' + item.logo + '" alt=""></div>';
    }
    var em = item.emblema || {};
    return '<div class="emblema">' + (IC[em.icono] || '<b style="font-size:24px">' + esc(em.texto || item.nombre[0]) + '</b>') + '</div>';
  }

  /* ------------------------------------------------------------------ índice de sorteos */
  var CASAS = CAT.casas, MODS = CAT.modalidades, SORTEOS = [], POR_ID = {};
  CASAS.forEach(function (c) {
    c.sorteos.forEach(function (s) { var o = { tipo: 'quiniela', casa: c, s: s, id: s.id }; SORTEOS.push(o); POR_ID[s.id] = o; });
  });
  MODS.forEach(function (m) { POR_ID[m.id] = { tipo: 'modalidad', casa: null, s: m, m: m, id: m.id }; });

  /* ------------------------------------------------------------------ estado */
  var datos = { resultados: {} }, primeraCarga = true, vistos = {}, ultimaCarga = null;

  /** Estado de un sorteo o modalidad para el día de hoy. */
  function estadoDe(id, ahora) {
    var o = POR_ID[id], item = o.s, res = datos.resultados[id] || null, hoy = T.iso(ahora);
    var juegaHoy = !item.dias || item.dias.indexOf(ahora.getDay()) >= 0;
    var hz = horarioDe(item, ahora);
    var e = { id: id, item: item, res: res, hz: hz, hoy: hoy, juegaHoy: juegaHoy };
    if (res && res.fecha === hoy) e.estado = 'resultado';
    else if (!juegaHoy) { e.estado = 'libre'; e.proxDia = proximoDia(item, ahora); }
    else if (ahora < hz.cierre) { e.estado = 'proximo'; e.falta = hz.cierre - ahora; }
    else e.estado = 'esperando';
    return e;
  }
  function proximoDia(item, ahora) {
    for (var k = 1; k <= 7; k++) { var d = new Date(ahora.getTime()); d.setDate(d.getDate() + k); if (item.dias.indexOf(d.getDay()) >= 0) return d; }
    return null;
  }
  function chipDe(e) {
    if (e.estado === 'resultado') return { cls: 'chip chip-resultado', txt: 'RESULTADO' };
    if (e.estado === 'esperando') return { cls: 'chip chip-esperando', txt: 'ESPERANDO' };
    if (e.estado === 'libre') return { cls: 'chip chip-libre', txt: 'PRÓXIMO ' + (e.proxDia ? DIAS[e.proxDia.getDay()] : '') };
    if (e.falta <= 60 * 60000) return { cls: 'chip chip-cierra' + (e.falta <= 5 * 60000 ? ' urgente' : ''), txt: 'CIERRA EN ' + cuenta(e.falta) };
    return { cls: 'chip chip-proximo', txt: 'CIERRE ' + hora12(e.hz.cierreTxt) };
  }
  function vistaBolas(e, cantidad) {
    var vacia = []; for (var i = 0; i < cantidad; i++) vacia.push('--');
    if (e.estado === 'resultado') return { nums: e.res.numeros, cls: '' };
    if (e.estado === 'esperando' || !e.res) return { nums: vacia, cls: 'vacia' };
    return { nums: e.res.numeros, cls: 'anterior' };
  }

  /* ------------------------------------------------------------------ escenas */
  var escenasEl = $('escenas'), ESCENAS = [], celdas = [], modCeldas = [];

  /** Páginas por grupo (dominicanas, más, internacionales); cada página tiene 12 espacios (normal 2, ancha 3). */
  function paginarCasas() {
    var paginas = [], actual = null, usado = 0, grupos = CAT.grupos || {};
    CASAS.forEach(function (c) {
      var peso = c.ancho ? 3 : 2, g = c.grupo || '';
      if (!actual || actual.grupo !== g || usado + peso > 12) {
        actual = { grupo: g, titulo: grupos[g] || 'Quinielas', casas: [] }; paginas.push(actual); usado = 0;
      }
      actual.casas.push(c); usado += peso;
    });
    return paginas;
  }

  function tarjetaCasa(casa, i, alta) {
    var n = casa.sorteos.length, ancha = !!casa.ancho;
    var t = el('div', 'tarjeta ' + (ancha ? 'ancha celdas-' + n : 'filas-' + n) + (alta ? ' alta' : '') + (casa.fondo ? ' con-fondo' : ''));
    t.style.setProperty('--ac', rgb(casa.acento)); t.style.setProperty('--i', i);
    var cols = ancha && n > 1 ? 2 : 1, filas = Math.ceil(n / cols);
    t.innerHTML = (casa.fondo ? '<div class="tarjeta-fondo" style="background-image:url(' + casa.fondo + ')' + (casa.fondo_pos ? ';background-position:' + casa.fondo_pos : '') + '"></div>' : '') +
      '<div class="tarjeta-brillo"></div>' +
      '<div class="t-cab">' + placaHtml(casa) + '<div><div class="t-nombre">' + esc(casa.nombre) + '</div>' +
      '<div class="t-sub">Quiniela · ' + n + (n === 1 ? ' sorteo' : ' sorteos') + '</div></div></div>';
    var cuerpo = el('div', 't-cuerpo' + (cols === 2 ? ' cols-2' : ''));
    cuerpo.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0,1fr))';
    cuerpo.style.gridTemplateRows = 'repeat(' + filas + ', minmax(0,1fr))';
    casa.sorteos.forEach(function (s) {
      var apilado = ancha && filas === 1;
      var c = el('div', 'sorteo' + (apilado ? ' apilado' : ''));
      c.innerHTML = '<div class="s-top"><div class="s-nombre">' + (IC[s.momento] || '') + '<span>' + esc(s.nombre) + '</span></div><span class="chip"></span></div>' +
        '<div class="s-medio"><div class="s-bolas"></div><div class="s-meta"></div></div>';
      cuerpo.appendChild(c);
      celdas.push({ id: s.id, color: casa.bola, chip: c.querySelector('.chip'), bolas: c.querySelector('.s-bolas'), meta: c.querySelector('.s-meta'), firma: '' });
    });
    t.appendChild(cuerpo);
    return t;
  }

  function tarjetaModalidad(m, i) {
    var t = el('div', 'tarjeta modalidad ' + (m.ancho ? 'ancha ' : '') + (m.tipo === 'kino' ? 'kino ' : '') + 'n-' + m.cantidad);
    t.style.setProperty('--ac', rgb(m.acento)); t.style.setProperty('--i', i);
    var dias = m.dias.length === 7 ? 'Todos los días' : m.dias.map(function (d) { return DIAS[d]; }).join(' · ');
    t.innerHTML = '<div class="tarjeta-brillo"></div>' +
      '<div class="t-cab">' + placaHtml(m) + '<div style="min-width:0"><div class="t-nombre">' + esc(m.nombre) + '</div>' +
      '<div class="t-sub">' + esc(m.casa) + ' · ' + dias + '</div></div></div>' +
      '<div class="m-cuerpo"><div class="m-bolas-fila"></div><div class="m-pie"><div class="m-fecha"></div><span class="chip"></span></div></div>';
    modCeldas.push({ id: m.id, m: m, chip: t.querySelector('.chip'), bolas: t.querySelector('.m-bolas-fila'), meta: t.querySelector('.m-fecha'), firma: '' });
    return t;
  }

  function construir() {
    var paginas = paginarCasas();
    CFG.rotacion.forEach(function (r) {
      if (r.escena === 'quinielas') {
        paginas.forEach(function (pg, p) {
          var e = el('section', 'escena'), g = el('div', 'grilla'), casas = pg.casas;
          // Página con 1 o 2 casas normales: tarjetas a todo lo alto, con bolas grandes
          var alta = casas.length <= 2 && !casas.some(function (c) { return c.ancho; });
          casas.forEach(function (c, i) { g.appendChild(tarjetaCasa(c, i, alta)); });
          e.appendChild(g); escenasEl.appendChild(e);
          ESCENAS.push({ tipo: 'quinielas', pagina: p + 1, el: e, segundos: r.segundos,
            kicker: 'RESULTADOS DE HOY · QUINIELAS', titulo: pg.titulo });
        });
      } else if (r.escena === 'modalidades') {
        var e = el('section', 'escena'), g = el('div', 'grilla');
        MODS.forEach(function (m, i) { g.appendChild(tarjetaModalidad(m, i)); });
        e.appendChild(g); escenasEl.appendChild(e);
        ESCENAS.push({ tipo: 'modalidades', el: e, segundos: r.segundos, kicker: 'SORTEOS ESPECIALES', titulo: 'Kino, Loto, Pool y más' });
      } else if (r.escena === 'horarios') {
        var h = el('section', 'escena'); h.innerHTML = '<div class="horarios"><div class="h-panel"></div><div class="h-panel"></div></div>';
        escenasEl.appendChild(h);
        ESCENAS.push({ tipo: 'horarios', el: h, segundos: r.segundos, kicker: 'PROGRAMACIÓN DE HOY', titulo: 'Horarios de cierre y sorteo' });
      }
    });
    var pag = $('paginador');
    pag.innerHTML = ESCENAS.map(function () { return '<i><b></b></i>'; }).join('');
  }

  /* ------------------------------------------------------------------ pintar */
  function pintarCeldas(ahora) {
    celdas.forEach(function (c) {
      var e = estadoDe(c.id, ahora), ch = chipDe(e);
      if (c.chip.className !== ch.cls) c.chip.className = ch.cls;
      if (c.chip.textContent !== ch.txt) c.chip.textContent = ch.txt;
      var vb = vistaBolas(e, 3);
      var firma = e.estado + '|' + vb.cls + '|' + vb.nums.join(',');
      if (firma === c.firma) return;
      c.firma = firma;
      c.bolas.innerHTML = bolasHtml(vb.nums, c.color, vb.cls);
      var m2;
      if (e.estado === 'resultado') m2 = '<div class="m2 hoy">HOY · ' + fechaCorta(e.hoy) + '</div>';
      else if (e.estado === 'esperando') m2 = '<div class="m2">CERRÓ ' + hora12(e.hz.cierreTxt) + '</div>';
      else m2 = '<div class="m2">' + (e.res ? 'ANTERIOR · ' + fechaCorta(e.res.fecha) : 'SIN RESULTADO') + '</div>';
      c.meta.innerHTML = (e.hz.sinHora ? '<div class="m1">CIERRE<b>' + hora12(e.hz.cierreTxt) + '</b></div>'
                                      : '<div class="m1">SORTEO<b>' + hora12(e.hz.horaTxt) + '</b></div>') + m2;
    });
  }

  function pintarModalidades(ahora) {
    modCeldas.forEach(function (c) {
      var e = estadoDe(c.id, ahora), ch = chipDe(e), m = c.m;
      if (e.estado === 'libre' && e.proxDia) ch.txt = 'PRÓXIMO ' + DIAS[e.proxDia.getDay()] + ' ' + hora12(m.hora);
      if (c.chip.className !== ch.cls) c.chip.className = ch.cls;
      if (c.chip.textContent !== ch.txt) c.chip.textContent = ch.txt;
      var vb = vistaBolas(e, m.cantidad);
      var extras = m.extras && e.res && e.res.extras && vb.cls !== 'vacia' ? e.res.extras : null;
      var firma = e.estado + '|' + vb.cls + '|' + vb.nums.join(',') + '|' + (extras ? JSON.stringify(extras) : '');
      if (firma === c.firma) return;
      c.firma = firma;
      var html = bolasHtml(vb.nums, m.bola, vb.cls);
      if (m.extras) {
        html += '<div class="extras">' + m.extras.map(function (x, k) {
          var v = extras ? extras[x.clave] : '--';
          return '<div class="extra">' + bolasHtml([v], x.bola, vb.cls).replace('--n:0', '--n:' + (m.cantidad + k)) + '<small>' + x.etiqueta + '</small></div>';
        }).join('') + '</div>';
      }
      c.bolas.innerHTML = html;
      var f;
      if (e.estado === 'resultado') f = 'SORTEO DE HOY<b>' + hora12(e.hz.horaTxt) + '</b>';
      else if (e.res && vb.cls !== 'vacia') f = 'ÚLTIMO SORTEO<b>' + fechaCorta(e.res.fecha) + '</b>';
      else if (e.estado === 'esperando') f = 'SORTEO DE HOY<b>' + hora12(e.hz.horaTxt) + '</b>';
      else f = 'SORTEO<b>' + hora12(m.hora) + '</b>';
      c.meta.innerHTML = f;
    });
  }

  function filasHorario(ahora) {
    var lista = SORTEOS.map(function (o) { return { o: o, e: estadoDe(o.id, ahora), casa: o.casa.nombre, nombre: o.s.nombre, color: o.casa.bola, ac: o.casa.acento }; });
    MODS.forEach(function (m) {
      var e = estadoDe(m.id, ahora);
      if (e.juegaHoy) lista.push({ e: e, casa: m.casa, nombre: m.nombre, color: m.bola, ac: m.acento, mod: true });
    });
    lista.sort(function (a, b) { return a.e.hz.cierre - b.e.hz.cierre || a.e.hz.hora - b.e.hz.hora; });
    return lista;
  }

  function pintarHorarios(ahora) {
    var esc_ = ESCENAS.filter(function (x) { return x.tipo === 'horarios'; })[0];
    if (!esc_) return;
    var lista = filasHorario(ahora), cierreSig = null;
    // Las próximas en cerrar: todas las que comparten la primera hora de cierre pendiente
    for (var i = 0; i < lista.length; i++) if (lista[i].e.estado === 'proximo') { cierreSig = +lista[i].e.hz.cierre; break; }
    var mitad = Math.ceil(lista.length / 2), paneles = esc_.el.querySelectorAll('.h-panel');
    var cab = '<div class="h-fila h-cab"><span></span><span>LOTERÍA</span><span>CIERRE</span><span>SORTEO</span><span style="text-align:right">ESTADO</span></div>';
    [lista.slice(0, mitad), lista.slice(mitad)].forEach(function (parte, k) {
      var cuentas = [];
      var html = cab + parte.map(function (f) {
        var e = f.e, ch = chipDe(e), estado;
        var esSig = e.estado === 'proximo' && +e.hz.cierre === cierreSig;
        if (e.estado === 'resultado' && !f.mod) estado = bolasHtml(e.res.numeros, f.color);
        else if (e.estado === 'resultado') estado = '<span class="' + ch.cls + '">' + ch.txt + '</span>';
        else if (e.estado === 'proximo' && !esSig) estado = '<span class="chip chip-proximo">EN VENTA</span>';
        else if (e.estado === 'proximo') { cuentas.push(ch.txt); estado = '<span class="' + ch.cls + '" data-cd="1">@@CD@@</span>'; }
        else estado = '<span class="' + ch.cls + '">' + ch.txt + '</span>';
        var nombreCasa = f.mod ? f.nombre : f.casa, detalle = f.mod ? f.casa : f.nombre;
        var cls = 'h-fila' + (e.estado !== 'proximo' ? ' pasado' : '') + (esSig ? ' siguiente' : '');
        return '<div class="' + cls + '" style="--ac:' + rgb(f.ac) + '"><span class="h-barra"></span>' +
          '<div class="h-nombre">' + esc(nombreCasa) + '<small>' + esc(detalle) + '</small></div>' +
          '<div class="h-hora">' + hora12(e.hz.cierreTxt) + '</div><div class="h-hora tenue">' + (e.hz.sinHora ? '—' : hora12(e.hz.horaTxt)) + '</div>' +
          '<div class="h-estado">' + estado + '</div></div>';
      }).join('');
      // Solo se reconstruye si algo cambió (evita que las bolas parpadeen); la cuenta regresiva se actualiza en su sitio
      if (paneles[k]._firma !== html) {
        paneles[k]._firma = html;
        var c = 0; paneles[k].innerHTML = html.replace(/@@CD@@/g, function () { return cuentas[c++]; });
      } else {
        [].forEach.call(paneles[k].querySelectorAll('[data-cd]'), function (el_, n) { if (el_.textContent !== cuentas[n]) el_.textContent = cuentas[n]; });
      }
    });
  }

  function pintarPie(ahora) {
    var cands = [];
    [0, 1].forEach(function (k) {
      var dia = new Date(ahora.getTime()); dia.setDate(dia.getDate() + k);
      SORTEOS.forEach(function (o) { var hz = horarioDe(o.s, dia); if (hz.cierre > ahora) cands.push({ n: nombreCorto(o), t: hz.cierre, h: hz.hora, txt: hz.cierreTxt, man: k === 1 }); });
      MODS.forEach(function (m) { if (m.dias.indexOf(dia.getDay()) < 0) return; var hz = horarioDe(m, dia); if (hz.cierre > ahora) cands.push({ n: m.nombre, t: hz.cierre, h: hz.hora, txt: hz.cierreTxt, man: k === 1 }); });
    });
    cands.sort(function (a, b) { return a.t - b.t || (a.h || 0) - (b.h || 0); });
    var top = cands.slice(0, CFG.proximosCierresEnPie || 6), lista = $('pieLista');
    if (!top.length) { lista.innerHTML = '<div class="pie-vacio">No hay más cierres programados</div>'; return; }
    lista.innerHTML = top.map(function (c, i) {
      var primero = +c.t === +top[0].t;
      var falta = c.t - ahora, cd = primero && falta < 3 * 3600000 ? '<em>en ' + cuenta(falta) + '</em>' : '';
      return '<div class="pie-item' + (primero ? ' primero' : '') + '"><small>' + esc(c.n) + '</small><b>' + (c.man ? 'MAÑ ' : '') + hora12(c.txt) + cd + '</b></div>';
    }).join('');
  }

  /* ------------------------------------------------------------------ reloj y fondo */
  var fondoActivo = null, capaFondo = 0;
  function ponerFondo(nombre) {
    if (nombre === fondoActivo) return; fondoActivo = nombre;
    var capas = [$('fondoA'), $('fondoB')], nueva = capas[capaFondo = 1 - capaFondo], vieja = capas[1 - capaFondo];
    nueva.style.backgroundImage = 'url(' + (CFG.static || 'static/loterias/') + 'img/fondos/' + nombre + '.jpg)';
    nueva.classList.add('visible'); vieja.classList.remove('visible');
  }
  function fondoPorHora(ahora) { var h = ahora.getHours(); return h < 5 ? 'noche' : h < 12 ? 'dia' : h < 18 ? 'tarde' : 'noche'; }

  function pintarReloj(ahora) {
    var h = ahora.getHours(), ap = h >= 12 ? 'PM' : 'AM';
    $('relojHora').textContent = T.pad(h % 12 || 12) + ':' + T.pad(ahora.getMinutes());
    $('relojAmpm').textContent = ap;
    $('relojFecha').textContent = DIAS[ahora.getDay()] + '. ' + ahora.getDate() + ' ' + MESES[ahora.getMonth()] + ' ' + ahora.getFullYear();
  }

  /* ------------------------------------------------------------------ rotación */
  var idx = -1, timer = null, pausado = false;
  var fija = params.get('escena');

  function irA(i) {
    if (!ESCENAS.length) return;
    idx = (i + ESCENAS.length) % ESCENAS.length;
    var esc_ = ESCENAS[idx];
    ESCENAS.forEach(function (x) { x.el.classList.toggle('activa', x === esc_); });
    $('tituloKicker').textContent = esc_.kicker;
    $('tituloPrincipal').textContent = esc_.titulo;
    var ahora = T.ahora();
    ponerFondo(esc_.tipo === 'horarios' ? 'programado' : fondoPorHora(ahora));
    if (esc_.tipo === 'horarios') pintarHorarios(ahora);
    var dots = $('paginador').children, ms = esc_.segundos * 1000;
    for (var k = 0; k < dots.length; k++) {
      dots[k].className = k < idx ? 'hecho' : '';
      var b = dots[k].firstChild; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    }
    if (fija) { dots[idx].className = 'hecho'; return; }
    dots[idx].className = 'activo'; dots[idx].firstChild.style.animationDuration = ms + 'ms';
    clearTimeout(timer);
    if (!pausado) timer = setTimeout(function () { irA(idx + 1); }, ms);
  }
  function pausar() { pausado = true; clearTimeout(timer); var d = $('paginador').children[idx]; if (d) d.firstChild.style.animationPlayState = 'paused'; }
  function reanudar() { pausado = false; irA(idx); }

  /* ------------------------------------------------------------------ capas */
  var cola = [], enCapa = false;
  function encolar(x) { cola.push(x); if (!enCapa) siguienteCapa(); }
  function siguienteCapa() {
    var x = cola.shift();
    if (!x) { enCapa = false; reanudar(); return; }
    if (x.tipo === 'resultado') {
      // Todos los resultados que esperan salen juntos en la misma pantalla
      var ids = x.ids.slice();
      cola = cola.filter(function (y) { if (y.tipo !== 'resultado') return true; y.ids.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); return false; });
      x = pantallaResultados(ids);
      if (!x) { siguienteCapa(); return; }
    }
    enCapa = true; pausar();
    var capa = x.tipo === 'jugada' ? $('capaJugada') : $('capaResultado');
    capa.innerHTML = x.html; capa.className = 'capa activa';
    if (x.alMostrar) x.alMostrar(capa);
    setTimeout(function () {
      capa.className = 'capa activa saliendo';
      setTimeout(function () { capa.className = 'capa'; capa.innerHTML = ''; siguienteCapa(); }, 500);
    }, x.segundos * 1000);
  }

  /** Pide anunciar un resultado. Los que llegan casi a la vez (1.5 s) se juntan en una sola pantalla. */
  var porAnunciar = [], timerAnuncio = null;
  function anunciarResultado(id) {
    if (!POR_ID[id] || !datos.resultados[id] || porAnunciar.indexOf(id) >= 0) return;
    porAnunciar.push(id);
    clearTimeout(timerAnuncio);
    timerAnuncio = setTimeout(function () { var ids = porAnunciar; porAnunciar = []; encolar({ tipo: 'resultado', ids: ids }); }, 1500);
  }

  function datosResultado(id) {
    var o = POR_ID[id], res = datos.resultados[id];
    if (!o || !res) return null;
    var item = o.s;
    return { o: o, res: res, item: item, casa: o.casa || item, color: o.casa ? o.casa.bola : item.bola, ac: rgb((o.casa || item).acento),
      nombre: o.casa ? o.casa.nombre : item.nombre, sub: o.casa ? item.nombre : item.casa,
      hora: item.hora ? hora12(item.hora) : 'cierre ' + hora12(item.cierre) };
  }

  function pantallaResultados(ids) {
    var lista = ids.map(datosResultado).filter(Boolean);
    if (!lista.length) return null;
    var seg = CFG.segundosResultadoNuevo || 12;
    if (lista.length === 1) {
      var r = lista[0], nums = r.res.numeros, grande = nums.length > 3;
      var etq = r.o.tipo === 'quiniela' ? '<div class="spot-etq">' + PREMIOS.map(function (p) { return '<span>' + p + '</span>'; }).join('') + '</div>' : '';
      return { tipo: 'resultado', segundos: seg,
        html: '<div class="rayos" style="--ac:' + r.ac + '"></div><div class="spot" style="--ac:' + r.ac + '">' +
          '<div class="spot-kicker">¡NUEVO RESULTADO!</div>' +
          '<div class="spot-cab">' + placaHtml(r.casa) + '<div><div class="spot-titulo">' + esc(r.nombre) + '</div><div class="spot-sub">' + esc(r.sub) + ' · ' + r.hora + '</div></div></div>' +
          bolasHtml(nums, r.color) + etq +
          '<div class="spot-pie">Sorteo del <b>' + fechaCorta(r.res.fecha) + '</b> · Juega ya en este punto de venta</div></div>',
        alMostrar: function (capa) { if (grande) { var b = capa.querySelector('.bolas'); b.style.setProperty('--bola', (nums.length > 8 ? 74 : 130) + 'px'); b.style.flexWrap = 'wrap'; b.style.gap = '14px'; } } };
    }
    // Varios a la vez: cuadrícula en la misma pantalla
    var n = lista.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, filas = Math.ceil(n / cols);
    var anchoCelda = (1760 - (cols - 1) * 24) / cols - 48;
    var base = filas === 1 ? (cols === 2 ? 150 : 124) : filas === 2 ? 104 : 72;
    var html = '<div class="rayos"></div><div class="spot multi">' +
      '<div class="spot-kicker">¡NUEVOS RESULTADOS!</div>' +
      '<div class="res-grilla" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
      lista.map(function (r, k) {
        var nums = r.res.numeros, porFila = Math.min(nums.length, 10);
        var tam = Math.floor(Math.min(base, (anchoCelda - (porFila - 1) * 10) / porFila));
        var b = bolasHtml(nums, r.color).replace('class="bolas ', 'style="--bola:' + tam + 'px" class="bolas ');
        return '<div class="res-item" style="--ac:' + r.ac + ';--k:' + k + '">' +
          '<div class="res-cab">' + placaHtml(r.casa) + '<div style="min-width:0"><div class="res-titulo">' + esc(r.nombre) + '</div>' +
          '<div class="res-sub">' + esc(r.sub) + ' · ' + r.hora + '</div></div></div>' + b + '</div>';
      }).join('') + '</div>' +
      '<div class="spot-pie">Sorteos del <b>' + fechaCorta(lista[0].res.fecha) + '</b> · Juega ya en este punto de venta</div></div>';
    return { tipo: 'resultado', html: html, segundos: Math.min(30, seg + (n - 1) * 3) };
  }

  var COLORES_JUGADA = ['roja', 'azul', 'naranja', 'verde', 'morada', 'celeste'];
  function mostrarJugada(j) {
    j = j || {};
    var nums = (j.numeros || []).map(function (n) { return T.pad(+n); });
    if (!nums.length) return;
    var casa = null;
    if (j.loteria) CASAS.forEach(function (c) { if (c.id === j.loteria || c.nombre.toLowerCase() === String(j.loteria).toLowerCase()) casa = c; });
    var ac = casa ? rgb(casa.acento) : '242,199,92';
    var html = '<div class="rayos" style="--ac:' + ac + '"></div><div class="spot jugada" style="--ac:' + ac + '">' +
      '<div class="spot-kicker">NÚMEROS DE LA SUERTE</div>' +
      '<div class="spot-nombre">La jugada de<b>' + esc((j.nombre || 'un cliente').toUpperCase()) + '</b></div>' +
      '<div class="bolas">' + nums.map(function (n, i) { return '<div class="bola b-' + COLORES_JUGADA[i % COLORES_JUGADA.length] + '" style="--n:' + i + '"><span data-n="' + n + '">00</span></div>'; }).join('') + '</div>' +
      '<div class="spot-pie">' + (casa ? 'Para <b>' + esc(casa.nombre) + '</b> · ' : '') + 'Escanea el QR y genera la tuya</div></div>';
    encolar({ tipo: 'jugada', html: html, segundos: CFG.segundosJugada || 10, alMostrar: function (capa) {
      [].forEach.call(capa.querySelectorAll('.bola span'), function (s, i) {
        var fin = Date.now() + 1300 + i * 380 + 400;
        var iv = setInterval(function () {
          if (Date.now() >= fin) { clearInterval(iv); s.textContent = s.getAttribute('data-n'); return; }
          s.textContent = T.pad(Math.floor(Math.random() * 100));
        }, 70);
      });
    } });
  }

  /* ------------------------------------------------------------------ datos */
  function cargar() {
    return D.obtener().then(function (d) {
      datos = d; ultimaCarga = T.ahora();
      var hoy = T.hoy();
      Object.keys(d.resultados).forEach(function (id) {
        var r = d.resultados[id];
        if (r.fecha === hoy && vistos[id] !== hoy) { if (!primeraCarga && POR_ID[id]) anunciarResultado(id); vistos[id] = hoy; }
      });
      primeraCarga = false;
      tick();
    }).catch(function (err) { console.warn('[visor] sin datos:', err); });
  }

  /* ------------------------------------------------------------------ ciclo de 1 s */
  function tick() {
    var ahora = T.ahora();
    pintarReloj(ahora);
    pintarCeldas(ahora);
    pintarModalidades(ahora);
    if (ESCENAS[idx] && ESCENAS[idx].tipo === 'horarios') pintarHorarios(ahora);
    else if (ESCENAS[idx]) ponerFondo(fondoPorHora(ahora));
    pintarPie(ahora);
    $('tituloDia').textContent = ultimaCarga ? 'ACTUALIZADO ' + hora12(T.pad(ultimaCarga.getHours()) + ':' + T.pad(ultimaCarga.getMinutes())) : '';
  }

  /* ------------------------------------------------------------------ escala 1920x1080 */
  function escalar() {
    var w = window.innerWidth, h = window.innerHeight, s = Math.min(w / 1920, h / 1080);
    $('escenario').style.transform = 'translate(' + (w - 1920 * s) / 2 + 'px,' + (h - 1080 * s) / 2 + 'px) scale(' + s + ')';
  }

  /* ------------------------------------------------------------------ inicio */
  function iniciar() {
    escalar(); window.addEventListener('resize', escalar);

    var mk = CFG.marca || {};
    $('marcaLogo').innerHTML = mk.logo ? '<img src="' + (/^(\/|https?:|data:)/.test(mk.logo) ? '' : (CFG.static || '')) + mk.logo + '" alt="">' : '';
    $('marcaNombre').textContent = mk.nombre || '';
    $('marcaSub').textContent = mk.sub || '';
    if (!mk.nombre && !mk.sub) document.querySelector('.marca-texto').style.display = 'none';
    // La línea de abajo ocupa el mismo ancho que el nombre
    function ajustarSub() {
      var n = $('marcaNombre'), b = $('marcaSub'), txt = (mk.sub || '').length;
      if (!mk.nombre || !txt) return;
      b.style.letterSpacing = '0px'; b.style.marginRight = '0px';
      var sobra = n.offsetWidth - b.offsetWidth;
      var ls = Math.max(0, sobra / (txt - 1));
      b.style.letterSpacing = ls + 'px'; b.style.marginRight = -ls + 'px';
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarSub); else setTimeout(ajustarSub, 500);
    $('lema').innerHTML = (mk.lema || []).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');
    $('qrTexto').innerHTML = (CFG.qr.titulo || []).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
    try {
      var qr = window.qrcode(0, 'M'); qr.addData(CFG.qr.url); qr.make();
      $('qrCodigo').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { console.warn('[visor] QR:', e); }

    construir();
    var inicio = 0;
    if (fija) {
      for (var i = 0; i < ESCENAS.length; i++) if (ESCENAS[i].tipo === fija && (!params.get('pagina') || ESCENAS[i].pagina === +params.get('pagina'))) { inicio = i; break; }
    }
    ponerFondo(fondoPorHora(T.ahora()));
    cargar().then(function () { irA(inicio); });
    tick();
    setInterval(tick, 1000);
    setInterval(cargar, (D.modoPrueba ? 5 : (CFG.refrescoDatosSeg || 30)) * 1000);

    document.addEventListener('keydown', function (ev) {
      var k = ev.key.toLowerCase();
      if (k === 'arrowright') irA(idx + 1);
      else if (k === 'arrowleft') irA(idx - 1);
      else if (k === 'r') demoResultado();
      else if (k === 'j') demoJugada();
    });

    if (params.get('demo') === '1') {
      setTimeout(demoResultado, 6000);
      var alterna = 0;
      setInterval(function () { (alterna++ % 2 ? demoResultado : demoJugada)(); }, 45000);
    }
  }

  function demoResultado() {
    var ids = Object.keys(datos.resultados).filter(function (id) { return POR_ID[id]; });
    if (ids.length) anunciarResultado(ids[Math.floor(Math.random() * ids.length)]);
  }
  function demoJugada() {
    var nombres = ['Marck', 'Yokasta', 'Ramón', 'Wendy', 'Starlin'], c = CASAS[Math.floor(Math.random() * CASAS.length)];
    var n = []; while (n.length < 3) { var v = Math.floor(Math.random() * 100); if (n.indexOf(v) < 0) n.push(v); }
    mostrarJugada({ nombre: nombres[Math.floor(Math.random() * nombres.length)], numeros: n, loteria: c.id });
  }

  window.VisorTV = { mostrarJugada: mostrarJugada, anunciarResultado: anunciarResultado, recargar: cargar, irA: irA };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
