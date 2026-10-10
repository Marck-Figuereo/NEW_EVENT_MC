

const game_code = localStorage.getItem('game_id')

// Carpeta de videos de cada juego dentro de static/videos
const games = {
                5 : 'roosters',
                4 : 'horses7',
                3 : 'dogs8',
                2 : 'dogs6',
                1 : 'ruleta'
              }

// Sufijo de los intros con multiplicador (caballos usa introX2C.mp4 / introX3C.mp4)
const sufijo_intro = { 4 : 'C' }

// TODOS los videos (intro y video del evento) se buscan en la carpeta de su juego:
// BASE_VIDEOS/CARPETA_JUEGO/nombre_video.mp4
// BASE_VIDEOS es la direccion del equipo donde estan las carpetas de videos en produccion.
const BASE_VIDEOS = 'http://localhost:3000'

// El nombre llega de la API en selected_video (con o sin .mp4).
const carpeta_video = {
                1 : 'RULETA',
                2 : 'DOGS_6',
                3 : 'DOGS_8',
                4 : 'HORSES_7',
                5 : 'ROOSTERS'
              }

const url_video_evento = nombre => {
  let archivo = String(nombre || '').split('?')[0].split('/').pop().trim()
  if (archivo && !/\.[a-z0-9]{2,4}$/i.test(archivo)) archivo += '.mp4'
  return `${BASE_VIDEOS}/${carpeta_video[game_code]}/${archivo}`
}


// ==========================================
// MULTIPLICADORES (solo carreras; gallos y ruleta no tienen)
// Guia: race_multiplier llega por el WebSocket en el estado in_progress (despues de
// cerrar ventas) y tambien en cada resultado. Valores 2 o 3 -> 'X2' / 'X3'; otro -> 'X'.
// ==========================================

var multiplicador_ws = null   // race_multiplier del evento en curso (WebSocket)
var mult_evento      = 'X'    // multiplicador usado para el intro y el elemento durante la carrera

const es_carrera = () => [2, 3, 4].includes(Number(game_code))

// Carreras cuyo video ya trae el espacio para poner los resultados ENCIMA del video
// (ultimos 10 s): perros de 6 y de 8.
// Caballos (4) todavia no: muestra su PANTALLA DE RESULTADOS al terminar el video, como antes.
// Cuando los videos de caballos esten listos, se agrega el 4 a esta lista y queda igual que los perros.
const resultado_sobre_video = () => [2, 3].includes(Number(game_code))

const etiqueta_multiplicador = valor => {
  if (!es_carrera()) return 'X'
  const n = Number(valor)
  return (n === 2 || n === 3) ? `X${n}` : 'X'
}



// ==========================================
// GALLOS (game_id 5): pantallas propias y colores de cada gallo
// Deben verse en todo el archivo (showGallos, mostrando_*), por eso no van dentro de un if.
// ==========================================

var screen_resultados_en_carrera    = document.getElementById("container-resultado-en-carrera"); 
var screen_resultados_medio_carrera = document.getElementById("container-resultado-medio-carrera");

var bkg_clss = {'1' : ['linear-gradient(to bottom, #3475ef, #002363)', '#fff'],
                '2' : ['linear-gradient(to bottom, #fff, #bcbcbc)', '#000'],
                '0' : ['linear-gradient(to bottom, #4b4b4b, #101010)', '#fff']}

const SOMBRA_GALLO = "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)"

var peleas_video = null   // peleas del video de gallos que se esta reproduciendo
var ciclo_video  = 0      // cada intento de reproducir el video tiene su numero
var consultas_del_ciclo = -1   // ciclo en el que ya se consultaron jackpot y bono



var video_intro         = document.getElementById("intro"); 
var video_event          = document.getElementById("evento"); 

var screen_tablas       = document.getElementById("cuerpo"); 
var screen_resultados   = document.getElementById("container-resultado-carrera"); 

var menjase_bonos       = document.getElementById("container-resultado-bonos");

var screen_jp           = document.getElementById("container-jackpots");
var screen_bono         = document.getElementById('ganador-bono')

video_event.style.width  = '100%'; 
video_event.style.height = '100%'

video_intro.style.width = '100%';
video_intro.style.height = '100%';




var vd = false;
var nup = ["", ""]
var nup2 = ["", ""]

// Duracion del video del evento en segundos. Llega de la API con cada resultado
// (result.tiempo_video, en milisegundos) porque cada video dura distinto.
// Si la API no la envia, se usa la del archivo (video_event.duration) y, si tampoco, tiempoVideo.
var tiempoVideo = 54.920
var tiempo_video_api = null   // segundos del video del evento en curso (API)

const duracion_video_evento = () => {
  if (tiempo_video_api > 0) return tiempo_video_api
  if (isFinite(video_event.duration) && video_event.duration > 0) return video_event.duration
  return tiempoVideo
}

var overlay_video   = document.getElementById('overlay-video')   // solo existe en carreras
var vigilando_resultado = false   // revisa cuadro a cuadro el tiempo real del video

var ver_w_p = false
var ver_b = false  

var cc = true


var tiempo = 0
var event_tiempo = 288      // duracion de la venta; se toma del WebSocket al empezar cada sorteo
  

var entra_intro = false;
var entra_race = false; 

var entra_sincro_1 = true
var entra_sincro_2 = true
var entra_sincro_3 = true

var internet = true

var id_table = 0;

var sorteo_ws = null   // sorteo_id del evento en curso (WebSocket)

// sorteo_id del evento que cerro ventas. Se guarda en el cierre porque el WebSocket
// anuncia enseguida el sorteo siguiente y sorteo_ws cambia antes de pedir el resultado.
var sorteo_cierre = null

var cargando_tabla = false   // hay una consulta de tabla en curso

// Contador ascendente de cada pelea (gallos)
var contadorInterval = null
var contadorValor    = 0



