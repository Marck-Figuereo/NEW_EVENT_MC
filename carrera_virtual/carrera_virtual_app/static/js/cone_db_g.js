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

    try {

        const id_jackpt = localStorage.getItem('id_jackpot')

        const datos_re = {'realizar':'consulta_jackpots', "id_jackpot": id_jackpt };
        const response = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data     = await response.json() 

        const datoss = localStorage.getItem('datos_jack')
        const jack = data['data'][0]['monto_actual']
        

        if(datoss == undefined){ 
            
            localStorage.setItem('datos_jack', 	jack) 
            $('#jp_global').text(moneda(jack))
        
        }else{

            if(Number(datoss) > Number(jack)) document.querySelector('#jp_global').textContent = moneda(jack);            
            else aumento_jack(Number(datoss), jack)
        
            localStorage.setItem('datos_jack', 	jack) 
            
        }
        


    } catch (error) {
        console.log("Error: ", error)
        $('#jp_global').text(moneda(0))
            
    }



}

const Consulta_ganador_jack = async () => {

    
    $("#container-jackpots .row_jp").remove();

    try {
        const id_jackpt = localStorage.getItem('id_jackpot')
        
        if (id_jackpt == undefined) return false
                
        const datos_re = {'realizar':'consulta_gandores_jack', "id_jackpot": id_jackpt};

        const response  = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        const datos = [ data['data'][0]['id_apuesta_c'],  data['data'][0]['valor_ganado'], 
                        `"${data['data'][0]['lugar']}"`,  `"${data['data'][0]['fecha_jack']}"`,
                        ]
        
        if (localStorage.getItem('w_j') == undefined) localStorage.setItem('w_j', `[${datos}]`) 
        
        else if(JSON.parse(localStorage.getItem('w_j'))[0] != data['data'][0]['id_apuesta_c'] && sincronizacion_jack_sort(data['data'][0]['fecha_jack'].substring(0, 10), data['data'][0]['fecha_jack'].substring(11, 19))){
            console.log("123456")

            $('#container-jackpots').append(`<div class="row row_jp mt-5">\
                                            
                <div class="col-md-7 themed-grid-col">\
                    <div class="form-group">\
                        <input class="input_info_jp" type="text" readonly value="${data['data'][0]['lugar']}">\
                    </div>\
                </div>\
            
                
                <div class="col-md-5 themed-grid-col">\
                    <div class="form-group">\
                        <input class="input_info_jp" type="text" readonly value="******${(data['data'][0]['id_apuesta_c']).toString().substr(6,6)}">\
                    </div>\
                </div>\

            </div>\
            <div class="row row_jp">\
                
                <div class="col-md-12 themed-grid-col mt-3">\
                    <div class="form-group">\
                        <input class="input_info_jp precio_jp" type="text" readonly value="${moneda(data['data'][0]['valor_ganado'])}">\
                    </div>\
                </div>\
            
            </div>`)
            
            localStorage.setItem('w_j', `[${datos}]`) 

            const info = JSON.parse(localStorage.getItem('w_j'))

            $('#id_tk_info').text(`ID ******${info[0].toString().substr(-6)}`)
            $('#monto_info').text(moneda(info[1]))
            $('#lugar_info').text(info[2])
            $('#date_info').text(restar_fecha_hora(info[3].substring(0, 10), info[3].substring(11, 19))[0])
            
            return true

        }else localStorage.setItem('w_j', `[${datos}]`) 
        

        const info = JSON.parse(localStorage.getItem('w_j'))
        
        $('#id_tk_info').text(`ID ******${info[0].toString().substr(-6)}`)
        $('#monto_info').text(moneda(info[1]))
        $('#lugar_info').text(info[2])
        $('#date_info').text(restar_fecha_hora(info[3].substring(0, 10), info[3].substring(11, 19))[0])

        return false
        
    }catch (error) {

                $('#id_tk_info').text(`ID ******56132`)
        $('#monto_info').text('$27,962.23')
        $('#lugar_info').text('DEMO 02')
        $('#date_info').text('12/05/2026')

        console.log("Error: ", error)
        return false
    
    }
   

}




