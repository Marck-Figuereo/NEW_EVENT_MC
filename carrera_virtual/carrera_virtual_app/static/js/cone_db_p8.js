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
        const response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
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

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 
        

            
        const datos = [ data['data'][0]['id_apuesta_c'],  data['data'][0]['valor_ganado'], 
                        `"${data['data'][0]['lugar']}"`,  `"${data['data'][0]['fecha_jack']}"`,
                        ]
        
        if (localStorage.getItem('w_j') == undefined) localStorage.setItem('w_j', `[${datos}]`) 
        
        else if(JSON.parse(localStorage.getItem('w_j'))[0] != data['data'][0]['id_apuesta_c'] && sincronizacion_jack_sort(data['data'][0]['fecha_jack'].substring(0, 10), data['data'][0]['fecha_jack'].substring(11, 19))){


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
        
        const datos_re = {'realizar':'consulta_bonos', "id_lugar" : lugar, "juego": 'PERROS_8'};

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        if(data['data'].length > 0){


            if(localStorage.getItem('id_b') != data['data'][0]['id_apuesta_c_id'].toString()){
            
                document.getElementById("id_bns").value  = `ID ******${data['data'][0]['id_apuesta_c_id'].toString().substr(6,6)}`
                document.getElementById("mnt_bns").value = moneda(data['data'][0]['valor_ganado']) 

                localStorage.setItem('id_b', data['data'][0]['id_apuesta_c_id']) 

                return true
                
            }else{ return false } 


        }else{ return false }
    
    }catch(error){console.log("Error: ", error)
        
        return false
    }
        


}



const Consulta_Tabla = async () => {


    try {
        
        $('.precios_tbl').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });

        const datos_re = {'realizar':'consulta_tabla','juego':'PERROS_8', "id_grupo" : localStorage.getItem('grp')};

        var response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        var data      = await response.json() 
        
        var good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])
        
        var cnt = 0;
                
        while (good && cnt < 10){
            
            cnt +=1                 
            response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
            data = await response.json()
            
            good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])     
            
        }
        
        
        if (cnt > 9) { Swal.fire({title: 'ADVERTENCIA!!', text: "PROBLEMA DE CONEXION", icon: 'warning', showConfirmButton: false, timer: 30000 }).then(() => location.reload() )}

        if(good == false){

            localStorage.setItem('fecha', 	data['data'][0]['fecha']) 
            localStorage.setItem('hora', 	data['data'][0]['hora']) 

            let direct      = [[], [], []]
            let pls         = [[], [], []]
            

            try{
                $('.td_pls').each(function(){  pls[0].push($(this).attr('id')) });          
                $('.td-1er').each(function(){  direct[0].push($(this).attr('id')) });                
                    
            }catch(error){console.log("Error: ", error)}
            
            $('.precios_tbl').each(function() {  

                var x = $(this).attr('id');          

                if(Number(data['data'][0][`${x}`]) >= 1){ 
                    
                    $(`#${x}`).text(Number(data['data'][0][`${x}`]))

                    $(`#${x}`).css("color", "#ffffff"); 
                    
                    try{
                        if(direct[0].includes(x)){direct[1].push(Number(data['data'][0][`${x}`])), direct[2].push(`${x}`) }   
                        if(pls[0].includes(x)){pls[1].push(Number(data['data'][0][`${x}`])), pls[2].push(`${x}`)}
                       
                    }catch(error){console.log("Error: ", error)}
                    
                }else {
                    
                    $(`#${x}`).text('- - -')
                }

            });
            

            $('#id_sorteos_c_id').text(data['data'][0]['id_sorteos_c_id'].toString().substr(-3))



            try{
                $(`#${direct[2][direct[1].indexOf(Math.min(...direct[1]))]}`).css("color", "#09ff00");
                $(`#${direct[2][direct[1].indexOf(Math.max(...direct[1]))]}`).css("color", "#ff0000");

                $(`#${pls[2][pls[1].indexOf(Math.min(...pls[1]))]}`).css("color", "#09ff00");
                $(`#${pls[2][pls[1].indexOf(Math.max(...pls[1]))]}`).css("color", "#ff0000");
            
            }catch(error){console.log("Error: ", error)}
            

            await Consulta_ultimas_carreras()
            await Consultas_jackpot_carrera()
            
            return true
        
        }else{return false}
    
    
    } catch (error) {

    
        console.log("Error: ", error)
        $('.precios_tbl').each(function() {  

            $(`#${$(this).attr('id')}`).text('- - -')

        });
    
        $('#id_sorteos_c_id').text(0)

        return false

    }

            


}
 
 


