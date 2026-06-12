const seg_intro   = [110, 290, 470, 650, 830, 1010, 1190, 1370, 1550, 1730, 1910, 2090, 2270, 2450, 2630, 2810, 2990, 3170, 3350, 3530];     
const num_intro   = [115, 295, 475, 655, 835, 1015, 1195, 1375, 1555, 1735, 1915, 2095, 2275, 2455, 2635, 2815, 2995, 3175, 3355, 3535];
const seg_race    = [120, 300, 480, 660, 840, 1020, 1200, 1380, 1560, 1740, 1920, 2100, 2280, 2460, 2640, 2820, 3000, 3180, 3360, 3540];     
const seg_sincro  = [60,  240, 420, 600, 780, 960,  1140, 1320, 1500, 1680, 1860, 2040, 2220, 2400, 2580, 2760, 2940, 3120, 3300, 3480];     

const DURACION_HORA = 3600; // 60 * 60



var video_intro         = document.getElementById("intro");


var video_race          = document.getElementById("race"); 

var screen_tablas       = document.getElementById("cuerpo"); 
var screen_resultados   = document.getElementById("container-resultado-carrera"); 
var screen_multi_intro   = document.getElementById("container-resultado-multiplicados"); 


var screen_jp           = document.getElementById("container-jackpots");
var screen_bono         = document.getElementById('ganador-bono')




video_race.style.width  = '100%'; 
video_race.style.height = '100%'

video_intro.style.width = '100%';
video_intro.style.height = '100%';

var vd = false
var nup = ["", ""]
var nup2 = []

var ver_w_p = false
var ver_b = false

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
    screen_jp.style.opacity = 0
    screen_bono.style.opacity = 0
    screen_multi_intro.style.opacity = 0

  }

}

updateConnectionStatus = () => {

  if(!navigator.onLine) cerrar_to()

}


