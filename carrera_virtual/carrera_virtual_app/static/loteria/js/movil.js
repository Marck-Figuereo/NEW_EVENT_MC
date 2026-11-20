/* =====================================================================
   DEMP LOTTOVIEW · MÓVIL (lo que abre el QR)
   ---------------------------------------------------------------------
   1. Elige la lotería   2. Escribe su nombre   3. Recibe 3 números (00-99)
   Comparte por WhatsApp y (cuando exista el backend) la jugada sale en la
   pantalla del punto de venta.

   URL:  /LOTERIA/suerte            ?loteria=nacional  preselecciona una lotería
                                    ?pv=PV-0001        punto de venta (se envía con la jugada)
   Marca: // >>> AJUSTAR CONTRATO
   ===================================================================== */
(function () {
  'use strict';

  var CAT = window.VISOR_CATALOGO, CASAS = CAT.casas;
  var params = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var COLORES = ['roja', 'azul', 'naranja'];          // los mismos de la jugada en la TV

  var estado = { casa: null, nombre: '', numeros: [] };

  /* ---------------- utilidades ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hora12(hhmm) { var p = hhmm.split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM'); }
  function enDia(hhmm, base) { var p = hhmm.split(':'), d = new Date(base.getTime()); d.setHours(+p[0], +p[1], 0, 0); return d; }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function placa(casa) {
    var f = casa.logo_fondo || 'claro', cls = f === 'oscuro' ? 'oscuro' : f === 'claro' ? '' : 'color';
    return '<span class="loteria-placa ' + cls + '"' + (cls === 'color' ? ' style="--placa:' + f + '"' : '') + '>' +
      (casa.logo ? '<img src="' + casa.logo + '" alt="">' : '') + '</span>';
  }

  /** Próximo sorteo de la casa que todavía se puede jugar (hoy o mañana). */
  function proximoSorteo(casa) {
    var ahora = new Date();
    for (var k = 0; k < 2; k++) {
      var dia = new Date(ahora.getTime()); dia.setDate(dia.getDate() + k);
      var dom = dia.getDay() === 0;
      var lista = casa.sorteos.map(function (s) {
        var c = (dom && s.cierre_dom) || s.cierre, h = (dom && s.hora_dom) || s.hora;
        return { s: s, cierre: enDia(c, dia), cierreTxt: c, horaTxt: h, manana: k === 1 };
      }).filter(function (x) { return x.cierre > ahora; }).sort(function (a, b) { return a.cierre - b.cierre; });
      if (lista.length) return lista[0];
    }
    return null;
  }
  function textoSorteo(p) {
    if (!p) return '';
    var cuando = p.horaTxt ? hora12(p.horaTxt) : 'cierra ' + hora12(p.cierreTxt);
    return (p.s.nombre === estado.casa.nombre ? '' : p.s.nombre + ' · ') + (p.manana ? 'mañana ' : '') + cuando;
  }

  /** 3 números distintos del 00 al 99, con el generador del navegador. */
  function sortear() {
    var nums = [], buf = new Uint32Array(1);
    while (nums.length < 3) {
      var v;
      if (window.crypto && crypto.getRandomValues) { crypto.getRandomValues(buf); v = buf[0] % 100; }
      else v = Math.floor(Math.random() * 100);
      if (nums.indexOf(v) < 0) nums.push(v);
    }
    return nums.map(pad);
  }

  /* ---------------- formulario ---------------- */
  function pintarLoterias() {
    $('loterias').innerHTML = CASAS.map(function (c) {
      return '<label class="loteria"><input type="radio" name="loteria" value="' + esc(c.id) + '">' +
        '<span class="loteria-caja">' + placa(c) + '<span class="loteria-nombre">' + esc(c.nombre) + '</span></span></label>';
    }).join('');
    $('loterias').addEventListener('change', function (ev) {
      elegir(ev.target.value);
      $('error').textContent = '';
    });
  }

  function elegir(id) {
    var casa = CASAS.filter(function (c) { return c.id === id; })[0];
    if (!casa) return;
    estado.casa = casa;
    var radio = document.querySelector('input[name="loteria"][value="' + id + '"]');
    if (radio) radio.checked = true;
    var p = proximoSorteo(casa);
    $('proximo').className = 'proximo';
    $('proximo').innerHTML = p ? 'Próximo sorteo: <b>' + esc(textoSorteo(p)) + '</b>' : '';
    guardar('lv_loteria', id);
  }

  function validar() {
    var nombre = $('nombre').value.trim().replace(/\s+/g, ' ');
    $('nombre').setAttribute('aria-invalid', 'false');
    if (!estado.casa) {
      $('proximo').className = 'proximo error'; $('proximo').textContent = 'Elige una lotería.';
      $('loterias').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    if (nombre.length < 2) {
      $('error').textContent = 'Escribe tu nombre para generar la jugada.';
      $('nombre').setAttribute('aria-invalid', 'true'); $('nombre').focus();
      return null;
    }
    $('error').textContent = '';
    return nombre;
  }

  /* ---------------- resultado ---------------- */
  function mostrarResultado(desdeHistorial) {
    var casa = estado.casa, p = proximoSorteo(casa), ahora = new Date();
    $('resPara').textContent = 'La jugada de';
    $('resTitulo').innerHTML = '<b>' + esc(estado.nombre) + '</b>';
    $('resCab').innerHTML = placa(casa) + '<div class="res-cab-texto"><div class="res-cab-nombre">' + esc(casa.nombre) + '</div>' +
      (p ? '<div class="res-cab-sorteo">Próximo sorteo · ' + esc(textoSorteo(p)) + '</div>' : '') + '</div>';
    $('resFecha').textContent = DIAS[ahora.getDay()] + ' ' + ahora.getDate() + ' ' + MESES[ahora.getMonth()] + ' ' + ahora.getFullYear() +
      ' · ' + hora12(pad(ahora.getHours()) + ':' + pad(ahora.getMinutes()));

    sortearEnPantalla();

    var texto = 'Mis números de la suerte para ' + casa.nombre + (p ? ' (' + textoSorteo(p) + ')' : '') + ': ' +
      estado.numeros.join(' - ') + '. Generados en DEMP LottoView.';
    $('compartir').href = 'https://wa.me/?text=' + encodeURIComponent(texto);

    $('vistaForm').hidden = true; $('vistaResultado').hidden = false;
    window.scrollTo(0, 0);
    // El historial permite volver con el botón "atrás" del teléfono. En algunos marcos está bloqueado: no pasa nada.
    if (!desdeHistorial) { try { history.pushState({ vista: 'resultado' }, ''); estado.conHistorial = true; } catch (_) { estado.conHistorial = false; } }
  }

  function volver() {
    $('vistaResultado').hidden = true; $('vistaForm').hidden = false;
    window.scrollTo(0, 0);
  }

  /* ---------------- el sorteo en pantalla ----------------
     1. Una tómbola con bolas de colores que vuelan y chocan (canvas).
     2. Cada número sale por arriba, vuela hasta su lugar y su cifra gira
        como un rodillo de tragamonedas hasta frenar en su número.
     3. Al fijarse: golpe, anillo dorado, chispas y vibración.
     4. Al final la tómbola se cierra, cae confeti y aparecen los botones.
     Tocar la tarjeta salta directo al resultado. */
  var corrida = 0, timers = [];
  var PALETA = ['roja', 'azul', 'naranja', 'verde', 'amarilla', 'morada', 'celeste', 'rosada'];
  var COLOR_HEX = { roja: '#e5483b', azul: '#2f6bff', naranja: '#ff8a1f', verde: '#22c55e', amarilla: '#f2c75c', morada: '#a855f7', celeste: '#22d3ee', rosada: '#ec4899' };
  var TEXTOS = ['Mezclando las bolas…', 'Sale el primer número…', 'Sale el segundo número…', 'Y el último número…'];
  //               sale del bombo   tiempo del rodillo
  var SALIDA = [1500, 2750, 4000], RODILLO = [1000, 1000, 1600];
  var VUELO = 650;

  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
  function despues(ms, fn) { var id = corrida; timers.push(setTimeout(function () { if (id === corrida) fn(); }, ms)); }
  function limpiarTimers() { timers.forEach(clearTimeout); timers = []; }

  /* imágenes de las bolas (las mismas del CSS, así sirven aquí y en la vista previa) */
  var imgs = {};
  function cargarImagenes() {
    PALETA.forEach(function (c) {
      if (imgs[c]) return;
      var d = document.createElement('div'); d.className = 'bola b-' + c; d.style.cssText = 'position:absolute;visibility:hidden;width:10px;height:10px';
      document.body.appendChild(d);
      var m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(d).backgroundImage); d.remove();
      if (m) { var im = new Image(); im.src = m[1]; imgs[c] = im; }
    });
  }

  /* ---------- la tómbola ---------- */
  var bombo = null;
  function crearBombo(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth || 340, H = 216;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 12, r = R * 0.15, bolas = [], ang = 0, vivo = true, ultimo = 0, apagar = 1;
    for (var k = 0; k < 22; k++) {
      var a = Math.random() * Math.PI * 2, d = Math.random() * (R - r);
      bolas.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: (Math.random() - .5) * 500, vy: (Math.random() - .5) * 500,
        c: PALETA[k % PALETA.length], g: Math.random() * Math.PI * 2 });
    }
    function paso(dt) {
      ang += dt * 2.4;
      bolas.forEach(function (b) {
        b.vy += 1100 * dt;                                    // gravedad
        if (b.y > cy + R * 0.35) b.vy -= (1500 + Math.random() * 2200) * dt;   // soplador desde abajo
        b.vx += (Math.random() - .5) * 900 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.g += b.vx * dt * 0.05;
        var dx = b.x - cx, dy = b.y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > R - r) {                                       // choca con el vidrio
          var nx = dx / d, ny = dy / d; b.x = cx + nx * (R - r); b.y = cy + ny * (R - r);
          var vn = b.vx * nx + b.vy * ny; b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny;
          b.vx += -ny * 140; b.vy += nx * 140;                 // el giro del bombo las arrastra
        }
      });
      for (var i = 0; i < bolas.length; i++) for (var j = i + 1; j < bolas.length; j++) {
        var A = bolas[i], B = bolas[j], ex = B.x - A.x, ey = B.y - A.y, dd = ex * ex + ey * ey, m = 2 * r;
        if (dd < m * m && dd > 0.01) {
          var dl = Math.sqrt(dd), ux = ex / dl, uy = ey / dl, o = (m - dl) / 2;
          A.x -= ux * o; A.y -= uy * o; B.x += ux * o; B.y += uy * o;
          var va = A.vx * ux + A.vy * uy, vb = B.vx * ux + B.vy * uy;
          if (va - vb > 0) { A.vx += (vb - va) * ux; A.vy += (vb - va) * uy; B.vx += (va - vb) * ux; B.vy += (va - vb) * uy; }
        }
      }
    }
    function dibujar() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = apagar;
      // fondo del vidrio
      var g = ctx.createRadialGradient(cx - R * .3, cy - R * .4, R * .1, cx, cy, R);
      g.addColorStop(0, 'rgba(120,150,230,.16)'); g.addColorStop(1, 'rgba(10,18,44,.55)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      // rayos del bombo girando
      ctx.strokeStyle = 'rgba(222,186,108,.18)'; ctx.lineWidth = 2;
      for (var k = 0; k < 6; k++) { var a = ang + k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
      // bolas
      bolas.forEach(function (b) {
        var im = imgs[b.c];
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.g);
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -r, -r, r * 2, r * 2);
        else { ctx.fillStyle = COLOR_HEX[b.c]; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      // aro dorado, boca de salida y reflejo
      ctx.lineWidth = 4; ctx.strokeStyle = '#d6b46a';
      ctx.beginPath(); ctx.arc(cx, cy, R + 2, -Math.PI / 2 + .22, Math.PI * 1.5 - .22); ctx.stroke();
      ctx.fillStyle = '#d6b46a'; ctx.fillRect(cx - R * .26, cy - R - 10, 5, 14); ctx.fillRect(cx + R * .26 - 5, cy - R - 10, 5, 14);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, R - 7, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function bucle(t) {
      if (!vivo) return;
      var dt = Math.min(.033, ultimo ? (t - ultimo) / 1000 : .016); ultimo = t;
      paso(dt); dibujar(); requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
    return {
      /** Saca la bola que esté más arriba y devuelve su centro en la página. */
      sacar: function (color) {
        if (!bolas.length) return null;
        var idx = 0; bolas.forEach(function (b, i) { if (b.y < bolas[idx].y) idx = i; });
        var b = bolas.splice(idx, 1)[0], rc = canvas.getBoundingClientRect();
        return { x: rc.left + cx, y: rc.top + cy - R, r: r };
      },
      apagar: function () { var t0 = performance.now(); (function f(t) { apagar = Math.max(0, 1 - (t - t0) / 400); if (apagar > 0 && vivo) requestAnimationFrame(f); })(t0); },
      parar: function () { vivo = false; }
    };
  }

  /* ---------- confeti y chispas ---------- */
  var conf = { ctx: null, parts: [], corriendo: false };
  function prepararConfeti() {
    var c = $('confeti'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    conf.ctx = c.getContext('2d'); conf.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function chispas(x, y, color) {
    for (var k = 0; k < 26; k++) {
      var a = Math.random() * Math.PI * 2, v = 160 + Math.random() * 260;
      conf.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 520, vida: .55 + Math.random() * .35, t: 0,
        tipo: 'chispa', c: Math.random() < .6 ? '#f7d47a' : COLOR_HEX[color], s: 2 + Math.random() * 2.5 });
    }
    animarConfeti();
  }
  function lluvia() {
    var cols = ['#f2c75c', '#e5483b', '#2f6bff', '#ff8a1f', '#22c55e', '#ec4899', '#fff3c8'];
    for (var k = 0; k < 150; k++) {
      conf.parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .5, vx: (Math.random() - .5) * 80, vy: 160 + Math.random() * 220,
        g: 120, vida: 3.2, t: 0, tipo: 'papel', c: cols[k % cols.length], w: 6 + Math.random() * 6, h: 9 + Math.random() * 7,
        rot: Math.random() * 6, vr: (Math.random() - .5) * 10, fase: Math.random() * 6 });
    }
    animarConfeti();
  }
  function animarConfeti() {
    if (conf.corriendo) return; conf.corriendo = true;
    var ultimo = 0;
    (function f(t) {
      var dt = Math.min(.033, ultimo ? (t - ultimo) / 1000 : .016); ultimo = t;
      var ctx = conf.ctx; ctx.clearRect(0, 0, innerWidth, innerHeight);
      conf.parts = conf.parts.filter(function (p) {
        p.t += dt; if (p.t > p.vida || p.y > innerHeight + 40) return false;
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        var alfa = Math.min(1, (p.vida - p.t) / .4);
        ctx.globalAlpha = alfa; ctx.fillStyle = p.c;
        if (p.tipo === 'chispa') { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - p.t / p.vida * .6), 0, Math.PI * 2); ctx.fill(); }
        else { p.rot += p.vr * dt; p.x += Math.sin(p.t * 4 + p.fase) * 40 * dt;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.t * 6 + p.fase))); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
        return true;
      });
      ctx.globalAlpha = 1;
      if (conf.parts.length) requestAnimationFrame(f); else { conf.corriendo = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    })(performance.now());
  }

  /* ---------- rodillo de cada número ---------- */
  function armarRodillo(span, final, vueltas) {
    var lista = []; for (var k = 0; k < vueltas; k++) lista.push(pad(Math.floor(Math.random() * 100)));
    lista.push(final);
    span.innerHTML = '<span class="tira">' + lista.map(function (n) { return '<i>' + n + '</i>'; }).join('') + '</span>';
    return { tira: span.firstChild, pasos: vueltas };
  }

  function fijar(bola, i, final) {
    bola.classList.remove('rodando'); bola.classList.add('lista');
    var rc = bola.getBoundingClientRect();
    chispas(rc.left + rc.width / 2, rc.top + rc.height / 2, COLORES[i % COLORES.length]);
    vibrar(final ? [40, 70, 60] : 30);
  }

  function terminar(rapido) {
    var estadoTxt = $('resEstado');
    estadoTxt.textContent = '¡Esta es tu jugada!'; estadoTxt.classList.add('final');
    $('saltar').hidden = true;
    $('tombola').classList.add('cerrada');
    if (bombo) { bombo.apagar(); var b = bombo; setTimeout(function () { b.parar(); }, 500); bombo = null; }
    lluvia();
    despues(rapido ? 150 : 650, function () { $('acciones').classList.add('visible'); });
  }

  function sortearEnPantalla() {
    limpiarTimers(); var id = ++corrida;
    // La animación es parte de la experiencia: se muestra completa aunque el sistema tenga reducidas las
    // animaciones (en Windows suele venir así). Quien no quiera esperar toca "Toca para ver ya".
    var nums = estado.numeros, reducido = false;
    var cont = $('bolas'), estadoTxt = $('resEstado'), tomb = $('tombola');
    cargarImagenes(); prepararConfeti();
    if (bombo) { bombo.parar(); bombo = null; }
    $('acciones').classList.remove('visible');
    estadoTxt.classList.remove('final');
    [].forEach.call(document.querySelectorAll('.bola-vuela'), function (e) { e.remove(); });

    cont.innerHTML = nums.map(function (n, i) {
      return '<div class="bola hueco" data-color="' + COLORES[i % COLORES.length] + '" style="--n:' + i + '"><span></span></div>';
    }).join('');
    var huecos = cont.querySelectorAll('.bola');

    tomb.classList.toggle('sin-bombo', reducido);
    tomb.classList.remove('cerrada');
    $('saltar').hidden = false;
    estadoTxt.textContent = TEXTOS[0];

    // la vista ya está visible: se crea el bombo en el siguiente cuadro (necesita medidas reales)
    if (!reducido) requestAnimationFrame(function () { if (id === corrida) bombo = crearBombo($('bombo')); });

    nums.forEach(function (n, i) {
      var hueco = huecos[i], color = hueco.getAttribute('data-color');
      var sale = reducido ? 300 + i * 700 : SALIDA[i], rodar = reducido ? 450 : RODILLO[i];
      despues(sale, function () {
        estadoTxt.textContent = TEXTOS[i + 1];
        var origen = bombo && bombo.sacar(color);
        var llega = reducido ? 0 : VUELO;
        if (origen) volar(hueco, color, origen);
        despues(llega, function () {
          hueco.classList.remove('hueco'); hueco.classList.add('b-' + color, 'rodando');
          var rod = armarRodillo(hueco.querySelector('span'), n, reducido ? 4 : (i === 2 ? 22 : 14));
          var alto = rod.tira.firstChild.getBoundingClientRect().height;
          var anim = rod.tira.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-alto * rod.pasos) + 'px)' }],
            { duration: rodar, easing: 'cubic-bezier(.12,.75,.22,1)', fill: 'forwards' });
          anim.onfinish = function () {
            if (id !== corrida) return;
            hueco.querySelector('span').textContent = n;
            fijar(hueco, i, i === nums.length - 1);
            if (i === nums.length - 1) terminar(false);
          };
        });
      });
    });
  }

  /** Una bola sale de la boca del bombo y cae en su hueco. */
  function volar(hueco, color, origen) {
    var rc = hueco.getBoundingClientRect(), b = document.createElement('div');
    b.className = 'bola bola-vuela b-' + color;
    b.style.cssText = 'position:fixed;left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px;z-index:40';
    document.body.appendChild(b);
    var dx = origen.x - (rc.left + rc.width / 2), dy = origen.y - (rc.top + rc.height / 2), s0 = (origen.r * 2) / rc.width;
    b.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s0 + ')', offset: 0 },
      { transform: 'translate(' + dx * .55 + 'px,' + (dy - 70) + 'px) scale(' + (s0 + .35) + ') rotate(-180deg)', offset: .4 },
      { transform: 'translate(0,0) scale(1) rotate(-360deg)', offset: 1 }
    ], { duration: VUELO, easing: 'cubic-bezier(.35,.1,.25,1)' }).onfinish = function () { b.remove(); };
  }

  function saltar() {
    if ($('saltar').hidden) return;
    limpiarTimers(); var id = ++corrida;
    [].forEach.call(document.querySelectorAll('.bola-vuela'), function (e) { e.remove(); });
    [].forEach.call($('bolas').querySelectorAll('.bola'), function (b, i) {
      b.classList.remove('hueco', 'rodando'); b.classList.add('b-' + b.getAttribute('data-color'), 'lista');
      b.querySelector('span').textContent = estado.numeros[i];
    });
    terminar(true);
  }

  /* ---------------- enviar a la pantalla del local ---------------- */
  function enviarJugada() {
    var jugada = { nombre: estado.nombre, numeros: estado.numeros.map(Number), loteria: estado.casa.id, pv: params.get('pv') || null };

    // Prueba local: si el visor de TV está abierto en este mismo navegador, la muestra.
    try { if ('BroadcastChannel' in window) new BroadcastChannel('lottoview-jugadas').postMessage(jugada); } catch (_) {}

    // >>> AJUSTAR CONTRATO: endpoint que reenvía la jugada al visor del punto de venta (por su WebSocket).
    var url = (window.VISOR_CONFIG && window.VISOR_CONFIG.jugadaUrl) || null;
    if (!url) return;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jugada) })
      .catch(function (e) { console.warn('[movil] no se pudo enviar la jugada:', e); });
  }

  /* ---------------- inicio ---------------- */
  function iniciar() {
    pintarLoterias();
    var pre = params.get('loteria') || leer('lv_loteria');
    if (pre) elegir(pre);
    var nombre = leer('lv_nombre');
    if (nombre) $('nombre').value = nombre;

    $('nombre').addEventListener('input', function () { if ($('error').textContent) { $('error').textContent = ''; $('nombre').setAttribute('aria-invalid', 'false'); } });

    // Se genera con el clic del botón o con "Ir/Enter" del teclado. No se usa el envío del formulario:
    // hay navegadores y marcos (vista previa, apps que abren el QR) que lo bloquean.
    function generar(ev) {
      if (ev) ev.preventDefault();
      var n = validar(); if (!n) return;
      estado.nombre = n; guardar('lv_nombre', n);
      estado.numeros = sortear();
      $('nombre').blur();
      mostrarResultado(false);
      enviarJugada();
    }
    $('generar').addEventListener('click', generar);
    $('form').addEventListener('submit', function (ev) { ev.preventDefault(); });
    $('nombre').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') generar(ev); });
    $('saltar').addEventListener('click', saltar);
    $('otra').addEventListener('click', function () { estado.numeros = sortear(); mostrarResultado(true); enviarJugada(); });
    $('cambiar').addEventListener('click', function () {
      if (estado.conHistorial) { try { history.back(); return; } catch (_) {} }
      volver();
    });
    window.addEventListener('popstate', function () { estado.conHistorial = false; volver(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
