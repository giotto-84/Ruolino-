#!/bin/sh
# Avvio del programma Ruolino su Linux/macOS.
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
    echo "Primo avvio: preparazione dell'ambiente..."
    python3 -m venv .venv
    if [ -d pacchetti ]; then
        .venv/bin/pip install --no-index --find-links=pacchetti -r requirements.txt
    else
        .venv/bin/pip install -r requirements.txt
    fi
fi
exec .venv/bin/python avvia.py "$@"
