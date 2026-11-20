"""Avvia il programma Ruolino sulla rete interna.

Uso:  python avvia.py [--porta 8000] [--solo-questo-pc]

Ad ogni avvio: aggiorna il database, carica i dati iniziali mancanti,
fa un backup del database e avvia il server (raggiungibile dagli altri PC
della rete all'indirizzo mostrato a schermo).
"""
import argparse
import os
import socket
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ruolino.settings")


def indirizzo_locale():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--porta", type=int, default=int(os.environ.get("RUOLINO_PORTA", 8000)))
    parser.add_argument("--solo-questo-pc", action="store_true", help="non accessibile dagli altri PC")
    args = parser.parse_args()

    import django
    from django.core.management import call_command

    django.setup()
    from django.conf import settings

    esisteva = (settings.DATI_DIR / "ruolino.sqlite3").exists()
    call_command("migrate", interactive=False, verbosity=0)
    call_command("setup_iniziale", verbosity=0)
    if esisteva:
        call_command("backup_db", verbosity=0)

    from django.contrib.auth.models import User

    if not User.objects.filter(is_superuser=True).exists():
        print("\nNessun amministratore presente: creane uno ora.")
        call_command("createsuperuser")

    from waitress import serve

    from ruolino.wsgi import application

    host = "127.0.0.1" if args.solo_questo_pc else "0.0.0.0"
    print("\n==============================================")
    print(" RUOLINO avviato")
    print(f" Da questo PC:       http://localhost:{args.porta}")
    if not args.solo_questo_pc:
        print(f" Dagli altri PC:     http://{indirizzo_locale()}:{args.porta}")
    print(f" Dati in:            {settings.DATI_DIR}")
    print(" Per chiudere: CTRL+C oppure chiudere questa finestra")
    print("==============================================\n", flush=True)
    serve(application, host=host, port=args.porta, threads=8)


if __name__ == "__main__":
    sys.exit(main())