function iniciarConteoAscendente(limite = 100, velocidad = 1000) {
  // 1. Buscar si ya existe un contador viejo en el DOM
  let div = document.getElementById("contador");

  // 2. Si existe de antes, frenamos el intervalo viejo y lo limpiamos visualmente
  if (div) {
    clearInterval(contadorInterval);
    div.remove(); // lo quitamos para crear uno limpio
  }

  // 3. Creamos un contador nuevo desde cero
  div = document.createElement("div");
  div.id = "contador";
  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    font-size: 40px;
    color: white;
    background: rgba(0,0,0,0.7);
    padding: 10px 20px;
    border-radius: 10px;
    z-index: 9999;
  `;
  div.textContent = "0:00";
  document.body.appendChild(div);

  // 4. Arrancamos el conteo desde cero
  contadorValor = 0;
  clearInterval(contadorInterval); // por si acaso
  contadorInterval = setInterval(() => {
    contadorValor++;
    div.textContent = convtSegs(contadorValor);

    if (contadorValor >= limite) {
      clearInterval(contadorInterval);
      // si quieres que desaparezca SOLO cuando llega al límite, descomenta:
      // div.remove();
    }
  }, velocidad);
}

// 🔥 Nueva función para eliminar completamente el contador
function detenerConteoAscendente() {
  clearInterval(contadorInterval);
  contadorInterval = null;
  contadorValor = 0;

  const div = document.getElementById("contador");
  if (div) div.remove();
}




// ==========================================
// ALERTA DE CONEXION
// Solo se muestra con el visor quieto en las tablas. Si el internet se va durante el
// intro, el video, el jackpot, el bono o los resultados, el evento sigue sin interrupcion
// y la alerta sale al volver a las tablas (si la conexion sigue caida).
// ==========================================

var ws_ultimo_mensaje     = Date.now()   // ultimo mensaje recibido del WebSocket
var ws_caido_desde        = Date.now()   // null mientras el WebSocket esta abierto
var alerta_conexion       = false        // la alerta esta en pantalla
var arranque_sin_internet = false        // el visor se abrio sin conexion: al volver se recarga

const en_tablas = () => screen_tablas.style.opacity == 1

const sin_conexion = () => {

  if (!navigator.onLine) return true

  const ahora = Date.now()

  if (ws_caido_desde)  return ahora - ws_caido_desde > 8000        // WebSocket cerrado y sin lograr reconectar
  return ahora - ws_ultimo_mensaje > 20000                         // abierto pero sin mensajes (conexion muerta)
}

const mostrar_alerta_conexion = () => {
  alerta_conexion = true
  Swal.fire({ title: 'Sin conexión a internet', text: 'Reconectando...', icon: 'warning',
              showConfirmButton: false, allowOutsideClick: false, allowEscapeKey: false })
}

const revisar_conexion = () => {

  // Visor suspendido: su pantalla de bloqueo ya esta encima y no corre contenido
  if (window.ControlVisor && ControlVisor.bloqueado) return

  const caida = sin_conexion()

  if (caida && !alerta_conexion && en_tablas()) mostrar_alerta_conexion()

  else if (!caida && alerta_conexion) {

    alerta_conexion = false
    Swal.close()

    if (arranque_sin_internet) { location.reload(); return }

    // Evento fallido pendiente: vuelve su aviso y la tabla sigue en "- - -"
    if (window.historial_congelado) { mostrar_alerta_fallo(); return }

    // Volvio la conexion: tabla, jackpots y ultimos resultados al dia
    recuperar_evento_actual()
    sincronizacion()
  }
}

setInterval(revisar_conexion, 1000)

cerrar_to = () => revisar_conexion()

updateConnectionStatus = () => revisar_conexion()




// ==========================================
// WEBSOCKET DE CONTEO (guia 5.13)
// Unica conexion directa del navegador. La URL la inyecta Django en la plantilla (WEBSOCKET_URL).
// Reconexion con espera incremental y, al reconectar, una consulta del evento actual.
// ==========================================

var websocket        = null   // una sola conexion activa
var ws_reintentos    = 0
var ws_temporizador  = null
var ws_conecto_antes = false
var ws_pidiendo      = false  // ticket en camino: no se abre otra conexion

const url_websocket = () => {
  const base = String((window.VISOR_CONFIG || {}).wsUrl || '').replace(/\/+$/, '')
  return `${base}/ws/pos/grupos/${localStorage.getItem('grupo')}/games/${localStorage.getItem('game_id')}/countdown/`
}


// ==========================================
// COUNTDOWN DEL SORTEO (guia completa del visor)
// - Identidad, tabla y fase se aplican siempre, tambien con ventas cerradas.
// - El tiempo de venta sale de la hora del servidor: sales_close_at - (server_time + tiempo
//   local transcurrido). El reloj del equipo no decide el cierre. Cero con ventas cerradas.
// - Cada sorteo (UUID) tiene su estado: venta, ciclo, pendiente, reproduciendo, finalizado,
//   omitido o abandonado. El intro sale por fase y UUID, no por un segundo exacto.
// ==========================================

var estado_ws        = null   // state del ultimo countdown.update (selling, in_progress...)
var fase_ws          = null   // phase (sales_open, in_progress, awaiting_result, video_playing)
var dato_ws          = null   // ultimo countdown.update aplicado
var reloj_base       = null   // { recibido, servidor, cierre } para el tiempo de venta
var tiempo_valido    = false  // hay un tiempo de venta real (no inventado)
var ultimo_conteo    = 0      // ultima instantanea VALIDA del countdown (salud del sorteo)
var sin_datos_sorteo = false
var ciclo_en_curso   = false  // intro / video / resultados de un sorteo en pantalla
var estados_sorteo   = {}     // { sorteo_id: { estado, cuando } }
var sincronizados    = {}     // { sorteo_id: { s1, s2, s3 } }
var countdown_retry  = 0      // segundos sugeridos por countdown.unavailable

const SIN_DATOS_MS          = 5000    // plazo del cliente, no es una duracion del sorteo
const REINTENTO_RESULTADO_MS = 10000  // resultado pendiente: se vuelve a buscar cada 10 s
const MIN_VIDEO_TARDIO_MS    = 20000  // entrar con el video ya corriendo: solo si quedan >= 20 s

const marcar_sorteo = (clave, estado) => {
  const st = estados_sorteo[clave] || (estados_sorteo[clave] = {})
  st.estado = estado
  st.cuando = Date.now()
  console.log('Sorteo', clave, '->', estado)
}

const tiempo_restante = () => {
  if (estado_ws && estado_ws !== 'selling') return 0
  if (reloj_base) return Math.max(0, Math.ceil((reloj_base.cierre - (reloj_base.servidor + performance.now() - reloj_base.recibido)) / 1000))
  return Number(tiempo) || 0
}

const marcar_conteo = () => {
  ultimo_conteo = Date.now()
  sin_datos_sorteo = false
}

// Datos del sorteo temporalmente no disponibles: sin tiempo inventado
const mostrar_sin_datos = motivo => {
  if (sin_datos_sorteo) return
  sin_datos_sorteo = true
  reloj_base = null
  tiempo_valido = false
  console.log('Datos del sorteo no disponibles:', motivo)
  $('#tiempo_regresivo').text('--:--')
}

// countdown.empty: sin sorteo; se retiran ronda, tabla y tiempo del anterior
const sin_sorteo = () => {
  reloj_base = null
  tiempo_valido = false
  estado_ws = null
  fase_ws = null
  id_table = null
  $('#id_sorteos_c_id').text('')
  $('#tiempo_regresivo').text('--:--')
  if (typeof limpiar_tablas === 'function') limpiar_tablas()
}

const manejar_countdown = (data, origen = 'ws') => {

  const tipo = data['type'] || 'countdown.update'

  // Sin evento programado
  if (tipo === 'countdown.empty' || data['state'] === 'no_event') {
    if (origen !== 'rest') marcar_conteo()
    sin_sorteo()
    return
  }
  if (tipo !== 'countdown.update') return

  // Contexto vigente: un mensaje de otro grupo o juego no cuenta ni se aplica
  if (data['grupo_id'] != null && localStorage.getItem('grupo') && String(data['grupo_id']) !== String(localStorage.getItem('grupo'))) { console.log('Countdown de otro grupo: se ignora', data['grupo_id']); return }
  if (data['game_id'] != null && String(data['game_id']) !== String(game_code)) { console.log('Countdown de otro juego: se ignora', data['game_id']); return }

  if (origen !== 'rest') marcar_conteo()

  const sorteo_nuevo = data['sorteo_id'] && data['sorteo_id'] != sorteo_ws

  id_table  = data['table_odds_id']
  sorteo_ws = data['sorteo_id'] || sorteo_ws
  estado_ws = data['state'] || 'selling'
  fase_ws   = data['phase'] || null
  dato_ws   = data

  // Reloj de venta con la hora del servidor
  const servidor = Date.parse(data['server_time'])
  const cierre   = Date.parse(data['sales_close_at'])
  if (estado_ws === 'selling' && Number.isFinite(servidor) && Number.isFinite(cierre)) {
    reloj_base = { recibido : performance.now(), servidor : servidor, cierre : cierre }
    tiempo_valido = true
  } else {
    reloj_base = null
    if (Number.isFinite(Number(data['seconds_left'])) && data['seconds_left'] !== null) { tiempo = Number(data['seconds_left']); tiempo_valido = true }
    else tiempo_valido = estado_ws !== 'selling'
  }
  tiempo = tiempo_restante()

  // Duracion configurable de la venta (panel de administracion): el primer conteo del sorteo
  if (sorteo_nuevo && estado_ws === 'selling' && Number(tiempo) > 0) event_tiempo = Math.max(Number(tiempo), Number(data['seconds_left']) || 0)

  // Sorteo siguiente en venta: su tabla se pide enseguida, aunque la carrera o pelea
  // anterior siga en pantalla, para que este lista al volver a las tablas.
  if (estado_ws === 'selling' && id_table && (sorteo_nuevo || id_table != tabla_cargada) && !cargando_tabla) {
    cargando_tabla = true
    Consulta_Tabla(id_table, Number(game_code)).then(ok => { vd = ok }).finally(() => { cargando_tabla = false })
  }

  // Multiplicativo (solo carreras): se revela en los ultimos 5 s de venta y se mantiene
  // durante in_progress / awaiting_result. Un evento nuevo en venta llega sin el.
  if (data['race_multiplier'] != null) multiplicador_ws = data['race_multiplier']
  else if (estado_ws === 'selling' && Number(data['seconds_left']) > 5) multiplicador_ws = null

  // Sorteo en venta: queda registrado y los pendientes de otros sorteos ya no se muestran
  if (estado_ws === 'selling' && sorteo_ws && tiempo > 0) {
    if (!estados_sorteo[sorteo_ws]) estados_sorteo[sorteo_ws] = { estado : 'venta', cuando : Date.now() }
    for (const k in estados_sorteo) if (k !== sorteo_ws && estados_sorteo[k].estado === 'pendiente') marcar_sorteo(k, 'abandonado')
  }

  $('#id_sorteos_c_id').text(data['event_number']);
  $('#tiempo_regresivo').text(tiempo_valido ? formatoTiempo(tiempo) : '--:--');
}

// El tiempo de venta se descuenta con el reloj monotono local entre instantaneas
setInterval(() => {
  if (!reloj_base || sin_datos_sorteo) return
  tiempo = tiempo_restante()
  $('#tiempo_regresivo').text(formatoTiempo(tiempo))
}, 250)

// Salud del sorteo: el control puede seguir vivo mientras el countdown calla
setInterval(() => {
  if (en_tablas() && Date.now() - ultimo_conteo > SIN_DATOS_MS) mostrar_sin_datos('sin instantaneas del countdown en ' + (SIN_DATOS_MS / 1000) + ' s')
}, 1000)


// Estado inicial o recuperacion tras reconectar (guia 5.6): una sola consulta, no polling
const recuperar_evento_actual = async () => {

  const evento = await consultar_evento_actual()
  if (!evento) return

  // Se aplica igual que una instantanea del countdown: identidad, tabla, fase y tiempos.
  // Sin state, se deduce de la fase.
  const d = Object.assign({ type : 'countdown.update' }, evento)
  if (!d['state']) d['state'] = (!d['phase'] || d['phase'] === 'sales_open') ? 'selling' : 'in_progress'
  manejar_countdown(d, 'rest')
}


connectWebSocket = async () => {

    if (!navigator.onLine) return

    if (!(window.VISOR_CONFIG && window.VISOR_CONFIG.wsUrl)) {
      console.error('WEBSOCKET_URL no esta configurado en el visor')
      return
    }

    // Una sola conexion activa
    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) return
    if (ws_pidiendo) return
        
    clearTimeout(ws_temporizador)

    // Guia de tiempo real: ticket de dispositivo NUEVO en cada conexion y primer frame "authenticate".
    // Si la API todavia no tiene el control de dispositivos, se conecta como antes.
    ws_pidiendo = true
    let acceso = { modo : 'sin_auth' }
    try { if (window.ControlVisor) acceso = await ControlVisor.ticketCountdown() } finally { ws_pidiendo = false }

    if (acceso.modo === 'parar') return                       // visor suspendido o revocado
    if (acceso.modo === 'esperar') { clearTimeout(ws_temporizador); ws_temporizador = setTimeout(connectWebSocket, acceso.ms); return }
    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) return
    
    const socket = new WebSocket(url_websocket());
    websocket = socket
    
    socket.onopen = () => {
      (window.ControlVisor ? ControlVisor.logEvento : console.log)('conectado | autenticacion: ' + acceso.modo, socket.url)
      if (acceso.modo === 'auth') socket.send(JSON.stringify({ type : 'authenticate', ticket : acceso.ticket }))
      ws_caido_desde = null
      ws_ultimo_mensaje = Date.now()
      if (ws_conecto_antes) recuperar_evento_actual()   // se pudo perder un mensaje
      ws_conecto_antes = true
    }
    
    socket.onmessage = (event) => {
      let data
      ws_ultimo_mensaje = Date.now()

      try { data = JSON.parse(event.data) } catch (error) { console.log('Mensaje de WebSocket invalido'); return }
      (window.ControlVisor ? ControlVisor.logEvento : console.log)(data, socket.url)
      // Este canal tambien trae mensajes de control (device.*): esos no son conteo
      const tipo = window.ControlVisor ? ControlVisor.mensajeCountdown(data) : 'conteo'

      if (tipo === 'contexto') {
        // countdown.context_changed: sin datos del sorteo; el servidor cierra con 4403 y el
        // cierre reconcilia la configuracion antes de abrir otra suscripcion
        mostrar_sin_datos('countdown.context_changed')
        setTimeout(() => { if (websocket === socket) socket.close() }, 5000)
        return
      }
      if (tipo === 'no_disponible') {
        // countdown.unavailable: el servidor cierra con 1011; se reconecta tras retry_after
        countdown_retry = Number(data['retry_after']) || 3
        mostrar_sin_datos('countdown.unavailable')
        return
      }
      if (tipo !== 'conteo') return

      ws_reintentos = 0          // conexion autenticada y estable: la espera vuelve a 1 s
      manejar_countdown(data)
    };

    // Reconexion con espera creciente (1, 2, 4, 8, 16 y 30 s, con variacion).
    // 4403: grupo/juego/suspension; antes de volver se consulta el estado del visor.
    socket.onclose = async (evento) => {

      (window.ControlVisor ? ControlVisor.logEvento : console.log)('cerrado, codigo ' + evento.code, socket.url)
      if (websocket !== socket) return
      websocket = null
      if (!ws_caido_desde) ws_caido_desde = Date.now()

      const espera = window.ControlVisor
        ? await ControlVisor.cierreCountdown(evento.code, ws_reintentos, countdown_retry)
        : Math.min(1000 * Math.pow(2, ws_reintentos), 15000)
      countdown_retry = 0
      ws_reintentos++

      if (espera === null) return
      clearTimeout(ws_temporizador)
      ws_temporizador = setTimeout(connectWebSocket, espera)
    }

    socket.onerror = () => socket.close();
 
    // Se espera un momento para recibir el primer mensaje (tabla y tiempo)
    return esperar(2000)

}


// Cambio de grupo (heartbeat con config_changed): se cierra la conexion actual y se abre otra
const reconectar_websocket = () => {

  const anterior = websocket
  websocket = null

  if (anterior) { anterior.onclose = null; anterior.close() }

  ws_reintentos = 0
  connectWebSocket()
}

// Manejadores de eventos para cambios en el estado de la conexión
window.addEventListener('online',  connectWebSocket);
window.addEventListener('offline', updateConnectionStatus);


    
// La configuracion ya no se consulta aqui: la vigila el heartbeat (guia 5.4 y 5.5)
const sincronizacion = async () =>{
 
  vd = await Consulta_Tabla(id_table, Number(game_code)) 

}

 


var intervalo_bono = null   // parpadeo de la pantalla de bono

const detener_bono = () => {
  clearInterval(intervalo_bono)
  intervalo_bono = null
}


const mostrando_bonos = () => {

  // Evita que se acumulen intervalos de eventos anteriores
  detener_bono()

  ocultar_overlay_video()

  // Viniendo directo del video (carreras), se ocultan el video y el multiplicador
  video_event.style.opacity         = 0;
  video_intro.style.opacity         = 0;
  screen_jp.style.opacity           = 0;
  if (game_code != 5) menjase_bonos.style.opacity = 0;

  screen_resultados.style.opacity   = 0;  
  screen_bono.style.opacity         = 1


  // Hay un solo ganador de bono por localidad
  pintar_ganador_bono()


  var c3 = false 
  intervalo_bono = setInterval(()=>{ 
    
    if(c3){
      
      c3= false 
     document.getElementById('titulow').classList.remove('bns-white')
      document.getElementById('titulow').classList.add('bns-red')
      document.getElementById('id_bns').style.border = '5px solid #5d0500'
      document.getElementById('mnt_bns').style.border = '5px solid #5d0500'

    }else{

      c3 = true
     document.getElementById('titulow').classList.add('bns-white')
      document.getElementById('titulow').classList.remove('bns-red')  
      document.getElementById('id_bns').style.border = '5px solid #ffffff'
      document.getElementById('mnt_bns').style.border = '5px solid #ffffff'
    }
    
  }, 400)

}



const mostrando_win_jackpot = () => {

  ocultar_overlay_video()
  
  video_event.currentTime           = 0
  video_intro.currentTime           = 0

  screen_tablas.style.opacity       = 0;
  video_intro.style.opacity         = 0;
  video_event.style.opacity         = 0;
  
  
  screen_resultados.style.opacity   = 0;
  screen_jp.style.opacity           = 1;
  screen_bono.style.opacity         = 0

  if(game_code == 5){
    screen_resultados_en_carrera.style.opacity    = 0
    screen_resultados_medio_carrera.style.opacity = 0 
  
  }else menjase_bonos.style.opacity       = 0;


}



const mostrando_resultado = async () => {
  
  
  if(game_code == 5){
    screen_resultados_en_carrera.style.opacity    = 0
    screen_resultados_medio_carrera.style.opacity = 0
    $("#div_result_1, #div_result_2, #div_result_3").css({background: "transparent", color: "transparent"}); 
  
  }else if(es_carrera()){
    
    document.getElementById("pos_bono").removeAttribute('src');
    menjase_bonos.style.opacity  = 0;

  }
  
  video_event.currentTime = 0
  video_intro.currentTime = 0
  
  screen_tablas.style.opacity     = 0;
  video_intro.style.opacity       = 0;
  video_event.style.opacity        = 0;
  

  screen_jp.style.opacity = 0;
  screen_bono.style.opacity = 0
  screen_resultados.style.opacity = 1;
  

  

}

const mostrando_tablas = async () =>{

  // Fin del ciclo del sorteo: terminado, salvo que haya quedado pendiente de resultado
  if (ciclo_en_curso && sorteo_cierre && estados_sorteo[sorteo_cierre] &&
      ['ciclo', 'reproduciendo'].includes(estados_sorteo[sorteo_cierre].estado)) marcar_sorteo(sorteo_cierre, 'finalizado')
  ciclo_en_curso = false

  detener_bono()
  ocultar_overlay_video()


  if(game_code == 5){
    screen_resultados_en_carrera.style.opacity    = 0
    screen_resultados_medio_carrera.style.opacity = 0
    $("#div_result_1, #div_result_2, #div_result_3").css({background: "transparent", color: "transparent"}); 
  
  }else if(es_carrera()){
    
    document.getElementById("pos_bono").removeAttribute('src');
    menjase_bonos.style.opacity  = 0;
  
  }

  video_event.style.opacity        = 0;
  video_intro.style.opacity       = 0;
  screen_resultados.style.opacity = 0;
   

  screen_jp.style.opacity = 0;

  
  screen_tablas.style.opacity     = 1;
  screen_bono.style.opacity         = 0

  // Ultimos resultados consultados mientras el evento estaba en pantalla:
  // se pintan ahora, salvo que el evento haya fallado (ver recarga_por_fallo)
  if (window.historial_en_espera) {
    const pendiente = window.historial_en_espera
    window.historial_en_espera = null
    if (!window.historial_congelado) pintar_ultimas_carreras(pendiente)
  }

}


// Gallos: durante el video se anuncia el resultado de cada pelea cuando termina.
// peleas = [{ganador, segundos} x3] leidas del nombre del video (peleas_desde_video).
const showGallos = async (peleas) =>{

  if (!peleas) return

  for (let i = 0; i < 3; i++) {

    const pelea = peleas[i]
    const ms    = pelea.segundos * 1000
    const [fondo, texto] = bkg_clss[pelea.ganador] || bkg_clss['0']

    await esperar(ms)

    console.log(`Termino pelea ${i + 1}`);

    $("#div_medio_1").css({ "background" : fondo, "color" : texto, "box-shadow" : SOMBRA_GALLO })
    $(".txt_medio_1").text(convtSegs(pelea.segundos))
    $(".tt_medio").text(`Pelea #${i + 1}`)
    $("#container-resultado-medio-carrera").css("opacity" , "1")

    if (ms < 60000) await esperar(3000)

    $("#container-resultado-medio-carrera").css("opacity" , "0")
    $("#container-resultado-en-carrera").css("opacity" , "1")

    $(`#div_result_${i + 1}`).css({ "background" : fondo, "color" : texto, "box-shadow" : SOMBRA_GALLO })
    $(`.txt_result_${i + 1}`).text(convtSegs(pelea.segundos))

    if (i < 2) iniciarConteoAscendente(peleas[i + 1].segundos)
  }

  await esperar(2000)

  detenerConteoAscendente();

}

