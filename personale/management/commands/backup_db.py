import sqlite3
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Crea una copia di sicurezza del database in dati/backup (mantiene le ultime N copie)."

    def add_arguments(self, parser):
        parser.add_argument("--mantieni", type=int, default=30, help="quante copie conservare")

    def handle(self, *args, **opt):
        settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        origine = settings.DATABASES["default"]["NAME"]
        dest = settings.BACKUP_DIR / f"ruolino_{datetime.now():%Y%m%d_%H%M%S}.sqlite3"
        with sqlite3.connect(origine) as src, sqlite3.connect(dest) as dst:
            src.backup(dst)
        copie = sorted(settings.BACKUP_DIR.glob("ruolino_*.sqlite3"))
        for vecchia in copie[: -opt["mantieni"]]:
            vecchia.unlink()
        self.stdout.write(self.style.SUCCESS(f"Backup creato: {dest}"))
