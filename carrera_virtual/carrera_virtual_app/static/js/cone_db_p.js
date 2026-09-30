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


// ==========================================
// ACCESO A DJANGO LOCAL (guia "Integracion del visor con la API sin Redis")
// JavaScript solo llama /games del mismo origen; Django consulta la API.
// ==========================================

const post_visor = datos => fetch("/games",{ method:"POST", body:JSON.stringify(datos), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})

// Token revocado o visor inactivo: se limpia el visor y se vuelve al flujo de activacion (QR)
const volver_a_configuracion = () => {
    localStorage.clear()
    window.location.href = "/"
}


// Segundos -> "m:ss" (tiempos de las peleas de gallos)
function convtSegs(sgs) {
    const total = Number(sgs) || 0
    const min = Math.floor(total / 60)
    const sec = total % 60
    return `${min}:${String(sec).padStart(2, '0')}`
}


// ==========================================
// GALLOS: peleas codificadas en el nombre del video
// 9 digitos, 3 por pelea: [ganador][segundos con 2 digitos]
//   065138229.mp4 -> pelea 1: gana 0 en 65 s | pelea 2: gana 1 en 38 s | pelea 3: gana 2 en 29 s
// Ganador: 1 azul, 2 blanco, 0 empate
// ==========================================

// La API nombra al ganador con palabras (order_key "BLUE-DRAW-WHITE", GENERAL:WHITE, FIGHT_1:BLUE);
// el video, con digitos. Estos mapas permiten usar cualquiera de los dos.
const NOMBRE_GALLO = { '1' : 'BLUE', '2' : 'WHITE', '0' : 'DRAW' }
const COLOR_GALLO  = { '1' : 'blue', '2' : 'white', '0' : 'silver', 'BLUE' : 'blue', 'WHITE' : 'white', 'DRAW' : 'silver' }

const peleas_desde_video = video => {

    const nombre = String(video || '').split('/').pop().split('?')[0].replace(/\.[^.]+$/, '')

    if (!/^\d{9}$/.test(nombre)) return null

    return [0, 3, 6].map(i => ({ ganador : nombre[i], segundos : Number(nombre.substr(i + 1, 2)) }))
}

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
  


var animaciones_jack = {}   // animacion activa de cada caja de jackpot

const detener_animacion_jack = id_html => cancelAnimationFrame(animaciones_jack[id_html])

const aumento_jack = (num_inicio, num_fn, id_html) =>{


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
        document.querySelector(id_html).textContent = moneda(currentNumber.toLocaleString());
    
        // Verificar si la animación debe continuar
        if (progress < 1)  animaciones_jack[id_html] = requestAnimationFrame(updateCount);
        
    }
    
    // Función de interpolación cuadrática (easeOut)
    easeOutQuad = t => t * (2 - t);
    
    detener_animacion_jack(id_html)   // una sola animacion por caja

    startTime = performance.now(); // Obtener el tiempo actual de alta resolución
    animaciones_jack[id_html] = requestAnimationFrame(updateCount);
}




// Pinta una caja de jackpot (#jp_global o #jp_local).
//   jackpot existe      -> monto (con la animacion de aumento)
//   jackpot no asignado -> "JK SIN ASIGNAR"
const pintar_caja_jackpot = (id_html, clave, jackpot) => {

    if (!jackpot) {
        detener_animacion_jack(id_html)
        $(id_html).text('JK SIN ASIGNAR').css('font-size', '22px')
        localStorage.removeItem(clave)
        return
    }

    $(id_html).css('font-size', '')

    const datoss = localStorage.getItem(clave)
    const jack   = jackpot['current_amount']

    if(datoss == undefined){ 
        
        localStorage.setItem(clave, jack) 
        $(id_html).text(moneda(jack))
    
    }else{

        if(Number(datoss) > Number(jack)) document.querySelector(id_html).textContent = moneda(jack);            
        else aumento_jack(Number(datoss), jack, id_html)
    
        localStorage.setItem(clave, jack) 
    }
}


// Error al consultar los jackpots: ambas cajas muestran ERROR
var jackpots_cargados = false   // ya se pinto al menos una respuesta valida

// Falla de la API: si ya hay montos en pantalla se conservan (guia, seccion 6);
// ERROR solo se muestra si nunca se pudieron cargar.
const error_jackpots = () => {
    if (jackpots_cargados) return
    detener_animacion_jack('#jp_global')
    detener_animacion_jack('#jp_local')
    $('#jp_global, #jp_local').text('ERROR').css('font-size', '22px')
}


