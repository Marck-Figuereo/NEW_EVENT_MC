#!/usr/bin/env python3
"""
BINGO - generador y validador del JSON de prueba del visor.

    python herramientas/bingo_generar_json.py            -> genera y valida
    python herramientas/bingo_generar_json.py --validar  -> solo valida el JSON existente

Salida: carrera_virtual_app/static/bingo/data/sorteos_prueba_bingo.json

Por que un script y no el JSON escrito a mano
--------------------------------------------
En produccion TODO llega de la API (bolas, cartones, ganadores). Este script solo
fabrica datos de PRUEBA con la misma forma, y que cuadren entre si: cada ganador
completa su figura exactamente en la bola que dice el JSON. Se simulan los cartones
vendidos, se sacan bolas al azar del 1 al 90 hasta que algun carton hace BINGO
(maximo 60) y se calculan los ganadores como lo haria el backend.

Reglas (las mismas que valida el visor)
---------------------------------------
- Bolas distintas del 1 al 90. El sorteo dura hasta el BINGO (maximo 60 bolas):
  siempre hay BINGO y su bola es la ultima del sorteo.
- Carton: 15 numeros distintos en 3 filas de 5 (cada fila ordenada).
- CUATRO       4 numeros de una misma fila.
- LINEA        una fila completa (5).
- DOBLE_LINEA  dos filas completas.
- BINGO        carton lleno (15).
- JACKPOT      exclusivo del bingo: lo gana el carton que hace BINGO antes de la
               bola 60 (bola <= limite_bola_jackpot). Si el BINGO sale en la bola 60
               el jackpot se acumula al siguiente sorteo.
- Cada premio se entrega una sola vez: en la PRIMERA bola en que algun carton
  completa la figura. Si varios la completan en esa misma bola, el premio se
  reparte en partes iguales.
"""

import json
import random
import string
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'carrera_virtual_app' / 'static' / 'bingo' / 'data' / 'sorteos_prueba_bingo.json'

TOTAL_BOLAS = 60
NUM_MIN, NUM_MAX = 1, 90
LIMITE_BOLA_JACKPOT = 59
ORDEN_TIPOS = ['CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO', 'JACKPOT']
CLAVE_PREMIO = {'CUATRO': 'cuatro', 'LINEA': 'linea', 'DOBLE_LINEA': 'doble_linea', 'BINGO': 'bingo'}

LUGARES = [
    'CS 03 SANTIAGO', 'CS 11 NEXT', 'CS 23 SIMON BOLIVAR', 'CS 974 LOS ALCARRIZOS',
    'CS 03 LA VEGA', 'CS 98 NEXT', 'CS 917 PANTOJA', 'CS 45 VILLA MELLA',
    'CS 210 HERRERA', 'CS 77 SAN CRISTOBAL', 'CS 15 LOS MINA', 'CS 302 BANI',
]

INF = 10 ** 6


# ----------------------------------------------------------------------------
# Logica del juego (una sola fuente para generar y para validar)
# ----------------------------------------------------------------------------

def filas(numeros):
    return [numeros[0:5], numeros[5:10], numeros[10:15]]


def bola_de_figuras(numeros, posicion):
    """Bola (1..60) en que el carton completa cada figura, o INF si no la completa.
    posicion: {numero: indice 1..60 en que salio}."""
    filas_pos = [sorted(posicion.get(n, INF) for n in f) for f in filas(numeros)]
    cuatro = min(f[3] for f in filas_pos)              # 4o numero en salir de su fila
    linea_por_fila = sorted(f[4] for f in filas_pos)    # fila completa cuando sale su 5o
    return {
        'CUATRO': cuatro,
        'LINEA': linea_por_fila[0],
        'DOBLE_LINEA': linea_por_fila[1],
        'BINGO': linea_por_fila[2],
    }


def nuevo_carton(rng):
    nums = rng.sample(range(NUM_MIN, NUM_MAX + 1), 15)
    return sorted(nums[0:5]) + sorted(nums[5:10]) + sorted(nums[10:15])


def nuevo_ticket(rng, usados):
    while True:
        t = ''.join(rng.choice(string.ascii_uppercase + string.digits) for _ in range(9))
        if t not in usados:
            usados.add(t)
            return t


