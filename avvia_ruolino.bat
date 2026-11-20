@echo off
REM Avvio del programma Ruolino su Windows.
REM Il primo avvio crea l'ambiente Python e installa i componenti (serve Internet una sola volta,
REM oppure la cartella "pacchetti" preparata in anticipo: vedi README).
cd /d "%~dp0"
if not exist .venv (
    echo Primo avvio: preparazione dell'ambiente...
    py -3 -m venv .venv || python -m venv .venv
    if exist pacchetti (
        .venv\Scripts\pip install --no-index --find-links=pacchetti -r requirements.txt
    ) else (
        .venv\Scripts\pip install -r requirements.txt
    )
)
.venv\Scripts\python avvia.py %*
pause
