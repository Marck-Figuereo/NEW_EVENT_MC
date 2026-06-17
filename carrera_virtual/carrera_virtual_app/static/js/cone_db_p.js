function getCookie2(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
         //Does this cookie string begin with the name we want?
          if (cookie.substring(0, name.length + 1) === (name + '=')) {
              cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
              break;
          }
  }
    }
    return cookieValue;
  } 

  

function formatoTiempo(segundos) {
  segundos = Number(segundos) || 0;

  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;

  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

}



const moneda = (number) => new Intl.NumberFormat('es-US', {style: 'currency',currency: 'USD', minimumFractionDigits: 2}).format(number);

var  pc_tl = {};



const sincronizacion_jack_sort = (fecha_t, hora_t)=> {

      
    const hrs  = (horas     < 10 ? '0' : '') + horas
    const mit  = (minutos   < 10 ? '0' : '') + minutos
    const segd = (segundos  < 10 ? '0' : '') + segundos
    
    const dia2 = (dia     < 10 ? '0' : '') + dia
    const mes2 = ((mes+1) < 10 ? '0' : '') + (mes+1)
  
    const tiempo = hrs + ":" + mit + ":" + segd
    const fecha_aqu = year + "/" + mes2 + "/" + dia2
  
    console.log(hora_t, fecha_t)
    const fecha1 = `${fecha_t} ${hora_t.substr(0, 6)}00`.replace('/', '-').replace('/', '-')
    const fecha2 = `${fecha_aqu} ${tiempo.substr(0, 6)}00`.replace('/', '-').replace('/', '-')
  
    var dift = moment(fecha2).diff(moment(fecha1), 'minute')
    if(dift <= 4 ) return true 
    else return false
  
} 
  


function restar_fecha_hora(dates, time) {

    const time_remp = new Date(`${dates.replace("/", " ")} ${time}`)
    
    time_remp.setHours(time_remp.getHours() + eval(localStorage.getItem('gmt')))
    
    let hora_t;
  
    if(eval(localStorage.getItem('apm'))){
        
        var am_pm = ""
        hora_t = time_remp.getHours()
    
    }else{

        var am_pm = time_remp.getHours() >= 12 ? ':PM' : ':AM';
        hora_t = (time_remp.getHours() % 12) || 12;

    }
  
    const time_remp_final = hora_t + ":" + time_remp.getMinutes() + ":" + time_remp.getSeconds() + am_pm
    const date_remp_final = time_remp.getDate() + "/" + (time_remp.getUTCMonth()+1) + "/" + time_remp.getUTCFullYear()
    
    return [date_remp_final, time_remp_final]
  
  
}

const aumento_jack = (num_inicio, num_fn) =>{


    let duration = 240000; // Duración total de la animación en milisegundos
    var startTime; // Tiempo de inicio del contador
    var animationFrame; // Referencia al cuadro de animación    
    
    function updateCount(timestamp) {
        
        const elapsed = timestamp - startTime;
        
        // Calcular el progreso como una función cuadrática para simular el efecto de podómetro
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuad(progress);
    
        // Calcular el número actual basado en el progreso
        const currentNumber = (num_inicio + easedProgress * (num_fn - num_inicio)).toFixed(2)
        
        // Mostrar el número actual en el elemento HTML
        document.querySelector('#jp_global').textContent = moneda(currentNumber.toLocaleString());
    
        // Verificar si la animación debe continuar
        if (progress < 1)  animationFrame = requestAnimationFrame(updateCount);
        
    }
    
    // Función de interpolación cuadrática (easeOut)
    easeOutQuad = t => t * (2 - t);
    
    startTime = performance.now(); // Obtener el tiempo actual de alta resolución
    animationFrame = requestAnimationFrame(updateCount);
}




const Consultas_jackpot_carrera = async () =>{

   
    // try {

    //     const id_jackpt = localStorage.getItem('id_jackpot')

        const datos_re = {'realizar':'consulta_jackpots', "jackpot_id": 1};
        const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data     = await response.json() 
 

        $('#id_tk_info').text(`ID ${data['last_winner_ticket']}`)
        $('#monto_info').text(moneda(data['last_winner_amount']))
        $('#lugar_info').text(data['last_winner_lugar'])
        $('#date_info').text(data['last_winner_at'])
            

        const datoss = localStorage.getItem('datos_jack')
        const jack = data['current_amount']
        

        if(datoss == undefined){ 
            
            localStorage.setItem('datos_jack', 	jack) 
            $('#jp_global').text(moneda(jack))
        
        }else{

            if(Number(datoss) > Number(jack)) document.querySelector('#jp_global').textContent = moneda(jack);            
            else aumento_jack(Number(datoss), jack)
        
            localStorage.setItem('datos_jack', 	jack) 
            
        }
        


    // } catch (error) {
    //     console.log("Error: ", error)
    //     $('#jp_global').text(moneda(0))
            
    // }



}



