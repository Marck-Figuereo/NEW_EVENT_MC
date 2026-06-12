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

const color = {
            
    'red' : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36], 
    'black' : [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35], 
    'green' : [0], 

    "row1" :        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],  
    "row2" :        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],       
    "row3" :        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],       
    

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

    // try {

        const id_jackpt = localStorage.getItem('id_jackpot')

        const datos_re = {'realizar':'consulta_jackpots', "id_jackpot": id_jackpt };
        const response = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
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
        


    // } catch (error) {
    //     console.log("Error: ", error)
    //     $('#jp_global').text(moneda(0))
            
    // }




}



const Consulta_ganador_jack = async () => {

    
    $("#container-jackpots .row_jp").remove();

    try {
        const id_jackpt = localStorage.getItem('id_jackpot')
        
        if (id_jackpt == undefined) return false
                
        const datos_re = {'realizar':'consulta_gandores_jack', "id_jackpot": id_jackpt};

        const response  = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
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
        
        const datos_re = {'realizar':'consulta_bonos', "id_lugar" : lugar, "juego": 'RULETA'};

        const response  = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
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


    // try {
    
        const datos_re = {'realizar':'consulta_tabla','juego':'RULETA', "id_grupo" : localStorage.getItem('grp')};

        var response = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        var data      = await response.json() 


        console.log(data);
        var good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])

        var cnt = 0;

        while (good && cnt < 10){
            
            cnt +=1                 
            response = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
            data = await response.json()
            
            good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])     
            
        }
        
        
        if (cnt > 9) { Swal.fire({title: 'ADVERTENCIA!!', text: "PROBLEMA DE CONEXION", icon: 'warning', showConfirmButton: false, timer: 30000 }).then(() => location.reload() )}

        if(good == false){

            localStorage.setItem('fecha', 	data['data'][0]['fecha']) 
            localStorage.setItem('hora', 	data['data'][0]['hora']) 


            $('#id_sorteos_c_id').text(data['data'][0]['id_sorteos_c'].toString().substr(-3))


            await Consulta_ultimas_carreras()
            await Consultas_jackpot_carrera()
            
            return [true, data['data'][0]['multi_x']['numeros']]
        
        }else{return [false, {}]}
    
    
    // } catch (error) {

    
    //     console.log("Error: ", error)
     
    //     $('#id_sorteos_c_id').text(0)

    //     return [false, {}]

    // }

            


}
 




