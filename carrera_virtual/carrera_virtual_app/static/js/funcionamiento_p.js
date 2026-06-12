const seg_intro   = [290, 590, 890,  1190, 1490, 1790, 2090, 2390, 2690, 2990, 3290, 3590];  
const DURACION_HORA = 3600; // 60 * 60

const seg_race    = [0,   300, 600,  900,  1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300];

const seg_sincro  = [120,   420, 720,  1020,  1320, 1620, 1920, 2220, 2520, 2820, 3120, 3420];    


var video_intro         = document.getElementById("intro"); 
var video_race          = document.getElementById("race"); 

var screen_tablas       = document.getElementById("cuerpo"); 
var screen_resultados   = document.getElementById("container-resultado-carrera"); 

var menjase_bonos       = document.getElementById("container-resultado-bonos");

var screen_jp           = document.getElementById("container-jackpots");
var screen_bono         = document.getElementById('ganador-bono')


 

video_race.style.width  = '100%'; 
video_race.style.height = '100%'

video_intro.style.width = '100%';
video_intro.style.height = '100%';

var vd = false;
var nup = ["", ""]
var nup2 = ["", ""]

var ver_w_p = false
var ver_b = false
var ver_p = false
var condi_ver_p = false

var cc = true



var horas = 0;
var minutos = 0;
var segundos = 0;
var dia = 0;
var mes = 0;
var year = 0;

var entra_intro = true;
var entra_race = true;
var entra_tabla = true;

var internet = true