def calcular_ganadores(cartones, bolas, premios):
    posicion = {n: i + 1 for i, n in enumerate(bolas)}
    figuras = [bola_de_figuras(c['numeros'], posicion) for c in cartones]

    ganadores = []
    for tipo in ['CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO']:
        primera = min(f[tipo] for f in figuras)
        if primera >= INF:
            continue
        idx = [i for i, f in enumerate(figuras) if f[tipo] == primera]
        monto = round(premios[CLAVE_PREMIO[tipo]] / len(idx), 2)
        for i in idx:
            ganadores.append(dict(tipo=tipo, bola=primera, numero_bola=bolas[primera - 1],
                                  monto=monto, **cartones[i]))

    bingos = [g for g in ganadores if g['tipo'] == 'BINGO']
    if bingos and bingos[0]['bola'] <= LIMITE_BOLA_JACKPOT:
        for g in bingos:
            # El monto del jackpot no se fija aqui: es el acumulado del momento
            # (lo lleva el visor; en produccion lo manda la API).
            ganadores.append(dict(g, tipo='JACKPOT', monto=None, reparto=len(bingos)))

    ganadores.sort(key=lambda g: (g['bola'], ORDEN_TIPOS.index(g['tipo'])))
    return ganadores, figuras


def elegir_seguimiento(cartones, bolas, ganadores, maximo=40):
    """Cartones que el visor sigue en el tablero 'mejores cartones'.
    Ganadores + los que menos numeros les faltan en varios momentos del sorteo."""
    elegidos = {g['ticket'] for g in ganadores}
    for corte in (10, 20, 30, 40, 50, 60):
        salidas = set(bolas[:corte])
        orden = sorted(cartones, key=lambda c: sum(n not in salidas for n in c['numeros']))
        for c in orden[:10]:
            elegidos.add(c['ticket'])
    ganadores_t = {g['ticket'] for g in ganadores}
    lista = [c for c in cartones if c['ticket'] in ganadores_t] + \
            [c for c in cartones if c['ticket'] in elegidos and c['ticket'] not in ganadores_t]
    return lista[:max(maximo, len(ganadores_t))]


# ----------------------------------------------------------------------------
# Generacion
# ----------------------------------------------------------------------------

def generar_sorteo(semilla, vendidos, premios):
    rng = random.Random(semilla)
    usados = set()
    cartones = [{'lugar': rng.choice(LUGARES), 'ticket': nuevo_ticket(rng, usados),
                 'numeros': nuevo_carton(rng)} for _ in range(vendidos)]
    bolas = rng.sample(range(NUM_MIN, NUM_MAX + 1), TOTAL_BOLAS)
    ganadores, _ = calcular_ganadores(cartones, bolas, premios)
    bingo = [g for g in ganadores if g['tipo'] == 'BINGO']
    if not bingo:
        return cartones, None, None        # siempre hay BINGO: esta semilla no sirve
    return cartones, bolas[:bingo[0]['bola']], ganadores


def cumple(escenario, ganadores):
    tipos = {}
    for g in ganadores:
        tipos.setdefault(g['tipo'], []).append(g)
    bingo = tipos.get('BINGO')
    if escenario == 'acumula_bingo_en_60':
        return bool(bingo) and bingo[0]['bola'] == TOTAL_BOLAS
    if escenario == 'jackpot':
        return bool(bingo) and bingo[0]['bola'] <= 56 and len(bingo) == 1 and len(tipos.get('LINEA', [])) == 1
    if escenario == 'jackpot_con_empate':
        return bool(bingo) and bingo[0]['bola'] <= LIMITE_BOLA_JACKPOT and len(bingo) == 1 and \
            (len(tipos.get('LINEA', [])) >= 2 or len(tipos.get('CUATRO', [])) >= 2)
    raise ValueError(escenario)