const Consultas_jackpot_carrera = async () =>{

    let data = null

    try {

        const datos_re = { 'realizar'     : 'consulta_jackpots', 'device_token' : localStorage.getItem('dkg'), 'game_id' : localStorage.getItem('game_id') };
        const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        data = await response.json()

    } catch (error) {
        console.log("Error: ", error)
        error_jackpots()
        return
    }

    console.log(data, 'Consultas_jackpot_carrera');

    // La API no respondio o la respuesta no trae el contrato esperado
    if (!data || data['error'] || !Array.isArray(data['jackpots'])) {
        error_jackpots()
        return
    }

    const jk_global = (data['global_jackpots'] || [])[0]
    const jk_local  = (data['local_jackpots']  || [])[0]

    jackpots_cargados = true

    pintar_caja_jackpot('#jp_global', 'datos_jack_gl', jk_global)
    pintar_caja_jackpot('#jp_local',  'datos_jack_lc', jk_local)


    // Ultimo ganador (del jackpot global, como antes)
    if (jk_global && jk_global['last_winner_at']) {
        $('#id_tk_info').text(`****${jk_global['last_winner_ticket_id']}`)
        $('#monto_info').text(moneda(jk_global['last_winner_amount']))
        $('#lugar_info').text(jk_global['last_winner_lugar'])
        $('#date_info').text(jk_global['last_winner_at'])
    } else {
        $('#id_tk_info, #monto_info, #lugar_info, #date_info').text('- - -')
    }
}



// ==========================================
// GANADORES DE JACKPOT (guia: Ganadores de jackpots)
// El backend devuelve el evento ganador de cada jackpot aplicable al visor y juego.
// Cada ganador se muestra una sola vez: se guarda su winner_id (o jackpot_id + sorteo_id)
// en localStorage, asi no se repite despues de recargar o reconectar.
// ==========================================

const CLAVE_JK_VISTOS = 'jk_ganadores_vistos'

const id_ganador_jk = item => {
    const ev = item['event'] || {}
    if (ev['winner_id'] != null) return `w:${ev['winner_id']}`
    if (ev['sorteo_id'])         return `j:${item['jackpot_id']}:${ev['sorteo_id']}`
    return null
}


// Devuelve true si hay un ganador nuevo para mostrar
const Consulta_ganador_jack = async () => {

    console.log('Consulta_ganador_jack');

    try {

        const datos_re = {'realizar':'consulta_gandores_jack', "device_token" : localStorage.getItem('dkg'), "game_id" : localStorage.getItem('game_id')};

        const response  = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        if (!data || !Array.isArray(data['events'])) return false

        // Ganadores ya mostrados en este visor
        const primera_vez = localStorage.getItem(CLAVE_JK_VISTOS) == null
        let vistos = []
        try { vistos = JSON.parse(localStorage.getItem(CLAVE_JK_VISTOS)) || [] } catch (error) { vistos = [] }

        const nuevos = data['events'].filter(item => {
            const id = id_ganador_jk(item)
            return id && !vistos.includes(id)
        })

        nuevos.forEach(item => vistos.push(id_ganador_jk(item)))
        localStorage.setItem(CLAVE_JK_VISTOS, JSON.stringify(vistos.slice(-50)))

        // Primer arranque del visor: se registran los ganadores existentes sin anunciarlos
        if (primera_vez || nuevos.length == 0) return false


        // Pantalla de ganador: una fila por cada jackpot ganado
        $("#container-jackpots .row_jp").remove();

        nuevos.forEach(item => {

            const ev = item['event']

            const fila_nombre = $(`<div class="row row_jp mt-5"><div class="col-md-12 themed-grid-col"><div class="form-group"><input class="input_info_jp" type="text" readonly></div></div></div>`)
            fila_nombre.find('input').val(item['name'] || '')

            const fila_datos = $(`<div class="row row_jp mt-3">
                <div class="col-md-7 themed-grid-col"><div class="form-group"><input class="input_info_jp jk_lugar" type="text" readonly></div></div>
                <div class="col-md-5 themed-grid-col"><div class="form-group"><input class="input_info_jp jk_ticket" type="text" readonly></div></div>
            </div>`)
            fila_datos.find('.jk_lugar').val(ev['winner_lugar'] || '')
            fila_datos.find('.jk_ticket').val(`******${String(ev['ticket_code'] || '').slice(-6)}`)

            const fila_monto = $(`<div class="row row_jp"><div class="col-md-12 themed-grid-col mt-3"><div class="form-group"><input class="input_info_jp precio_jp" type="text" readonly></div></div></div>`)
            fila_monto.find('input').val(moneda(ev['winner_amount']))

            $('#container-jackpots').append(fila_nombre, fila_datos, fila_monto)
        })


        // Barra "ULTIMO JACKPOT" con el ganador que se acaba de mostrar
        const ultimo = nuevos[0]['event']
        $('#id_tk_info').text(`****${String(ultimo['ticket_code'] || '').slice(-6)}`)
        $('#monto_info').text(moneda(ultimo['winner_amount']))
        $('#lugar_info').text(ultimo['winner_lugar'] || '')
        $('#date_info').text(ultimo['selected_at'] || '')

        return true
        
    }catch (error) {

        console.log("Error: ", error)
        return false
    
    }
}




