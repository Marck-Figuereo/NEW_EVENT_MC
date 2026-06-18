from django.urls import path,include, re_path as url
from rest_framework.urlpatterns import format_suffix_patterns
from . import views
from django.contrib.auth.decorators import login_required

urlpatterns=[


    #GENERALES
    path('carreras_virtual_p',	views.carreras_virtual_p,	        name="carreras_virtual_p"),
    path('games',views.games,name="games"),
    path('carreras_virtual_p8',	views.carreras_virtual_p8,	        name="carreras_virtual_p8"),
    path('carreras_virtual_c',	views.carreras_virtual_c,	        name="carreras_virtual_c"),
    path('roulette',	        views.roulette,	                    name="roulette"),
    path('gallos',	            views.gallos,	                    name="gallos"),
    #path('login',	            views.login,	                    name="login"),
    path('',                    views.configuration,                name="configuration"),
    


]