const Consulta_bonos = async () => {


    try{
        const lugar = localStorage.getItem('id_lugar')
        
        const datos_re = {'realizar':'consulta_bonos', "id_lugar" : lugar, "juego": 'GALLOS_V1'};

        const response  = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        if(data['data'].length > 0){

            if(localStorage.getItem('id_b') != data['data'][0]['id_apuesta_c_id'].toString()){

                document.getElementById("id_bns").value  = `ID ******${data['data'][0]['id_apuesta_c_id'].toString().substr(6,6)}`
                document.getElementById("mnt_bns").value = moneda(data['data'][0]['valor_ganado']) 

                localStorage.setItem('id_b', data['data'][0]['id_apuesta_c_id']) 

                return true
                
            }else{ return false } 


        }else{ return false }

    
    }catch(error){
        console.log("Error: ", error)
        return false
    }
        


}



const Consulta_Tabla = async () => {

    try {       
    

        $('.ods').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });

        const datos_re = {'realizar':'consulta_tabla','juego':'GALLOS_V1', "id_grupo" : localStorage.getItem('grp')};

        var response = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        var data      = await response.json()         
    
        
        var good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])

        var cnt = 0;

        while (good && cnt < 10){
            
            cnt +=1                 
            response = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
            data = await response.json()
            
            good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])     
            
        }
        
        
        if (cnt > 9) { Swal.fire({title: 'ADVERTENCIA!!', text: "PROBLEMA DE CONEXION", icon: 'warning', showConfirmButton: false, timer: 30000 }).then(() => location.reload() )}

        if(good == false){

            localStorage.setItem('fecha', 	data['data'][0]['fecha']) 
            localStorage.setItem('hora', 	data['data'][0]['hora']) 

            
            Object.entries(data['data'][0]).forEach(([element, inx]) => {
        
                if(!['id_tabla_g', 'fecha', 'hora', 'id_sorteos_c_id'].includes(element)) $(`#${element}`).text(inx);
            
            });
            
            $('#id_sorteos_c_id').text(data['data'][0]['id_sorteos_c_id'].toString().substr(-3))

            await Consulta_ultimas_carreras()
            await Consultas_jackpot_carrera()
            
            return true
        
        }else{return false}
    
    
    } catch (error) {

        console.log("Error: ", error)

        $('.ods').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });
    
        $('#id_sorteos_c_id').text(0)

        return false

    }

            


}
 
 function convtSegs(sgs) {
  let min = Math.floor(sgs / 60);
  let sec = sgs % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}


const Consulta_resultados = async () => {

    const datos_re = {'realizar':'consulta_resultados', 'juego':'GALLOS_V1', "id_grupo" : localStorage.getItem('grp')};
    const response = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json() 

    console.log(data);
    
    const clr = { '1' : 'blue', '2' : 'white',  '0' : 'silver' }

    const result = data['data'][0]['race_winner']

    $("#container-resultado-carrera div").remove(); 
    $("#container-resultado-carrera hr").remove(); 

    $("#container-resultado-carrera").append(`<div class="themed-grid-col row-win mt-4">`+

        `<div class="num_pelea_div">`+
            `<p class="pelea">TORNEO</p>`+ 
            `<p class="body_div">${data['data'][0]['id_sorteos_c'].toString().substr(-3)}</p>`+ 
        `</div>`+
        `<div class="inf-win"><div class="result-${clr[result[0]]}"><p>GANADOR</p></div></div>`+
        `<div class="win-odd"><p>${data['data'][0]['ganador_torneo']}</p></div>`+
    `</div>`+
    `<hr class="linea-result">`+
    `<div class="themed-grid-col row-rounds">`+
        `<div class="div-name-round">`+
        `<p>PELEAS</p>`+
        `</div>`+

        `<div class="div-img-round1"><div class="result-${clr[result[2]]}"></div></div>`+
        `<div class="div-txt-round1"><p>${data['data'][0]['ganador_r1']}</p></div>`+

        `<div class="div-img-round2"><div class="result-${clr[result[3]]}"></div></div>`+
        `<div class="div-txt-round2"><p>${data['data'][0]['ganador_r2']}</p></div>`+
        
        `<div class="div-img-round3"><div class="result-${clr[result[4]]}"></div></div>`+
        `<div class="div-txt-round3"><p>${data['data'][0]['ganador_r3']}</p></div>`+
    `</div>`+      
    
    `<hr class="linea-result">`+
    `<div class="themed-grid-col row-trpl mb-4">`+
        `<div class="div-trpl-no"><p>No. ${result.substr(2,3)}</p></div>`+
        `<div class="div-trpl-1"><div class="result-${clr[result[2]]}">${convtSegs(result.substr(7,2))}</div></div>`+
        `<div class="div-trpl-2"><div class="result-${clr[result[3]]}">${convtSegs(result.substr(10,2))}</div></div>`+
        `<div class="div-trpl-3"><div class="result-${clr[result[4]]}">${convtSegs(result.substr(13,2))}</div></div>`+
        `<div class="div-trpl-odd"><p>${data['data'][0]['ganador_tripleta']}</p></div></div>`)



    return [result, true]


}














