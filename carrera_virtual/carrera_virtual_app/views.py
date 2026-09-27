from django.shortcuts import render,redirect
import requests
from django.http import HttpResponse, JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from decouple import config
from urllib.parse import urlencode
from carrera_virtual_app.helpers.redis_helper import *
import uuid


# Configuraciones de entorno
API_URL = config('API_URL')
version = "v7.1.0" 








@csrf_exempt
def configuration(request):
    if request.method == "POST":

        datos = json.load(request)

        if datos["realizar"] == "activacion":
            response = requests.post(f"{API_URL}api/core/display/pairing/start/")

            data = response.json()

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

            response = requests.get(f"{API_URL}api/core/display/pairing/status/",params={"device_token": datos["device_token"]})
            data = response.json()
            print(data)
            return JsonResponse(data)

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


		if request.method =='POST' and datos['realizar'] =='consulta_jackpots':

			# Guia: siempre consultar jackpots por device_token y game_id (no por jackpot_id)
			jackpots = get_display_jackpots(
			    device_token=datos['device_token'],
			    game_id=datos['game_id'],
			)
			
			return JsonResponse(jackpots,safe=False,content_type='application/json')

		

		elif request.method =='POST' and datos['realizar'] =='consulta_tabla':


			paytable = get_paytable_for_display(table_odds_id = datos['table_odds_id'])
			print(paytable,"aefrasfdsd")
			return JsonResponse(paytable,safe=False,content_type='application/json')



		elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

			# Guia: se consulta el evento ganador de CADA jackpot aplicable al visor.
			# Los jackpot_id salen de la lista de jackpots del dispositivo y juego,
			# no de un id guardado en el navegador.
			jackpots = get_display_jackpots(
			    device_token=datos['device_token'],
			    game_id=datos['game_id'],
			)

			eventos = []

			for jackpot in (jackpots or {}).get('jackpots') or []:

				ganador = get_display_jackpot_winner_event(
				    jackpot_id=jackpot['jackpot_id'],
				)

				if ganador.get('has_winner_event') and ganador.get('event'):
					eventos.append({
						'jackpot_id': jackpot['jackpot_id'],
						'name':       jackpot.get('name'),
						'scope_type': jackpot.get('scope_type'),
						'level_name': jackpot.get('level_name'),
						'event':      ganador['event'],
					})

			return JsonResponse({'count': len(eventos), 'events': eventos},safe=False,content_type='application/json')


		elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
			game_id = datos['game_id']
			grupo_id = datos['grupo_id']

			video_payload = get_current_display_video(
			    grupo_id=grupo_id,
			    device_token=datos['device_token'],
			    game_id=game_id,
			)
			return JsonResponse(video_payload,safe=False,content_type='application/json')
			


		elif request.method =='POST' and datos['realizar'] =='history_results':
			game_id = datos['game_id']
			grupo_id = datos['grupo_id']

			last_5_result = get_display_results(
			    grupo_id=grupo_id,
			    device_token=datos['device_token'],
			    game_id=game_id,
			)

			print('asfdasdasdss', last_5_result)
			
			return JsonResponse(last_5_result,safe=False,content_type='application/json')


		elif request.method =='POST' and datos['realizar'] =='display_config':
			device_token = datos['device_token']
			
			display_config = get_display_config(
			    device_token=device_token,
			)
			
			return JsonResponse(display_config,safe=False,content_type='application/json')



			


		elif request.method =='POST' and datos['realizar'] =='consulta_bonos':

			# Guia: el bono se consulta con el sorteo exacto que acaba de finalizar
			# (lugar + juego + sorteo). Funciona igual para todos los juegos.
			device_token = datos.get('device_token')
			game_id      = datos.get('game_id')
			sorteo_id    = datos.get('sorteo_id')

			sin_bono = {'has_bonus_event': False, 'sorteo_id': sorteo_id, 'count': 0, 'winners': []}

			# El sorteo_id forma parte de la clave Redis: solo se acepta un UUID valido
			try:
				sorteo_id = str(uuid.UUID(str(sorteo_id)))
			except (ValueError, TypeError):
				return JsonResponse(sin_bono,safe=False,content_type='application/json')

			if not device_token or not game_id:
				return JsonResponse(sin_bono,safe=False,content_type='application/json')

			# El lugar se toma de la configuracion del visor, no del navegador
			display_config = get_display_config(device_token=device_token) or {}
			lugar_id = (display_config.get('lugar') or {}).get('id')

			if not lugar_id:
				return JsonResponse(sin_bono,safe=False,content_type='application/json')

			bono = get_display_bonus_event(
			    device_token=device_token,
			    lugar_id=lugar_id,
			    game_id=game_id,
			    sorteo_id=sorteo_id,
			)

			return JsonResponse(bono,safe=False,content_type='application/json')


	return render(request, "pv_p.html",{'version1': version})


@csrf_exempt
def DOGS_6(request):

	return render(request, "pv_p.html",{'version1': version})



@csrf_exempt
def DOGS_8(request):

	return render(request, f"pv_p8.html",{'version1': version})

	


@csrf_exempt
def HORSES_7(request):

	return render(request,"pv_c.html",{'version1': version})



@csrf_exempt
def ROULETTE(request): return render(request,"pv_roulette.html",{'version1': version})
 




def ROOSTERS(request):


	#return render(request,"pv_c.html",{'version1': version})
	return render(request,"pv_g.html",{'version1': version})





