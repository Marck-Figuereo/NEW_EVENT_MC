// ==========================================
// DEMOSTRACION DE CABALLOS (solo HORSES_7)
//
//   http://localhost:8000/HORSES_7?demo=1                 -> ACTIVA la demostracion en este navegador
//   http://localhost:8000/HORSES_7?demo=1&reiniciar=1     -> empieza de nuevo desde la carrera 1
//   http://localhost:8000/HORSES_7?demo=0                 -> DESACTIVA la demostracion (visor normal)
//   Las carreras son cada 5 minutos, igual que en produccion: cierran a la hora exacta del
//   reloj (:00, :05, :10 ...). Al reiniciar, la primera cierra en el siguiente multiplo de 5 min
//   que deje al menos 1 minuto de venta.
//   &lugar=Nombre    nombre que se ve en el banner del lugar. Se recuerda.
//
// Una vez activada queda guardada en este navegador (cookie "demo_caballos"): al abrir el visor
// (/, DOGS_6, RULETA, ...) Django lo manda directo a /HORSES_7?demo=1, sin ir al juego que
// llega de la API. Solo afecta al navegador donde se activo; el servidor y el .env no cambian.
//
// Sin activarla este archivo no hace NADA: el visor funciona exactamente igual que siempre.
//
// Con la demostracion el visor no usa la API ni internet. Este archivo simula el servidor:
//   - el conteo del sorteo (venta, cierre, carrera) que normalmente llega por el WebSocket
//   - las respuestas de /games: tabla de cuotas, resultado, ultimos resultados, jackpots
// Las cuatro carreras se repiten en orden. Ganador, segundo y cuotas de cada una cuadran con
// su video: la tabla que se ve en venta es la misma que paga el resultado y la que queda en
// los ultimos resultados.
//
// Los datos de la demostracion se guardan aparte (prefijo "demo_caballos:"): la configuracion
// real del visor (token, grupo, juego) no se toca.
// ==========================================