def generar():
    pool_def = [
        # codigo, escenario, cartones vendidos, premios
        ('P1', 'jackpot',             1200, dict(cuatro=5000, linea=10000, doble_linea=20000, bingo=40000)),
        ('P2', 'jackpot_con_empate',  2400, dict(cuatro=10000, linea=25000, doble_linea=50000, bingo=100000)),
        ('P3', 'acumula_bingo_en_60', 1800, dict(cuatro=20000, linea=40000, doble_linea=80000, bingo=160000)),
        ('P4', 'acumula_bingo_en_60', 1500, dict(cuatro=10000, linea=25000, doble_linea=50000, bingo=100000)),
        ('P5', 'jackpot',             2600, dict(cuatro=20000, linea=40000, doble_linea=80000, bingo=160000)),
    ]

    pool = []
    for k, (codigo, escenario, vendidos, premios) in enumerate(pool_def):
        semilla = 1000 * (k + 1)
        while True:
            cartones, bolas, ganadores = generar_sorteo(semilla, vendidos, premios)
            if bolas and cumple(escenario, ganadores):
                break
            semilla += 1
        seguimiento = elegir_seguimiento(cartones, bolas, ganadores)
        pool.append({
            'codigo': codigo,
            'escenario': escenario,
            'semilla': semilla,
            'cartones_vendidos': vendidos,
            'premios': premios,
            'bolas': bolas,
            'ganadores': ganadores,
            'seguimiento': seguimiento,
        })
        resumen = ', '.join(f"{g['tipo']}@{g['bola']}" for g in ganadores)
        print(f'{codigo} {escenario:<22} semilla {semilla:<6} {len(bolas):>2} bolas  {resumen}')

    datos = {
        '_descripcion': 'Datos de prueba del BINGO para el visor. Generado por herramientas/bingo_generar_json.py; '
                        'no editar a mano los sorteos (ganadores y bolas deben cuadrar).',
        'version': 2,
        'config': {
            'game_code': 'BINGO',
            'total_bolas': TOTAL_BOLAS,
            'numero_min': NUM_MIN,
            'numero_max': NUM_MAX,
            'limite_bola_jackpot': LIMITE_BOLA_JACKPOT,
            'intervalo_min': 10,
            'sorteo_inicial': 154,
            'figuras': {
                'CUATRO': '4 numeros de una misma fila',
                'LINEA': 'una fila completa',
                'DOBLE_LINEA': 'dos filas completas',
                'BINGO': 'carton lleno (15)',
                'JACKPOT': 'BINGO antes de la bola 60; si el BINGO sale en la 60, se acumula',
            },
        },
        'jackpot': {
            'monto_actual': 35600.00,
            'monto_base': 10000.00,
            'aporte_por_sorteo': 1250.00,
            'ultimo': {'monto': 25364.00, 'fecha': '2026-10-15', 'lugar': 'CS 917 PANTOJA', 'ticket': 'K2H39E3A0'},
        },
        'historial': [
            {'sorteo': 153, 'fecha': '2026-10-19', 'hora': '14:30', 'premios': dict(cuatro=5000, linea=10000, doble_linea=20000, bingo=40000), 'jackpot': False},
            {'sorteo': 152, 'fecha': '2026-10-19', 'hora': '14:20', 'premios': dict(cuatro=50000, linea=100000, doble_linea=200000, bingo=400000), 'jackpot': False},
            {'sorteo': 151, 'fecha': '2026-10-19', 'hora': '14:10', 'premios': dict(cuatro=50000, linea=100000, doble_linea=200000, bingo=400000), 'jackpot': False},
            {'sorteo': 150, 'fecha': '2026-10-19', 'hora': '14:00', 'premios': dict(cuatro=10000, linea=25000, doble_linea=50000, bingo=100000), 'jackpot': False},
            {'sorteo': 149, 'fecha': '2026-10-19', 'hora': '13:50', 'premios': dict(cuatro=50000, linea=100000, doble_linea=200000, bingo=400000), 'jackpot': False},
        ],
        # Los crea el panel de administracion. El visor muestra los 3 proximos (los pasados se ignoran).
        'sorteos_especiales': [
            {'id': 1, 'titulo': 'BINGO DÍA DE LAS MADRES', 'fecha': '2026-05-31', 'hora': '13:00',
             'premios': dict(cuatro=600000, linea=150000, doble_linea=300000, bingo=1200000)},
            {'id': 2, 'titulo': 'BINGO VIERNES SOCIAL', 'fecha': '2026-10-30', 'hora': '18:00',
             'premios': dict(cuatro=400000, linea=100000, doble_linea=200000, bingo=800000)},
            {'id': 3, 'titulo': 'BINGO DE ACCIÓN DE GRACIAS', 'fecha': '2026-11-26', 'hora': '19:00',
             'premios': dict(cuatro=500000, linea=125000, doble_linea=250000, bingo=1000000)},
            {'id': 4, 'titulo': 'BINGO NAVIDEÑO', 'fecha': '2026-12-24', 'hora': '20:00',
             'premios': dict(cuatro=800000, linea=200000, doble_linea=400000, bingo=1600000)},
        ],
        'sorteos': pool,
    }

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
    print('Escrito', SALIDA, f'({SALIDA.stat().st_size // 1024} KB)')