cerrar_to = () =>{

  if (video_race.currentTime == 0 &&  screen_resultados.style.opacity == 0 && screen_bono.style.opacity == 0 && screen_jp.style.opacity == 0){

    internet = false
    Swal.fire({ title: 'Error de conexion', showConfirmButton: false, icon: 'warning' })
    video_intro.style.opacity = 0
    video_race.style.opacity = 0
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
        
        Swal.close()
        let latestTimestamp = 0;

        let websocket = new WebSocket(`ws://127.0.0.1:8500/ws/pos/games/${gameId}/countdown/`);
        
        websocket.onmessage = (event) => {
            
            const data = JSON.parse(event.data);
            // console.log(data['seconds_left'], data)

            if(!data['can_sell']) borrar_bets(), $('#cuerpo_carga').addClass('sombra')
            
            tiempo = data
            $('#tiempo_regresivo').val(tiempo['seconds_left']);

 

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




const confirmacion_tabla = (fecha_t, hora_t)=> {
      
  const hrs  = (horas     < 10 ? '0' : '') + horas
  const mit  = (minutos   < 10 ? '0' : '') + minutos
  const segd = (segundos  < 10 ? '0' : '') + segundos
  
  const dia2 = (dia     < 10 ? '0' : '') + dia
  const mes2 = ((mes+1) < 10 ? '0' : '') + (mes+1)


  const tiempo = hrs + ":" + mit + ":" + segd
  const fecha_aqu = year + "/" + mes2 + "/" + dia2
  
  //Verificando si los minutos, horas y fechas estan sincronizadas
  if ( (Number(hora_t.substr(3,1)) == Number(tiempo.substr(3,1))) && (Number(hora_t.substr(0,2)) == Number(tiempo.substr(0,2)) ) && (fecha_t == fecha_aqu) ){

      //Confirmando cual tiempo correspondiente, la mitad o el completo
      let dejaver = 
          
      (Number(tiempo.substr(4,1)) > 4 && Number(hora_t.substr(3,2)) == Number(tiempo.substr(3,1) + '5') ) 
      ||  (Number(tiempo.substr(4,1)) < 5 && Number(hora_t.substr(3,2)) == Number(tiempo.substr(3,1) + '0') )
      
      if(!dejaver){ return true   }else{return false}
      


  
  }else{ return true }



} 
    
const sincronizacion = async () =>{

  const fecha = localStorage.getItem('fecha')
  const hora = localStorage.getItem('hora')

  const good = confirmacion_tabla(fecha, hora)
 
  if (good) vd = await Consulta_Tabla() 

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
  
  video_race.currentTime            = 0
  video_intro.currentTime           = 0

  screen_tablas.style.opacity       = 0;
  video_intro.style.opacity         = 0;
  video_race.style.opacity          = 0;
  
  menjase_bonos.style.opacity       = 0;
  

  screen_resultados.style.opacity   = 0;
  screen_jp.style.opacity           = 1;
  screen_bono.style.opacity         = 0


}



const mostrando_resultado = async () => {
  
  
  
  video_race.currentTime = 0
  video_intro.currentTime = 0
  
  screen_tablas.style.opacity     = 0;
  video_intro.style.opacity       = 0;
  video_race.style.opacity        = 0;
  
  menjase_bonos.style.opacity  = 0;

  screen_jp.style.opacity = 0;

  screen_bono.style.opacity         = 0
  
  screen_resultados.style.opacity = 1;
  

  document.getElementById("pos_bono").innerHTML = "";

}

const mostrando_tablas = async () =>{

  document.getElementById("pos_bono").innerHTML = '';

  video_race.style.opacity        = 0;
  video_intro.style.opacity       = 0;
  screen_resultados.style.opacity = 0;
  
  menjase_bonos.style.opacity  = 0;

  screen_jp.style.opacity = 0;

  
  screen_tablas.style.opacity     = 1;
  screen_bono.style.opacity         = 0

  
}

const excute_race = async () =>{

  // nup = await Consulta_resultados()
  await Consulta_resultados()

  // vid = `${nup[0].substr(0,1)}-${nup[0].substr(1,1)}-${nup[0].substr(3,1)}`
  
  // console.log(vid);
  


    // video_race.src                = `http://localhost:3000/dog/${vid}.mp4`;
    
    video_race.src               = `../static/videos/1-2-B.mp4`;
    video_race.type               = 'video/mp4';
  

  

  screen_tablas.style.opacity   = 0;
  screen_jp.style.opacity       = 0;
  video_race.style.opacity      = 1;  
  video_race.muted = true

  video_race.play()
    
 
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

  

video_race.addEventListener('ended', async () => {

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




video_race.addEventListener('playing', async () => {

  if(nup[1] == 'X2' || nup[1] == 'X3'){
    
    menjase_bonos.style.opacity  = 1;
    document.getElementById('pos_bono').src = `../static/img/${nup[1]}_V.png`

    
  }

    
  // ver_w_p = await Consulta_ganador_jack()
  // ver_b = await Consulta_bonos()
  await Consulta_ganador_jack()
  await Consulta_bonos()

})
  

reload_err = true
video_race.addEventListener('error', async () => {

  if (reload_err){

    await esperar(3000)
    excute_race()
    reload_err = false

  }else{

    $('.precios_tbl').each(()=> $($(this).attr('id')).text('- - -') );

    $('#id_sorteos_c_id').val('');
    
    video_race.style.opacity        = 0;
    video_intro.style.opacity       = 0;
    screen_tablas.style.opacity     = 0;
    screen_resultados.style.opacity = 0;
    screen_jp.style.opacity         = 0;
  
    reload_err = false
    
    await Swal.fire({ title: 'Error', text: "Error al transmitir la carrera", showConfirmButton: false, icon: 'warning', timer: 60000 }).then(() => location.reload() )
  
  }

});





// var actualizando_seg = (mint, seg) => {

//     const t = (mint * 60) + seg;  // segundos dentro de la hora (0–3599)
//     let segundos_res;

//     // 1. Antes del primer cierre de la hora
//     if (t < seg_intro[0]) segundos_res = seg_intro[0] - t; // Cuenta regresiva hasta el primer cierre (230 = 3:50)

//     else {

//         // 2. Buscar el próximo cierre dentro de esta misma hora
//         let proximo_cierre = seg_intro.find(c => c > t);

//         if (proximo_cierre) segundos_res = proximo_cierre - t; // Hay un cierre por delante en esta hora
        
//         else {
//             // 3. Ya pasamos el ÚLTIMO cierre (3530 = 58:50)
//             // Próximo cierre = PRIMER cierre de la SIGUIENTE hora
//             // 3600 (fin de la hora) + 230 (primer cierre)
//             proximo_cierre = DURACION_HORA + seg_intro[0]; // 3600 + 230
//             segundos_res = proximo_cierre - t;
//         }
//     }

//     $('#tiempo_regresivo').text( new Date(segundos_res * 1000).toISOString().slice(14, 19) );

// };





$(document).ready(async()=>{

  $('.txt_lgr').text(localStorage.getItem('nm_lgr'))
  Consulta_grupo()

  //Evitar que se pueda sombrar textos
  document.onselectstart = () => false;
  
  if (!navigator.onLine) cerrar_to()

  else if(localStorage.getItem('usr') == null || localStorage.getItem('pss') == null){

		window.location.href = "/";
    	
  }else{ 

    await connectWebSocket();

    // vd = await Consulta_Tabla();
    await Consulta_Tabla();
    await mostrando_tablas() 
    
    Consulta_ganador_jack()
    
  }
  

})
 


// const allinfo = async()=> vd = await Consulta_Tabla() 
const allinfo = async()=> await Consulta_Tabla() 

setInterval( async ()=> {
  

  // actualizando_seg(minutos, segundos)
  
  if( seg_intro.includes( (minutos * 60) + segundos ) && vd && entra_intro){
      
    entra_intro = false
    
    // nup2 = await Consulta_resultados()
    await Consulta_resultados()

  
    $('.precios_tbl').each(()=> {  
    
      $($(this).attr('id')).text('- - -')

    });

    $('#id_sorteos_c_id').val('');

    if(localStorage.getItem('url') != null) pt = 6
    else pt = 0

    // if(nup2[1] == 'X2' || nup2[1] == 'X3') video_intro.src = `http://localhost:300${pt}/dog/intro${nup2[1]}.mp4`; 
    // else                                   video_intro.src = `http://localhost:300${pt}/dog/intro.mp4`; 
    
    // if(nup2[1] == 'X2' || nup2[1] == 'X3') video_intro.src = `static/videos/dog/intro${nup2[1]}.mp4`; 
    // else                                   video_intro.src = `static/videos/dog/intro.mp4`; 
    video_intro.src = `../static/videos/intro.mp4`; 
  
      

    video_intro.type                  = 'video/mp4';
    video_intro.style.opacity         = 1;
    screen_resultados.style.opacity   = 0;
    screen_tablas.style.opacity       = 0;
    
    screen_jp.style.opacity           = 0;
    screen_bono.style.opacity         = 0;
    video_intro.muted = true
    video_intro.play() 

 
    
    

  }else if( seg_race.includes( (minutos * 60) + segundos ) && vd && entra_race){


    entra_race = false    
    excute_race()
    

  }
 
  
  if(seg_race.includes(((minutos * 60) + segundos) - 60 ) || seg_race.includes(((minutos * 60) + segundos) + 60 )){ 
  
    sincronizacion()
    
    entra_race = true
    entra_tabla = true
    entra_intro = true

  }if(seg_sincro.includes((minutos * 60) + segundos) ){
    
    ver_w_p = false
    ver_b = false
    
    sincronizacion()
    Consulta_grupo()
  
  
  }if(seg_race.includes( ((minutos * 60) + segundos) - 35 ) && entra_tabla){ 
  
    allinfo()
    entra_tabla = false;

  }
  


} , 500);
 
 
 

 
   