const excute_race = async (opciones = {}) =>{

  const ciclo = ++ciclo_video

  // Ganadores de jackpot y bono: se buscan de nuevo para este sorteo
  ver_w_p = false
  ver_b   = false
   
  entra_sincro_1 = true
  entra_sincro_2 = true
  entra_sincro_3 = true

  // Resultado del sorteo que acaba de cerrar (el del WebSocket)
  nup = await Consulta_resultados(sorteo_cierre)
  console.log("race",   nup);

  if (!nup) {
    // Guia completa: el sorteo queda PENDIENTE y se vuelve a buscar mas tarde mientras
    // el servidor siga en ese sorteo; no se da por terminado
    console.log('Sin resultado del sorteo en curso: queda pendiente y se vuelve a la tabla')
    if (sorteo_cierre) marcar_sorteo(sorteo_cierre, 'pendiente')
    video_intro.style.opacity = 0
    mostrando_tablas()
    return
  }

  if (sorteo_cierre) marcar_sorteo(sorteo_cierre, 'reproduciendo')

  // Carreras: numero de carrera visible desde el inicio del video y cuotas listas para duracion - 10 s
  preparar_overlay_video()


  // Video real del resultado: nombre (selected_video) y duracion en ms (result.tiempo_video) de la API
  const ms_video = Number(((nup[6] || {})['result'] || {})['tiempo_video'])
  tiempo_video_api = ms_video > 0 ? ms_video / 1000 : null

  video_event.src                = url_video_evento(nup[0]);
  video_event.type               = 'video/mp4';

  // Incorporacion tardia: el video arranca donde va el del servidor
  // (duracion oficial - video_milliseconds_left)
  if (opciones.quedanMs > 0 && tiempo_video_api > 0) {
    const inicio = Math.max(0, tiempo_video_api - opciones.quedanMs / 1000)
    console.log('Incorporacion tardia: el video empieza en', inicio.toFixed(1), 's')
    try { video_event.currentTime = inicio } catch (e) {}
    video_event.addEventListener('loadedmetadata', () => { if (video_event.currentTime < inicio - 1) { try { video_event.currentTime = inicio } catch (e) {} } }, { once : true })
  }

  console.log('Video del evento:', video_event.src, 'duracion API (s):', tiempo_video_api)

  // Gallos: todo sale del codigo del video (video_code, ej. 132065248):
  // conteo, anuncio de cada pelea y pantalla de resultados. Asi coincide con el resultado
  // del sorteo y sus cuotas, aunque en pruebas se reproduzca un archivo fijo.
  if (game_code == 5) {
    peleas_video = peleas_desde_video((nup[6] || {})['video_code'] || nup[0]) || peleas_desde_video(video_event.src)
    pintar_resultado_gallos(nup[6], peleas_video)
  }

  const empezo = new Promise(resolve => video_event.addEventListener('playing', resolve, { once : true }))
  
  screen_tablas.style.opacity   = 0;
  screen_jp.style.opacity       = 0;
  video_event.style.opacity      = 1;  
  video_event.muted = true

  video_event.play().catch(() => {})

  if(game_code == 5){

    if (!peleas_video) { console.log('El nombre del video no trae los tiempos de las peleas:', video_event.src); return }

    // Los tiempos cuentan desde que el video empieza a verse, no desde que se pidio
    await empezo
    if (ciclo !== ciclo_video) return   // hubo un reintento: lo maneja el ciclo nuevo
    iniciarConteoAscendente(peleas_video[0].segundos)    
    await showGallos(peleas_video)
  }

}


 
promesa_win_jackpot = () => {

  return new Promise((resolve, reject)=>{
    
    setTimeout(()=>{ 
      
      mostrando_win_jackpot() 
      return resolve()

    }, 7000)
  
  
  })

}

 
promesa_tablas = () => {

  return new Promise((resolve, reject)=>{
    
    setTimeout(()=>{ 
      
      mostrando_tablas(); 
      return resolve()

    }, 7000)
  
  
  })

}