# ----------------------------------------------------------------------------
# Validacion
# ----------------------------------------------------------------------------

def validar(ruta=SALIDA):
    datos = json.loads(Path(ruta).read_text(encoding='utf-8'))
    cfg = datos['config']
    problemas = []

    def mal(msg):
        problemas.append(msg)

    for s in datos['sorteos']:
        c = s['codigo']
        bolas = s['bolas']
        if not (1 <= len(bolas) <= cfg['total_bolas']):
            mal(f'{c}: {len(bolas)} bolas, deben ser de 1 a {cfg["total_bolas"]}')
        if len(set(bolas)) != len(bolas):
            mal(f'{c}: bolas repetidas')
        if any(not (cfg['numero_min'] <= b <= cfg['numero_max']) for b in bolas):
            mal(f'{c}: bola fuera de rango')

        posicion = {n: i + 1 for i, n in enumerate(bolas)}
        primera = {}
        for g in s['ganadores']:
            t = g['tipo']
            nums = g['numeros']
            if len(nums) != 15 or len(set(nums)) != 15:
                mal(f'{c} {g["ticket"]}: el carton debe tener 15 numeros distintos')
                continue
            if not (1 <= g['bola'] <= len(bolas)) or bolas[g['bola'] - 1] != g['numero_bola']:
                mal(f'{c} {g["ticket"]}: numero_bola no coincide con la bola {g["bola"]}')
            figura = 'BINGO' if t == 'JACKPOT' else t
            en = bola_de_figuras(nums, posicion)[figura]
            if en != g['bola']:
                mal(f'{c} {g["ticket"]} {t}: completa la figura en la bola {en}, el JSON dice {g["bola"]}')
            primera.setdefault(t, g['bola'])
            if primera[t] != g['bola']:
                mal(f'{c} {t}: ganadores en bolas distintas (cada premio sale una sola vez)')

        bingo = primera.get('BINGO')
        jack = primera.get('JACKPOT')
        for t in ('CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO'):
            if t not in primera:
                mal(f'{c}: falta el ganador de {t} (siempre salen los 4 premios)')
        if bingo is not None and bingo != len(bolas):
            mal(f'{c}: el sorteo debe terminar en la bola del BINGO ({bingo}), trae {len(bolas)} bolas')
        if bingo is not None and bingo <= cfg['limite_bola_jackpot'] and jack is None:
            mal(f'{c}: BINGO en la bola {bingo} y falta el JACKPOT')
        if jack is not None and (bingo is None or jack != bingo or jack > cfg['limite_bola_jackpot']):
            mal(f'{c}: JACKPOT invalido (bola {jack}, limite {cfg["limite_bola_jackpot"]})')

        orden = [(g['bola'], ORDEN_TIPOS.index(g['tipo'])) for g in s['ganadores']]
        if orden != sorted(orden):
            mal(f'{c}: ganadores fuera de orden')

        tickets = {x['ticket'] for x in s['seguimiento']}
        for g in s['ganadores']:
            if g['ticket'] not in tickets:
                mal(f'{c}: el ganador {g["ticket"]} no esta en seguimiento')

    if problemas:
        print('JSON con problemas:')
        for p in problemas:
            print('  -', p)
        return False

    print(f'JSON valido: {len(datos["sorteos"])} sorteos, todo cuadra.')
    return True


if __name__ == '__main__':
    if '--validar' not in sys.argv:
        generar()
    sys.exit(0 if validar() else 1)
