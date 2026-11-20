from django.core.management.base import BaseCommand, CommandError

from personale.importazione import importa_brogliaccio


class Command(BaseCommand):
    help = "Importa anagrafica e ruolino dal brogliaccio Excel (il file non viene copiato)."

    def add_arguments(self, parser):
        parser.add_argument("file", help="percorso del file .xlsx")
        parser.add_argument("--anno", type=int, required=True, help="anno a cui si riferisce il brogliaccio")
        parser.add_argument("--foglio", default="BROGLIACCIO")
        parser.add_argument(
            "--mantieni",
            action="store_true",
            help="non cancellare gli impieghi gia' presenti nel periodo del file",
        )

    def handle(self, *args, **opt):
        try:
            rapporto = importa_brogliaccio(
                opt["file"], opt["anno"], opt["foglio"], sostituisci=not opt["mantieni"]
            )
        except (ValueError, FileNotFoundError) as e:
            raise CommandError(str(e))
        for riga in rapporto.righe():
            self.stdout.write(riga)
        self.stdout.write(self.style.SUCCESS("Importazione completata."))