connectWebSocket = async () => {
  
  if (navigator.onLine) { // Solo intenta conectar si está online

    if(!internet) {
      location.reload()  
      internet = true
      
    }
    
    Swal.close()
    let latestTimestamp = 0;

    let websocket = new WebSocket('wss://time.varmanex.com');

    websocket.onmessage = (event) => {
    
      const data = JSON.parse(event.data);
      const messageTimestamp = parseFloat(data.timestamp);

      if (messageTimestamp > latestTimestamp) {
    
        latestTimestamp = messageTimestamp;  // Actualiza la marca de tiempo más reciente
        
        const date = new Date(data.time);
        
        horas    = date.getHours()
        minutos  = date.getMinutes()
        segundos = date.getSeconds()
        dia      = date.getDate()
        mes      = date.getMonth()
        year     = date.getFullYear()

      }
    
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
  
  const fecha1 = `${fecha_t} ${hora_t.substr(0, 6)}00`.replace('/', '-').replace('/', '-')
  const fecha2 = `${fecha_aqu} ${tiempo.substr(0, 6)}00`.replace('/', '-').replace('/', '-')

  var dift = moment(fecha2).diff(moment(fecha1), 'minute')
  
  if(dift <= 2 ) return false 
  else return true



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

  Consulta_bonos()

  var c3 = false 
  setInterval(()=>{ 
    
    if(c3){
      
      c3= false 
      document.getElementById('titulow').classList.remove('bns-white')
      document.getElementById('titulow').classList.add('bns-red')
      document.getElementById('id_bns').style.border = '5px solid #a70000'
      document.getElementById('mnt_bns').style.border = '5px solid #a70000'

    }else{

      c3 = true
      document.getElementById('titulow').classList.add('bns-white')
      document.getElementById('titulow').classList.remove('bns-red') 
      document.getElementById('id_bns').style.border = '5px solid #2e2e2e'
      document.getElementById('mnt_bns').style.border = '5px solid #2e2e2e'
    }
    
  }, 400)

}



const mostrando_win_jackpot = () => {
  
  video_race.currentTime            = 0
  video_intro.currentTime           = 0

  screen_tablas.style.opacity       = 0;
  video_intro.style.opacity         = 0;
  video_race.style.opacity          = 0;
  
  
  screen_multi_intro.style.opacity = 0
  screen_resultados.style.opacity   = 0;
  screen_jp.style.opacity           = 1;
  screen_bono.style.opacity         = 0

}



const mostrando_resultado = () => {
  
  
  
  video_race.currentTime = 0
  video_intro.currentTime = 0
  
  screen_tablas.style.opacity     = 0;
  video_intro.style.opacity       = 0;
  video_race.style.opacity        = 0;
  

  screen_jp.style.opacity = 0;

  screen_bono.style.opacity         = 0
  
  screen_resultados.style.opacity = 1;
  
  screen_multi_intro.style.opacity = 0 


}

const mostrando_tablas = async () =>{
 


  video_race.style.opacity        = 0;
  video_intro.style.opacity       = 0;
  screen_resultados.style.opacity = 0;
  

  screen_jp.style.opacity = 0;

  
  screen_tablas.style.opacity     = 1;
  screen_bono.style.opacity         = 0
  screen_multi_intro.style.opacity = 0


}


const excute_race = async () =>{
    
  $("#container-resultado-multiplicados div").remove()
  
  nup = await Consulta_resultados(false)

  const vds = nup[0].length < 4 ? `0${nup[0]}` : nup[0]

  console.log(vds.replace(',', '_'), `0${nup[0]}`);  

  // video_race.src    = `http://localhost:3000/roulette/${vds.replace(',', '_')}.webm`;
  video_race.src    =  `static/videos/ruleta/${vds.replace(',', '_')}.webm`;

  video_race.type               = 'video/webm';
  
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

  $("#container-resultado-multiplicados div").remove()
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




video_intro.addEventListener('playing', async () => {
    
  ver_w_p = await Consulta_ganador_jack()
  ver_b = await Consulta_bonos()

})
  

reload_err = true
video_race.addEventListener('error', async () => {

  $("#container-resultado-multiplicados div").remove()

  if (reload_err){

    await esperar(3000)
    excute_race()
    reload_err = false

  }else{

    $('#id_sorteos_c_id').val('');

    video_race.style.opacity        = 0;
    video_intro.style.opacity       = 0;
    screen_tablas.style.opacity     = 0;
    screen_resultados.style.opacity = 0;
    screen_jp.style.opacity         = 0;
    screen_multi_intro.style.opacity = 0

    reload_err = true
    
    await Swal.fire({ title: 'Error', text: "Error al transmitir", showConfirmButton: false, icon: 'warning', timer: 60000 }).then(() => location.reload() )
       
  }

});



 

var actualizando_seg = (mint, seg) => {

    const t = (mint * 60) + seg;  // segundos dentro de la hora
    let segundos_res;

    // 1. Si estamos antes del primer cierre de la hora
    if (t < seg_intro[0]) segundos_res = seg_intro[0] - t; // cuenta hasta 110

    else {
        // 2. Buscar el próximo cierre dentro de esta hora
        let proximo_cierre = seg_intro.find(c => c > t);

        if (proximo_cierre) segundos_res = proximo_cierre - t; // Hay un cierre más adelante en esta misma hora
        else {
            // 3. Ya pasamos el ÚLTIMO cierre (3410 = 56:50)
            // Próximo cierre: PRIMER cierre de la SIGUIENTE hora
            // 3600 (fin de la hora actual) + 110 (primer cierre)
            proximo_cierre = DURACION_HORA + seg_intro[0]; // 3600 + 110
            segundos_res = proximo_cierre - t;
        }
    }
    
    $('#tiempo_regresivo').text( new Date(segundos_res * 1000).toISOString().slice(14, 19) );


};




$(document).ready(async()=>{
  
  $('.txt_lgr').text(localStorage.getItem('nm_lgr'))
  Consulta_grupo()
  
  // //Evitar que se pueda sombrar textos
  document.onselectstart = () => false;
  console.log(!navigator.onLine);
  if (!navigator.onLine) cerrar_to()

  else if(localStorage.getItem('usr') == null || localStorage.getItem('pss') == null) window.location.href = "/";


  await connectWebSocket();

  vd = await Consulta_Tabla();
  await mostrando_tablas() 

  Consulta_ganador_jack()

  

})
 


const allinfo = async()=> vd = await Consulta_Tabla() 


setInterval( async ()=> {
  

  actualizando_seg(minutos, segundos)

 
  if( seg_intro.includes( (minutos * 60) + segundos ) && vd[0] && entra_intro){
      

    entra_intro = false

    nup2 = await Consulta_resultados(true)
    
    console.log("intro", `intro_x${Object.keys(nup2[1]).length}`,  nup2, Object.keys(nup2[1]).length);
    $('#id_sorteos_c_id').val('');

    
    
    // video_intro.src = `http://localhost:3000/roulette/intrro_r${Object.keys(nup2[1]).length}.mp4`;  

    
    video_intro.src = `static/videos/intrro_r${Object.keys(nup2[1]).length}.mp4`;  
 
    video_intro.type                  = 'video/mp4';
    video_intro.style.opacity         = 1;
    

    screen_resultados.style.opacity   = 0;
    screen_tablas.style.opacity       = 0;
    
    screen_jp.style.opacity           = 0;
    screen_bono.style.opacity         = 0;
    
    video_intro.muted = true

    video_intro.play() 



  }else if( seg_race.includes( (minutos * 60) + segundos ) && vd[0] && entra_race){
    console.log("race");
    entra_race = false
    excute_race()
    

  }

  if( num_intro.includes( (minutos * 60) + segundos ) && video_intro.style.opacity == 1 && nup2[2]){

    
    $("#container-resultado-multiplicados div").remove()

    
    console.log(Object.keys(nup2[1]).length);

    $("#container-resultado-multiplicados").append(`<div class="box_x${Object.keys(nup2[1]).length}"></div>`)

    Object.keys(nup2[1]).forEach((key, inx) => {
      

      $(`#container-resultado-multiplicados .box_x${Object.keys(nup2[1]).length}`).append(`<div class="multis_${inx+1}">`+
                                                              `<p class="xnum">X${nup2[1][key]}</p>`+
                                                              `<p class="num">${key}</p>`+
                                                            `</div>`) 
    
    });


    screen_multi_intro.style.opacity  = 1


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
 
 
 

 
   
