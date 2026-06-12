from django.shortcuts import render,redirect
import requests
from django.http import HttpResponse, JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from decouple import config
from urllib.parse import urlencode

# Configuraciones de entorno
API_URL = config('API_URL')
version = "v7.0.0" 

@csrf_exempt
def configuration(request):
    if request.method == "POST":

        datos = json.load(request)

        if datos['realizar']=='activacion':


	        response = requests.post(f"{API_URL}/display/pairing/start/",)

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


        if datos['realizar']=='status_activacion':

        	response = requests.get(f"{API_URL}/display/pairing/status/",params={'device_token':datos['device_token']})
        	data = response.json()
        	print(data)
        	return JsonResponse(data)



    return render(request, "configuration.html")










def login(request):

	if request.method == 'POST':

		datos = json.load(request)

		if request.method =='POST' and datos['realizar'] =='lg':

			response = requests.post(f'{API_URL}/Login_operador/',data={'username':datos['username'],'password':datos['password'],'url_api':API_URL})
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


	return render(request,"login.html")




@csrf_exempt
def carreras_virtual_p(request):

	if request.session.get('datos_token') !=None:
		token_api = request.session.get('datos_token')['token']
		headers = {'Authorization':f'Token {token_api}'} 
		
		if request.method == 'POST':

			datos = json.load(request)


			if request.method =='POST' and datos['realizar'] =='consulta_jackpots':
				lugar_jk = datos['id_jackpot']
				jackpot_actual = cache.get(f'jackpot_actual_{lugar_jk}')


				if jackpot_actual is None:
					response = requests.post(f'{API_URL}/Consulta_Jackpot_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(jackpot_actual,safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_grupo':
	
				response = requests.post(f'{API_URL}/Consulta_Grupo_r/',data=datos,headers=headers)
				return JsonResponse(response.json(),safe=False,content_type='application/json')

			

			elif request.method =='POST' and datos['realizar'] =='consulta_tabla':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				tabla_sort = cache.get(f'Last_tabla_{datos["juego"]}_{id_grupo}')


				if tabla_sort is None:

					response = requests.post(f'{API_URL}/Consulta_tabla/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(tabla_sort,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

				id_jack = datos['id_jackpot']

				win_jak_r = cache.get(f'ganador_jackpot{id_jack}')

				if win_jak_r is None:

					response = requests.post(f'{API_URL}/Ganadores_Jackpot/',data=datos,headers=headers)
					return JsonResponse(response.content,content_type='application/json')

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(win_jak_r,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_ult_carreras':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				ult_result = cache.get(f'Ultimos_resultados_{juego}_{id_grupo}')


				if ult_result is None:

					response = requests.post(f'{API_URL}/Ultimos_Resultados_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					print('find it in cache 2')
					return JsonResponse(ult_result,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_bonos':
				lugar_b = datos['id_lugar']
				juego = datos['juego']
				bonos_red = cache.get(f'bonos_{lugar_b}_{juego}')

				if bonos_red is None:

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(bonos_red,safe=False,content_type='application/json')


		return render(request, "pv_p.html",{'version1': version})

	else:
		return redirect('/')







@csrf_exempt
def carreras_virtual_p8(request):

	if request.session.get('datos_token') !=None:
		token_api = request.session.get('datos_token')['token']
		headers = {'Authorization':f'Token {token_api}'}
		
		if request.method == 'POST':

			datos = json.load(request)


			if request.method =='POST' and datos['realizar'] =='consulta_jackpots':
				lugar_jk = datos['id_jackpot']
				jackpot_actual = cache.get(f'jackpot_actual_{lugar_jk}')


				if jackpot_actual is None:
					response = requests.post(f'{API_URL}/Consulta_Jackpot_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(jackpot_actual,safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_grupo':
	
				response = requests.post(f'{API_URL}/Consulta_Grupo_r/',data=datos,headers=headers)
				return JsonResponse(response.json(),safe=False,content_type='application/json')

			

			elif request.method =='POST' and datos['realizar'] =='consulta_tabla':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				tabla_sort = cache.get(f'Last_tabla_{datos["juego"]}_{id_grupo}')


				if tabla_sort is None:

					response = requests.post(f'{API_URL}/Consulta_tabla/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(tabla_sort,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

				id_jack = datos['id_jackpot']

				win_jak_r = cache.get(f'ganador_jackpot{id_jack}')

				if win_jak_r is None:

					response = requests.post(f'{API_URL}/Ganadores_Jackpot/',data=datos,headers=headers)
					return JsonResponse(response.content,content_type='application/json')

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(win_jak_r,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_ult_carreras':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				ult_result = cache.get(f'Ultimos_resultados_{juego}_{id_grupo}')


				if ult_result is None:
					response = requests.post(f'{API_URL}/Ultimos_Resultados_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					print('find it in cache 2')
					return JsonResponse(ult_result,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_bonos':
				lugar_b = datos['id_lugar']
				juego = datos['juego']
				bonos_red = cache.get(f'bonos_{lugar_b}_{juego}')

				if bonos_red is None:

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(bonos_red,safe=False,content_type='application/json')


		return render(request, f"pv_p8.html",{'version1': version})

	else:
		return redirect('/')
	


@csrf_exempt
def carreras_virtual_c(request):

	if request.session.get('datos_token') !=None:
		token_api = request.session.get('datos_token')['token']
		headers = {'Authorization':f'Token {token_api}'}
 
 
		if request.method == 'POST':

			datos = json.load(request)


			if request.method =='POST' and datos['realizar'] =='consulta_jackpots':
				lugar_jk = datos['id_jackpot']
				jackpot_actual = cache.get(f'jackpot_actual_{lugar_jk}')


				if jackpot_actual is None:
					response = requests.post(f'{API_URL}/Consulta_Jackpot_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(jackpot_actual,safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_grupo':
	
				response = requests.post(f'{API_URL}/Consulta_Grupo_r/',data=datos,headers=headers)
				return JsonResponse(response.json(),safe=False,content_type='application/json')

			

			elif request.method =='POST' and datos['realizar'] =='consulta_tabla':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				tabla_sort = cache.get(f'Last_tabla_{datos["juego"]}_{id_grupo}')


				if tabla_sort is None:

					response = requests.post(f'{API_URL}/Consulta_tabla/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(tabla_sort,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

				id_jack = datos['id_jackpot']

				win_jak_r = cache.get(f'ganador_jackpot{id_jack}')

				if win_jak_r is None:

					response = requests.post(f'{API_URL}/Ganadores_Jackpot/',data=datos,headers=headers)
					return JsonResponse(response.content,content_type='application/json')

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(win_jak_r,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_ult_carreras':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				ult_result = cache.get(f'Ultimos_resultados_{juego}_{id_grupo}')


				if ult_result is None:

					response = requests.post(f'{API_URL}/Ultimos_Resultados_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					print('find it in cache 2')
					return JsonResponse(ult_result,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_bonos':
				lugar_b = datos['id_lugar']
				juego = datos['juego']
				bonos_red = cache.get(f'bonos_{lugar_b}_{juego}')

				if bonos_red is None:

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(bonos_red,safe=False,content_type='application/json')


		#return render(request,"pv_c.html",{'version1': version})
		return render(request,"pv_c.html",{'version1': version})

	else:
		return redirect('/')




def roulette(request):

	if request.session.get('datos_token') !=None:
		token_api = request.session.get('datos_token')['token']
		headers = {'Authorization':f'Token {token_api}'}
 
 
		if request.method == 'POST':

			datos = json.load(request)


			if request.method =='POST' and datos['realizar'] =='consulta_jackpots':
				lugar_jk = datos['id_jackpot']
				jackpot_actual = cache.get(f'jackpot_actual_{lugar_jk}')


				if jackpot_actual is None:
					response = requests.post(f'{API_URL}/Consulta_Jackpot_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(jackpot_actual,safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_grupo':
	
				response = requests.post(f'{API_URL}/Consulta_Grupo_r/',data=datos,headers=headers)
				return JsonResponse(response.json(),safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_tabla':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

			


				


			elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

				id_jack = datos['id_jackpot']

				win_jak_r = cache.get(f'ganador_jackpot{id_jack}')

				if win_jak_r is None:

					response = requests.post(f'{API_URL}/Ganadores_Jackpot/',data=datos,headers=headers)
					return JsonResponse(response.content,content_type='application/json')

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(win_jak_r,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_ult_carreras':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				ult_result = cache.get(f'Ultimos_resultados_{juego}_{id_grupo}')

				print(ult_result)
				if ult_result is None:

					response = requests.post(f'{API_URL}/Ultimos_Resultados_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					print('find it in cache 2')
					return JsonResponse(ult_result,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_bonos':
				lugar_b = datos['id_lugar']
				juego = datos['juego']
				bonos_red = cache.get(f'bonos_{lugar_b}_{juego}')

				if bonos_red is None:

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(bonos_red,safe=False,content_type='application/json')


		return render(request,"pv_roulette.html",{'version1': version})

	else:
		return redirect('/')




def gallos(request):

	if request.session.get('datos_token') !=None:
		token_api = request.session.get('datos_token')['token']
		headers = {'Authorization':f'Token {token_api}'}
 
 
		if request.method == 'POST':

			datos = json.load(request)


			if request.method =='POST' and datos['realizar'] =='consulta_jackpots':
				lugar_jk = datos['id_jackpot']
				jackpot_actual = cache.get(f'jackpot_actual_{lugar_jk}')


				if jackpot_actual is None:
					response = requests.post(f'{API_URL}/Consulta_Jackpot_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(jackpot_actual,safe=False,content_type='application/json')



			elif request.method =='POST' and datos['realizar'] =='consulta_grupo':
	
				response = requests.post(f'{API_URL}/Consulta_Grupo_r/',data=datos,headers=headers)
				return JsonResponse(response.json(),safe=False,content_type='application/json')

			

			elif request.method =='POST' and datos['realizar'] =='consulta_tabla':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				tabla_sort = cache.get(f'Last_tabla_{datos["juego"]}_{id_grupo}')


				if tabla_sort is None:

					response = requests.post(f'{API_URL}/Consulta_tabla/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(tabla_sort,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_gandores_jack':

				id_jack = datos['id_jackpot']

				win_jak_r = cache.get(f'ganador_jackpot{id_jack}')

				if win_jak_r is None:

					response = requests.post(f'{API_URL}/Ganadores_Jackpot/',data=datos,headers=headers)
					return JsonResponse(response.content,content_type='application/json')

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(win_jak_r,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_resultados':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				rsult = cache.get(f'resultados_{juego}_{id_grupo}')

				if rsult is None:

					response = requests.post(f'{API_URL}/Consulta_Resultados/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					return JsonResponse(rsult,safe=False,content_type='application/json')

				


			elif request.method =='POST' and datos['realizar'] =='consulta_ult_carreras':
				juego = datos['juego']
				id_grupo = datos['id_grupo']

				ult_result = cache.get(f'Ultimos_resultados_{juego}_{id_grupo}')


				if ult_result is None:

					response = requests.post(f'{API_URL}/Ultimos_Resultados_Carrera/',data=datos,headers=headers)
					return JsonResponse(response.json(),safe=False,content_type='application/json')

				else:
					
					return JsonResponse(ult_result,safe=False,content_type='application/json')


			elif request.method =='POST' and datos['realizar'] =='consulta_bonos':
				lugar_b = datos['id_lugar']
				juego = datos['juego']
				bonos_red = cache.get(f'bonos_{lugar_b}_{juego}')

				if bonos_red is None:

					return JsonResponse({'mensaje':'OK','data':[]},safe=False,content_type='application/json')

				else:
					return JsonResponse(bonos_red,safe=False,content_type='application/json')


		#return render(request,"pv_c.html",{'version1': version})
		return render(request,"pv_g.html",{'version1': version})

	else:
		return redirect('/')