const Consulta_resultados = async () => {

    const datos_re = {'realizar':'consulta_resultados','juego':'PERROS_8', "id_grupo" : localStorage.getItem('grp')};
    const response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json() 
    
    let pos1 = parseInt(data['data'][0]['race_winner'].substr(0,1)) 
    let pos2 = parseInt(data['data'][0]['race_winner'].substr(2,1)) 

    let pago_win  = data['data'][0]['pago_primer_lugar']
    let pago_pale = data['data'][0]['pago_pale']
    
    const vd_num  = data['data'][0]['race_winner'].split(",").join("")
    
    const vd_num2 = data['data'][0]['bonos_race']
   
    document.getElementById("n_race").innerHTML = data['data'][0]['id_sorteos_c'].toString().substr(-3);

    document.getElementById("img_win").src = `static/img/numeros/p8/n${pos1}.svg`;
    document.getElementById("p_win").innerHTML = Number(pago_win)
   
    document.getElementById("img1_ext").src = `static/img/numeros/p8/n${pos1}.svg`;
    document.getElementById("img2_ext").src = `static/img/numeros/p8/n${pos2}.svg`;
    document.getElementById("p_ext").innerHTML = Number(pago_pale);
    
    return [vd_num, vd_num2]


}














const Consulta_ultimas_carreras = async () => {


    try{

        const datos_re = {'realizar':'consulta_ult_carreras','juego':'PERROS_8', "id_grupo" : localStorage.getItem('grp')};

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()
        
        data.map((races, cont)=>{
         
            if(races[0]['bonos_race'] == 'X2' || races[0]['bonos_race'] == 'X3'){ document.getElementById(`bns${cont}`).src = `../static/img/${races[0]['bonos_race']}_V.png` 
            }else{document.getElementById(`bns${cont}`).src = '' }

               
           
           document.getElementById(`numero_race${cont}`).innerHTML = races[0]['id_sorteos_c'].toString().substr(-3)
           document.getElementById(`lugarimg_1er${cont}`).src =  `static/img/numeros/p8/n${races[0]['race_winner'].substr(0,1)}.svg`
           document.getElementById(`lugarprc_1er${cont}`).innerHTML = Number(races[0]['pago_primer_lugar']) 
           
           
           document.getElementById(`lugarimg_pls_1er${cont}`).src =  `static/img/numeros/p8/n${races[0]['race_winner'].substr(0,1)}.svg`
           document.getElementById(`lugarimg_pls_2do${cont}`).src =  `static/img/numeros/p8/n${races[0]['race_winner'].substr(2,1)}.svg`
           document.getElementById(`lugarprc_pls${cont}`).innerHTML = Number(races[0]['pago_pale']) 
           
            
        })
        
        return true
        
    } catch (error) {

        console.log("Error: ", error)
        return false

    }
            

}

 



 
const Consulta_grupo = async () => {


    try{ 
        const datos_re = {'realizar':'consulta_grupo', "id_lugar" : localStorage.getItem('id_lugar')};
        
        const response  = await fetch("/carreras_virtual_p8",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()
        
        localStorage.setItem('grp', data[0]['id_grupos']) 
           
        return true
        
    } catch (error) {console.log("Error: ", error)
        
        return false

    }
            

}