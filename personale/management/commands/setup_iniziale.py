from django.core.management.base import BaseCommand

from personale.dati_iniziali import carica_dati_iniziali


class Command(BaseCommand):
    help = "Crea gradi, codici di impiego, contatori, tipi di scadenza e ruoli utente (non sovrascrive)."

    def handle(self, *args, **options):
        carica_dati_iniziali()
        self.stdout.write(self.style.SUCCESS("Dati iniziali caricati."))
