from django.contrib import admin

from .models import (
    Contatore, Detrazione, Grado, Impiego, Militare, RegistroModifiche,
    Scadenza, Spettanza, TipoImpiego, TipoScadenza,
)


@admin.register(Militare)
class MilitareAdmin(admin.ModelAdmin):
    list_display = ("cognome", "nome", "grado", "incarico", "stato", "data_uscita")
    list_filter = ("stato", "grado")
    search_fields = ("cognome", "nome", "incarico")


@admin.register(Impiego)
class ImpiegoAdmin(admin.ModelAdmin):
    list_display = ("data", "militare", "tipo", "localita", "modificato_da", "modificato_il")
    list_filter = ("tipo", "data")
    search_fields = ("militare__cognome", "note", "localita")
    date_hierarchy = "data"


@admin.register(RegistroModifiche)
class RegistroAdmin(admin.ModelAdmin):
    list_display = ("quando", "utente", "azione")
    search_fields = ("azione",)

    def has_change_permission(self, request, obj=None):
        return False


for modello in (Grado, Contatore, Spettanza, Detrazione, TipoImpiego, TipoScadenza, Scadenza):
    admin.site.register(modello)