promesa_bonos = () => {

  return new Promise((resolve, reject)=>{
    
    setTimeout(()=>{ 
      
      mostrando_bonos(); 
      return resolve()

    }, 7000)
  
  
  })

}


function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}






video_intro.addEventListener('ended', async () => excute_race() )

// Si el intro no existe o no se puede reproducir, se pasa directo al video de la carrera
video_intro.addEventListener('error', async () => {
  console.log('Intro no disponible, se pasa directo a la carrera:', video_intro.src)
  video_intro.style.opacity = 0
  excute_race()
})  

video_event.addEventListener('ended', async () => {

  // Gallos: mantiene su pantalla de resultados
  if (game_code == 5) {

    detenerConteoAscendente();
    mostrando_resultado();
    
    if(ver_w_p){ 
      await promesa_win_jackpot()
      await esperar(18000)
    } 
     
    if(ver_b){     
      await promesa_bonos() 
      await esperar(18000) 
    }
    
    await promesa_tablas();
    return
  }


  // Caballos (por ahora): pantalla de resultados al terminar el video, como antes.
  // intro -> video -> resultados -> jackpot (si hay ganador) -> bono (si hay ganador) -> tabla
  if (!resultado_sobre_video()) {

    mostrando_resultado();

    // El ganador puede acreditarse segundos despues del resultado: segunda consulta al terminar el video
    if (!ver_w_p) ver_w_p = await Consulta_ganador_jack()

    if(ver_w_p){
      await promesa_win_jackpot()
      await esperar(18000)
    }

    if(ver_b){
      await promesa_bonos()
      await esperar(18000)
    }

    await promesa_tablas();
    return
  }


  // Perros: los resultados ya se vieron dentro del video.
  // intro -> video -> jackpot (si hay ganador) -> bono (si hay ganador) -> tabla

  // El ganador puede acreditarse segundos despues del resultado: segunda consulta al terminar el video
  if (!ver_w_p) ver_w_p = await Consulta_ganador_jack()

  if (ver_w_p) {
    mostrando_win_jackpot()
    await esperar(18000)
  }

  if (ver_b) {
    mostrando_bonos()
    await esperar(18000)
  }

  mostrando_tablas()

  


})




