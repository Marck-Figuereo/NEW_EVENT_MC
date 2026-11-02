/* =====================================================================
   VISOR TV · LOTERÍAS — Configuración general
   ---------------------------------------------------------------------
   Todo lo que cambia por punto de venta vive aquí.
   Vive en static/loteria/ del proyecto NEW_EVENT_MC (vista /LOTERIA).
   ===================================================================== */
// Se une a lo que pone la plantilla (wsUrl para control_visor.js), no lo reemplaza.
window.VISOR_CONFIG = Object.assign(window.VISOR_CONFIG || {}, {
  // Carpeta de estáticos. pv_loteria.html pone <base href="/static/loteria/">, así que './' basta.
  static: './',

  marca: {
    nombre: 'LOTTOVIEW',  // va al lado del logo DEMP, en dorado
    sub: 'RESULTADOS DE LOTERÍAS',
    lema: ['TU SUERTE', 'SIEMPRE', 'CONTIGO'],
    logo: 'img/marca/demp.svg'   // ruta dentro de la carpeta `static`
  },

  // Lo que abre el QR en el celular del cliente (visor móvil)
  qr: {
    url: 'https://dempinnovations.com/',
    titulo: ['ESCANEA', 'PARA JUGAR']
  },

  // Escenas que rotan en la TV y cuántos segundos dura cada una.
  // 'quinielas' se reparte sola en las páginas que hagan falta (16 s cada una).
  rotacion: [
    { escena: 'quinielas',   segundos: 16 },
    { escena: 'modalidades', segundos: 16 },
    { escena: 'horarios',    segundos: 14 }
  ],

  segundosResultadoNuevo: 12,   // pantalla completa cuando entra un resultado
  segundosJugada: 10,           // pantalla completa con la jugada del QR
  refrescoDatosSeg: 30,         // cada cuánto se piden resultados a la API
  proximosCierresEnPie: 6,

  // API (cuando se monte en Django). Si `url` es null se usa el modo prueba.
  api: {
    url: null,                  // ej. '/visor/loterias/resultados/'
    metodo: 'GET'
  }
});
