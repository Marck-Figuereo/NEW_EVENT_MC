const seg_intro   = [290, 650, 1010, 1370, 1730, 2090, 2450, 2810, 3170, 3530];     
const seg_race    = [300, 660, 1020, 1380, 1740, 2100, 2460, 2820, 3180, 3540];

const seg_sincro  = [180,240,  540,600,  900,960,  1260,1320,  1620,1680,  1980,2040,  2340,2400,  2700,2760,  3060,3120,  3420,3480];         


var video_intro         = document.getElementById("intro"); 
var video_round1          = document.getElementById("round1"); 


var screen_tablas       = document.getElementById("cuerpo"); 
var screen_resultados   = document.getElementById("container-resultado-carrera"); 

var screen_resultados_en_carrera   = document.getElementById("container-resultado-en-carrera"); 
var screen_resultados_medio_carrera   = document.getElementById("container-resultado-medio-carrera");
var screen_jp           = document.getElementById("container-jackpots");
var screen_bono         = document.getElementById('ganador-bono')


const bkg_clss = {'1' : ['linear-gradient(to bottom, #3475ef, #002363)', '#fff'],
                  '2' : ['linear-gradient(to bottom, #fff, #bcbcbc)', '#000'],
                  '0' : ['linear-gradient(to bottom, #4b4b4b, #101010)', '#fff']}


video_round1.style.width  = '100%'; 
video_round1.style.height = '100%' 

video_intro.style.width = '100%';
video_intro.style.height = '100%';

var vd = false
var nup = ["", ""]
var nup2 = '' 

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


let contadorInterval = null;
let contadorValor = 0;

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

  if (video_round1.currentTime == 0 && screen_resultados.style.opacity == 0 && screen_bono.style.opacity == 0 && screen_jp.style.opacity == 0){

    internet = false
    Swal.fire({ title: 'Error de conexion', showConfirmButton: false, icon: 'warning' })
    video_intro.style.opacity = 0
    video_round1.style.opacity = 0
    screen_resultados_en_carrera.style.opacity = 0
    screen_resultados_medio_carrera.style.opacity = 0
    screen_tablas.style.opacity = 0
    screen_resultados.style.opacity = 0
    
    screen_jp.style.opacity = 0
    screen_bono.style.opacity = 0

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
  
  if(dift <= 5 ) return false 
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
      document.getElementById('titulow').classList.add('bns-blue')
      document.getElementById('id_bns').style.border = '5px solid #37386c'
      document.getElementById('mnt_bns').style.border = '5px solid #37386c'

    }else{

      c3 = true
      document.getElementById('titulow').classList.remove('bns-blue')
      document.getElementById('titulow').classList.add('bns-white')
      document.getElementById('id_bns').style.border = '5px solid #ffffff'
      document.getElementById('mnt_bns').style.border = '5px solid #ffffff'
    }
    
  }, 400)

}



const mostrando_win_jackpot = () => {
  
    video_round1.currentTime          = 0
    video_round1.style.opacity        = 0;

    video_intro.currentTime           = 0
    screen_resultados_en_carrera.style.opacity    = 0
    screen_resultados_medio_carrera.style.opacity = 0 
    screen_tablas.style.opacity       = 0
    video_intro.style.opacity         = 0
    
  

  screen_resultados.style.opacity   = 0;
  screen_jp.style.opacity           = 1;
  screen_bono.style.opacity         = 0

}



const mostrando_resultado = () => {
  

    $("#div_result_1, #div_result_2, #div_result_3").css({background: "transparent", color: "transparent"});
    
    video_round1.currentTime = 0
    video_round1.style.opacity        = 0;

    video_intro.currentTime = 0
    screen_resultados_en_carrera.style.opacity = 0
    screen_resultados_medio_carrera.style.opacity = 0
    screen_tablas.style.opacity     = 0;
    video_intro.style.opacity       = 0;
    

    

    screen_jp.style.opacity = 0;

    screen_bono.style.opacity         = 0

    screen_resultados.style.opacity = 1;



}


const mostrando_tablas = async () =>{


  $("#div_result_1, #div_result_2, #div_result_3").css({background: "transparent", color: "transparent"});
  
  screen_resultados_en_carrera.style.opacity = 0
  screen_resultados_medio_carrera.style.opacity = 0
  
  video_round1.style.opacity        = 0;
  video_round1.currentTime = 0
  
  video_intro.style.opacity       = 0;
  screen_resultados.style.opacity = 0;
  
  

  screen_jp.style.opacity = 0;

  
  screen_tablas.style.opacity     = 1;
  screen_bono.style.opacity         = 0



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

    }, 15000)
  
  
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