// ==========================================
// DATOS SOBRE EL VIDEO (carreras)
// CARRERA N se ve durante todo el video; RESULTADOS y las cuotas aparecen
// exactamente a (duracion - 10 s), que es cuando el video muestra su pantalla de resultados.
// ==========================================

var overlay_listo = false   // textos preparados, a la espera del primer cuadro del video
const ov_suerte   = document.getElementById('ov_suerte')   // solo existe en perros de 6

const preparar_overlay_video = () => {

  if (!overlay_video || !resultado_sobre_video()) return

  vigilando_resultado = false

  document.getElementById('ov_numero').textContent = nup[3] ?? ''
  document.getElementById('ov_win').textContent    = nup[4] ?? ''
  document.getElementById('ov_exacta').textContent = nup[5] ?? ''

  // Los textos quedan listos, pero NO se muestran todavia: el numero de carrera aparece
  // con el primer cuadro del video (ver programar_resultado_video). Antes salia sobre el
  // final del intro mientras el video terminaba de cargar.
  overlay_video.classList.remove('visible', 'con-resultado', 'con-suerte')
  overlay_listo = true
}


// El momento se mide con el reloj del propio video (el tiempo del cuadro que se esta
// mostrando), no con un temporizador: si el video se atrasa, pierde cuadros o se pausa,
// el texto espera con el. Asi sale exactamente cuando el video muestra sus resultados.
const programar_resultado_video = () => {

  if (!overlay_video || !resultado_sobre_video() || vigilando_resultado || overlay_video.classList.contains('con-resultado')) return

  vigilando_resultado = true

  const revisar = (tiempo_video) => {

    if (!vigilando_resultado) return

    // Primer cuadro del video en pantalla: ahora si se muestra el numero de carrera
    if (overlay_listo && !overlay_video.classList.contains('visible')) overlay_video.classList.add('visible')

    const duracion = duracion_video_evento()

    // "BUENA SUERTE" sobre la barra roja inferior izquierda del video (solo las plantillas que
    // tienen #ov_suerte: perros de 6). La barra esta en el video hasta duracion - 15 s.
    if (ov_suerte) overlay_video.classList.toggle('con-suerte', overlay_listo && tiempo_video < duracion - 15)

    if (tiempo_video >= duracion - 10) {
      vigilando_resultado = false
      overlay_video.classList.remove('con-suerte')
      overlay_video.classList.add('con-resultado')
      console.log(`Resultados sobre el video: segundo ${tiempo_video.toFixed(2)} (esperado ${(duracion - 10).toFixed(2)} de ${duracion.toFixed(2)})`)
      return
    }

    siguiente_cuadro()
  }

  const siguiente_cuadro = () => {

    // Tiempo exacto del cuadro mostrado en pantalla (Chrome / Edge)
    if ('requestVideoFrameCallback' in video_event) {
      video_event.requestVideoFrameCallback((ahora, cuadro) => revisar(cuadro.mediaTime))
    } else {
      requestAnimationFrame(() => revisar(video_event.currentTime))
    }
  }

  siguiente_cuadro()
}


