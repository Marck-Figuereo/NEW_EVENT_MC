

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



if(game_code == 5){
  

  var screen_resultados_en_carrera   = document.getElementById("container-resultado-en-carrera"); 
  var screen_resultados_medio_carrera   = document.getElementById("container-resultado-medio-carrera");

  const bkg_clss = {'1' : ['linear-gradient(to bottom, #3475ef, #002363)', '#fff'],
                    '2' : ['linear-gradient(to bottom, #fff, #bcbcbc)', '#000'],
                    '0' : ['linear-gradient(to bottom, #4b4b4b, #101010)', '#fff']}

}



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

// Duracion del video del evento en segundos (valor de prueba; luego llegara de la API
// junto con el nombre del video). Si el navegador ya leyo la duracion real del archivo
// (video_event.duration), se usa esa.
var tiempoVideo = 54.920

var overlay_video   = document.getElementById('overlay-video')   // solo existe en carreras
var vigilando_resultado = false   // revisa cuadro a cuadro el tiempo real del video

var ver_w_p = false
var ver_b = false  

var cc = true


var tiempo = 0
var event_tiempo = 288
  

var entra_intro = false;
var entra_race = false; 

var entra_sincro_1 = true
var entra_sincro_2 = true
var entra_sincro_3 = true

var internet = true

var id_table = 0;



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
    menjase_bonos.style.opacity = 0
    screen_jp.style.opacity = 0
    screen_bono.style.opacity = 0

  }

}

updateConnectionStatus = () => {

  if(!navigator.onLine) cerrar_to()

}




connectWebSocket = async () => {

    if (navigator.onLine) { // Solo intenta conectar si está online
        
        if(!internet) location.reload()  
      
        Swal.close()
        
        let websocket = new WebSocket(`ws://api-demp.applications.svc.cluster.local:8000/ws/pos/grupos/${localStorage.getItem('grupo')}/games/${localStorage.getItem('game_id')}/countdown/`);
        
        websocket.onmessage = (event) => {
            
            const data = JSON.parse(event.data);
            
            id_table = data['table_odds_id']
            tiempo = data['seconds_left']

            // El multiplicador solo aparece despues de cerrar ventas (estado in_progress)
            if (data['state'] === 'in_progress' && data['race_multiplier'] != null) multiplicador_ws = data['race_multiplier']
            else if (data['state'] === 'selling') multiplicador_ws = null
            
            $('#id_sorteos_c_id').text(data['event_number']);
            $('#tiempo_regresivo').text(formatoTiempo(tiempo));
            

        };

        websocket.onclose = () => setTimeout(connectWebSocket, 1000); // Intenta reconectar automáticamente

        websocket.onerror = () => websocket.close();
     
        return new Promise((resolve, reject)=>{
    
            setTimeout(()=> resolve(), 2000)
          
        })
    }

}