const Consulta_ultimas_carreras = async () => {


    // try{

        const datos_re = {'realizar':'consulta_ult_carreras','juego':'GALLOS_V1', "id_grupo" : localStorage.getItem('grp')};

        const response  = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        
        const data      = await response.json()
        
        const clr = { '1' : 'blue', '2' : 'white',  '0' : 'emp' }
        
        $('.sidebar_ult div').remove()

        $('.sidebar_ult').append('<div class="row row-title">HISTORIAL DE TORNEO </div>')

        data.forEach( inf => {

            $('.sidebar_ult').append(`<div class="row row-body">`+
                    
                    `<div class="row row-b row-b-1">`+
                        `<div class="items-num">${inf['id_sorteos_c'].toString().substr(-3)}</div>`+
                        `<div class="items-info">GANADOR</div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][0]]}" style="color:transparent;">- - -</span></div>`+
                        `<div class="odds-result">${inf['ganador_torneo']}</div></div>`+
                    `<div class="row row-b row-b-2">`+
                        `<div class="items-num"></div>`+
                        `<div class="items-info">RONDAS</div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][2]]}" style="color:transparent;">- - -</span></div>`+
                        `<div class="odds-result">${inf['ganador_r1']}</div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][3]]}" style="color:transparent;">- - -</span></div>`+
                        `<div class="odds-result">${inf['ganador_r2']}</div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][4]]}" style="color:transparent;">- - -</span></div>`+
                        `<div class="odds-result">${inf['ganador_r3']}</div></div>`+

                    `<div class="row row-b row-b-3">`+
                        `<div class="items-num"></div>`+
                        `<div class="items-info">NO. ${inf['race_winner'].substr(2,3)}</div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][2]]}">${convtSegs(inf['race_winner'].substr(7,2))}</span></div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][3]]}">${convtSegs(inf['race_winner'].substr(10,2))}</span></div>`+
                        `<div><span class="bg_${clr[inf['race_winner'][4]]}">${convtSegs(inf['race_winner'].substr(13,2))}</span></div>`+
                        `<div class="odds-result">${inf['ganador_tripleta']}</div></div></div>`)
            

        })
        
         return true
        
    // } catch (error) {
    
    //     console.log("Error: ", error)
    //     return false

    // }
            

}



 
const Consulta_grupo = async () => {


    try{ 
        const datos_re = {'realizar':'consulta_grupo', "id_lugar" : localStorage.getItem('id_lugar')};
        
        const response  = await fetch("/gallos",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()
        
        localStorage.setItem('grp', data[0]['id_grupos']) 
           
        return true
        
    } catch (error) {console.log("Error: ", error)
        
        return false

    }
            

}
