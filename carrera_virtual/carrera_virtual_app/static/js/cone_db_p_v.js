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





const Consultas_jackpot_carrera = async () =>{

    try {
        const id_jackpt = localStorage.getItem('id_jackpot')

        const datos_re = {'realizar':'consulta_jackpots', "id_jackpot": id_jackpt };
        const response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data     = await response.json() 

        $('#jp_global').text(moneda(data['data'][0]['monto_actual']))
        
    } catch (error) {
        console.log("Error: ", error)
        $('#jp_global').val(moneda(0))
        
    }



}


const Consulta_ganador_jack = async () => {

    
    try {


        const id_jackpt = localStorage.getItem('id_jackpot')
        if (id_jackpt == undefined) return
        
        const datos_re = {'realizar':'consulta_gandores_jack', "id_jackpot": id_jackpt};

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        if(data['data'].length > 0 ){
            
            document.getElementById("ticket_jp").innerHTML = (data['data'][0]['id_apuesta_c']).toString().substr(6,6)
            document.getElementById("monto_jp").innerHTML = moneda(data['data'][0]['valor_ganado'])
            document.getElementById("lugar_jp").innerHTML = data['data'][0]['lugar']

            return true

        }else{return false}

        
    }catch (error) {

        console.log("Error: ", error)
        return false
    
    }
   

}





const Consulta_bonos = async () => {
   
    try{
        const lugar = JSON.parse(localStorage.getItem('id_lugar'))

        const datos_re = {'realizar':'consulta_bonos', "id_lugar" : lugar, "juego": 'PERROS_6'};

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
        const data      = await response.json() 

        if(data['response'].length > 0){
            
            document.getElementById("id_bns").innerHTML  = data['response'][0]['id_apuesta_c_id'].toString().substr(6,6)
            document.getElementById("mnt_bns").innerHTML = moneda(data['response'][0]['valor_ganado']) 

            
            const datos_re2 = { 'realizar':'actualizar_mostrado_bonos', 'id_apuesta_c' : data['response'][0]['id_apuesta_c_id'] }
            await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re2), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'} })
            
            return true
        

        }else{ return false }

        
    }catch(error){
        console.log("Error: ", error)
        return false
    }

}

const Consulta_Tabla = async () => {


    try {        

        $('.precios_tbl').each(function() {  $(`#${$(this).attr('id')}`).text('- - -') });

        const datos_re = {'realizar':'consulta_tabla','juego':'PERROS_6'};

        var response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        var data      = await response.json() 

        
        let good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])

        let cnt = 0;

        while (good && cnt < 10){
            
            cnt +=1                 
            response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
            data = await response.json()
            
            good = confirmacion_tabla(data['data'][0]['fecha'],  data['data'][0]['hora'])     
            
        }
        
        if (cnt > 9) { Swal.fire({title: 'ADVERTENCIA!!', text: "PROBLEMA DE CONEXION", icon: 'warning', showConfirmButton: false, timer: 20000 }).then(() => location.reload() )}

        if(good == false){

            localStorage.setItem('fecha', 	data['data'][0]['fecha']) 
            localStorage.setItem('hora', 	data['data'][0]['hora']) 

            let direct     = [[], [], []]
            let pls        = [[], [], []]

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

            
            
            $('#id_sorteos_c_id').text(data['data'][0]['id_sorteos_c_id'].toString().substr(-4))
        
            
            try{
                $(`#${direct[2][direct[1].indexOf(Math.min(...direct[1]))]}`).css("color", "#11e06e");
                $(`#${direct[2][direct[1].indexOf(Math.max(...direct[1]))]}`).css("color", "#e72b2e");

                $(`#${pls[2][pls[1].indexOf(Math.min(...pls[1]))]}`).css("color", "#11e06e");
                $(`#${pls[2][pls[1].indexOf(Math.max(...pls[1]))]}`).css("color", "#e72b2e");
                

            }catch (error){console.log("Error: ", error)}

                
            await Consulta_ultimas_carreras()
            await Consultas_jackpot_carrera()
        
            return [true, data['data'][0]]
        
        }else{ return [false, '']}


    } catch (error) {

        
        console.log("Error: ", error)
        $('.precios_tbl').each(function() {  

            $(`#${$(this).attr('id')}`).text('- - -')

        });
        
        $('#id_sorteos_c_id').val(0)

        return [false,"","","",""]

    }

            


}
 
const Consulta_resultados = async (pc_tl) => {

    const datos_re = {'realizar':'consulta_resultados','juego':'PERROS_6'};
    const response = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
    const data     = await response.json() 

    
    let pos1 = parseInt(data['data'][0]['animales_ganadores'].substr(0,1)) 
    let pos2 = parseInt(data['data'][0]['animales_ganadores'].substr(2,1)) 

    
    const vd_num  = data['data'][0]['animales_ganadores'].split(",").join("")
    
    const vd_num2 = data['data'][0]['bonos']

    document.getElementById('img-display-result').src = `../static/result/p${pos1}${pos2}.png`;

    document.getElementById("n_race").innerHTML = pc_tl['id_sorteos_c_id'].toString().substr(-4);

    document.getElementById("p_win").innerHTML = Number(pc_tl[`p${pos1}_1er`]);
    
    document.getElementById("p_ext").innerHTML = Number(pc_tl[`p${pos1}_p${pos2}`]);
    
    return [vd_num, vd_num2]


}










const Consulta_ultimas_carreras = async () => {

    
    try{

        const datos_re = {'realizar':'consulta_ult_carreras','juego':'PERROS_6'};

        const response  = await fetch("/carreras_virtual_p",{ method:"POST", body:JSON.stringify(datos_re), headers:{ "X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
        const data      = await response.json()


        data.map((races, cont)=>{

            
            if(races[0]['bonos_race'] == 'X2' || races[0]['bonos_race'] == 'X3'){  document.getElementById(`bns${cont}`).src = `../static/img/${races[0]['bonos_race']}.svg` 
            }else{document.getElementById(`bns${cont}`).src = '' }

                
            
            document.getElementById(`numero_race${cont}`).innerHTML = races[0]['id_sorteos_c'].toString().substr(-4)
            document.getElementById(`img_posi${cont}`).src =  `static/img/np${races[0]['race_winner'].substr(0,1)}.png`
            document.getElementById(`img_y_posi${cont}`).innerHTML = races[0]['race_winner'].substr(0,1)
            document.getElementById(`prc_1er_lgr${cont}`).innerHTML = Number(races[0]['pago_primer_lugar']) 
            
            
            document.getElementById(`img_pos1${cont}`).src =  `static/img/np${races[0]['race_winner'].substr(0,1)}.png`
            document.getElementById(`img_y_pos1${cont}`).innerHTML = races[0]['race_winner'].substr(0,1)
            document.getElementById(`img_pos2${cont}`).src =  `static/img/np${races[0]['race_winner'].substr(2,1)}.png`
            document.getElementById(`img_y_pos2${cont}`).innerHTML = races[0]['race_winner'].substr(2,1)
            document.getElementById(`prc_2er_lgr${cont}`).innerHTML = Number(races[0]['pago_pale']) 
            
            
        
            
        })
        
        return true
        
    } catch (error) {
    
        console.log("Error:", error)   
        return false

    }
            

}

 