// ==========================================
// BONOS DEL EVENTO FINALIZADO (todos los juegos)
// Guia: se consulta con el sorteo_id exacto del resultado mostrado (results[0]).
// Se consulta enseguida y se repite cada 2 s durante maximo 10 s; se detiene
// cuando has_bonus_event es true. El sorteo ya mostrado no se repite.
// ==========================================

var ganador_bono = null   // ganador del ultimo bono encontrado (uno por localidad)


const Consulta_bonos = async (sorteo_id) => {

    console.log('Consulta_bonos', sorteo_id);

    if (!sorteo_id) return false

    // Este sorteo ya se mostro (por ejemplo, despues de recargar la pagina)
    if (localStorage.getItem('id_b') == sorteo_id) return false

    const inicio = Date.now()

    while (true) {

        try {

            const datos_re = {'realizar':'consulta_bonos', "device_token" : localStorage.getItem('dkg'), "game_id" : localStorage.getItem('game_id'), "sorteo_id" : sorteo_id};

            const response  = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
            const data      = await response.json()

            // 400 / 404: la API rechazo la consulta; reintentar no cambia nada (guia, seccion 6)
            if (response.status == 400 || response.status == 404 || response.status == 501) {
                console.log('Bono no disponible:', response.status, data)
                return false
            }

            // Nunca mostrar un bono de otro sorteo
            const mismo_sorteo = data && (!data['sorteo_id'] || data['sorteo_id'] == sorteo_id)

            if (mismo_sorteo && data['has_bonus_event'] && Array.isArray(data['winners']) && data['winners'].length > 0) {

                ganador_bono = data['winners'][0]
                localStorage.setItem('id_b', sorteo_id)

                pintar_ganador_bono()
                return true
            }

        } catch (error) {
            console.log("Error: ", error)
        }

        // Limite de 10 segundos
        if (Date.now() - inicio + 2000 > 10000) return false

        await new Promise(resolve => setTimeout(resolve, 2000))
    }
}


// Pinta en la pantalla de bono al ganador de la localidad
const pintar_ganador_bono = () => {

    if (!ganador_bono) return

    document.getElementById("id_bns").value  = `ID ${ganador_bono['masked_ticket_code']}`
    document.getElementById("mnt_bns").value = moneda(ganador_bono['bonus_amount'])
}




var tabla_cargada = null   // table_odds_id que esta dibujado en la tabla

