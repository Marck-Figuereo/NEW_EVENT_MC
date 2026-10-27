// Tablero de caballos (pv_c.html): estados de la pantalla de tablas.
// Solo observa los textos que ya llenan cone_db_p.js y funcionamiento_p.js y les pone clases
// (style_c.css, seccion TABLERO). No cambia ningun dato ni la logica de esos archivos.
(function () {
  var cuerpo = document.getElementById('cuerpo')
  if (!cuerpo || !cuerpo.classList.contains('vh')) return

  var texto = function (el) { return (el && el.textContent || '').trim() }

  // Llama a fn cada vez que cambia el texto de el (y una vez al inicio)
  var vigilar = function (el, fn) {
    if (!el) return
    fn(el)
    new MutationObserver(function () { fn(el) }).observe(el, { childList: true, characterData: true, subtree: true })
  }

  // ---- Jackpots: ERROR o JK SIN ASIGNAR se muestran como NO DISPONIBLE ----
  ;['jp_global', 'jp_local'].forEach(function (id) {
    vigilar(document.getElementById(id), function (el) {
      var t = texto(el).toUpperCase()
      el.closest('.vh-jack').classList.toggle('vh-sin-dato', t === 'ERROR' || t === 'JK SIN ASIGNAR')
    })
  })

  // ---- Conteo: ultimos 30 segundos en rojo ----
  var caja_tiempo = document.querySelector('#cuerpo .vh-tiempo')
  vigilar(document.getElementById('tiempo_regresivo'), function (el) {
    var m = /^(\d+):(\d{2})$/.exec(texto(el))
    var seg = m ? Number(m[1]) * 60 + Number(m[2]) : -1
    caja_tiempo.classList.toggle('vh-urgente', seg >= 0 && seg <= 30)
  })

  // ---- Historial: filas sin carrera ocultas; sin ninguna, un aviso ----
  var historial = document.querySelector('#cuerpo .vh-historial')
  var historial_listo = false   // al abrir, el historial tarda en llegar: el aviso espera unos segundos
  var revisar_historial = function () {
    var vacias = 0
    for (var i = 0; i < 5; i++) {
      var num = document.getElementById('numero_race' + i)
      if (!num) continue
      var sin = texto(num) === ''
      num.closest('.vh-hist-item').style.visibility = sin ? 'hidden' : ''
      if (sin) vacias++
    }
    historial.classList.toggle('vh-vacio', historial_listo && vacias === 5)
  }
  setTimeout(function () { historial_listo = true; revisar_historial() }, 8000)
  for (var i = 0; i < 5; i++) vigilar(document.getElementById('numero_race' + i), revisar_historial)

  // ---- Ultimo jackpot sin dato ("- - -") ----
  ;['monto_info', 'id_tk_info', 'lugar_info', 'date_info'].forEach(function (id) {
    vigilar(document.getElementById(id), function (el) {
      el.closest('.vh-dato').classList.toggle('vh-sin-dato', texto(el) === '- - -' || texto(el) === '')
    })
  })

  // ---- Ticket: "****482193" se muestra como "•••• 482193" ----
  vigilar(document.getElementById('id_tk_info'), function (el) {
    var t = el.textContent
    if (/^\*+/.test(t)) el.textContent = t.replace(/^\*+\s*/, '•••• ')
  })

  // ---- Pantalla de ganador jackpot: el ticket "******482193" se muestra como "•••• 482193" ----
  var jackpots = document.getElementById('container-jackpots')
  if (jackpots) new MutationObserver(function () {
    jackpots.querySelectorAll('.jk_ticket').forEach(function (el) {
      if (/^\*+/.test(el.value)) el.value = el.value.replace(/^\*+\s*/, '•••• ')
    })
    // nombre de banca largo: la letra baja hasta que cabe (hasta un 60% del tamano)
    jackpots.querySelectorAll('.jk_lugar').forEach(function (el) {
      el.style.removeProperty('font-size')
      var tam = parseFloat(getComputedStyle(el).fontSize), minimo = tam * 0.6
      while (el.scrollWidth > el.clientWidth + 1 && tam > minimo) { tam -= 1; el.style.fontSize = tam + 'px' }
    })
  }).observe(jackpots, { childList: true })

  // ---- Textos largos: la letra baja hasta que el texto cabe; si aun asi no cabe,
  //      pasa a dos lineas (dos_lineas = tamano de letra para dos lineas) ----
  var ajustar = function (el, minimo, dos_lineas) {
    if (!el) return
    var base = el.getAttribute('data-vh-base')
    if (!base) { base = parseFloat(getComputedStyle(el).fontSize); el.setAttribute('data-vh-base', base) }
    base = Number(base)
    el.classList.remove('vh-2l')
    el.style.fontSize = base + 'px'
    var tam = base
    while (el.scrollWidth > el.clientWidth + 1 && tam > minimo) {
      tam -= 1
      el.style.fontSize = tam + 'px'
    }
    if (dos_lineas && el.scrollWidth > el.clientWidth + 1) {
      el.classList.add('vh-2l')
      el.style.fontSize = dos_lineas + 'px'
    }
  }
  var ajustables = [
    [document.querySelector('#cuerpo .vh-lugar label'), 19, 18],
    [document.getElementById('lugar_info'), 28, 24],
    [document.getElementById('id_tk_info'), 26],
    [document.getElementById('date_info'), 26],
    [document.getElementById('monto_info'), 26]
  ]
  ajustables.forEach(function (par) {
    vigilar(par[0], function (el) { ajustar(el, par[1], par[2]) })
  })
  // ---- Montos de jackpot muy largos: la letra baja hasta dejar 16px libres junto a la etiqueta.
  //      Solo se mide cuando cambia la cantidad de caracteres o se borro el tamano (el monto se anima seguido). ----
  var ajustar_jackpot = function (el) {
    // clave = largo del texto + tamano puesto a mano (cone_db_p.js lo borra al pintar un monto nuevo)
    var clave = texto(el).length + '|' + el.style.fontSize
    if (el._vh_clave === clave) return
    var etq = el.parentNode.querySelector('.vh-jack-etq')
    if (!etq) return
    el.style.removeProperty('font-size')
    if (el.closest('.vh-jack').classList.contains('vh-sin-dato')) return
    var tam = parseFloat(getComputedStyle(el).fontSize)
    while (el.getBoundingClientRect().left - etq.getBoundingClientRect().right < 16 && tam > 34) {
      tam -= 1
      el.style.setProperty('font-size', tam + 'px')
    }
    el._vh_clave = texto(el).length + '|' + el.style.fontSize
  }
  ;['jp_global', 'jp_local'].forEach(function (id) { vigilar(document.getElementById(id), ajustar_jackpot) })

  // ---- Pantallas de premio (GANADOR JACKPOT y GANADOR DEL BONO) ----
  // funcionamiento_p.js las muestra poniendo su opacidad en 1 durante 18 s. El CSS del juego
  // dice que video de fondo lleva (--g-video: 'premio_caballos'); si no dice ninguno, la
  // pantalla queda como esta. Al aparecer:
  //   - el video de monedas arranca desde el inicio (static/videos/premios/<nombre>.mp4)
  //   - la placa entra a los 0,25 s (clase g-activo)
  //   - el monto gira en rodillos de 0,8 a 3,4 s y llega con el golpe de monedas del video
  //     (clase g-final: salta, brilla y salen destellos)
  //   - el video dura 15 s y termina en un fondo limpio que se queda quieto; desde su ultimo
  //     segundo y hasta que se oculta la pantalla, el polvo de oro flota por codigo (g-calma)
  // El monto real no se toca: los rodillos van encima del campo y se quitan al ocultarse.
  var base_js = (document.currentScript && document.currentScript.src) || location.href

  var premio = function (caja, filas, montos, ordenar) {
    if (!caja) return
    var nombre = getComputedStyle(caja).getPropertyValue('--g-video').trim().replace(/^['"]|['"]$/g, '')
    if (!nombre) return

    var video = document.createElement('video')
    video.className = 'g-video'
    video.muted = true; video.setAttribute('muted', ''); video.setAttribute('playsinline', '')
    video.preload = 'auto'
    video.src = new URL('../videos/premios/' + nombre + '.mp4', base_js).href
    caja.insertBefore(video, caja.firstChild)
    var polvo = document.createElement('div')
    polvo.className = 'g-polvo'
    for (var g = 0; g < 70; g++) {
      var grano = document.createElement('i'), dura = 9 + Math.random() * 10
      grano.style.left = (Math.random() * 100) + '%'; grano.style.top = (8 + Math.random() * 100) + '%'
      grano.style.setProperty('--t', 'calc(' + (1.6 + Math.random() * 3.4).toFixed(1) + ' * var(--u))')
      grano.style.setProperty('--a', (.35 + Math.random() * .5).toFixed(2))
      grano.style.setProperty('--d', dura.toFixed(1) + 's')
      grano.style.setProperty('--r', (-Math.random() * dura).toFixed(1) + 's')
      polvo.appendChild(grano)
    }
    caja.insertBefore(polvo, video.nextSibling)
    var fondo = document.createElement('div')
    fondo.className = 'g-placa-fondo'
    caja.insertBefore(fondo, polvo.nextSibling)

    var activo = false, inicio = 0, tiempos = [], capas = []
    var calma = function () {
      if (activo && (video.ended || (video.duration && video.currentTime >= video.duration - 1))) caja.classList.add('g-calma')
    }
    video.addEventListener('timeupdate', calma)
    video.addEventListener('ended', calma)
    var u = function () { return Math.min(window.innerWidth / 1920, window.innerHeight / 1080) }

    // posicion de un elemento dentro de la pantalla, sin contar transformaciones (asi da igual
    // si la placa esta a mitad de su entrada cuando llegan los datos)
    var caja_pos = function (el) {
      var x = 0, y = 0, e = el
      while (e && e !== caja) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent }
      return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight }
    }
    // la placa cubre todas las filas visibles
    var medir_fondo = function () {
      var a = null
      filas().forEach(function (el) {
        if (!el.offsetWidth || !el.offsetHeight) return
        var r = caja_pos(el)
        if (!a) a = r
        else a = { l: Math.min(a.l, r.l), t: Math.min(a.t, r.t), r: Math.max(a.r, r.r), b: Math.max(a.b, r.b) }
      })
      fondo.style.display = a ? '' : 'none'
      if (!a) return
      fondo.style.left = a.l + 'px'; fondo.style.top = a.t + 'px'
      fondo.style.width = (a.r - a.l) + 'px'; fondo.style.height = (a.b - a.t) + 'px'
    }
    var poner = function (capa) {
      var c = capa.campo, r = caja_pos(c), e = getComputedStyle(c)
      var arriba = parseFloat(e.paddingTop) || 0, abajo = parseFloat(e.paddingBottom) || 0, ancho = r.r - r.l
      capa.el.style.left = r.l + 'px'; capa.el.style.width = ancho + 'px'
      capa.el.style.top = (r.t + arriba) + 'px'; capa.el.style.height = (r.b - r.t - arriba - abajo) + 'px'
      // si la cifra no cabe, se achica (offsetWidth tampoco cuenta transformaciones)
      var tam = parseFloat(e.fontSize)
      capa.el.style.fontSize = tam + 'px'
      while (capa.cifras.offsetWidth > ancho * 0.92 && tam > 40) {
        tam -= 4; capa.el.style.fontSize = tam + 'px'
      }
    }

    // monto en rodillos: cada digito gira hasta su numero, de izquierda a derecha
    var rodillos = function (campo) {
      var cifra = String(campo.value || '')
      if (!/[0-9]/.test(cifra)) return
      var el = document.createElement('div'); el.className = 'g-monto'
      var aura = document.createElement('div'); aura.className = 'g-aura'
      var cifras = document.createElement('div'); cifras.className = 'g-cifras'
      var ruedas = []
      for (var i = 0; i < cifra.length; i++) {
        var ch = cifra[i], s = document.createElement('span')
        if (/[0-9]/.test(ch)) {
          var r = document.createElement('div'); r.className = 'g-rueda'
          for (var v = 0; v < 4; v++) for (var d = 0; d <= 9; d++) {
            var n = document.createElement('i'); n.textContent = d; r.appendChild(n)
          }
          s.appendChild(r); ruedas.push({ r: r, fin: +ch })
        } else s.textContent = ch
        cifras.appendChild(s)
      }
      var reflejo = document.createElement('div'); reflejo.className = 'g-reflejo'; reflejo.textContent = cifra
      cifras.appendChild(reflejo)
      el.appendChild(aura); el.appendChild(cifras)
      ;[[8, 22], [27, 78], [46, 14], [63, 82], [81, 26], [95, 70]].forEach(function (p, k) {
        var c = document.createElement('span'); c.className = 'g-chispa'
        c.style.left = p[0] + '%'; c.style.top = p[1] + '%'; c.style.animationDelay = (k * 0.31 + 0.1) + 's'
        el.appendChild(c)
      })
      caja.appendChild(el)
      var capa = { el: el, campo: campo, cifras: cifras }
      capas.push(capa); poner(capa)
      campo.classList.add('g-oculto')

      var espera = Math.max(0, 800 - (performance.now() - inicio)), k = ruedas.length
      ruedas.forEach(function (w, j) {
        var pasos = 10 * (1 + Math.floor(j * 2 / k)) + w.fin
        w.r.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-' + (pasos * 1.1) + 'em)' }],
          { duration: 1700 + (k > 1 ? j * (900 / (k - 1)) : 900), delay: espera, easing: 'cubic-bezier(.3, .1, .2, 1)', fill: 'forwards' })
      })
    }
    var quitar = function () {
      capas.forEach(function (c) { c.el.remove(); c.campo.classList.remove('g-oculto') })
      capas = []
    }
    var armar = function () {
      quitar()
      if (ordenar) ordenar()
      medir_fondo()
      montos().forEach(rodillos)
    }

    var empezar = function () {
      if (activo) return
      activo = true; inicio = performance.now()
      caja.classList.remove('g-activo', 'g-final', 'g-calma'); void caja.offsetWidth
      armar()
      caja.classList.add('g-activo')
      try { video.currentTime = 0; var p = video.play(); if (p && p.catch) p.catch(function () {}) } catch (e) {}
      tiempos.push(setTimeout(function () { caja.classList.add('g-final') }, 3400))
    }
    var parar = function () {
      if (!activo) return
      activo = false
      tiempos.forEach(function (t) { clearTimeout(t) }); tiempos = []
      caja.classList.remove('g-activo', 'g-final', 'g-calma')
      quitar()
      try { video.pause(); video.currentTime = 0 } catch (e) {}
    }

    new MutationObserver(function () {
      if (parseFloat(caja.style.opacity) > 0) empezar()
      else parar()
    }).observe(caja, { attributes: true, attributeFilter: ['style'] })
    // si los datos llegan con la pantalla ya visible, se vuelve a armar
    new MutationObserver(function (cambios) {
      var datos = cambios.some(function (m) {
        return [].slice.call(m.addedNodes).concat([].slice.call(m.removedNodes)).some(function (n) { return n.classList && n.classList.contains('row_jp') })
      })
      if (datos && activo) armar()
      else if (datos && ordenar) ordenar()
    }).observe(caja, { childList: true })
    window.addEventListener('resize', function () { if (activo) { medir_fondo(); capas.forEach(poner) } })
  }

  var jackpots = document.getElementById('container-jackpots')
  premio(jackpots,
    function () { return [].slice.call(document.querySelectorAll('#container-jackpots > .row')) },
    function () { return [].slice.call(document.querySelectorAll('#container-jackpots .precio_jp')) },
    // cone_db_p.js pone nombre, lugar/ticket y monto: en pantalla va el monto antes que lugar/ticket
    function () {
      [].slice.call(document.querySelectorAll('#container-jackpots > .row_jp')).forEach(function (f) {
        var antes = f.previousElementSibling
        if (f.querySelector('.precio_jp') && antes && antes.querySelector('.jk_lugar')) jackpots.insertBefore(f, antes)
      })
    })
  premio(document.getElementById('ganador-bono'),
    function () { return ['titulow', 'mnt_bns', 'id_bns'].map(function (id) { return document.getElementById(id) }).filter(Boolean) },
    function () { var el = document.getElementById('mnt_bns'); return el ? [el] : [] })

  // las fuentes llegan despues del primer dibujo: se vuelve a medir cuando terminan de cargar
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      ajustables.forEach(function (par) { ajustar(par[0], par[1], par[2]) })
      ;['jp_global', 'jp_local'].forEach(function (id) { var el = document.getElementById(id); if (el) { el._vh_clave = null; ajustar_jackpot(el) } })
    })
  }
})()
