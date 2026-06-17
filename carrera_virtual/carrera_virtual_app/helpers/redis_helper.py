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
                f"/api/core/display/results/latest/"
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
        "scheduled_at": latest.get("scheduled_at"),
        "settled_at": latest.get("settled_at"),
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
        f"{API_URL}/api/core/display/config/",
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

    if payload:
        return payload

    response = requests.get(
        (
            f"{API_URL}"
            f"/api/core/table-odds/{table_odds_id}/"
        ),
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
                f"/api/jackpot/display/{jackpot_id}/"
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



def get_display_jackpot_winner_event(
    *,
    jackpot_id,
):
    key = f"jackpot:winner_event:{jackpot_id}"

    payload = cache.get(key)

    if payload:
        return {
            "has_winner_event": True,
            "event": payload,
        }

    try:
        response = requests.get(
            (
                f"{API_URL}"
                f"/api/jackpot/display/{jackpot_id}/winner-event/"
            ),
            timeout=3,
        )

        response.raise_for_status()

        fallback_payload = response.json()

        event = fallback_payload.get("event")

        if event:
            cache.set(
                key,
                event,
                60 * 30,
            )

        return fallback_payload

    except Exception:
        return {
            "has_winner_event": False,
            "event": None,
        }





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
                f"/api/core/display/config/"
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