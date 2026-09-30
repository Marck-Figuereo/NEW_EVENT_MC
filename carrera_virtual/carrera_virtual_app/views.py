from django.shortcuts import render,redirect
import requests
from django.http import HttpResponse, JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt
from decouple import config
from urllib.parse import urlencode
import uuid
import os

# Guia "Integracion del visor con la API sin Redis": todas las llamadas a la API
# viven en el cliente HTTP. El visor ya no lee Redis.
from carrera_virtual_app.helpers.display_api_client import (
    API_URL,
    start_pairing,
    get_pairing_status,
    get_display_config,
    send_display_heartbeat,
    get_current_event,
    get_paytable_for_display,
    get_display_results,
    get_current_video_fallback,
    get_display_jackpots,
    get_jackpot_winner_events,
    get_display_bonus_event,
)


# Configuraciones de entorno
version = "v7.1.0"

# Unica conexion directa del navegador (tiempo real). Se inyecta en las plantillas.
_WS_POR_DEFECTO = API_URL.replace('https://', 'wss://', 1).replace('http://', 'ws://', 1)
WEBSOCKET_URL = config('WEBSOCKET_URL', default=_WS_POR_DEFECTO).strip().rstrip('/')


# Version de los JS y CSS del visor: cambia sola cada vez que se modifica un archivo,
# asi el navegador nunca mezcla un archivo nuevo con otro viejo guardado en cache.
_STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
_ARCHIVOS_VISOR = ['js/cone_db_p.js', 'js/funcionamiento_p.js', 'css/style_p.css', 'css/style_p8.css',
                   'css/style_c.css', 'css/style_g.css', 'css/overlay_video.css']

def _version_archivos():
    try:
        return str(int(max(os.path.getmtime(os.path.join(_STATIC, a)) for a in _ARCHIVOS_VISOR if os.path.exists(os.path.join(_STATIC, a)))))
    except ValueError:
        return version


def _contexto_visor():
    return {'version1': version, 'vjs': _version_archivos(), 'ws_url': WEBSOCKET_URL}




# ==========================================
# RESPUESTAS AL NAVEGADOR (guia, seccion 6)
#   200 con listas vacias -> estado valido sin datos
#   400                   -> parametros ausentes o invalidos
#   404                   -> visor inactivo o token desconocido
#   429                   -> limite temporal (se respeta Retry-After)
#   500 / timeout         -> falla temporal: el visor conserva la ultima pantalla valida
# ==========================================

def _error(codigo, detalle, status, **extra):
    return JsonResponse(dict({'error': codigo, 'detail': detalle}, **extra), status=status)


def _error_http(error, nombre):
    """Traduce un error HTTP de la API y deja en la consola de Django lo que respondio."""
    respuesta = error.response
    status    = respuesta.status_code if respuesta is not None else 502
    url       = respuesta.url if respuesta is not None else ''
    cuerpo    = (respuesta.text or '')[:300].replace('\n', ' ') if respuesta is not None else ''

    print(f"API {status} en {nombre}: {url} -> {cuerpo}")

    # Lo que dijo la API viaja al navegador para poder diagnosticar desde la consola
    extra = {'api_status': status, 'api_url': url.split('?')[0], 'api_respuesta': cuerpo}

    if status == 400:
        return _error('parametros_invalidos', 'La API rechazo los parametros.', 400, **extra)

    # 404 con la pagina HTML de "Not Found": la ruta no existe en esta version de la API.
    # No significa que el visor este revocado, asi que no se responde 404.
    tipo = (respuesta.headers.get('Content-Type', '') if respuesta is not None else '').lower()
    if status == 404 and 'text/html' in tipo:
        return _error('endpoint_no_disponible', 'La API no tiene este endpoint desplegado.', 501, **extra)

    if status == 404:
        return _error('visor_no_autorizado', 'Visor inactivo, token desconocido o recurso inexistente.', 404, **extra)

    if status == 429:
        resp = _error('limite_temporal', 'Demasiadas solicitudes.', 429, **extra)
        if respuesta is not None and respuesta.headers.get('Retry-After'):
            resp['Retry-After'] = respuesta.headers['Retry-After']
        return resp

    return _error('api_no_disponible', 'Falla temporal de la API.', 503, **extra)


def _consultar(funcion, **parametros):
    try:
        return JsonResponse(funcion(**parametros), safe=False)

    except requests.HTTPError as error:
        return _error_http(error, funcion.__name__)

    except (requests.RequestException, ValueError) as error:
        print(f"API no disponible en {funcion.__name__}: {error}")
        return _error('api_no_disponible', 'Falla temporal de la API.', 503)




