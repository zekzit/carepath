from django.contrib import admin

from .models import Building, Edge, Floor, Node

admin.site.register(Building)
admin.site.register(Floor)
admin.site.register(Node)
admin.site.register(Edge)
