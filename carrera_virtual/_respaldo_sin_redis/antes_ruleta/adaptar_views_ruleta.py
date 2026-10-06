import sys
def rw(p, fn):
    raw=open(p,'rb').read(); c=b'\r\n' in raw; s=raw.decode('utf-8').replace('\r\n','\n'); s=fn(s)
    open(p,'wb').write((s.replace('\n','\r\n') if c else s).encode('utf-8'))
def rep(s,old,new):
    assert s.count(old)==1,(s.count(old),old[:80]); return s.replace(old,new)
base=sys.argv[1]
def vw(s):
    s=rep(s,"""                   'css/style_c.css', 'css/style_g.css', 'css/overlay_video.css']""","""                   'css/style_c.css', 'css/style_g.css', 'css/overlay_video.css',
                   'ruleta/cone_db_roulette.js', 'ruleta/funcionamiento_roulette.js', 'ruleta/roulette_integration.css']""")
    s=rep(s,"""@csrf_exempt
def ROULETTE(request): return render(request, "pv_roulette.html", _contexto_visor())""","""# Ruleta (game_id 1). Sus pantallas y assets viven en static/ruleta/.
# /ROULETTE se mantiene por si la API envia ese game_url.
@csrf_exempt
def RULETA(request): return render(request, "pv_ruleta.html", _contexto_visor())

ROULETTE = RULETA""")
    return s
rw(base+'/views.py', vw)
def ur(s):
    return rep(s,"""    path('ROULETTE',	views.ROULETTE,	        name="ROULETTE"),""","""    path('RULETA',	    views.RULETA,	        name="RULETA"),
    path('ROULETTE',	views.ROULETTE,	        name="ROULETTE"),""")
rw(base+'/urls.py', ur)
print('ok')
