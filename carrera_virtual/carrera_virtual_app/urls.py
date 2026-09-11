from django.urls import path,include, re_path as url
from rest_framework.urlpatterns import format_suffix_patterns
from . import views
from django.contrib.auth.decorators import login_required

urlpatterns=[


    #GENERALES
    path('games',views.games,name="games"),

    path('DOGS_6',	    views.DOGS_6,	        name="DOGS_6"),
    path('DOGS_8',	    views.DOGS_8,	        name="DOGS_8"),
    path('HORSES_7',	views.HORSES_7,	        name="HORSES_7"),
    path('ROULETTE',	views.ROULETTE,	        name="ROULETTE"),
    path('ROOSTERS',	views.ROOSTERS,	        name="ROOSTERS"),
    path('',            views.configuration,    name="configuration"),
    


]
