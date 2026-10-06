"""
Cliente HTTP del visor hacia la API central (guia: "Integracion del visor con la API sin Redis").

- Django es la unica frontera HTTP del navegador: JavaScript llama /games o /configuration
  y estas funciones consultan la API con requests.
- El visor ya no lee Redis. La cache, sus TTL y el respaldo en PostgreSQL viven dentro de la API.
- Las funciones devuelven el JSON de la API tal cual. Los errores HTTP y de red se propagan
  como excepciones de requests; views.py decide que responder al navegador.
"""

from urllib.parse import urljoin

import requests
from decouple import config


API_URL = config("API_URL").strip().rstrip("/") + "/"

# (conexion, lectura) en segundos, como recomienda la guia
TIMEOUT = (1.5, 4)

HTTP = requests.Session()


def _enviar(metodo, path, **kwargs):
    url = urljoin(API_URL, path.lstrip("/"))
    try:
        return HTTP.request(metodo, url, **kwargs)
    except requests.ConnectionError:
        # La API cierra las conexiones inactivas; si se reutilizo una ya cerrada
        # ("RemoteDisconnected"), se reintenta una vez con una conexion nueva.
        return HTTP.request(metodo, url, **kwargs)


def api_get(path, *, params=None, timeout=TIMEOUT):
    response = _enviar("GET", path, params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def api_post(path, *, json=None, timeout=TIMEOUT):
    response = _enviar("POST", path, json=json, timeout=timeout)
    response.raise_for_status()
    return response.json()


# ==========================================
# EMPAREJAMIENTO (5.1 y 5.2)
# ==========================================

def start_pairing():
    return api_post("api/core/display/pairing/start/", json={})


def get_pairing_status(*, device_token):
    return api_get("api/core/display/pairing/status/", params={"device_token": device_token})


# ==========================================
# CONFIGURACION Y HEARTBEAT (5.4 y 5.5)
# ==========================================

def get_display_config(*, device_token):
    return api_get("api/core/display/config/", params={"device_token": device_token})


def send_display_heartbeat(*, device_token, app_version):
    return api_post("api/core/display/heartbeat/", json={
        "device_token": device_token,
        "app_version": app_version,
    })


# ==========================================
# EVENTO, TABLA, RESULTADOS Y VIDEO (5.6 a 5.9)
# El grupo lo obtiene la API a partir del device_token: no se envia grupo_id.
# ==========================================

def get_current_event(*, device_token, game_id):
    return api_get("api/core/display/events/current/", params={
        "device_token": device_token,
        "game_id": game_id,
    })


def get_paytable_for_display(*, table_odds_id):
    return api_get(f"api/core/table-odds/{table_odds_id}/")


def get_display_results(*, device_token, game_id, limit=5):
    return api_get("api/core/display/results/latest/", params={
        "device_token": device_token,
        "game_id": game_id,
        "limit": limit,
    })


def get_current_video_fallback(*, device_token, game_id):
    return api_get("api/core/display/videos/current/fallback/", params={
        "device_token": device_token,
        "game_id": game_id,
    })


# ==========================================
# JACKPOTS, GANADORES Y BONOS (5.10 a 5.12)
# ==========================================

def get_display_jackpots(*, device_token, game_id):
    return api_get("api/jackpot/display/device-game/", params={
        "device_token": device_token,
        "game_id": game_id,
    })


def get_jackpot_winner_events(*, device_token, game_id):
    """Una sola llamada con los ganadores recientes de todos los jackpots del visor y juego."""
    return api_get("api/jackpot/display/device-game/winner-events/", params={
        "device_token": device_token,
        "game_id": game_id,
    })


def get_games_by_code(*, code):
    """Juegos activos con ese codigo (guia de ruleta: GET api/core/games/?status=active&code=RULETA)."""
    return api_get("api/core/games/", params={
        "status": "active",
        "code": code,
    })


def get_display_bonus_event(*, device_token, game_id, sorteo_id):
    """El lugar se deriva del device_token en la API: no se envia lugar_id."""
    return api_get("api/core/display/bonuses/event/", params={
        "device_token": device_token,
        "game_id": game_id,
        "sorteo_id": sorteo_id,
    })