const Consulta_resultados = async sorteo => {
    
    const datos_re = {'realizar':'consulta_resultados','juego':'RULETA', "id_grupo" : localStorage.getItem('grp')};
    const response = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json() 
    
    //if(data['data'][0]['race_winner'] == '---') return [data['data'][0]['race_winner'], data['data'][0]['multi_x']['numeros'], true]
    
    if(sorteo) return [data['data'][0]['race_winner'], data['data'][0]['multi_x']['numeros'], true]

    $('#id_sort_win').text(data['data'][0]['id_sorteos_c'].toString().substr(-3))
    
    $(".info_result div").remove()
    
    console.log(data);
    const multis = data['data'][0]['multi_x']['numeros']

    const win =  data['data'][0]['race_winner'].length == 4 ? data['data'][0]['race_winner'].substr(0,2) : data['data'][0]['race_winner'].substr(0,1)


    let multi = false
    var dfbjf = Object.keys(multis).map( key =>{
                    
        const clr = color['red'].includes(Number(key)) && win != key ? "n_red" : color['black'].includes(Number(key)) && win != key ? "n_black" :  win == key ? "n_gold" : "n_green"
        if(clr == 'n_gold') multi = true 
        return `<div class="caja_mu"><label class="nums_title ${clr}">${key}</label><label class="multis_body"><span>X${multis[key]}</span></label></div>`
    
    }).join('')


    if (win != '0' && win != '---'){

        const win2 = Number(win)

        const rango = win2 < 19 ? '1-18'  : '19-36' 
        const docena = win2 < 12 ? '1-12' : win2 > 12 && win2 < 25 ? '13-24' : '25-36'
        const paridad = win2 % 2 === 0 ? 'PAR' : 'IMPAR'
        const fila =  color['row1'].includes(win2) ? '1RA FILA' : color['row2'].includes(win2) ? '2DA FILA' : '3RA FILA'

        
        var clss

        $('.round1_1').removeClass("num_gold")
        $('.round1_1').removeClass("num_black")
        $('.round1_1').removeClass("num_red")
        $('.round1_1').removeClass("num_green")
        $("#container-resultado-carrera").removeClass("margen-left-resultados")

        if(color['red'].includes(win2)){ 
            
            clss = ["n_red", "ROJO"] 

            multi ? $('.round1_1').addClass("num_gold") : $('.round1_1').addClass("num_red") 
            
            $('#win_color').text('ROJO') 
        
        
        }else if(color['black'].includes(win2)){ 
        
            clss = ["n_black", "NEGRO"]

            multi ? $('.round1_1').addClass("num_gold") : $('.round1_1').addClass("num_black") 

            $('#win_color').text('NEGRO') 
        
        }
        

        $(".info_result").append(`

            <div class="row fila-p_i-color2">`+
            `<div class="themed-grid-col result-color ${clss[0]}">${clss[1]}</div>`+
            `<div class="themed-grid-col result-p_i ${clss[0]}">${paridad}</div>`+ 
            `</div>`+
            `<div class="row fila-p_i-color">`+
            `<div class="col-md-4 themed-grid-col result-1-12">${docena}</div>`+
            `<div class="col-md-4 themed-grid-col result-1-18">${rango}</div>`+
            `<div class="col-md-4 themed-grid-col result-row">${fila}</div>`+
            `</div>`+
            `<div class="row fila-p_i-color3">${dfbjf}</div>`)

    


        

        // $(`.result-wrap-${win}`).attr('id', 'parpa');


        // $('#parpa').removeClass('wred')
        // $('#parpa').addClass('wgold')



    }else if(win == '0'){

        $('.round1_1').removeClass("num_gold")
        $('.round1_1').addClass("num_green")
        $('.round1_1').removeClass("num_black")
        $('.round1_1').removeClass("num_red")
                
        $("#container-resultado-carrera").addClass("margen-left-resultados")
        
    }


    $('#win_nm').text(win) 



    return [data['data'][0]['race_winner'], data['data'][0]['multi_x']['numeros'], true]


}










