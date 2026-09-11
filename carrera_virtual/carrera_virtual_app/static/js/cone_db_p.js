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
        document.querySelector('#jp_mega').textContent = moneda(currentNumber.toLocaleString());
    
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

        const datos_re = {'realizar':'consulta_jackpots', "jackpot_id": localStorage.getItem('jk')};
        const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data     = await response.json() 
 
        console.log(data);
        $('#id_tk_info').text(`****${data['last_winner_ticket_id']}`)
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
        
    //     const datos_re = {'realizar':'consulta_bonos', "device_token" : localStorage.getItem('dkg')};

    //     const response  = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
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




const Consulta_Tabla = async (id_table, game) => {

    console.log('Consulta_Tabla', id_table, game);
        $('.txt_lgr').text(localStorage.getItem('lugar'))

        // try {        

            

        //     $('.precios_tbl').each(function() {  
                
        //         $(`#${$(this).attr('id')}`).css("color", "#fff")
        //         $(`#${$(this).attr('id')}`).text('- - -') 
            
        //     });

        //     const datos_re = {'realizar':'consulta_tabla' , 'table_odds_id' : id_table};
    
        //     var response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        //     var data      = await response.json()         
        
        //     console.log(data);
        
        //     Object.entries(data).forEach(([cmb, odds])=>{
    
        //         if      (cmb.length == 3 && [2, 3, 4].includes(game)) $('#'+ cmb[0] +'-' + cmb[2]).text(parseFloat(odds).toFixed(1))
        //         else if (game == 5)                                   $('#ods_' + cmb).text(odds);
        //         else                                                  $(`#${cmb[4]}-${cmb[4]}` ).text(odds)
    
        //     }) 


        //     try{
    

        //         const entradas = Object.entries(data);

        //         const combinaciones = entradas.filter(([key]) => key.length === 3 );

        //         const win = entradas.filter(([key]) => /^WIN \d+$/.test(key));

        //         if (combinaciones.length) { 
                    
        //             const pcMayor = combinaciones.reduce((a, b) => Number(a[1]) > Number(b[1]) ? a : b);
        //             const pcMenor = combinaciones.reduce((a, b) => Number(a[1]) < Number(b[1]) ? a : b);
                
        //             if(game == 5){
        //                 $(`#ods_${pcMayor[0]}`).css("color", "#09ff00");
        //                 $(`#ods_${pcMenor[0]}`).css("color", "#ff0000");

        //             }else{
        //                 $(`#${pcMayor[0]}`).css("color", "#09ff00");
        //                 $(`#${pcMenor[0]}`).css("color", "#ff0000");
        //             }
        //         }


        //         if (win.length) {

        //             const winMayor = win.reduce((a, b) => Number(a[1]) > Number(b[1]) ? a : b );

        //             const winMenor = win.reduce((a, b) => Number(a[1]) < Number(b[1]) ? a : b );

        //             const mayorKey = winMayor[0].replace("WIN ", "");
        //             const menorKey = winMenor[0].replace("WIN ", "");

        //             $(`#${mayorKey}-${mayorKey}`).css("color", "#09ff00");
        //             $(`#${menorKey}-${menorKey}`).css("color", "#ff0000");
        //         }
            
        //     }catch(error){console.log("Error: ", error)}
            
        // }catch(error){console.log("Error: ", error)}


        Consulta_ultimas_carreras()
        Consultas_jackpot_carrera()
        
        return true
        
    
    
    // } catch (error) {

    //     console.log("Error: ", error)
    //     $('.precios_tbl').each(function() {  

    //         $(`#${$(this).attr('id')}`).text('- - -')

    //     });

    //     return false

    // }

            


}
 

const confirmar_configuracion = async () => {

    console.log('confirmar_configuracion')

    const datos_re = {'realizar':'display_config', "device_token" : localStorage.getItem('dkg')};
    const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json()

    if(data['config_version'] != localStorage.getItem("version")){

        localStorage.setItem('game_id', data['config']['games']) 
        localStorage.setItem('grupo', data['grupo']['id']) 
        localStorage.setItem('version', data['config_version']) 
        localStorage.setItem('lugar', data['lugar']['nombre'])
        localStorage.setItem('jk', data['jackpot_id']) 
    }

}
 



const Consulta_resultados = async () => {

    console.log('Consulta_resultados');
    const datos_re = {'realizar':'consulta_resultados' ,  'grupo_id' : localStorage.getItem('grupo'), 'game_id' : localStorage.getItem('game_id'), "device_token" : localStorage.getItem('dkg')};
    const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json()
    console.log(response, data, 'Consulta_resultados');
    
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

    return [data['selected_video'], 'X']

}