// Manejadores de eventos para cambios en el estado de la conexión
window.addEventListener('online',  connectWebSocket);
window.addEventListener('offline', updateConnectionStatus);


    
const sincronizacion = async () =>{

  await confirmar_configuracion()
 
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


const showGallos = async (inf) =>{

  const time_vd1 = Number(`${inf[0].substr(7,2)}000`)
  const time_vd2 = Number(`${inf[0].substr(10,2)}000`)
  const time_vd3 = Number(`${inf[0].substr(13,2)}000`)

  console.log(inf[0].substr(7,2), inf[0].substr(10,2), inf[0].substr(13,2));

  console.log(time_vd1, time_vd2, time_vd3);

  await esperar(time_vd1)

  console.log("Termino pelea 1");

  $("#div_medio_1").css("background" , bkg_clss[inf[0][2]][0])
  $("#div_medio_1").css("color" ,      bkg_clss[inf[0][2]][1])
  $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
  $(".txt_medio_1").text(convtSegs(inf[0].substr(7,2)))
  $(".tt_medio").text('Pelea #1')
  $("#container-resultado-medio-carrera").css("opacity" , "1")

  if(time_vd1 < 60000) await esperar(3000)

  $("#container-resultado-medio-carrera").css("opacity" , "0")
  $("#container-resultado-en-carrera").css("opacity" , "1")
  $("#div_result_1").css("background" , bkg_clss[inf[0][2]][0])
  $("#div_result_1").css("color" ,      bkg_clss[inf[0][2]][1])
  $("#div_result_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
  $(".txt_result_1").text(convtSegs(inf[0].substr(7,2)))

  iniciarConteoAscendente(Number(inf[0].substr(10,2)))


  await esperar(time_vd2)
  console.log("Termino pelea 2");

  $("#div_medio_1").css("background" , bkg_clss[inf[0][3]][0])
  $("#div_medio_1").css("color" ,      bkg_clss[inf[0][3]][1])
  $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
  $(".txt_medio_1").text(convtSegs(inf[0].substr(10,2)))
  $(".tt_medio").text('Pelea #2')
  $("#container-resultado-medio-carrera").css("opacity" , "1")

  if(time_vd2 < 60000) await esperar(3000)

  $("#container-resultado-medio-carrera").css("opacity" , "0")
  $("#div_result_2").css("background" , bkg_clss[inf[0][3]][0])
  $("#div_result_2").css("color" ,      bkg_clss[inf[0][3]][1])
  $("#div_result_2").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
  $(".txt_result_2").text(convtSegs(inf[0].substr(10,2)))

  iniciarConteoAscendente(Number(inf[0].substr(13,2)))


  await esperar(time_vd3)
  console.log("Termino pelea 3");    

  $("#div_medio_1").css("background" , bkg_clss[inf[0][4]][0])
  $("#div_medio_1").css("color" ,      bkg_clss[inf[0][4]][1])
  $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
  $(".txt_medio_1").text(convtSegs(inf[0].substr(13,2)))
  $(".tt_medio").text('Pelea #3')
  $("#container-resultado-medio-carrera").css("opacity" , "1")

  if(time_vd3 < 60000) await esperar(3000)

  $("#container-resultado-medio-carrera").css("opacity" , "0")
  $("#div_result_3").css("background" , bkg_clss[inf[0][4]][0])
  $("#div_result_3").css("color" ,      bkg_clss[inf[0][4]][1])
  $("#div_result_3").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")

  $(".txt_result_3").text(convtSegs(inf[0].substr(13,2)))

  await esperar(2000)

  detenerConteoAscendente();

}

const excute_race = async () =>{
   
  entra_sincro_1 = true
  entra_sincro_2 = true
  entra_sincro_3 = true

  nup = await Consulta_resultados()
  console.log("race",   nup);

  // Carreras: numero de carrera visible desde el inicio del video y cuotas listas para duracion - 10 s
  preparar_overlay_video()


  // video_event.src                = `http://localhost:3000/${games[game_code]}/${nup[0]}`;
  video_event.src               = `../static/videos/${games[game_code]}/perros8.mp4`;
  video_event.type               = 'video/mp4';
  
  screen_tablas.style.opacity   = 0;
  screen_jp.style.opacity       = 0;
  video_event.style.opacity      = 1;  
  video_event.muted = true

  video_event.play()

  if(game_code == 5){
    
    iniciarConteoAscendente(Number(nup[0].substr(7,2)))    
    await showGallos()
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

    const duracion = (isFinite(video_event.duration) && video_event.duration > 0) ? video_event.duration : tiempoVideo

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

  ver_w_p = await Consulta_ganador_jack()
  // Bono del sorteo exacto que se esta mostrando (nup[2] = sorteo_id del resultado)
  ver_b = await Consulta_bonos(nup[2])

  
  
  console.log("mostrando el video");

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

    console.log('intro'); 
    entra_race = true
    
    entra_sincro_1 = true
    entra_sincro_2 = true
    entra_sincro_3 = true
    
    nup2 = await Consulta_resultados()
    
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

    if(mult_evento == 'X2' || mult_evento == 'X3') video_intro.src = `../static/videos/${games[game_code]}/intro${mult_evento}${sufijo_intro[game_code] || ''}.mp4`; 
    else                                          video_intro.src = `../static/videos/${games[game_code]}/intro.mp4`; 

    console.log('intro', video_intro.src, 'multiplicador:', mult_evento);
 
    
    console.log(nup2); 
    
    video_intro.type                  = 'video/mp4';
    video_intro.style.opacity         = 1;
    screen_resultados.style.opacity   = 0;
    screen_tablas.style.opacity       = 0;
    
    screen_jp.style.opacity           = 0;
    screen_bono.style.opacity         = 0;
    video_intro.muted = true
    video_intro.play() 

 

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

    await connectWebSocket();

    vd = await Consulta_Tabla(id_table, Number(game_code));
    await mostrando_tablas() 
    
    // Primer arranque de este visor: registrar los ganadores existentes sin anunciarlos
    if (localStorage.getItem('jk_ganadores_vistos') == null) Consulta_ganador_jack()
    
  }
  

})