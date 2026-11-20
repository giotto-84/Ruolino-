"""Nei database gia' esistenti collega RC e RC FEST alle "Ore di recupero",
scalate secondo l'orario di lavoro (lun-gio 8 ore, ven 4 ore)."""
from django.db import migrations


def collega(apps, schema_editor):
    Contatore = apps.get_model("personale", "Contatore")
    TipoImpiego = apps.get_model("personale", "TipoImpiego")
    OrarioLavoro = apps.get_model("personale", "OrarioLavoro")
    OrarioLavoro.objects.get_or_create(pk=1)
    ore = Contatore.objects.filter(nome="Ore di recupero").first()
    if ore is None:
        return
    TipoImpiego.objects.filter(codice__in=["RC", "RC FEST"], contatore__isnull=True).update(
        contatore=ore, scala_secondo_orario=True
    )


class Migration(migrations.Migration):
    dependencies = [("personale", "0002_orario_lavoro")]
    operations = [migrations.RunPython(collega, migrations.RunPython.noop)]
