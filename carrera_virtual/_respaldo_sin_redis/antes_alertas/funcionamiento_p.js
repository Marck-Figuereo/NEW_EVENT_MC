

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

// Carpeta de los videos de cada juego (intro y video del evento):
// ../static/videos/CARPETA_JUEGO/nombre_video.mp4
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
  return `../static/videos/${carpeta_video[game_code]}/${archivo}`
}


// ==========================================
// MULTIPLICADORES (solo carreras; gallos y ruleta no tienen)
// Guia: race_multiplier llega por el WebSocket en el estado in_progress (despues de
// cerrar ventas) y tambien en cada resultado. Valores 2 o 3 -> 'X2' / 'X3'; otro -> 'X'.
// ==========================================

var multiplicador_ws = null   // race_multiplier del evento en curso (WebSocket)
var mult_evento      = 'X'    // multiplicador usado para el intro y el elemento durante la carrera

const es_carrera = () => [2, 3, 4].includes(Number(game_code))

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




cerrar_to = () =>{

  if (video_event.currentTime == 0 &&  screen_resultados.style.opacity == 0 && screen_bono.style.opacity == 0 && screen_jp.style.opacity == 0){

    internet = false
    Swal.fire({ title: 'Error de conexion', showConfirmButton: false, icon: 'warning' })
    video_intro.style.opacity = 0
    video_event.style.opacity = 0
    screen_tablas.style.opacity = 0
    screen_resultados.style.opacity = 0
    if (menjase_bonos) menjase_bonos.style.opacity = 0
    screen_jp.style.opacity = 0
    screen_bono.style.opacity = 0

  }

}

updateConnectionStatus = () => {

  if(!navigator.onLine) cerrar_to()

}




// ==========================================
// WEBSOCKET DE CONTEO (guia 5.13)
// Unica conexion directa del navegador. La URL la inyecta Django en la plantilla (WEBSOCKET_URL).
// Reconexion con espera incremental y, al reconectar, una consulta del evento actual.
// ==========================================

var websocket        = null   // una sola conexion activa
var ws_reintentos    = 0
var ws_temporizador  = null
var ws_conecto_antes = false

const url_websocket = () => {
  const base = String((window.VISOR_CONFIG || {}).wsUrl || '').replace(/\/+$/, '')
  return `${base}/ws/pos/grupos/${localStorage.getItem('grupo')}/games/${localStorage.getItem('game_id')}/countdown/`
}


const manejar_countdown = data => {

  // Sin evento programado: no trae tabla, numero ni segundos
  if (data['type'] === 'countdown.empty' || data['state'] === 'no_event') return

  const sorteo_nuevo = data['sorteo_id'] && data['sorteo_id'] != sorteo_ws

  id_table  = data['table_odds_id']
  tiempo    = data['seconds_left']
  sorteo_ws = data['sorteo_id'] || sorteo_ws

  // Duracion configurable de la venta (panel de administracion): el primer conteo del sorteo
  if (sorteo_nuevo && data['state'] === 'selling' && Number(tiempo) > 0) event_tiempo = Number(tiempo)

  // Sorteo siguiente en venta: su tabla se pide enseguida, aunque la carrera o pelea
  // anterior siga en pantalla, para que este lista al volver a las tablas.
  if (data['state'] === 'selling' && id_table && (sorteo_nuevo || id_table != tabla_cargada) && !cargando_tabla) {
    cargando_tabla = true
    Consulta_Tabla(id_table, Number(game_code)).then(ok => { vd = ok }).finally(() => { cargando_tabla = false })
  }

  // Multiplicativo (solo carreras): se revela en los ultimos 5 s de venta y se mantiene
  // durante in_progress / awaiting_result. Un evento nuevo en venta llega sin el.
  if (data['race_multiplier'] != null) multiplicador_ws = data['race_multiplier']
  else if (data['state'] === 'selling' && Number(data['seconds_left']) > 5) multiplicador_ws = null
  
  $('#id_sorteos_c_id').text(data['event_number']);
  $('#tiempo_regresivo').text(formatoTiempo(tiempo));
}