const consult_gallos = data => {

    $('.sidebar_ult div').remove();

    $('.sidebar_ult').append('<div class="row row-title">HISTORIAL DE TORNEO</div>');
 
    data.results.forEach(dts => {

        const result = dts.result;
        const inf = dts.settlement.result_odds || [];

        // ==========================================
        // BUSCAR ODDS
        // ==========================================

        const getOdds = selection_key => {

            const apuesta = inf.find(item => item.selection_key === selection_key);
            return apuesta ? apuesta.odds : '';

        };


        // ==========================================
        // RESULTADO
        // ==========================================

        const order = (result.order_key || '').split('-');
        const generalWinner = result.general_winner || '';


        // ==========================================
        // ODDS
        // ==========================================

        const ganadorTorneo = getOdds(result.order_key);
        const ganadorGeneral = getOdds(`GENERAL:${generalWinner}`);
        const ganadorR1 = getOdds(`FIGHT_1:${order[0]}`);
        const ganadorR2 = getOdds(`FIGHT_2:${order[1]}`);
        const ganadorR3 = getOdds(`FIGHT_3:${order[2]}`);


        // ==========================================
        // RESULT KEY
        // ==========================================

        const resultKey = result.result_key || '';


        // ==========================================
        // HTML
        // ==========================================

        $('.sidebar_ult').append(`

            <div class="row row-body">

                <!-- GANADOR -->

                <div class="row row-b row-b-1">
                    <div class="items-num">${dts.event_number ?? ''}</div>
                    <div class="items-info">GANADOR</div>
                    <div><span class="bg_${generalWinner || 'emp'}" style="color:transparent;"> - - -</span></div>
                    <div class="odds-result">${ganadorGeneral}</div>
                </div>


                <!-- RONDAS -->

                <div class="row row-b row-b-2">

                    <div class="items-num"></div>
                    <div class="items-info">RONDAS</div>

                    <!-- RONDA 1 -->

                    <div><span class="bg_${order[0] || 'emp'}" style="color:transparent;"> - - -</span></div>
                    <div class="odds-result">${ganadorR1}</div>
                    <div><span class="bg_${order[1] || 'emp'}"style="color:transparent;">- - -</span></div>
                    <div class="odds-result">${ganadorR2}</div>
                    <div><span class="bg_${order[2] || 'emp'}" style="color:transparent;">- - -</span></div>
                    <div class="odds-result">${ganadorR3}</div>

                </div>


                <!-- NUMERO -->

                <div class="row row-b row-b-3">

                    <div class="items-num"></div>
                    <div class="items-info">NO. ${resultKey}</div>
                    <div><span class="bg_${order[0] || 'emp'}">${resultKey[0] ?? ''}</span></div>
                    <div><span class="bg_${order[1] || 'emp'}">${resultKey[1] ?? ''}</span></div>
                    <div><span class="bg_${order[2] || 'emp'}">${resultKey[2] ?? ''}</span></div>
                    <div class="odds-result">${ganadorTorneo}</div>

                </div>

            </div>
        `);
    });
};



const Consulta_ultimas_carreras = async () => {

 
    // try{

        const datos_re = {'realizar':'history_results', 'grupo_id' : localStorage.getItem('grupo'), 'game_id': localStorage.getItem('game_id'), "device_token" : localStorage.getItem('dkg')};

        const response  = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        
        const data      = await response.json()

        console.log(data, "Consulta_ultimas_carreras");

        if (localStorage.getItem('game_id') == 5){

            consult_gallos(data)
            return

        }else if(localStorage.getItem('game_id') == 1){

            
            consult_ruleta(data)
            return
        }          

        data['results'].map((races, cont)=>{

            dc = { 2 : 'p6',3 : 'p8',4 : 'h7'}

    //         if(races['bonos_race'] == 'X2' || races['bonos_race'] == 'X3'){ document.getElementById(`bns${cont}`).src = `../static/img/${races['bonos_race']}_V.png` 
    //         }else{document.getElementById(`bns${cont}`).src = '' }

            document.getElementById(`numero_race${cont}`).innerHTML = races['event_number'] 
            document.getElementById(`lugarimg_1er${cont}`).src =  `static/img/numeros/${dc[races['game_id']]}/n${races['settlement']['result_odds'][0]['selection_key']}.svg`
            document.getElementById(`lugarprc_1er${cont}`).innerHTML = parseFloat(races['settlement']['result_odds'][0]['odds']).toFixed(1) 


            document.getElementById(`lugarimg_pls_1er${cont}`).src =  `static/img/numeros/${dc[races['game_id']]}/n${races['settlement']['result_odds'][1]['selection_key'][0]}.svg`
            document.getElementById(`lugarimg_pls_2do${cont}`).src =  `static/img/numeros/${dc[races['game_id']]}/n${races['settlement']['result_odds'][1]['selection_key'][2]}.svg`
            document.getElementById(`lugarprc_pls${cont}`).innerHTML = parseFloat(races['settlement']['result_odds'][1]['odds']).toFixed(1) 


        })
        
    //      return true
        
    // } catch (error) {
    
    //     console.log("Error: ", error)
    //     return false

    // }
            

}

 


