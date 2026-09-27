import requests
#from django.conf import settings
from django.core.cache import cache
from decouple import config


API_URL = config('API_URL')


def _latest_results_key(*, grupo_id, game_id=None):
    if game_id:
        return f"display:latest_results:{grupo_id}:{game_id}"

    return f"display:latest_results:{grupo_id}:all"


def get_display_results(
    *,
    grupo_id,
    device_token,
    game_id=None,
    limit=5,
):
    key = _latest_results_key(
        grupo_id=grupo_id,
        game_id=game_id,
    )

    payload = cache.get(key)

    if payload:
        return payload

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/core/display/results/latest/"
            ),
            params={
                "device_token": device_token,
                "game_id": game_id,
                "limit": limit,
            },
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

        cache.set(
            key,
            payload,
            None,
        )

        return payload

    except Exception:
        return None


def get_current_display_video(
    *,
    grupo_id,
    device_token,
    game_id=None,
):
    payload = get_display_results(
        grupo_id=grupo_id,
        device_token=device_token,
        game_id=game_id,
        limit=5,
    )

    if not payload:
        return None

    results = payload.get("results") or []

    if not results:
        return None

    latest = results[0]
    settlement = latest.get("settlement") or {}
    selected_video = settlement.get("selected_video")

    return {
        "has_video": bool(selected_video),
        "selected_video": selected_video,
        "result": latest.get("result"),
        "settlement": settlement,
        "event_number": latest.get("event_number"),
        "sorteo_id": latest.get("sorteo_id"),

        "race_multiplier": latest.get(
            "race_multiplier"
        ),
        "multiplier_label": latest.get(
            "multiplier_label"
        ),

        "scheduled_at": latest.get("scheduled_at"),
        "settled_at": (
            latest.get("settled_at")
            or latest.get("resulted_at")
        ),
    }


def get_display_config_from_session_or_api(
    *,
    request,
    device_token,
):
    display_config = request.session.get("display_config")

    if display_config:
        return display_config

    response = requests.get(
        f"{API_URL}api/core/display/config/",
        params={
            "device_token": device_token,
        },
        timeout=5,
    )

    response.raise_for_status()

    display_config = response.json()

    request.session["display_config"] = display_config
    request.session["display_config_version"] = display_config.get(
        "config_version"
    )

    request.session.modified = True

    return display_config






def get_paytable_for_display(*,table_odds_id):
    key = f"table_odds:{table_odds_id}"

    payload = cache.get(key)

    if payload is not None:
        return payload

    # Segun la guia, los errores HTTP, timeouts y JSON invalidos se controlan:
    # se devuelve el contrato vacio {} y la pantalla sigue su ciclo.
    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/core/table-odds/{table_odds_id}/"
            ),
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

    except (requests.RequestException, ValueError) as error:
        print(f"Tabla de pagos {table_odds_id} no disponible: {error}")
        return {}

    cache.set(
        key,
        payload,
        None,
    )

    return payload






def get_display_jackpot(
    *,
    jackpot_id,
):
    key = f"jackpot:display:{jackpot_id}"

    payload = cache.get(key)
    print("primero",payload)

    if payload:
        return payload

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/jackpot/display/{jackpot_id}/"
            ),
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

        print("primero 2",payload)

        cache.set(
            key,
            payload,
            None,
        )

        return payload

    except Exception:
        return None



def get_display_jackpots(
    *,
    device_token,
    game_id,
):
    """
    Jackpots aplicables al visor y juego (guia: Jackpots multiples por visor y juego).
    Redis:    jackpot:display:device:{device_token}:game:{game_id}   (TTL 60 s)
    Fallback: GET api/jackpot/display/device-game/?device_token=...&game_id=...
    """
    key = f"jackpot:display:device:{device_token}:game:{game_id}"

    payload = cache.get(key)

    if payload is not None:
        return payload

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/jackpot/display/device-game/"
            ),
            params={
                "device_token": device_token,
                "game_id": game_id,
            },
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

    except (requests.RequestException, ValueError) as error:
        print(f"Jackpots del visor no disponibles (game {game_id}): {error}")
        # Contrato vacio explicito. "error" permite a la pantalla distinguir
        # "API no disponible" (ERROR) de "visor sin jackpots" (JK SIN ASIGNAR).
        return {
            "error": True,
            "jackpots": [],
            "global_jackpots": [],
            "local_jackpots": [],
        }

    cache.set(
        key,
        payload,
        60,
    )

    return payload



def get_display_bonus_event(
    *,
    device_token,
    lugar_id,
    game_id,
    sorteo_id,
):
    """
    Ganadores de bono del sorteo exacto que acaba de finalizar (guia: Bonos del evento finalizado).
    Redis:    display:bonus_event:{lugar_id}:{game_id}:{sorteo_id}   (TTL 30 min)
    Fallback: GET api/core/display/bonuses/event/?device_token=...&game_id=...&sorteo_id=...
    La respuesta negativa NO se guarda: el bono puede acreditarse segundos despues.
    """
    key = f"display:bonus_event:{lugar_id}:{game_id}:{sorteo_id}"

    payload = cache.get(key)

    if payload is not None:
        return payload

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/core/display/bonuses/event/"
            ),
            params={
                "device_token": device_token,
                "game_id": game_id,
                "sorteo_id": sorteo_id,
            },
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

    except (requests.RequestException, ValueError) as error:
        print(f"Bono del sorteo {sorteo_id} no disponible: {error}")
        # Contrato vacio explicito
        return {
            "has_bonus_event": False,
            "lugar_id": lugar_id,
            "game_id": game_id,
            "sorteo_id": sorteo_id,
            "event_number": None,
            "count": 0,
            "winners": [],
        }

    if payload.get("has_bonus_event"):
        cache.set(
            key,
            payload,
            60 * 30,
        )

    return payload



def get_display_jackpot_winner_event(
    *,
    jackpot_id,
):
    """
    Evento ganador de un jackpot (guia: Ganadores de jackpots).
    Redis:    jackpot:winner_event:{jackpot_id}   (TTL 30 min)
    Fallback: GET api/jackpot/display/{jackpot_id}/winner-event/
    Contrato: {"has_winner_event": bool, "event": {...} o null}
    """
    key = f"jackpot:winner_event:{jackpot_id}"

    sin_ganador = {
        "has_winner_event": False,
        "event": None,
    }

    payload = cache.get(key)

    if payload is not None:
        # Contrato canonico: se devuelve tal cual
        if isinstance(payload, dict) and "has_winner_event" in payload:
            return payload
        # Compatibilidad con claves antiguas que guardaban solo el evento
        if isinstance(payload, dict) and payload:
            return {
                "has_winner_event": True,
                "event": payload,
            }

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/jackpot/display/{jackpot_id}/winner-event/"
            ),
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

    except (requests.RequestException, ValueError) as error:
        print(f"Ganador del jackpot {jackpot_id} no disponible: {error}")
        return sin_ganador

    if not isinstance(payload, dict):
        return sin_ganador

    # Se guarda la respuesta completa, sin transformarla, solo cuando hay ganador
    if payload.get("has_winner_event"):
        cache.set(
            key,
            payload,
            60 * 30,
        )

    return payload





def get_display_config(
    *,
    device_token,
):
    key = f"display:config:{device_token}"

    payload = cache.get(key)

    if payload:
        return payload

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"api/core/display/config/"
            ),
            params={
                "device_token": device_token,
            },
            timeout=3,
        )

        response.raise_for_status()

        payload = response.json()

        cache.set(
            key,
            payload,
            None,
        )

        return payload

    except Exception:
        return None