const Consulta_Tabla = async (id_table, game) => {

    console.log('Consulta_Tabla', id_table, game);
        $('.txt_lgr').text(localStorage.getItem('lugar'))

        // try {        

            

            const datos_re = {'realizar':'consulta_tabla' , 'table_odds_id' : id_table};

            // Primero se piden los datos. La tabla se limpia y se vuelve a pintar en el mismo
            // paso, cuando ya llegaron: el navegador no llega a dibujar la tabla vacia (sin pestaneo).
            let data = null

            try {
                const response = await fetch("/games",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
                data = response.ok ? await response.json() : null
            } catch (error) { console.log("Error: ", error) }

            // API no disponible: se conserva la tabla que ya esta en pantalla
            if (!data || typeof data !== 'object') return true
        
            console.log(data);

            $('.precios_tbl').each(function() {  
                
                $(`#${$(this).attr('id')}`).css("color", "#fff")
                $(`#${$(this).attr('id')}`).text('- - -') 
            
            });

            // Gallos: quitar el verde/rojo del sorteo anterior (sus cuotas usan la clase .ods)
            $('.ods').css("color", "");
        
            Object.entries(data).forEach(([cmb, odds])=>{
    
                if      (cmb.length == 3 && [2, 3, 4].includes(game)) $('#'+ cmb[0] +'-' + cmb[2]).text(parseFloat(odds).toFixed(1))
                else if (game == 5)                                   $('#ods_' + cmb).text(isNaN(parseFloat(odds)) ? odds : parseFloat(odds).toFixed(1));
                else                                                  $(`#${cmb[4]}-${cmb[4]}` ).text(odds)
    
            }) 


            try{
    

                const entradas = Object.entries(data);

                const combinaciones = entradas.filter(([key]) => key.length === 3 );

                const win = entradas.filter(([key]) => /^WIN \d+$/.test(key));

                if (combinaciones.length) { 
                    
                    const pcMayor = combinaciones.reduce((a, b) => Number(a[1]) > Number(b[1]) ? a : b);
                    const pcMenor = combinaciones.reduce((a, b) => Number(a[1]) < Number(b[1]) ? a : b);
                
                    if(game == 5){
                        $(`#ods_${pcMayor[0]}`).css("color", "#09ff00");
                        $(`#ods_${pcMenor[0]}`).css("color", "#ff0000");

                    }else{
                        $(`#${pcMayor[0]}`).css("color", "#09ff00");
                        $(`#${pcMenor[0]}`).css("color", "#ff0000");
                    }
                }


                if (win.length) {

                    const winMayor = win.reduce((a, b) => Number(a[1]) > Number(b[1]) ? a : b );

                    const winMenor = win.reduce((a, b) => Number(a[1]) < Number(b[1]) ? a : b );

                    const mayorKey = winMayor[0].replace("WIN ", "");
                    const menorKey = winMenor[0].replace("WIN ", "");

                    $(`#${mayorKey}-${mayorKey}`).css("color", "#09ff00");
                    $(`#${menorKey}-${menorKey}`).css("color", "#ff0000");
                }
            
            }catch(error){console.log("Error: ", error)}
            
        // }catch(error){console.log("Error: ", error)}


        tabla_cargada = id_table

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
 

// Aplica una configuracion del visor (display_config o heartbeat con config_changed)
const aplicar_configuracion = data => {

    if (!data || !data['config']) return

    const game_anterior  = String(localStorage.getItem('game_id'))
    const grupo_anterior = String(localStorage.getItem('grupo'))

    localStorage.setItem('game_id', data['config']['games']) 
    localStorage.setItem('grupo', (data['grupo'] || {})['id']) 
    localStorage.setItem('version', data['config_version']) 
    localStorage.setItem('lugar', (data['lugar'] || {})['nombre'])
    localStorage.setItem('jk', data['jackpot_id']) 

    $('.txt_lgr').text(localStorage.getItem('lugar'))

    // Otro juego: se abre su pantalla (o se recarga esta con el juego nuevo)
    const game_url = data['config']['game_url']

    if (game_url && game_url != localStorage.getItem('url')) {
        localStorage.setItem('url', game_url)
        window.location.href = "/" + game_url
        return
    }

    if (String(localStorage.getItem('game_id')) != game_anterior) {
        location.reload()
        return
    }

    // Mismo juego en otro grupo: se reconecta el WebSocket con el grupo nuevo
    if (String(localStorage.getItem('grupo')) != grupo_anterior && typeof reconectar_websocket == 'function') reconectar_websocket()
}


// Guia 5.4: se consulta al iniciar; despues, solo cuando el heartbeat indica otra config_version
const confirmar_configuracion = async () => {

    console.log('confirmar_configuracion')

    try {

        const response = await post_visor({'realizar':'display_config', "device_token" : localStorage.getItem('dkg')})

        if (response.status == 404) { volver_a_configuracion(); return }
        if (!response.ok) return   // API no disponible: se conserva la configuracion actual

        const data = await response.json()

        if (data['config_version'] != localStorage.getItem("version")) aplicar_configuracion(data)

    } catch (error) { console.log("Error: ", error) }
}


// Guia 5.5: heartbeat periodico. Mantiene el visor visible en soporte y detecta cambios de configuracion.
var heartbeat_segundos = 30

const enviar_heartbeat = async () => {

    try {

        const response = await post_visor({'realizar':'display_heartbeat', "device_token" : localStorage.getItem('dkg'), "config_version" : localStorage.getItem('version')})

        // 404: se confirma con la configuracion antes de sacar al visor
        if (response.status == 404) { await confirmar_configuracion(); return }

        // 501: la API todavia no tiene el endpoint de heartbeat; se reintenta cada 5 minutos
        if (response.status == 501) { console.log('La API no tiene heartbeat desplegado'); heartbeat_segundos = 300; return }

        if (response.ok) {

            const data = await response.json()

            const intervalo = Number(((data || {})['heartbeat'] || {})['heartbeat_interval_seconds'])
            if (intervalo > 0) heartbeat_segundos = intervalo

            if (data['config_changed']) aplicar_configuracion(data['config'])
        }

    } catch (error) {
        console.log("Error: ", error)
    } finally {
        setTimeout(enviar_heartbeat, heartbeat_segundos * 1000)
    }
}


// Guia 5.6: estado del evento en curso. Se usa al iniciar y al reconectar el WebSocket.
const consultar_evento_actual = async () => {

    try {

        const response = await post_visor({'realizar':'evento_actual', "device_token" : localStorage.getItem('dkg'), "game_id" : localStorage.getItem('game_id')})
        if (!response.ok) return null

        const data = await response.json()
        return (data && data['has_event']) ? data['event'] : null

    } catch (error) {
        console.log("Error: ", error)
        return null
    }
}



// Resultado del sorteo que se va a reproducir (results[0]).
// sorteo_esperado: sorteo_id del WebSocket. El resultado puede tardar unos segundos en publicarse:
// se reintenta cada 2 s (maximo 20 s) para no reproducir el video de otro sorteo.
// Devuelve [0 video, 1 multiplicador, 2 sorteo_id (para el bono), 3 numero de evento, 4 cuota win, 5 cuota exacta] o null.
const Consulta_resultados = async (sorteo_esperado = null) => {

    console.log('Consulta_resultados', sorteo_esperado);

    const inicio = Date.now()
    let data = null

    while (true) {

        try {

            const response = await post_visor({'realizar':'consulta_resultados', 'game_id' : localStorage.getItem('game_id'), "device_token" : localStorage.getItem('dkg')})
            data = response.ok ? await response.json() : null

        } catch (error) {
            console.log("Error: ", error)
            data = null
        }

        const hay_video = data && data['selected_video']

        if (hay_video && (!sorteo_esperado || !data['sorteo_id'] || data['sorteo_id'] == sorteo_esperado)) break

        if (Date.now() - inicio + 2000 > 20000) {
            console.log('El resultado del sorteo no llego a tiempo', sorteo_esperado, data)
            return null
        }

        await esperar(2000)
    }

    console.log(data, 'Consulta_resultados');

    const game = Number(localStorage.getItem('game_id'))

    // Gallos: su pantalla de resultados se llena con el video que se reproduce (ver excute_race)
    if (game == 5) return [data['selected_video'], 'X', data['sorteo_id'], data['event_number'], '', '', data]


    // Carreras
    let pago_win  = ''
    let pago_pale = ''

    try {

        const odds = data['settlement']['result_odds']

        let pos1 = odds[1]['selection_key'][0] 
        let pos2 = odds[1]['selection_key'][2]
        
        pago_win  = parseFloat(odds[0]['odds']).toFixed(1)
        pago_pale = parseFloat(odds[1]['odds']).toFixed(1)

        if (document.getElementById("n_race")) {

            document.getElementById("n_race").innerHTML = data['event_number']

            document.getElementById("img_win").src = `static/img/numeros/p6/n${pos1}.svg`;
            document.getElementById("p_win").innerHTML = pago_win
           
            document.getElementById("img1_ext").src = `static/img/numeros/p6/n${pos1}.svg`;
            document.getElementById("img2_ext").src = `static/img/numeros/p6/n${pos2}.svg`;
            document.getElementById("p_ext").innerHTML = pago_pale
        }

    } catch (error) { console.log("Resultado sin cuotas: ", error) }

    // nup[1]: multiplicador del resultado ('X2', 'X3' o 'X')
    const mult = [2, 3, 4].includes(game) && [2, 3].includes(Number(data['race_multiplier'])) ? `X${Number(data['race_multiplier'])}` : 'X'

    return [data['selected_video'], mult, data['sorteo_id'], data['event_number'], pago_win, pago_pale, data]

}


// Pantalla de resultados de gallos (#container-resultado-carrera).
// Ganadores y cuotas salen del resultado de la API; los tiempos, de las peleas del video.
const pintar_resultado_gallos = (data, peleas) => {

    if (!data) return

    const result = data['result'] || {}
    const odds   = (data['settlement'] || {})['result_odds'] || []

    const cuota = selection_key => {
        const apuesta = odds.find(item => String(item['selection_key']) === String(selection_key))
        if (!apuesta) return ''
        const n = parseFloat(apuesta['odds'])
        return isNaN(n) ? apuesta['odds'] : n.toFixed(1)
    }

    // El codigo del video manda: es lo que el publico acaba de ver en cada pelea.
    // El resultado de la API solo se usa si el nombre del video no trae el codigo.
    const order_api = (result['order_key'] || '').split('-').filter(x => x !== '')
    const order     = peleas ? peleas.map(p => NOMBRE_GALLO[p.ganador] || p.ganador) : order_api   // BLUE / WHITE / DRAW

    if (peleas && order_api.length == 3 && order_api.join('-') != order.join('-')) console.log('El resultado de la API no coincide con el video', order_api, order)

    const general = String(result['general_winner'] ?? '')
    const numero  = peleas ? peleas.map(p => p.ganador).join('') : (result['result_key'] || '')
    const color   = ganador => `result-${COLOR_GALLO[ganador] || 'silver'}`

    $('.body_div').text(data['event_number'] ?? '')

    $('#div_color_win').attr('class', color(general))
    $('#win-odd-text').text(cuota(`GENERAL:${general}`))

    for (let i = 1; i <= 3; i++) {

        const ganador = order[i - 1]

        $(`#div-color-round${i}`).attr('class', color(ganador))
        $(`#text-color-round${i}`).text(cuota(`FIGHT_${i}:${ganador}`))

        $(`#div-result-trpl-${i}`).attr('class', color(ganador))
        $(`#div-result-trpl-${i}`).text(peleas ? convtSegs(peleas[i - 1].segundos) : '')
    }

    $('#text-result-trpl').text(`No. ${numero}`)
    $('#text-result-trpl-odd').text(cuota(order.length == 3 ? order.join('-') : result['order_key']))
}




const consult_gallos = data => {

    $('.sidebar_ult div').remove();

    $('.sidebar_ult').append('<div class="row row-title">HISTORIAL DE TORNEO</div>');
 
    data.results.forEach(dts => {

        if (!dts || !dts.result) return;

        const result = dts.result;
        const inf = (dts.settlement || {}).result_odds || [];

        // Codigo de las peleas en su propio campo (video_code, ej. "146249065")
        const peleas = peleas_desde_video(dts.video_code || (dts.settlement || {}).selected_video);

        // ==========================================
        // BUSCAR ODDS
        // ==========================================

        const getOdds = selection_key => {

            const apuesta = inf.find(item => item.selection_key === selection_key);
            if (!apuesta) return '';
            const n = parseFloat(apuesta.odds);
            return isNaN(n) ? apuesta.odds : n.toFixed(1);

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
                    ${[0, 1, 2].map(i => `<div><span class="bg_${order[i] || (peleas ? NOMBRE_GALLO[peleas[i].ganador] : '') || 'emp'}">${peleas ? convtSegs(peleas[i].segundos) : (resultKey[i] ?? '')}</span></div>`).join('')}
                    <div class="odds-result">${ganadorTorneo}</div>

                </div>

            </div>
        `);
    });
};



const Consulta_ultimas_carreras = async () => {

 
    // try{

        const datos_re = {'realizar':'history_results', 'game_id': localStorage.getItem('game_id'), "device_token" : localStorage.getItem('dkg')};

        let data = null

        try {
            const response = await post_visor(datos_re)
            data = response.ok ? await response.json() : null
        } catch (error) { console.log("Error: ", error) }

        console.log(data, "Consulta_ultimas_carreras");

        // API no disponible: se conserva el historial que ya esta en pantalla
        if (!data || !Array.isArray(data['results'])) return

        if (localStorage.getItem('game_id') == 5){

            consult_gallos(data)
            return

        }     

        data['results'].map((races, cont)=>{

            dc = { 2 : 'p6',3 : 'p8',4 : 'h7'}

            // Guia: race_multiplier viene en cada resultado (2, 3 o null). Solo carreras.
            // Sin multiplicador la imagen se oculta: una <img> sin src dibuja un cuadro vacio.
            const mult     = races['race_multiplier']
            const img_mult = document.getElementById(`bns${cont}`)

            if (img_mult) {
                if (mult == 2 || mult == 3) {
                    img_mult.src = `../static/img/X${mult}_V.png`
                    img_mult.style.visibility = 'visible'
                } else {
                    img_mult.removeAttribute('src')
                    img_mult.style.visibility = 'hidden'
                }
            }

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

 