const Consulta_ultimas_carreras = async () => {


    // try{nm-hot
            
        var wins = { '0' : 0, '1' : 0, '2' : 0, '3' : 0, '4' : 0, '5' : 0, '6' : 0, '7' : 0, '8' : 0, '9' : 0, '10': 0, 
                    '11': 0, '12': 0, '13': 0, '14': 0, '15': 0, '16': 0, '17': 0, '18': 0, '19': 0, '20': 0, 
                    '21': 0, '22': 0, '23': 0, '24': 0, '25': 0, '26': 0, '27': 0, '28': 0, '29': 0, '30': 0, 
                    '31': 0, '32': 0, '33': 0, '34': 0, '35': 0, '36' : 0}



        const counts = {
            'color':   { 'red': 0, 'green': 0, 'black': 0 },
            'rango':   { "1-18": 0, "19-36": 0 },
            'paridad': { 'impar': 0, 'par': 0 },
            'docena':  { "1-12": 0, "13-24": 0, "25-36": 0 },
            'fila':    { "1ra": 0, "2da": 0, "3ra": 0 },
            'nms' : 0
        };

        const datos_re = {'realizar':'consulta_ult_carreras','juego':'RULETA', "id_grupo" : localStorage.getItem('grp')};
        
        const response  = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()

 
        $(".container_r div").remove();
        $(".container_r img").remove(); 

        
        $(".cuerpo-txt2 div").remove();

        data.forEach((element, inx) =>{ 
            
            counts['nms']++ 

            const nums =  element[0]['winner_number'].length == 4 ? Number(element[0]['winner_number'].substr(0,2)) : Number(element[0]['winner_number'].substr(0,1))


            nums < 19 ?      counts['rango']['1-18']+=1  : counts['rango']['19-36']+=1
            nums < 12 ?      counts['docena']['1-12']+=1 : nums > 12 && nums < 25  ? counts['docena']['13-24']+=1 : counts['docena']['25-36']+=1 
            nums % 2 === 0 ? counts['paridad']['par']+=1 : counts['paridad']['impar']+=1
            
            color['row1'].includes(nums) ? counts['fila']['1ra']+=1  : color['row2'].includes(nums)  ? counts['fila']['2da']+=1    : counts['fila']['3ra']+=1              
            color['red'].includes(nums)  ? counts['color']['red']+=1 : color['black'].includes(nums) ? counts['color']['black']+=1 : counts['color']['green']+=1              

            

            wins[nums] += 1  

            if((inx+1) < 16 ) {
                console.log(element[0]['multi_x']['numeros'][Number(nums)], element[0]['multi_x']['numeros'], nums);
                const dfd = element[0]['multi_x']['numeros'][Number(nums)] != undefined ? "X"+element[0]['multi_x']['numeros'][nums] : "" 
                
                
                const clss = color['red'].includes(nums) ? "num_red" : color['black'].includes(nums) ? "num_black" : "num_green"

                $(".container_r").append(`<div style="padding:20px 0px;"><label class="multi-flo">${dfd}</label><div class="${clss}"><label>${nums}</label></div></div>`)
                
                if((inx+1) < 15) $(".container_r").append(`<img src="static/img/ff.svg" style="width: 7px; margin-left:5px; margin-right:5px;"></img>`)
                 
                    
            }

        });

        
        Object.keys(wins).forEach(key => $(".cuerpo-txt2").append(`<div id="num2-${key}" class="num2-${key}">${wins[key]}</div>`) );

        // Convertimos a array para ordenar
        const pares = Object.entries(wins); 
        const ordenados = pares.sort((a, b) => b[1] - a[1]);
        const hot = ordenados.slice(0, 6).map(([num]) => Number(num));
        const cold = ordenados.slice(-6).map(([num]) => Number(num));

        hot.forEach((nm,inx) => $(`#nm-hot-${inx+1}`).text(nm))
        cold.forEach((nm,inx) => $(`#nm-cold-${inx+1}`).text(nm))


    
        $('#porcj-red').text(`${((counts['color']['red'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-green').text(`${((counts['color']['green'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-black').text(`${((counts['color']['black'] * 100)/counts['nms']).toFixed(2)}%`)

        $('#porcj-cols-1-18').text(`${((counts['rango']['1-18'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-cols-19-36').text(`${((counts['rango']['19-36'] * 100)/counts['nms']).toFixed(2)}%`)

        $('#porcj-cols-odd').text(`${((counts['paridad']['par'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-cols-even').text(`${((counts['paridad']['impar'] * 100)/counts['nms']).toFixed(2)}%`)
        
        $('#porcj-cols-1-12').text(`${((counts['docena']['1-12'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-cols-13-24').text(`${((counts['docena']['13-24'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-cols-25-36').text(`${((counts['docena']['25-36'] * 100)/counts['nms']).toFixed(2)}%`)

        $('#porcj-row1').text(`${((counts['fila']['1ra'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-row2').text(`${((counts['fila']['2da'] * 100)/counts['nms']).toFixed(2)}%`)
        $('#porcj-row3').text(`${((counts['fila']['3ra'] * 100)/counts['nms']).toFixed(2)}%`)


        return true
        
    // } catch (error) {

    //     console.log("Error: ", error)
    //     return false

    // }
            

} 

const Consulta_grupo = async () => {


    try{ 
        const datos_re = {'realizar':'consulta_grupo', "id_lugar" : localStorage.getItem('id_lugar')};
        
        const response  = await fetch("/roulette",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()
        
        localStorage.setItem('grp', data[0]['id_grupos'])
        
        return true
        
    } catch (error) {console.log("Error: ", error)
        
        return false

    }
            

}