const ocultar_overlay_video = () => {

  if (!overlay_video) return

  vigilando_resultado = false
  overlay_listo = false
  overlay_video.classList.remove('visible', 'con-resultado', 'con-suerte')
}




video_event.addEventListener('playing', async () => {

  programar_resultado_video()

  if(game_code != 5 && game_code != 1){

    // Elemento del multiplicador durante la carrera: el mismo del intro (evento en curso)
    if(mult_evento == 'X2' || mult_evento == 'X3'){
      
      menjase_bonos.style.opacity  = 1;
      document.getElementById('pos_bono').src = `../static/img/${mult_evento}_V.png`
      
    }

  }

  // 'playing' se repite cada vez que el video se recupera de una pausa de carga.
  // Las consultas se hacen una sola vez por video: una segunda consulta devuelve false
  // (el ganador ya quedo marcado como visto) y borraria el ganador encontrado.
  if (consultas_del_ciclo === ciclo_video) return
  consultas_del_ciclo = ciclo_video

  console.log("mostrando el video");

  const jackpot = await Consulta_ganador_jack()
  // Bono del sorteo exacto que se esta mostrando (nup[2] = sorteo_id del resultado)
  const bono    = await Consulta_bonos(nup[2])

  ver_w_p = ver_w_p || jackpot
  ver_b   = ver_b   || bono

})
  

