from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',include(('carrera_virtual_app.urls','carrera_virtual_app'), namespace='carrera_virtual_app'))
]