// Estado inicial o recuperacion tras reconectar (guia 5.6): una sola consulta, no polling
const recuperar_evento_actual = async () => {

  const evento = await consultar_evento_actual()
  if (!evento) return

  if (evento['table_odds_id']) id_table = evento['table_odds_id']
  if (evento['sorteo_id'])     sorteo_ws = evento['sorteo_id']
  if (evento['race_multiplier'] != null) multiplicador_ws = evento['race_multiplier']

  $('#id_sorteos_c_id').text(evento['event_number'] ?? '');
}


connectWebSocket = async () => {

    if (!navigator.onLine) return

    if (!(window.VISOR_CONFIG && window.VISOR_CONFIG.wsUrl)) {
      console.error('WEBSOCKET_URL no esta configurado en el visor')
      return
    }

    // Una sola conexion activa
    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) return
        
    if(!internet) location.reload()  
  
    Swal.close()
    clearTimeout(ws_temporizador)
    
    const socket = new WebSocket(url_websocket());
    websocket = socket

    socket.onopen = () => {
      ws_reintentos = 0
      if (ws_conecto_antes) recuperar_evento_actual()   // se pudo perder un mensaje
      ws_conecto_antes = true
    }
    
    socket.onmessage = (event) => {
      let data
      try { data = JSON.parse(event.data) } catch (error) { console.log('Mensaje de WebSocket invalido'); return }
      manejar_countdown(data)
    };

    // Reconexion con espera incremental: 1, 2, 4, 8 y maximo 15 segundos
    socket.onclose = () => {

      if (websocket !== socket) return
      websocket = null

      const espera = Math.min(1000 * Math.pow(2, ws_reintentos), 15000)
      ws_reintentos++

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

const excute_race = async () =>{

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
    console.log('Sin resultado del sorteo en curso: se vuelve a la tabla')
    video_intro.style.opacity = 0
    mostrando_tablas()
    return
  }

  // Carreras: numero de carrera visible desde el inicio del video y cuotas listas para duracion - 10 s
  preparar_overlay_video()


  // Video real del resultado: nombre (selected_video) y duracion en ms (result.tiempo_video) de la API
  const ms_video = Number(((nup[6] || {})['result'] || {})['tiempo_video'])
  tiempo_video_api = ms_video > 0 ? ms_video / 1000 : null

  video_event.src                = url_video_evento(nup[0]);
  video_event.type               = 'video/mp4';

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


  // Carreras: los resultados ya se vieron dentro del video.
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

const preparar_overlay_video = () => {

  if (!overlay_video) return

  vigilando_resultado = false

  document.getElementById('ov_numero').textContent = nup[3] ?? ''
  document.getElementById('ov_win').textContent    = nup[4] ?? ''
  document.getElementById('ov_exacta').textContent = nup[5] ?? ''

  overlay_video.classList.remove('con-resultado')
  overlay_video.classList.add('visible')
}


// El momento se mide con el reloj del propio video (el tiempo del cuadro que se esta
// mostrando), no con un temporizador: si el video se atrasa, pierde cuadros o se pausa,
// el texto espera con el. Asi sale exactamente cuando el video muestra sus resultados.
const programar_resultado_video = () => {

  if (!overlay_video || vigilando_resultado || overlay_video.classList.contains('con-resultado')) return

  vigilando_resultado = true

  const revisar = (tiempo_video) => {

    if (!vigilando_resultado) return

    const duracion = duracion_video_evento()

    if (tiempo_video >= duracion - 10) {
      vigilando_resultado = false
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
  overlay_video.classList.remove('visible', 'con-resultado')
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
  

reload_err = true
video_event.addEventListener('error', async () => {

  if (reload_err){

    await esperar(3000)
    excute_race()
    reload_err = false

  }else{
    
    $('.precios_tbl').each(function(){
      
      $(`#${$(this).attr('id')}`).css("color", "#fff")
      $($(this).attr('id')).text('- - -') 
    
    });

    $('#id_sorteos_c_id').text('');
    ocultar_overlay_video()
    
    video_event.style.opacity        = 0;
    video_intro.style.opacity       = 0;
    screen_tablas.style.opacity     = 0;
    screen_resultados.style.opacity = 0;
    screen_jp.style.opacity         = 0;
  
    reload_err = false
    
    await Swal.fire({ title: 'Error', text: "Error al transmitir la carrera", showConfirmButton: false, icon: 'warning', timer: 60000 }).then(() => location.reload() )
  
  }

});



  

setInterval( async ()=> { 
    
  if(tiempo == 0 && vd && entra_intro){entra_intro = false

    sorteo_cierre = sorteo_ws   // el sorteo que acaba de cerrar: es el que se va a reproducir

    console.log('intro'); 
    entra_race = true
    
    entra_sincro_1 = true
    entra_sincro_2 = true
    entra_sincro_3 = true
    
    $('.precios_tbl').each( function() {  
      
      $(`#${$(this).attr('id')}`).css("color", "#fff")
      $($(this).attr('id')).text('- - -')

    });

    $('#id_sorteos_c_id').text('');

    // if(nup2[1] == 'X2' || nup2[1] == 'X3') video_intro.src = `http://localhost:300${pt}/${games[game_code]}/intro${nup2[1}.mp4`; 
    // else                                   video_intro.src = `http://localhost:300${pt}/${games[game_code]}/intro.mp4`; 
    
    // Multiplicador del evento en curso: llega por el WebSocket al cerrar ventas (estado in_progress).
    // No se usa el de Consulta_resultados: en este momento results[0] todavia es el evento anterior.
    mult_evento = etiqueta_multiplicador(multiplicador_ws)

    if(mult_evento == 'X2' || mult_evento == 'X3') video_intro.src = `../static/videos/${carpeta_video[game_code]}/intro${mult_evento}${sufijo_intro[game_code] || ''}.mp4`; 
    else                                          video_intro.src = `../static/videos/${carpeta_video[game_code]}/intro.mp4`; 

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

 

  }else if(tiempo == 60 && entra_sincro_1){ entra_sincro_1 = false  

    console.log("entra_sincro_1");
    sincronizacion()
    entra_intro = true
  
     
  }else if(tiempo == 120 && entra_sincro_2){ entra_sincro_2 = false 
    
    ver_w_p = false
    ver_b = false

    console.log("entra_sincro_2");
    sincronizacion()
    entra_intro = true
  
  }else if((event_tiempo - 30) == tiempo && entra_sincro_3){ entra_sincro_3 = false  

    console.log("entra_sincro_3");
    sincronizacion() 
    entra_intro = true

  }
  


} , 500);
 
 
 

 
   
$(document).ready(async()=>{

  $('.txt_lgr').text(localStorage.getItem('nm_lgr'))


  //Evitar que se pueda sombrar textos
  document.onselectstart = () => false;
  
  if (!navigator.onLine) cerrar_to()

  else if(localStorage.getItem('dkg') == null){
   
    localStorage.clear(); 
    window.location.href = "/";
    	
  }else{ 

    await confirmar_configuracion()

    await connectWebSocket();

    // Sin mensaje del WebSocket todavia: estado inicial desde el evento actual
    if (!id_table) await recuperar_evento_actual()

    vd = await Consulta_Tabla(id_table, Number(game_code));

    // Heartbeat periodico (guia 5.5)
    enviar_heartbeat()
    await mostrando_tablas() 
    
    // Primer arranque de este visor: registrar los ganadores existentes sin anunciarlos
    if (localStorage.getItem('jk_ganadores_vistos') == null) Consulta_ganador_jack()
    
  }
  

})