(function () {

  const params = new URLSearchParams(location.search)
  const ruta   = location.pathname.replace(/\/+$/, '').split('/').pop()

  if (ruta !== 'HORSES_7') return

  // ?demo=0: se desactiva y el visor sigue normal
  if (params.get('demo') === '0') { document.cookie = 'demo_caballos=; path=/; max-age=0; SameSite=Lax'; return }

  const cookie_demo = /(?:^|;\s*)demo_caballos=1(?:;|$)/.test(document.cookie)
  if (params.get('demo') !== '1' && !cookie_demo) return

  // Queda activa en este navegador (1 año) hasta abrir ?demo=0
  document.cookie = 'demo_caballos=1; path=/; max-age=31536000; SameSite=Lax'

  window.DEMO_CABALLOS = true
  console.log('%c[DEMO CABALLOS] activa: sin API, carreras de demostracion', 'color:#b35900;font-weight:bold')


  // ---------------- carreras (una por video, en este orden) ----------------
  // video: nombre del archivo en la carpeta HORSES_7 de los videos (sin .mp4)
  // primero / segundo: lo que muestra el video. exacta: lo que paga la exacta ganadora.
  // ms: duracion exacta del video en milisegundos.
  // replay: segundos del video en que se ve el cuadro azul grande vacio (debajo de CARRERA) durante
  // la repeticion; ahi se escribe REPLAY. Medido cuadro a cuadro sobre cada video.
  const CARRERAS = [
    { video : '5-4-75-C7-F', primero : 5, segundo : 4, exacta : 75.0, ms : 107114, replay : [ 85.9,  92.1] },
    { video : '5-7-85-C7-F', primero : 5, segundo : 7, exacta : 85.0, ms : 151812, replay : [130.2, 136.8] },
    { video : '7-6-98-C7-F', primero : 7, segundo : 6, exacta : 98.0, ms : 109600, replay : [ 86.4,  94.6] },
    { video : '1-6-93-C7-F', primero : 1, segundo : 6, exacta : 93.0, ms : 106278, replay : [ 84.5,  91.3] }
  ]

  const CABALLOS   = 7
  const MARGEN     = 0.80     // retorno de las cuotas (80 %)
  const INTRO_S    = 10       // el intro de caballos dura 10 s
  const SOLAPE_S   = 12       // la venta siguiente abre 12 s antes de que termine el video
  const EVENTO_0   = 1001     // numero de la primera carrera de la demostracion
  const TABLA_0    = 9000     // table_odds_id de la primera carrera
  const GRUPO      = 'demo'

  const PERIODO_S = 300   // una carrera cada 5 minutos

  // lugar: el ultimo valor indicado en la direccion queda guardado (ver mas abajo)
  let LUGAR   = 'DEMOSTRACION'


  // ---------------- almacenamiento aparte ----------------
  // localStorage del visor -> claves con prefijo. Nada de la demo queda en la configuracion real.
  const PREFIJO = 'demo_caballos:'
  const sp = Storage.prototype
  const orig = { get : sp.getItem, set : sp.setItem, del : sp.removeItem, clear : sp.clear }
  const es_local = s => { try { return s === window.localStorage } catch (e) { return false } }

  sp.getItem    = function (k)    { return orig.get.call(this, es_local(this) ? PREFIJO + k : k) }
  sp.setItem    = function (k, v) { return orig.set.call(this, es_local(this) ? PREFIJO + k : k, v) }
  sp.removeItem = function (k)    { return orig.del.call(this, es_local(this) ? PREFIJO + k : k) }
  sp.clear      = function () {
    if (!es_local(this)) return orig.clear.call(this)
    Object.keys(this).filter(k => k.indexOf(PREFIJO) === 0).forEach(k => orig.del.call(this, k))
  }

  const fijar = (k, v) => localStorage.setItem(k, v)

  if (params.get('lugar')) fijar('nombre_lugar', params.get('lugar'))
  LUGAR   = (localStorage.getItem('nombre_lugar') || 'DEMOSTRACION').slice(0, 40)

  fijar('game_id', '4')
  fijar('url', 'HORSES_7')
  fijar('grupo', GRUPO)
  fijar('dkg', 'demo')
  fijar('version', 'demo')
  fijar('lugar', LUGAR)
  fijar('nm_lgr', LUGAR)

  // Linea de tiempo: se guarda cuando empezo, asi al recargar sigue donde iba (como el servidor)
  if (params.get('reiniciar') === '1' || !Number(localStorage.getItem('inicio'))) {
    fijar('inicio', String(Date.now()))
    localStorage.removeItem('id_b')
    localStorage.removeItem('datos_jack_gl')
    localStorage.removeItem('datos_jack_lc')
  }
  const INICIO = Number(localStorage.getItem('inicio'))


  // ---------------- sin control de dispositivo y sin depender de internet ----------------
  try { delete window.ControlVisor } catch (e) { window.ControlVisor = undefined }
  try { Object.defineProperty(Navigator.prototype, 'onLine', { configurable : true, get : () => true }) } catch (e) {}
  window.VISOR_CONFIG = Object.assign({}, window.VISOR_CONFIG, { wsUrl : (window.VISOR_CONFIG || {}).wsUrl || 'ws://demo' })


  // ---------------- cuotas de cada carrera ----------------
  // Numeros pseudoaleatorios fijos por carrera: la misma carrera siempre tiene la misma tabla.
  const azar = semilla => () => {
    semilla = (semilla + 0x6D2B79F5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const r1 = n => Math.round(n * 10) / 10

  const cuotas_carrera = indice => {

    const c   = CARRERAS[indice]
    const rnd = azar(7919 * (indice + 1))
    const a   = c.primero, b = c.segundo

    // Probabilidades: ganador y segundo en la mitad de la tabla; la exacta ganadora paga c.exacta
    // (exacta = MARGEN * (1 - pa) / (pa * pb))
    const x  = (-MARGEN / c.exacta + Math.sqrt(Math.pow(MARGEN / c.exacta, 2) + 4 * MARGEN / c.exacta)) / 2
    const pb = x * (0.85 + rnd() * 0.3)
    const pa = MARGEN / (c.exacta * pb + MARGEN)

    const p = {}
    const otros = []
    for (let n = 1; n <= CABALLOS; n++) if (n !== a && n !== b) otros.push(n)
    const pesos = otros.map(() => Math.pow(0.45 + rnd(), 1.6))
    const suma  = pesos.reduce((s, w) => s + w, 0)
    otros.forEach((n, i) => { p[n] = (1 - pa - pb) * pesos[i] / suma })
    p[a] = pa
    p[b] = pb

    const win = {}
    for (let n = 1; n <= CABALLOS; n++) win[n] = Math.max(1.5, r1(MARGEN / p[n]))

    const tabla = {}
    for (let n = 1; n <= CABALLOS; n++) tabla[`WIN ${n}`] = win[n].toFixed(1)
    for (let i = 1; i <= CABALLOS; i++) {
      for (let j = 1; j <= CABALLOS; j++) {
        if (i === j) continue
        tabla[`${i}-${j}`] = Math.min(999, Math.max(5, r1(MARGEN * (1 - p[i]) / (p[i] * p[j])))).toFixed(1)
      }
    }
    tabla[`${a}-${b}`] = c.exacta.toFixed(1)

    return { tabla, win : win[a], exacta : c.exacta }
  }

  const CUOTAS = CARRERAS.map((c, i) => cuotas_carrera(i))


  // ---------------- linea de tiempo ----------------
  // Una carrera cada 5 minutos: la carrera k cierra ventas en PRIMER_CIERRE + k * 5 min.
  // Al cerrar: intro (INTRO_S) -> video. La venta de la carrera siguiente abre SOLAPE_S antes de
  // que termine el video (al volver a la tabla ya esta lista) y dura hasta su cierre.
  const PERIODO_MS    = PERIODO_S * 1000
  // &desfase=N (prueba): corre los cierres N segundos respecto del reloj (por defecto 0: cierran a
  // :00, :05, :10...). Sirve para separar el conteo del reloj de la computadora.
  const DESFASE_MS    = Math.max(0, Math.min(299, Number(params.get('desfase')) || 0)) * 1000
  const PRIMER_CIERRE = Math.ceil((INICIO + 60000 - DESFASE_MS) / PERIODO_MS) * PERIODO_MS + DESFASE_MS

  const cierre_de = k => PRIMER_CIERRE + k * PERIODO_MS
  const abre_siguiente = k => cierre_de(k) + (INTRO_S + CARRERAS[k % CARRERAS.length].ms / 1000 - SOLAPE_S) * 1000

  const carrera_en = ms => {
    let k = Math.max(0, Math.ceil((ms - PRIMER_CIERRE) / PERIODO_MS))
    while (k > 0 && ms < abre_siguiente(k - 1)) k--
    const cierre = cierre_de(k)
    return { k, i : k % CARRERAS.length, empieza : k === 0 ? INICIO : abre_siguiente(k - 1), cierre, video : cierre + INTRO_S * 1000 }
  }

  const iso = ms => new Date(ms).toISOString()

  const instantanea = () => {

    const ahora = Date.now()
    const ev    = carrera_en(ahora)
    const c     = CARRERAS[ev.i]
    const venta = ahora < ev.cierre
    const fin   = ev.video + c.ms
    const fase  = venta ? 'sales_open' : (ahora < ev.video ? 'in_progress' : 'video_playing')

    const d = {
      type          : 'countdown.update',
      grupo_id      : GRUPO,
      game_id       : 4,
      game_code     : 'HORSES_7',
      sorteo_id     : `demo-${ev.k}`,
      event_number  : EVENTO_0 + ev.k,
      table_odds_id : TABLA_0 + ev.k,
      state         : venta ? 'selling' : 'in_progress',
      phase         : fase,
      server_time   : iso(ahora),
      sales_close_at: iso(ev.cierre),
      scheduled_at  : iso(ev.cierre),
      seconds_left  : venta ? Math.max(0, Math.round((ev.cierre - ahora) / 1000)) : 0,
      can_sell      : venta,
      has_result    : fase === 'video_playing',
      result_status : fase === 'video_playing' ? 'published' : 'pending',
      race_multiplier : null,
      tiempo_video  : null,
      video_ends_at : null,
      video_milliseconds_left : 0
    }
    if (fase === 'video_playing') {
      d.tiempo_video = c.ms
      d.video_ends_at = iso(fin)
      d.video_milliseconds_left = Math.max(0, fin - ahora)
    }
    return d
  }


  // ---------------- resultados ----------------
  // Carreras anteriores a la demostracion (solo para llenar los ultimos resultados al empezar)
  const PREVIAS = [
    { primero : 3, segundo : 2, win : 7.4,  exacta : 61.5 },
    { primero : 6, segundo : 1, win : 5.2,  exacta : 38.0 },
    { primero : 2, segundo : 7, win : 11.6, exacta : 104.3 },
    { primero : 4, segundo : 5, win : 6.8,  exacta : 57.9 },
    { primero : 1, segundo : 3, win : 4.1,  exacta : 29.6 }
  ]

  const resultado = k => {

    if (k < 0) {
      const p = PREVIAS[(-k - 1) % PREVIAS.length]
      return armar_resultado(k, null, p.primero, p.segundo, p.win, p.exacta, null)
    }
    const i = k % CARRERAS.length
    const c = CARRERAS[i]
    return armar_resultado(k, c.video, c.primero, c.segundo, CUOTAS[i].win, CUOTAS[i].exacta, c.ms)
  }

  const armar_resultado = (k, video, primero, segundo, win, exacta, ms) => ({
    sorteo_id       : `demo-${k}`,
    event_number    : EVENTO_0 + k,
    game_id         : 4,
    game_code       : 'HORSES_7',
    race_multiplier : null,
    selected_video  : video,
    result          : { winner : primero, second : segundo, tiempo_video : ms },
    settlement      : { result_odds : [
      { selection_key : String(primero),          odds : win.toFixed(1) },
      { selection_key : `${primero}-${segundo}`,  odds : exacta.toFixed(1) }
    ] }
  })

  // Ultima carrera con ventas cerradas (su resultado ya existe)
  const ultima_cerrada = () => {
    const ev = carrera_en(Date.now())
    return Date.now() >= ev.cierre ? ev.k : ev.k - 1
  }

  // Ultimos 5 resultados: una carrera entra cuando empieza su video
  const historial = () => {
    const ev = carrera_en(Date.now())
    const ultima = Date.now() >= ev.video ? ev.k : ev.k - 1
    const lista = []
    for (let k = ultima; k > ultima - 5; k--) lista.push(resultado(k))
    return lista
  }


  // ---------------- jackpots ----------------
  const jackpots = () => {

    const s = (Date.now() - INICIO) / 1000
    const ayer = new Date(INICIO - 26 * 3600 * 1000)
    const dos  = n => String(n).padStart(2, '0')
    const fecha = `${dos(ayer.getDate())}/${dos(ayer.getMonth() + 1)}/${ayer.getFullYear()} ${dos(ayer.getHours())}:${dos(ayer.getMinutes())}`

    const global = { jackpot_id : 1, name : 'JACKPOT GLOBAL', current_amount : r1(48250 + s * 0.85).toFixed(2),
                     last_winner_at : fecha, last_winner_ticket_id : '4821', last_winner_amount : '12500.00', last_winner_lugar : LUGAR }
    const local  = { jackpot_id : 2, name : 'JACKPOT LOCAL', current_amount : r1(4870 + s * 0.15).toFixed(2) }

    return { jackpots : [global, local], global_jackpots : [global], local_jackpots : [local] }
  }


  // ---------------- respuestas de /games ----------------
  const responder = datos => {

    switch (datos['realizar']) {

      case 'display_config':
        return { config : { games : '4', game_url : 'HORSES_7' }, grupo : { id : GRUPO }, config_version : 'demo',
                 lugar : { nombre : LUGAR }, jackpot_id : null }

      case 'display_heartbeat':
        return { config_changed : false, heartbeat : { heartbeat_interval_seconds : 300 } }

      case 'evento_actual':
      case 'display_current_event': {
        const d = instantanea()
        delete d.type
        return { has_event : true, event : d }
      }

      case 'consulta_tabla': {
        const k = Number(datos['table_odds_id']) - TABLA_0
        if (!(k >= 0)) return {}
        return CUOTAS[k % CARRERAS.length].tabla
      }

      case 'consulta_resultados': {
        const k = ultima_cerrada()
        return resultado(k)
      }

      case 'history_results':
        return { results : historial() }

      case 'consulta_jackpots':
        return jackpots()

      case 'consulta_gandores_jack':
      case 'consulta_ganadores_jack':
        return { events : [] }

      case 'consulta_bonos':
        return { has_bonus_event : false, winners : [], sorteo_id : datos['sorteo_id'] }

      default:
        return {}
    }
  }

  const fetch_real = window.fetch.bind(window)

  window.fetch = async (entrada, opciones = {}) => {

    let ruta_pedido = ''
    try { ruta_pedido = new URL(typeof entrada === 'string' ? entrada : entrada.url, location.href).pathname } catch (e) {}

    if (/\/games\/?$/.test(ruta_pedido) && String(opciones.method || 'GET').toUpperCase() === 'POST') {
      let datos = {}
      try { datos = JSON.parse(opciones.body || '{}') } catch (e) {}
      await new Promise(r => setTimeout(r, 40))
      return new Response(JSON.stringify(responder(datos)), { status : 200, headers : { 'Content-Type' : 'application/json' } })
    }

    return fetch_real(entrada, opciones)
  }


  // ---------------- WebSocket del conteo ----------------
  // Solo la conexion /countdown/ se simula; cualquier otra usa el WebSocket real.
  const WebSocketReal = window.WebSocket

  class WebSocketDemo {

    constructor (url, protocolos) {

      if (String(url).indexOf('/countdown/') === -1) return new WebSocketReal(url, protocolos)

      this.url = String(url)
      this.readyState = 0
      this.onopen = this.onmessage = this.onclose = this.onerror = null

      setTimeout(() => {
        if (this.readyState !== 0) return
        this.readyState = 1
        if (this.onopen) this.onopen({ type : 'open' })
        this._enviar()
        this._reloj = setInterval(() => this._enviar(), 1000)
      }, 30)
    }

    _enviar () {
      if (this.readyState === 1 && this.onmessage) this.onmessage({ type : 'message', data : JSON.stringify(instantanea()) })
    }

    send () {}

    close (codigo = 1000) {
      if (this.readyState >= 2) return
      this.readyState = 3
      clearInterval(this._reloj)
      setTimeout(() => { if (this.onclose) this.onclose({ type : 'close', code : codigo, wasClean : true }) }, 0)
    }

    addEventListener () {}
    removeEventListener () {}
  }

  WebSocketDemo.CONNECTING = 0
  WebSocketDemo.OPEN       = 1
  WebSocketDemo.CLOSING    = 2
  WebSocketDemo.CLOSED     = 3

  window.WebSocket = WebSocketDemo


  // ---------------- resultados sobre el video ----------------
  // Los videos nuevos de caballos traen los cuadros de RESULTADOS: las cuotas se escriben encima
  // en los ultimos 10 s (como perros). El cuadro del numero de carrera esta en otra posicion.
  const estilo = document.createElement('style')
  // El cuadro del numero de carrera (arriba a la derecha) esta dividido en dos mitades:
  // "CARRERA" va centrado en la mitad izquierda y el numero del sorteo en la derecha.
  estilo.textContent =
    '#overlay-video.ov_caballos #ov_carrera { left: 75.31%; top: 6.67%; width: 19.17%; height: 5.74%; font-size: 3.1cqh;' +
    ' display: grid; grid-template-columns: 1fr 1fr; justify-items: center; align-items: center; }' +
    '#overlay-video.ov_caballos #ov_carrera > span { display: block; }'
  document.head.appendChild(estilo)

  const marcar_overlay = () => {
    const ov = document.getElementById('overlay-video')
    if (!ov) return
    ov.classList.add('ov_caballos')

    // "CARRERA&nbsp;" es texto suelto: se pone en su propio elemento para la mitad izquierda
    const caja = document.getElementById('ov_carrera')
    if (caja && !caja.querySelector('.ov_etiqueta')) {
      Array.from(caja.childNodes).filter(n => n.nodeType === 3).forEach(n => n.remove())
      const etiqueta = document.createElement('span')
      etiqueta.className = 'ov_etiqueta'
      etiqueta.textContent = 'CARRERA'
      caja.insertBefore(etiqueta, caja.firstChild)
    }
  }
  marcar_overlay()
  document.addEventListener('DOMContentLoaded', marcar_overlay)


  // ---------------- REPLAY ----------------
  // Durante la repeticion el video muestra un cuadro azul grande vacio debajo de CARRERA
  // (x 1450-1810, y 144-388 de 1920x1080). Mientras ese cuadro esta en pantalla se escribe REPLAY.
  // El momento se toma del reloj del propio video (cuadro mostrado), igual que los resultados.
  const estilo_replay = document.createElement('style')
  estilo_replay.textContent =
    '#overlay-video #ov_replay { left: 75.52%; top: 13.33%; width: 18.75%; height: 22.59%; font-size: 6.2cqh;' +
    ' letter-spacing: .06em; opacity: 0; transition: opacity .2s ease-out; }' +
    '#overlay-video.con-replay #ov_replay { opacity: 1; }'
  document.head.appendChild(estilo_replay)

  let vigilando_replay = false
  let vuelta_replay    = 0      // cada video vigilado tiene su numero: una vigilancia vieja se detiene sola

  const preparar_replay = () => {
    const ov = document.getElementById('overlay-video')
    if (ov && !document.getElementById('ov_replay')) {
      const div = document.createElement('div')
      div.id = 'ov_replay'
      div.textContent = 'REPLAY'
      ov.appendChild(div)
    }
  }

  const tramo_replay = video => {
    const nombre = decodeURIComponent(String(video.currentSrc || video.src || '').split('?')[0].split('/').pop()).replace(/\.mp4$/i, '')
    const c = CARRERAS.find(x => x.video === nombre)
    return c ? c.replay : null
  }

  const quitar_replay = () => {
    vigilando_replay = false
    vuelta_replay++
    const ov = document.getElementById('overlay-video')
    if (ov) ov.classList.remove('con-replay')
  }

  const vigilar_replay = video => {

    if (vigilando_replay) return
    const tramo = tramo_replay(video)
    if (!tramo) return
    vigilando_replay = true
    const vuelta = ++vuelta_replay

    const revisar = t => {
      if (!vigilando_replay || vuelta !== vuelta_replay) return
      const ov = document.getElementById('overlay-video')
      if (ov) ov.classList.toggle('con-replay', t >= tramo[0] && t < tramo[1])
      if (video.ended) { quitar_replay(); return }
      siguiente()
    }
    const siguiente = () => {
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback((ahora, cuadro) => revisar(cuadro.mediaTime))
      else requestAnimationFrame(() => revisar(video.currentTime))
    }
    siguiente()
  }

  const al_cargar = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn()

  al_cargar(() => {
    preparar_replay()
    const video = document.getElementById('evento')
    if (!video) return
    video.addEventListener('playing', () => vigilar_replay(video))
    video.addEventListener('ended',   quitar_replay)
    video.addEventListener('error',   quitar_replay)
    video.addEventListener('emptied', quitar_replay)
  })


  // &latido=1 (prueba): una linea por segundo en la consola con la hora de la PC, el conteo y los
  // milisegundos desde la linea anterior. Si pasan mas de 1,5 s, la pagina estuvo detenida y se avisa.
  if (params.get('latido') === '1') {
    let anterior = performance.now()
    const dos = n => String(n).padStart(2, '0')
    setInterval(() => {
      const ahora = performance.now(), salto = Math.round(ahora - anterior)
      anterior = ahora
      const d = new Date()
      const conteo = (document.getElementById('tiempo_regresivo') || {}).textContent
      const linea = `[LATIDO VISOR] ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())} | conteo ${conteo} | ${salto} ms desde la linea anterior`
      if (salto > 1500) console.warn(linea + `  <-- SE DETUVO ${salto - 1000} ms`)
      else console.log(linea)
    }, 1000)
  }


  // Consola: resumen de la rotacion
  console.log('[DEMO CABALLOS] una carrera cada', PERIODO_S / 60, 'min | primera cierra', new Date(PRIMER_CIERRE).toLocaleTimeString(), '| carreras:', CARRERAS.map((c, i) =>
    `${c.video}: gana ${c.primero} (${CUOTAS[i].win.toFixed(1)}), exacta ${c.primero}-${c.segundo} (${c.exacta.toFixed(1)})`).join(' | '))

})();
