function getCookie2(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
      
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        // Does this cookie string begin with the name we want?
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
            cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            break;
        }
}
  }
  return cookieValue;
} 

$(document).ready(() =>{ if(localStorage.getItem('uss') == null || localStorage.getItem('dkg') == null) window.location.href = "/"})

    
$("#btnLogin").on("click", async function (e) {

    e.preventDefault(); 

    const username = $("#username").val();
    const password = $("#password-field").val();

    loginMessage.textContent = "";
    loginMessage.className = "login-message";

    if (!username || !password) {
        loginMessage.textContent = "Digite usuario y clave para iniciar turno.";
        loginMessage.classList.add("error");
        return;
    }

    btnLogin.disabled = true;
    btnLogin.classList.add("loading");
    
    const gms = ['DOGS_6', 'DOGS_8', 'HORSES_7', 'RULETA', 'GALLOS_V1', 'BINGO', 'KENO']
    for(let ino in gms)localStorage.setItem(gms[ino], false)


    try {//{detail: 'El operador está bloqueado temporalmente por intentos fallidos de login!!.'}
        
      const response  = await fetch("/login",{ method:"POST", body:JSON.stringify({'realizar':'login', 'username' : $("#username").val(), 'password' : $("#password-field").val(), 'device-token' : localStorage.getItem('dkg')}), headers:{"X-CSRFToken":getCookie2('csrftoken'), "X-Requested-With":"XMLHttpRequest", 'Content-Type':'application/json'}})

        const respuesta = await response.json();

        console.log(respuesta);

        let entrada = ""
        for(let ifd in respuesta['games']){const dt_gm = respuesta['games'][ifd]

            if(dt_gm['status']) entrada = dt_gm['code']
            dt_gm['status'] ? localStorage.setItem(dt_gm['code'], true) : localStorage.setItem(dt_gm['code'], false)//prs.toLowerCase())
        
        }

        if (!response.ok || respuesta.error) {
            throw new Error(respuesta.message || "Credenciales incorrectas.");
        }
        
        localStorage.setItem('csh_mode', respuesta['cash']['mode']) 
        loginMessage.textContent = "Operador validado. Abriendo punto de venta...";
        loginMessage.classList.add("success");

        
        setTimeout(() => window.location.href = "/"+ entrada, 600);


    } catch (error) {
        loginMessage.textContent = error.message || "No se pudo iniciar sesión.";
        loginMessage.classList.add("error");
    } finally {
        btnLogin.disabled = false;
        btnLogin.classList.remove("loading");
    }
});