video_round1.addEventListener('playing', async () => {
 

    const time_vd1 = Number(`${nup2[0].substr(7,2)}000`)
    const time_vd2 = Number(`${nup2[0].substr(10,2)}000`)
    const time_vd3 = Number(`${nup2[0].substr(13,2)}000`)

    console.log(nup2[0].substr(7,2), nup2[0].substr(10,2), nup2[0].substr(13,2));
    
    console.log(time_vd1, time_vd2, time_vd3);
    
    await esperar(time_vd1)
    
    console.log("Termino pelea 1");
    
    $("#div_medio_1").css("background" , bkg_clss[nup2[0][2]][0])
    $("#div_medio_1").css("color" ,      bkg_clss[nup2[0][2]][1])
    $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
    $(".txt_medio_1").text(convtSegs(nup2[0].substr(7,2)))
    $(".tt_medio").text('Pelea #1')
    $("#container-resultado-medio-carrera").css("opacity" , "1")
    
    if(time_vd1 < 60000) await esperar(3000)
    
    $("#container-resultado-medio-carrera").css("opacity" , "0")
    $("#container-resultado-en-carrera").css("opacity" , "1")
    $("#div_result_1").css("background" , bkg_clss[nup2[0][2]][0])
    $("#div_result_1").css("color" ,      bkg_clss[nup2[0][2]][1])
    $("#div_result_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
    $(".txt_result_1").text(convtSegs(nup2[0].substr(7,2)))

    iniciarConteoAscendente(Number(nup2[0].substr(10,2)))

  
    await esperar(time_vd2)
    console.log("Termino pelea 2");

    $("#div_medio_1").css("background" , bkg_clss[nup2[0][3]][0])
    $("#div_medio_1").css("color" ,      bkg_clss[nup2[0][3]][1])
    $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
    $(".txt_medio_1").text(convtSegs(nup2[0].substr(10,2)))
    $(".tt_medio").text('Pelea #2')
    $("#container-resultado-medio-carrera").css("opacity" , "1")
    
    if(time_vd2 < 60000) await esperar(3000)

    $("#container-resultado-medio-carrera").css("opacity" , "0")
    $("#div_result_2").css("background" , bkg_clss[nup2[0][3]][0])
    $("#div_result_2").css("color" ,      bkg_clss[nup2[0][3]][1])
    $("#div_result_2").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
    $(".txt_result_2").text(convtSegs(nup2[0].substr(10,2)))

    iniciarConteoAscendente(Number(nup2[0].substr(13,2)))

    
    await esperar(time_vd3)
    console.log("Termino pelea 3");    

    $("#div_medio_1").css("background" , bkg_clss[nup2[0][4]][0])
    $("#div_medio_1").css("color" ,      bkg_clss[nup2[0][4]][1])
    $("#div_medio_1").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")
    $(".txt_medio_1").text(convtSegs(nup2[0].substr(13,2)))
    $(".tt_medio").text('Pelea #3')
    $("#container-resultado-medio-carrera").css("opacity" , "1")
    
    if(time_vd3 < 60000) await esperar(3000)

    $("#container-resultado-medio-carrera").css("opacity" , "0")
    $("#div_result_3").css("background" , bkg_clss[nup2[0][4]][0])
    $("#div_result_3").css("color" ,      bkg_clss[nup2[0][4]][1])
    $("#div_result_3").css("box-shadow" , "inset 3px 3px 8px rgba(255, 255, 255, 0.274),  inset 0 1px 1px rgba(255, 255, 255, 0.432)")

    $(".txt_result_3").text(convtSegs(nup2[0].substr(13,2)))

    await esperar(2000)
    
    detenerConteoAscendente();


})



video_round1.addEventListener('ended', async () => {

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





  

video_round1.addEventListener('error', async () => {

  detenerConteoAscendente();
  $('#id_sorteos_c_id').val('');

  $('.ods').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });
    

  
  screen_tablas.style.opacity = 0;


  video_round1.style.opacity  = 0
  video_round1.currentTime    = 0
  
  video_intro.style.opacity       = 0;
  screen_resultados.style.opacity = 0;
  screen_resultados_en_carrera.style.opacity      = 0
  screen_resultados_medio_carrera.style.opacity =  0
  screen_jp.style.opacity = 0;
 

  await Swal.fire({ title: 'Error', text: "Error al transmitir la carrera", showConfirmButton: false, icon: 'warning', timer: 60000 }).then(() => location.reload() )
   

});

 


var actualizando_seg = (mint, seg) => {

    const t = (mint * 60) + seg;  // segundos dentro de la hora
    let segundos_res;

    seg_intro.forEach(se_ra => {
        
        if (t > se_ra) {
    
            const s_indice = seg_intro.indexOf(se_ra);

            if (s_indice === 9) {
                // DESPUÉS DEL ÚLTIMO CIERRE DE LA HORA
                // próximo cierre: primera carrera de la SIGUIENTE hora
                const proximo_cierre = 3600 + seg_intro[0]; // 3600 + 290
                segundos_res = proximo_cierre - t;
                
            } else segundos_res = seg_intro[s_indice + 1] - t; // Cualquier otro: tiempo hasta el siguiente cierre del array
            
            
            $('#tiempo_regresivo').text( new Date(segundos_res * 1000).toISOString().slice(14, 19) );
            
        } else if (t < seg_intro[0]) {
            
            // Antes de la primera carrera de la hora:
            // contar hasta seg_intro[0] (290 = 4:50)
            segundos_res = seg_intro[0] - t;

            $('#tiempo_regresivo').text( new Date(segundos_res * 1000).toISOString().slice(14, 19));
        
        }
    });    

};


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

  
    vd = await Consulta_Tabla(); 
    await mostrando_tablas() 

    Consulta_ganador_jack()
    
  }
  

})
 




