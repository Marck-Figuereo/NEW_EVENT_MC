

const game_code = localStorage.getItem('game_id')

const games = {
                5 : 'gallos',
                4 : 'horse',
                3 : 'dog8',
                2 : 'dog',
                1 : 'roulette'
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
        let latestTimestamp = 0;
        let websocket = new WebSocket(`ws://127.0.0.1:8500/ws/pos/grupos/${localStorage.getItem('grupo')}/games/${localStorage.getItem('game_id')}/countdown/`);
        
        websocket.onmessage = (event) => {
            
            const data = JSON.parse(event.data);
            
            id_table = data['table_odds_id']
            tiempo = data['seconds_left']
            
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

 


const mostrando_bonos = () => {

  screen_resultados.style.opacity   = 0;  
  screen_bono.style.opacity         = 1


  var c3 = false 
  setInterval(()=>{ 
    
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
  
  }else if([2,3,4].includes(game_code)){
    
    document.getElementById("pos_bono").innerHTML = "";
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


  if(game_code == 5){
    screen_resultados_en_carrera.style.opacity    = 0
    screen_resultados_medio_carrera.style.opacity = 0
    $("#div_result_1, #div_result_2, #div_result_3").css({background: "transparent", color: "transparent"}); 
  
  }else if([2,3,4].includes(game_code)){
    
    document.getElementById("pos_bono").innerHTML = "";
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

  // video_event.src                = `http://localhost:3000/${games[game_code]}/${nup[0]}`;
  
  video_event.src               = `../static/videos/1-2-B.mp4`;
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

video_event.addEventListener('ended', async () => {

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

  


})




video_event.addEventListener('playing', async () => {

  if(game_code != 5){

    if(nup[1] == 'X2' || nup[1] == 'X3'){
      
      menjase_bonos.style.opacity  = 1;
      document.getElementById('pos_bono').src = `../static/img/${nup[1]}_V.png`
      
    }

  }

  ver_w_p = await Consulta_ganador_jack()
  ver_b = await Consulta_bonos()

  
  
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
    
    // if(nup2[1] == 'X2' || nup2[1] == 'X3') video_intro.src = `../static/videos/${games[game_code]}/intro${nup2[1]}.mp4`; 
    // else                                   video_intro.src = `../static/videos/${games[game_code]}/intro.mp4`; 

    video_intro.src = `../static/videos/intro.mp4`; 
    
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
    
    Consulta_ganador_jack()
    
  }
  

})