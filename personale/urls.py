from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    # Ruolino
    path("ruolino/", views.ruolino, name="ruolino"),
    path("ruolino/<int:anno>/<int:mese>/", views.ruolino, name="ruolino_mese"),
    path("ruolino/<int:anno>/<int:mese>/excel/", views.esporta_ruolino, name="esporta_ruolino"),
    path("ruolino/cella/", views.cella_dettaglio, name="cella_dettaglio"),
    path("ruolino/cella/aggiungi/", views.cella_aggiungi, name="cella_aggiungi"),
    path("ruolino/cella/elimina/", views.cella_elimina, name="cella_elimina"),
    path("ruolino/periodo/", views.inserimento_periodo, name="inserimento_periodo"),
    # Anagrafica
    path("militari/", views.militari_elenco, name="militari"),
    path("militari/nuovo/", views.MilitareCrea.as_view(), name="militare_nuovo"),
    path("militari/<int:pk>/", views.militare_dettaglio, name="militare"),
    path("militari/<int:pk>/modifica/", views.MilitareModifica.as_view(), name="militare_modifica"),
    path("militari/<int:pk>/elimina/", views.MilitareElimina.as_view(), name="militare_elimina"),
    # Licenze
    path("licenze/", views.licenze, name="licenze"),
    path("licenze/spettanza/nuova/", views.SpettanzaCrea.as_view(), name="spettanza_nuova"),
    path("licenze/spettanza/<int:pk>/", views.SpettanzaModifica.as_view(), name="spettanza_modifica"),
    path("licenze/spettanza/<int:pk>/elimina/", views.SpettanzaElimina.as_view(), name="spettanza_elimina"),
    path("licenze/movimento/nuovo/", views.DetrazioneCrea.as_view(), name="detrazione_nuova"),
    path("licenze/movimento/<int:pk>/elimina/", views.DetrazioneElimina.as_view(), name="detrazione_elimina"),
    # Scadenze
    path("scadenze/", views.scadenze, name="scadenze"),
    path("scadenze/nuova/", views.ScadenzaCrea.as_view(), name="scadenza_nuova"),
    path("scadenze/<int:pk>/", views.ScadenzaModifica.as_view(), name="scadenza_modifica"),
    path("scadenze/<int:pk>/elimina/", views.ScadenzaElimina.as_view(), name="scadenza_elimina"),
    # Configurazione
    path("configurazione/", views.configurazione, name="configurazione_home"),
    path("configurazione/<str:sezione>/", views.configurazione, name="configurazione"),
    path("configurazione/<str:sezione>/nuovo/", views.configurazione_modifica, name="configurazione_nuovo"),
    path("configurazione/<str:sezione>/<int:pk>/", views.configurazione_modifica, name="configurazione_modifica"),
    # Varie
    path("importa/", views.importa_excel, name="importa"),
    path("registro/", views.registro, name="registro"),
]