const Consulta_ganador_jack = async () => {

    console.log('Consulta_ganador_jack');
    // $("#container-jackpots .row_jp").remove();

    // try {
    //     const id_jackpt = localStorage.getItem('id_jackpot')
        
    //     if (id_jackpt == undefined) return false
                
    //     const datos_re = {'realizar':'consulta_gandores_jack', "id_jackpot": id_jackpt};

    //     const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
    //     const data      = await response.json() 

    //     const datos = [ data['data'][0]['id_apuesta_c'],  data['data'][0]['valor_ganado'], 
    //                     `"${data['data'][0]['lugar']}"`,  `"${data['data'][0]['fecha_jack']}"`,
    //                     ]
        
    //     if (localStorage.getItem('w_j') == undefined) localStorage.setItem('w_j', `[${datos}]`) 
        
    //     else if(JSON.parse(localStorage.getItem('w_j'))[0] != data['data'][0]['id_apuesta_c'] && sincronizacion_jack_sort(data['data'][0]['fecha_jack'].substring(0, 10), data['data'][0]['fecha_jack'].substring(11, 19))){
    //         console.log("123456")

    //         $('#container-jackpots').append(`<div class="row row_jp mt-5">\
                                            
    //             <div class="col-md-7 themed-grid-col">\
    //                 <div class="form-group">\
    //                     <input class="input_info_jp" type="text" readonly value="${data['data'][0]['lugar']}">\
    //                 </div>\
    //             </div>\
            
                
    //             <div class="col-md-5 themed-grid-col">\
    //                 <div class="form-group">\
    //                     <input class="input_info_jp" type="text" readonly value="******${(data['data'][0]['id_apuesta_c']).toString().substr(6,6)}">\
    //                 </div>\
    //             </div>\

    //         </div>\
    //         <div class="row row_jp">\
                
    //             <div class="col-md-12 themed-grid-col mt-3">\
    //                 <div class="form-group">\
    //                     <input class="input_info_jp precio_jp" type="text" readonly value="${moneda(data['data'][0]['valor_ganado'])}">\
    //                 </div>\
    //             </div>\
            
    //         </div>`)
            
    //         localStorage.setItem('w_j', `[${datos}]`) 

    //         const info = JSON.parse(localStorage.getItem('w_j'))

    //         $('#id_tk_info').text(`ID ******${info[0].toString().substr(-6)}`)
    //         $('#monto_info').text(moneda(info[1]))
    //         $('#lugar_info').text(info[2])
    //         $('#date_info').text(restar_fecha_hora(info[3].substring(0, 10), info[3].substring(11, 19))[0])
            
    //         return true

    //     }else localStorage.setItem('w_j', `[${datos}]`) 
        

    //     const info = JSON.parse(localStorage.getItem('w_j'))
        
    //     $('#id_tk_info').text(`ID ******56132`)
    //     $('#monto_info').text('$27,962.23')
    //     $('#lugar_info').text('DEMO 02')
    //     $('#date_info').text('12/05/2026')

    //     return false
        
    // }catch (error) {

    //     $('#id_tk_info').text(`ID ******56132`)
    //     $('#monto_info').text('$27,962.23')
    //     $('#lugar_info').text('DEMO 02')
    //     $('#date_info').text('12/05/2026')
    //     console.log("Error: ", error)
    //     return false
    
    // }
   

}




const Consulta_bonos = async () => {

    console.log('Consulta_bonos');
    // try{
    //     const lugar = localStorage.getItem('id_lugar')
        
    //     const datos_re = {'realizar':'consulta_bonos', "id_lugar" : lugar, "juego": 'PERROS_6'};

    //     const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
    //     const data      = await response.json() 

    //     if(data['data'].length > 0){

    //         if(localStorage.getItem('id_b') != data['data'][0]['id_apuesta_c_id'].toString()){

    //             document.getElementById("id_bns").value  = `ID ******${data['data'][0]['id_apuesta_c_id'].toString().substr(6,6)}`
    //             document.getElementById("mnt_bns").value = moneda(data['data'][0]['valor_ganado']) 

    //             localStorage.setItem('id_b', data['data'][0]['id_apuesta_c_id']) 

    //             return true
                
    //         }else{ return false } 


    //     }else{ return false }

    
    // }catch(error){
    //     console.log("Error: ", error)
    //     return false
    // }
        


}


