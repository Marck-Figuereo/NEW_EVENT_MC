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
  
(function($) {

	"use strict";

	var fullHeight = function() {

		$('.js-fullheight').css('height', $(window).height());
		$(window).resize(function(){
			$('.js-fullheight').css('height', $(window).height());
		});

	};
	fullHeight();

	$(".toggle-password").click(function() {

	  $(this).toggleClass("fa-eye fa-eye-slash");
	  var input = $($(this).attr("toggle"));
	  if (input.attr("type") == "password") {
	    input.attr("type", "text");
	  } else {
	    input.attr("type", "password");
	  }
	});

})(jQuery);



setTimeout(()=>location.reload(), 100000)

const inicia_sesion = async () =>{

	let user;
	let pass;
	let mensaje;

	if (localStorage.getItem('usr') == null || localStorage.getItem('pss') == null){

		mensaje = 'DATOS CORRECTOS'
		user = $('#user').val()
		pass = $('#password-field').val();

	}else{
		
		mensaje = 'INICIANDO SISTEMA'
		user = localStorage.getItem('usr')
		pass = localStorage.getItem('pss');

	}

	const datos_re = {'realizar':'lg' , 'username': user, 'password' : pass};
	const response = await fetch("",{ method:"POST", body:JSON.stringify(datos_re), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})
	const data     = await response.json() 


	$('#user').val('')
	$('#password-field').val('')


	if (typeof(data['respuesta_api']) == 'object'){
		

		await Swal.fire({icon: "success", title: mensaje, position: "top-end", showConfirmButton: false, timer: 1500})
	
		localStorage.setItem('gmt', 		 data['respuesta_api'][3][0]['gmt']) 
		localStorage.setItem('formato_hora', data['respuesta_api'][4][0]['formato_hora']) 
		localStorage.setItem('id_cons', 	 data['respuesta_api'][2][0]['id_consorcio']) 
		localStorage.setItem('id_lugar', 	 data['respuesta_api'][1][0]['id_lugar']) 
		localStorage.setItem('id_jackpot', 	 data['respuesta_api'][1][0]['id_jackpot_id']) 
		localStorage.setItem('nm_lgr', 	     data['respuesta_api'][1][0]['nombre'])  
		
		localStorage.setItem('usr', 	 	user) 
		localStorage.setItem('pss', 	 	pass) 
 		
		//Ambas App funcionando correctamente
		if (	 localStorage.getItem('url') == null || data['url_juego'] != '') window.location.href = data['url_juego'] //Nueva App
		else if (localStorage.getItem('url') == null || data['url_juego'] == '') window.location.href = localStorage.getItem('url') //Vieja App
		

	}else{await Swal.fire({ icon: "error",title: data['respuesta_api'].toUpperCase(), position: "top-end",showConfirmButton: false,timer: 1500}) }


}


$(document).ready(async()=>{

	
	await inicia_sesion()


})


$('#buscar_log').on("click", async ()=>{
	event.preventDefault()


	inicia_sesion()
	
	

})