# ==========================================
# CODIGO DEL VIDEO (gallos)
# El visor recibe el codigo en un campo propio: video_code.
#   settlement.selected_video = "videos/ROOSTERS/146249065.mp4"  ->  video_code = "146249065"
# Si la API ya envia video_code, se respeta tal cual.
# ==========================================

def _codigo_video(resultado):
    if not isinstance(resultado, dict):
        return None

    if resultado.get('video_code'):
        return str(resultado['video_code'])

    video = (resultado.get('settlement') or {}).get('selected_video') or resultado.get('selected_video') or ''
    nombre = str(video).split('?')[0].rsplit('/', 1)[-1].rsplit('.', 1)[0]

    return nombre or None




@csrf_exempt
def configuration(request):
    if request.method == "POST":

        datos = json.load(request)

        if datos["realizar"] == "activacion":

            try:
                data = start_pairing()
            except (requests.RequestException, ValueError) as error:
                print(f"No se pudo iniciar el emparejamiento: {error}")
                return _error('api_no_disponible', 'Falla temporal de la API.', 503)

            activation_url = (
                "http://localhost:5173/juegos-virtuales/device/activacion?"
                + urlencode({
                    "pairing_code": data["pairing_code"]
                })
            )

            return JsonResponse({
                "device_token": data["device_token"],
                "pairing_code": data["pairing_code"],
                "qr_url": activation_url
            })

        if datos["realizar"] == "status_activacion":

            device_token = str(datos.get("device_token") or "").strip()
            if not device_token:
                return _error('device_token_requerido', 'device_token es requerido.', 400)

            return _consultar(get_pairing_status, device_token=device_token)

    return render(request, "configuration.html")






"""def login(request):

	if request.method == 'POST':

		datos = json.load(request)

		if request.method =='POST' and datos['realizar'] =='lg':

			response = requests.post(f'{API_URL}api/core/Login_operador/',data={'username':datos['username'],'password':datos['password'],'url_api':API_URL})
			datos_log = response.json()

			if (datos_log['respuesta_api']!='operador deshabilitado' and datos_log['respuesta_api']!='usuario no encotrado' and datos_log['respuesta_api']!='constraseña incorrecta'):
				request.session['todos_los_datos'] = datos_log['respuesta_api']
				request.session['datos_token'] = datos_log['respuesta_api'][3]

				del datos_log['respuesta_api'][3]

				eso = request.GET.get('next', '')
				datos_log['url_juego'] = eso

				print(datos_log, "url-ma")
				return HttpResponse(json.dumps(datos_log),content_type='application/json')

			else:
				return HttpResponse(response.content,content_type='application/json')


	return render(request,"login.html")"""