// Evento que no pudo mostrarse: el aviso queda en pantalla sobre las tablas en "- - -" (nadie
// juega con las cuotas del sorteo que cerro) y los ultimos resultados no cambian. Pasado
// ESPERA_RECARGA_FALLO se actualiza todo POR DETRAS del aviso (tabla del sorteo en venta,
// ultimos resultados y jackpots) y recien entonces se quita el aviso: el cliente vuelve a una
// tabla ya al dia, sin recargar la pagina. Nunca interrumpe un evento.
const ESPERA_RECARGA_FALLO        = 60000    // carreras (perros y caballos): 1 minuto
const ESPERA_RECARGA_FALLO_GALLOS = 120000   // gallos: 2 minutos
var   recarga_pendiente    = null

// Todas las cuotas a "- - -" (carreras: .precios_tbl, gallos: .ods)
const limpiar_tablas = () => {
  $('.precios_tbl').css("color", "#fff").text('- - -')
  $('.ods').css("color", "").text('- - -')
}

// Aviso de evento fallido: se queda en pantalla hasta que todo se actualiza
const mostrar_alerta_fallo = () => {
  Swal.fire({ title: game_code == 5 ? 'Error al comenzar la pelea' : 'Error al comenzar la carrera',
              text: 'Espere el próximo evento.', icon: 'warning',
              showConfirmButton: false, allowOutsideClick: false, allowEscapeKey: false })
}

const recarga_por_fallo = () => {

  window.historial_congelado = true
  window.historial_en_espera = null
  if (recarga_pendiente) return

  const desde = Date.now()

  recarga_pendiente = setInterval(() => {

    if (Date.now() - desde < (game_code == 5 ? ESPERA_RECARGA_FALLO_GALLOS : ESPERA_RECARGA_FALLO)) return
    // Quieto en las tablas y sin alerta de conexion
    if (!en_tablas() || alerta_conexion) return

    clearInterval(recarga_pendiente)
    recarga_pendiente = null
    actualizar_tras_fallo()

  }, 1000)
}

// Se descongela y se pide todo de nuevo con el aviso todavia encima; al terminar, se quita
const actualizar_tras_fallo = async () => {

  window.historial_congelado = false
  window.historial_en_espera = null

  try {
    await recuperar_evento_actual()                       // sorteo en venta (tabla y numero)
    vd = await Consulta_Tabla(id_table, Number(game_code))  // cuotas (y jackpots)
    await Consulta_ultimas_carreras()                     // ultimos resultados ya con el evento fallido
    await esperar(800)                                    // que el navegador termine de pintar
  } catch (error) { console.log('Actualizacion tras el evento fallido:', error) }

  if (!alerta_conexion) Swal.close()
  console.log('Evento fallido: tablas y resultados actualizados, aviso retirado')
}

// Empieza un evento nuevo antes de que se cumpliera la espera: se suelta el congelamiento
// (al terminar ese evento todo se actualiza como siempre)
const soltar_fallo = () => {
  if (!window.historial_congelado) return
  clearInterval(recarga_pendiente)
  recarga_pendiente = null
  window.historial_congelado = false
  Swal.close()
}


// El video del evento no existe o no se puede reproducir: NO se usa ningun video de prueba.
// Se avisa (sin mencionar el video) y se vuelve a las tablas; el visor sigue con el siguiente sorteo.
video_event.addEventListener('error', async () => {

  // Solo cuenta mientras el video del evento esta en pantalla
  if (video_event.style.opacity != 1) return

  console.log('No se pudo reproducir el video del evento:', video_event.src)

  ciclo_video++                 // corta lo que esperaba a este video (conteo y peleas de gallos)
  vigilando_resultado = false
  if (game_code == 5) detenerConteoAscendente()

  recarga_por_fallo()           // congela ultimos resultados y tablas, y programa la recarga

  limpiar_tablas()              // las cuotas del sorteo que cerro no se pueden jugar
  await mostrando_tablas()

  // El mensaje no menciona el video ni de donde sale: solo que el evento no pudo comenzar.
  // Se queda hasta que todo se actualiza (1 minuto; gallos 2).
  mostrar_alerta_fallo()

});



  