const Consulta_Tabla = async () => {

    console.log('Consulta_Tabla');

    Consulta_ultimas_carreras()
    Consultas_jackpot_carrera()

    // try {        

        $('.precios_tbl').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });

        const datos_re = {'realizar':'consulta_tabla' , 'table_odds_id' : id_table};

        var response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        var data      = await response.json()         
        
        const inf = data['items']
 

        for(let int in inf){

            let cmb = inf[int]['selection_key']

            if(inf[int]['bet_type'] == 'WIN') $('#p'+cmb + '_p'+cmb).text(parseFloat(inf[int]['odds']).toFixed(1))
            else                              $('#p'+cmb[0]+ '_p'+cmb[2]).text(parseFloat(inf[int]['odds']).toFixed(1))

        }
         

        // if(direct[0].includes(x)){  direct[1].push(Number(data['data'][0][`${x}`])), direct[2].push(`${x}`) }   
        // if(pls[0].includes(x)){pls[1].push(Number(data['data'][0][`${x}`])), pls[2].push(`${x}`)}
       
   


    //         try{
    //             $(`#${direct[2][direct[1].indexOf(Math.min(...direct[1]))]}`).css("color", "#09ff00");
    //             $(`#${direct[2][direct[1].indexOf(Math.max(...direct[1]))]}`).css("color", "#ff0000");

    //             $(`#${pls[2][pls[1].indexOf(Math.min(...pls[1]))]}`).css("color", "#09ff00");
    //             $(`#${pls[2][pls[1].indexOf(Math.max(...pls[1]))]}`).css("color", "#ff0000");
            
    //         }catch(error){console.log("Error: ", error)}

    //         await Consulta_ultimas_carreras()
    //         await Consultas_jackpot_carrera()
            
    //         return true
        
    //     }else{return false}
    
    
    // } catch (error) {

    //     console.log("Error: ", error)
    //     $('.precios_tbl').each(function() {  

    //         $(`#${$(this).attr('id')}`).text('- - -')

    //     });
    
    //     $('#id_sorteos_c_id').text(0)

    //     return false

    // }

            


}
 
 


const Consulta_resultados = async () => {

    console.log('Consulta_resultados');
    const datos_re = {'realizar':'consulta_resultados' , 'game_id' : 2, "device_token" : localStorage.getItem('dkg')};
    const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json()
    console.log(data)

    let pos1 = data['settlement']['result_odds'][1]['selection_key'][0] 
    let pos2 = data['settlement']['result_odds'][1]['selection_key'][2]
    
    let pago_win  = parseFloat(data['settlement']['result_odds'][0]['odds']).toFixed(1)
    let pago_pale = parseFloat(data['settlement']['result_odds'][1]['odds']).toFixed(1)

   
    document.getElementById("n_race").innerHTML = data['event_number']

    document.getElementById("img_win").src = `static/img/numeros/p6/n${pos1}.svg`;
    document.getElementById("p_win").innerHTML = pago_win
   
    document.getElementById("img1_ext").src = `static/img/numeros/p6/n${pos1}.svg`;
    document.getElementById("img2_ext").src = `static/img/numeros/p6/n${pos2}.svg`;
    document.getElementById("p_ext").innerHTML = pago_pale



}







Consulta_resultados()






const Consulta_ultimas_carreras = async () => {


    console.log('Consulta_ultimas_carreras');
    // try{

        const datos_re = {'realizar':'history_results','game_id': 2, "device_token" : localStorage.getItem('dkg')};

        const response  = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        
        const data      = await response.json()

  
                  
        data['results'].map((races, cont)=>{
   

    //         if(races['bonos_race'] == 'X2' || races['bonos_race'] == 'X3'){ document.getElementById(`bns${cont}`).src = `../static/img/${races['bonos_race']}_V.png` 
    //         }else{document.getElementById(`bns${cont}`).src = '' }

            
            document.getElementById(`numero_race${cont}`).innerHTML = races['event_number'] 
            document.getElementById(`lugarimg_1er${cont}`).src =  `static/img/numeros/p6/n${races['settlement']['result_odds'][0]['selection_key']}.svg`
            document.getElementById(`lugarprc_1er${cont}`).innerHTML = parseFloat(races['settlement']['result_odds'][0]['odds']).toFixed(1) 


            document.getElementById(`lugarimg_pls_1er${cont}`).src =  `static/img/numeros/p6/n${races['settlement']['result_odds'][1]['selection_key'][0]}.svg`
            document.getElementById(`lugarimg_pls_2do${cont}`).src =  `static/img/numeros/p6/n${races['settlement']['result_odds'][1]['selection_key'][2]}.svg`
            document.getElementById(`lugarprc_pls${cont}`).innerHTML = parseFloat(races['settlement']['result_odds'][1]['odds']).toFixed(1) 


        })
        
    //      return true
        
    // } catch (error) {
    
    //     console.log("Error: ", error)
    //     return false

    // }
            

}

 