const allinfo = async()=> vd = await Consulta_Tabla() 

setInterval( async ()=> {
  
  
  actualizando_seg(minutos, segundos)
  

  console.log(( (minutos * 60) + segundos ), vd, entra_race)
  
  // console.log("conteo");
  if( seg_intro.includes( (minutos * 60) + segundos ) && vd && entra_intro){
      
    entra_intro = false 

    nup2 = await Consulta_resultados()
    
    
    $('#id_sorteos_c_id').val('');

    $('.ods').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });
     
    
    // video_intro.src = `http://localhost:3000/gallos/intro.mp4`; 
    video_intro.src = `static/videos//gallos/intro.mp4`;  

    video_intro.type                  = 'video/mp4';
    video_intro.style.opacity         = 1;
    screen_resultados.style.opacity   = 0;
    screen_tablas.style.opacity       = 0;
    
    screen_jp.style.opacity           = 0;
    screen_bono.style.opacity         = 0;

    video_intro.play() 
   
    
    

  }else if( seg_race.includes( (minutos * 60) + segundos ) && vd && entra_race ){
    
    console.log("entra 1");
    console.log(( (minutos * 60) + segundos ), seg_race);
    entra_race = false    
  
    nup2 = await Consulta_resultados() 

    console.log(nup2, 'ss');
    
    // video_round1.src                = `http://localhost:3000/gallos/${nup2[0].substr(2,3)}/${nup2[0].substr(6)}.mp4`;
    video_round1.src               = `static/videos/gallos/${nup2[0].substr(2,3)}/${nup2[0].substr(6)}.mp4`;

    
    video_round1.type             = 'video/mp4';
    
    screen_tablas.style.opacity   = 0;
    screen_jp.style.opacity       = 0;
    video_round1.style.opacity    = 1;
    
    video_round1.muted            = true
    
    video_round1.play()
    iniciarConteoAscendente(Number(nup2[0].substr(7,2)))    
      
    

  }
 
  
  if(seg_sincro.includes((minutos * 60) + segundos) ){ // sincronizacion
    
    console.log('sincronizacion', ((minutos * 60) + segundos))
    
    sincronizacion()
    Consulta_grupo()

    entra_race = true
    entra_intro = true
    entra_tabla = true;
   
    ver_w_p = false
    ver_b = false


  }if(seg_race.includes( ((minutos * 60) + segundos) - 120 ) && entra_tabla){  // Actualizacion tabla para mostrar
  
    console.log('Actualizacion tabla', ((minutos * 60) + segundos))
    allinfo()
    entra_tabla = false;
  
  }



} , 500);
 
 
 

 
   