// Inicia (o reintenta) el ciclo del sorteo cerrado, identificado por su UUID
const intentar_evento = () => {

  const clave = sorteo_ws
  const st = estados_sorteo[clave] || (estados_sorteo[clave] = { estado : 'nuevo', cuando : Date.now() })

  if (['ciclo', 'reproduciendo', 'finalizado', 'omitido', 'abandonado'].includes(st.estado)) return

  // Resultado pendiente: se vuelve a buscar (sin repetir el intro) mientras siga ese sorteo
  if (st.estado === 'pendiente') {
    if (!en_tablas() || Date.now() - st.cuando < REINTENTO_RESULTADO_MS) return
    console.log('Se vuelve a buscar el resultado del sorteo', clave)
    marcar_sorteo(clave, 'ciclo')
    ciclo_en_curso = true
    sorteo_cierre = clave
    limpiar_tablas()
    excute_race()
    return
  }

  // Incorporacion tardia: el primer dato de este sorteo llega con el video del servidor
  // ya corriendo. Se acompana desde donde va si queda tiempo; si no, se omite.
  // Gallos no se incorpora tarde: el conteo de sus peleas empieza con el video.
  if (fase_ws === 'video_playing' && st.estado === 'nuevo') {
    let quedan = Number((dato_ws || {})['video_milliseconds_left'])
    if (!Number.isFinite(quedan)) {
      const fin = Date.parse((dato_ws || {})['video_ends_at']), srv = Date.parse((dato_ws || {})['server_time'])
      quedan = (Number.isFinite(fin) && Number.isFinite(srv)) ? fin - srv : NaN
    }
    if (game_code == 5 || !(quedan >= MIN_VIDEO_TARDIO_MS)) {
      console.log('El video del sorteo ya esta corriendo (' + quedan + ' ms): se omite este sorteo')
      marcar_sorteo(clave, 'omitido')
      return
    }
    marcar_sorteo(clave, 'ciclo')
    ciclo_en_curso = true
    sorteo_cierre = clave
    limpiar_tablas()
    soltar_fallo()
    mult_evento = etiqueta_multiplicador(multiplicador_ws)
    excute_race({ quedanMs : quedan })
    return
  }

  marcar_sorteo(clave, 'ciclo')
  ciclo_en_curso = true

    sorteo_cierre = sorteo_ws   // el sorteo que acaba de cerrar: es el que se va a reproducir

    console.log('intro'); 
    entra_race = true
    
    entra_sincro_1 = true
    entra_sincro_2 = true
    entra_sincro_3 = true
    
    // Al empezar el evento las cuotas de ese sorteo se quitan: nadie debe jugar con ellas
    limpiar_tablas()

    // Si quedo en pantalla el aviso de un evento fallido, el evento nuevo se ve sin el
    soltar_fallo()

    $('#id_sorteos_c_id').text('');

    // if(nup2[1] == 'X2' || nup2[1] == 'X3') video_intro.src = `http://localhost:300${pt}/${games[game_code]}/intro${nup2[1}.mp4`; 
    // else                                   video_intro.src = `http://localhost:300${pt}/${games[game_code]}/intro.mp4`; 
    
    // Multiplicador del evento en curso: llega por el WebSocket al cerrar ventas (estado in_progress).
    // No se usa el de Consulta_resultados: en este momento results[0] todavia es el evento anterior.
    mult_evento = etiqueta_multiplicador(multiplicador_ws)

    if(mult_evento == 'X2' || mult_evento == 'X3') video_intro.src = `${BASE_VIDEOS}/${carpeta_video[game_code]}/intro${mult_evento}${sufijo_intro[game_code] || ''}.mp4`; 
    else                                          video_intro.src = `${BASE_VIDEOS}/${carpeta_video[game_code]}/intro.mp4`; 

    console.log('intro', video_intro.src, 'multiplicador:', mult_evento);
 
    
    console.log(nup2); 
    
    video_intro.type                  = 'video/mp4';
    video_intro.style.opacity         = 1;
    screen_resultados.style.opacity   = 0;
    screen_tablas.style.opacity       = 0;
    
    screen_jp.style.opacity           = 0;
    screen_bono.style.opacity         = 0;
    video_intro.muted = true
    video_intro.play().catch(() => {})
}

setInterval( async ()=> {

  // Ventas cerradas (in_progress / awaiting_result / video_playing) o tiempo de venta en cero:
  // intro y evento del sorteo por su UUID. Funciona aunque el visor arranque tarde (por
  // ejemplo con 20 s restantes) o se salten segundos.
  const cerrado = (estado_ws && estado_ws !== 'selling') || (estado_ws === 'selling' && tiempo_valido && tiempo == 0)

  if (cerrado && vd && sorteo_ws && !ciclo_en_curso) { intentar_evento(); return }

  // Re-sincronizacion de cuotas por tramos (120 s, 60 s y duracion - 30 s), una vez por
  // sorteo, aunque nunca se reciba exactamente ese segundo
  if (estado_ws === 'selling' && tiempo_valido && tiempo > 0 && sorteo_ws) {
    const sinc = sincronizados[sorteo_ws] || (sincronizados[sorteo_ws] = {})
    if (tiempo <= 120 && !sinc.s2) { sinc.s2 = true; ver_w_p = false; ver_b = false; console.log("entra_sincro_2"); sincronizacion() }
    else if (tiempo <= 60 && !sinc.s1) { sinc.s1 = true; console.log("entra_sincro_1"); sincronizacion() }
    else if (tiempo <= event_tiempo - 30 && !sinc.s3) { sinc.s3 = true; console.log("entra_sincro_3"); sincronizacion() }
  }

} , 500);
 
 
 

 
   
$(document).ready(async()=>{

  $('.txt_lgr').text(localStorage.getItem('nm_lgr'))


  //Evitar que se pueda sombrar textos
  document.onselectstart = () => false;
  
  if (!navigator.onLine) {

    // El visor se abrio sin internet: alerta y recarga completa cuando vuelva
    arranque_sin_internet = true
    mostrar_alerta_conexion()

  }else if(localStorage.getItem('dkg') == null){
   
    localStorage.clear(); 
    window.location.href = "/";
    	
  }else{ 

    // Estado del visor antes de mostrar contenido: suspendido, revocado, juego o grupo nuevos
    if (window.ControlVisor) {
      ControlVisor.estaQuieto = () => en_tablas()
      const estado = await ControlVisor.iniciar({ recargarSiCambiaJuego : true })
      if (estado === 'navegando' || estado === 'bloqueado' || estado === 'sin_juego') return
    }

    await confirmar_configuracion()

    await connectWebSocket();

    // Sin mensaje del WebSocket todavia: estado inicial desde el evento actual
    if (!id_table) await recuperar_evento_actual()

    vd = await Consulta_Tabla(id_table, Number(game_code));

    // Heartbeat periodico (guia 5.5). Con el control de dispositivo lo envia control_visor.js
    if (!window.ControlVisor) enviar_heartbeat()
    await mostrando_tablas() 
    
    // Primer arranque de este visor: registrar los ganadores existentes sin anunciarlos
    if (localStorage.getItem('jk_ganadores_vistos') == null) Consulta_ganador_jack()
    
  }
  

})