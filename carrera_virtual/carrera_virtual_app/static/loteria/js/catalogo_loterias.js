/* =====================================================================
   CATÁLOGO DE LOTERÍAS (agrupadas por casa)
   ---------------------------------------------------------------------
   - `cierre`: hora en que el punto de venta deja de vender (de tu sistema).
   - `hora`:   hora del sorteo. >>> VERIFICAR: son horas de referencia,
               en producción conviene que lleguen de la API.
   - `cierre_dom` / `hora_dom`: opcionales, si el domingo cambia.
   - `bola`: color de las bolas (roja, azul, verde, amarilla, morada,
             naranja, celeste, rosada).
   - `logo_fondo`: 'claro' = logo sobre placa blanca, 'oscuro' = sobre placa
             azul noche, o un color ('#333884'). Sin logo se dibuja un emblema.
   - `momento`: icono del sorteo ('dia' | 'tarde' | 'noche').
   ===================================================================== */
(function () {
  var IMG = ((window.VISOR_CONFIG && window.VISOR_CONFIG.static) || 'static/loterias/') + 'img/';

  window.VISOR_CATALOGO = {
    /* Cada casa va en una página según su `grupo` (en este orden). */
    grupos: {
      dominicanas:     'Loterías dominicanas',
      mas:             'Más loterías',
      internacionales: 'Loterías internacionales'
    },
    casas: [
      { id: 'nacional', grupo: 'dominicanas', nombre: 'Nacional', logo: IMG + 'logos/nacional.png', logo_fondo: 'claro',
        bola: 'verde', acento: '#22c55e',
        sorteos: [
          { id: 'NM', codigo: 'NM', nombre: 'Gana Más', cierre: '14:20', hora: '14:30', momento: 'dia' },
          { id: 'NN', codigo: 'NN', nombre: 'Noche',    cierre: '20:45', hora: '21:00', momento: 'noche', cierre_dom: '17:45', hora_dom: '18:00' }
        ] },
      { id: 'leidsa', grupo: 'dominicanas', nombre: 'Leidsa', logo: IMG + 'logos/leidsa.png', logo_fondo: 'claro',
        bola: 'roja', acento: '#ef4444',
        sorteos: [
          { id: 'LN', codigo: 'LN', nombre: 'Quiniela Palé', cierre: '20:50', hora: '20:55', momento: 'noche', cierre_dom: '15:50', hora_dom: '15:55' }
        ] },
      { id: 'real', grupo: 'dominicanas', nombre: 'Real', logo: IMG + 'logos/real.png', logo_fondo: 'claro',
        bola: 'morada', acento: '#a855f7',
        sorteos: [
          { id: 'RM', codigo: 'RM', nombre: 'Real Día',   cierre: '12:50', hora: '13:00', momento: 'dia' },
          { id: 'RN', codigo: 'RN', nombre: 'Real Noche', cierre: '19:50', hora: '20:00', momento: 'noche' }
        ] },
      { id: 'loteka', grupo: 'dominicanas', nombre: 'Loteka', logo: IMG + 'logos/loteka.png', logo_fondo: 'claro',
        bola: 'amarilla', acento: '#facc15',
        sorteos: [
          { id: 'LT', codigo: 'LT', nombre: 'Loteka Tarde', cierre: '13:25', hora: '13:35', momento: 'tarde' },
          { id: 'LK', codigo: 'LK', nombre: 'Loteka Noche', cierre: '19:45', hora: '19:55', momento: 'noche' }
        ] },
      { id: 'primera', grupo: 'dominicanas', nombre: 'La Primera', logo: IMG + 'logos/la-primera.svg', logo_fondo: 'oscuro',
        bola: 'naranja', acento: '#f97316',
        sorteos: [
          { id: 'PD', codigo: 'PD', nombre: 'Primera Día',   cierre: '11:45', hora: '12:00', momento: 'dia' },
          { id: 'PN', codigo: 'PN', nombre: 'Primera Noche', cierre: '18:50', hora: '19:00', momento: 'noche' }
        ] },
      { id: 'suerte', grupo: 'dominicanas', nombre: 'La Suerte', logo: IMG + 'logos/la-suerte.png', logo_fondo: 'claro',
        bola: 'azul', acento: '#3b82f6',
        sorteos: [
          { id: 'SD', codigo: 'SD', nombre: 'Suerte 12:30', cierre: '12:15', hora: '12:30', momento: 'dia' },
          { id: 'SN', codigo: 'SN', nombre: 'Suerte 6PM',   cierre: '17:45', hora: '18:00', momento: 'tarde' }
        ] },

      { id: 'lotedom', grupo: 'mas', nombre: 'Lotedom', logo: IMG + 'logos/lotedom.png', logo_fondo: 'claro',
        bola: 'roja', acento: '#ef4444',
        sorteos: [
          { id: 'LD', codigo: 'LD', nombre: 'Quiniela Lotedom', cierre: '11:50', hora: '12:00', momento: 'dia' }
        ] },
      { id: 'king', grupo: 'mas', nombre: 'King Lottery', logo: IMG + 'logos/king-lottery.png', logo_fondo: 'oscuro',
        bola: 'amarilla', acento: '#eab308',
        sorteos: [
          { id: 'KD', codigo: 'KD', nombre: 'King Día',   cierre: '12:15', hora: '12:30', momento: 'dia' },
          { id: 'KN', codigo: 'KN', nombre: 'King Noche', cierre: '19:15', hora: '19:30', momento: 'noche' }
        ] },
      { id: 'newyork', grupo: 'internacionales', nombre: 'Nueva York', logo: IMG + 'logos/nueva-york.png', logo_fondo: 'claro',
        bola: 'azul', acento: '#60a5fa', fondo: IMG + 'fondos/card-nueva-york.jpg', fondo_pos: 'left center', ancho: true,
        sorteos: [
          { id: 'YD', codigo: 'YD', nombre: 'NY Mediodía', cierre: '14:20', hora: '14:30', momento: 'dia' },
          { id: 'YN', codigo: 'YN', nombre: 'NY Noche',    cierre: '22:20', hora: '22:30', momento: 'noche' }
        ] },
      { id: 'puertorico', grupo: 'internacionales', nombre: 'Puerto Rico', logo: IMG + 'logos/puerto-rico.png', logo_fondo: 'claro',
        bola: 'morada', acento: '#a855f7', fondo: IMG + 'fondos/card-puerto-rico.jpg', fondo_pos: 'left center', ancho: true,
        sorteos: [
          // >>> VERIFICAR: falta la hora del sorteo; mientras no esté se muestra solo el cierre.
          { id: 'PR', codigo: 'PR', nombre: 'Puerto Rico', cierre: '23:59', hora: null, momento: 'noche' }
        ] },
      { id: 'florida', grupo: 'internacionales', nombre: 'Florida', logo: IMG + 'logos/florida.png', logo_fondo: 'claro',
        bola: 'celeste', acento: '#22d3ee', fondo: IMG + 'fondos/card-florida.jpg', ancho: true,
        sorteos: [
          { id: 'FD', codigo: 'FD', nombre: 'Florida Día',   cierre: '13:20', hora: '13:30', momento: 'dia' },
          { id: 'FN', codigo: 'FN', nombre: 'Florida Noche', cierre: '21:40', hora: '21:45', momento: 'noche' }
        ] },
      { id: 'anguila', grupo: 'internacionales', nombre: 'Anguila', logo: IMG + 'logos/anguila.png', logo_fondo: 'claro',
        bola: 'rosada', acento: '#ec4899', fondo: IMG + 'fondos/card-anguilla.jpg', ancho: true,
        sorteos: [
          { id: 'AD', codigo: 'AD', nombre: 'Anguila 10AM', cierre: '09:50', hora: '10:00', momento: 'dia' },
          { id: 'AM', codigo: 'AM', nombre: 'Anguila 1PM',  cierre: '12:50', hora: '13:00', momento: 'dia' },
          { id: 'AT', codigo: 'AT', nombre: 'Anguila 6PM',  cierre: '17:50', hora: '18:00', momento: 'tarde' },
          { id: 'AN', codigo: 'AN', nombre: 'Anguila 9PM',  cierre: '20:50', hora: '21:00', momento: 'noche' }
        ] }
      // Los Super Palé (SP) se agregan igual que las de arriba.
    ],

    /* Otras modalidades: Kino, Loto, Pool, Pega 3... (no son quinielas de 3 números) */
    modalidades: [
      { id: 'KINO', casa: 'Leidsa', nombre: 'Super Kino TV', logo: IMG + 'logos/kino-tv.png',
        tipo: 'kino', cantidad: 20, rango: [1, 80], bola: 'naranja', acento: '#f97316',
        hora: '20:55', cierre: '20:45', dias: [0, 1, 2, 3, 4, 5, 6], ancho: true },
      { id: 'LOTO', casa: 'Leidsa', nombre: 'Loto · Súper Más', logo: IMG + 'logos/loto-mas.png',
        tipo: 'loto', cantidad: 6, rango: [1, 38], bola: 'amarilla', acento: '#facc15',
        extras: [
          { clave: 'mas',       etiqueta: 'MÁS',       bola: 'roja', rango: [1, 12] },
          { clave: 'super_mas', etiqueta: 'SÚPER MÁS', bola: 'azul', rango: [1, 15] }
        ],
        hora: '20:55', cierre: '20:45', dias: [3, 6], ancho: true },
      { id: 'PEGA3', casa: 'Leidsa', nombre: 'Pega 3 Más', logo: IMG + 'logos/pega-3-mas.png',
        tipo: 'loto', cantidad: 3, rango: [0, 10], bola: 'celeste', acento: '#22d3ee',
        hora: '20:55', cierre: '20:45', dias: [0, 1, 2, 3, 4, 5, 6] },
      { id: 'POOL', casa: 'Leidsa', nombre: 'Loto Pool', logo: IMG + 'logos/loto-pool.png',
        tipo: 'loto', cantidad: 5, rango: [1, 31], bola: 'rosada', acento: '#ec4899',
        hora: '20:55', cierre: '20:45', dias: [0, 1, 2, 3, 4, 5, 6] },
      { id: 'LOTOREAL', casa: 'Real', nombre: 'Loto Real', logo: IMG + 'logos/loto-real.png', logo_fondo: '#333884',
        tipo: 'loto', cantidad: 6, rango: [1, 38], bola: 'morada', acento: '#a855f7',
        hora: '12:55', cierre: '12:45', dias: [2, 5] }
    ]
  };
})();