@csrf_exempt
def games(request):

    if request.method == 'POST':

        datos = json.load(request)
        realizar = datos.get('realizar')


        # La tabla de pagos no depende del visor: solo del table_odds_id del WebSocket.
        # Un 404 o una falla devuelven {} y la pantalla sigue su ciclo.
        if realizar == 'consulta_tabla':

            table_odds_id = datos.get('table_odds_id')

            if not table_odds_id:
                return JsonResponse({}, safe=False)

            try:
                return JsonResponse(get_paytable_for_display(table_odds_id=table_odds_id), safe=False)
            except (requests.RequestException, ValueError) as error:
                print(f"Tabla de pagos {table_odds_id} no disponible: {error}")
                return JsonResponse({}, safe=False)


        # El resto de acciones identifica al visor: device_token es obligatorio
        device_token = str(datos.get('device_token') or '').strip()

        if not device_token:
            return _error('device_token_requerido', 'device_token es requerido.', 400)

        game_id = datos.get('game_id')


        if realizar == 'display_config':

            return _consultar(get_display_config, device_token=device_token)


        elif realizar == 'display_heartbeat':

            # Guia 5.5: mantiene el visor visible en soporte y detecta cambios de configuracion
            try:
                heartbeat = send_display_heartbeat(device_token=device_token, app_version=version)
            except requests.HTTPError as error:
                return _error_http(error, 'send_display_heartbeat')
            except (requests.RequestException, ValueError):
                return _error('api_no_disponible', 'Falla temporal de la API.', 503)

            # Version conocida: la de la sesion o, tras reiniciar, la que envia el navegador
            previous = request.session.get('display_config_version', datos.get('config_version'))
            current  = heartbeat.get('config_version')

            response = {'heartbeat': heartbeat, 'config_changed': False}

            if previous not in (None, '') and str(previous) != str(current):
                try:
                    response['config'] = get_display_config(device_token=device_token)
                    response['config_changed'] = True
                except (requests.RequestException, ValueError) as error:
                    # Se reintenta en el siguiente heartbeat: no se guarda la version nueva
                    print(f"No se pudo recargar la configuracion: {error}")
                    return JsonResponse(response)

            request.session['display_config_version'] = current
            return JsonResponse(response)


        elif realizar == 'evento_actual':

            # Guia 5.6: estado inicial o respaldo del WebSocket (fase, tabla, multiplicativo)
            return _consultar(get_current_event, device_token=device_token, game_id=game_id)


        elif realizar == 'consulta_jackpots':

            # Guia 5.10: todos los jackpots aplicables al visor y juego
            return _consultar(get_display_jackpots, device_token=device_token, game_id=game_id)


        elif realizar == 'consulta_gandores_jack':

            # Guia 5.11: una sola llamada agregada con los ganadores recientes (30 min)
            return _consultar(get_jackpot_winner_events, device_token=device_token, game_id=game_id)


        elif realizar == 'history_results':

            # Guia 5.8: ultimos resultados. El grupo lo obtiene la API del device_token.
            # A cada resultado se le agrega video_code (codigo de las peleas en gallos).
            try:
                payload = get_display_results(device_token=device_token, game_id=game_id, limit=5)
            except requests.HTTPError as error:
                return _error_http(error, 'get_display_results')
            except (requests.RequestException, ValueError):
                return _error('api_no_disponible', 'Falla temporal de la API.', 503)

            for resultado in (payload or {}).get('results') or []:
                if isinstance(resultado, dict):
                    resultado['video_code'] = _codigo_video(resultado)

            return JsonResponse(payload, safe=False)


        elif realizar == 'consulta_resultados':

            # Resultado mas reciente (results[0]) con el video que se va a reproducir
            try:
                payload = get_display_results(device_token=device_token, game_id=game_id, limit=5)
            except requests.HTTPError as error:
                return _error_http(error, 'get_display_results')
            except (requests.RequestException, ValueError):
                return _error('api_no_disponible', 'Falla temporal de la API.', 503)

            results = (payload or {}).get('results') or []

            if not results:
                return JsonResponse({'has_video': False, 'selected_video': None, 'result': None, 'settlement': None})

            latest     = results[0]
            settlement = latest.get('settlement') or {}

            # Se devuelve el resultado COMPLETO tal como lo manda la API (ningun campo se descarta)
            # y se agregan los campos de uso directo del visor.
            respuesta = dict(latest)
            respuesta.update({
                'has_video':      bool(settlement.get('selected_video')),
                'selected_video': settlement.get('selected_video'),
                'video_code':     _codigo_video(latest),
                'resulted_at':    latest.get('resulted_at') or latest.get('settled_at'),
            })

            return JsonResponse(respuesta)


        elif realizar == 'video_actual':

            # Guia 5.9: solo al iniciar o al recuperar tras una reconexion
            return _consultar(get_current_video_fallback, device_token=device_token, game_id=game_id)


        elif realizar == 'consulta_bonos':

            # Guia 5.12: bono del sorteo exacto que acaba de finalizar.
            # El lugar lo deriva la API del device_token: ya no se envia lugar_id.
            sorteo_id = datos.get('sorteo_id')
            sin_bono  = {'has_bonus_event': False, 'sorteo_id': sorteo_id, 'count': 0, 'winners': []}

            try:
                sorteo_id = str(uuid.UUID(str(sorteo_id)))
            except (ValueError, TypeError):
                return JsonResponse(sin_bono)

            if not game_id:
                return JsonResponse(sin_bono)

            return _consultar(get_display_bonus_event, device_token=device_token, game_id=game_id, sorteo_id=sorteo_id)


        return _error('accion_desconocida', f'Accion no soportada: {realizar}', 400)


    return render(request, "pv_p.html", _contexto_visor())


@csrf_exempt
def DOGS_6(request):

    return render(request, "pv_p.html", _contexto_visor())



@csrf_exempt
def DOGS_8(request):

    return render(request, "pv_p8.html", _contexto_visor())




@csrf_exempt
def HORSES_7(request):

    return render(request, "pv_c.html", _contexto_visor())



@csrf_exempt
def ROULETTE(request): return render(request, "pv_roulette.html", _contexto_visor())




def ROOSTERS(request):

    return render(request, "pv_g.html", _contexto_visor())
