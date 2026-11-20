"""Funzioni di calendario: festivita' nazionali italiane e mesi."""
import calendar
from datetime import date, timedelta

MESI = [
    "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]
GIORNI_SETTIMANA = ["L", "M", "M", "G", "V", "S", "D"]


def pasqua(anno):
    """Domenica di Pasqua (algoritmo di Gauss/Meeus)."""
    a = anno % 19
    b, c = divmod(anno, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mese = (h + l - 7 * m + 114) // 31
    giorno = (h + l - 7 * m + 114) % 31 + 1
    return date(anno, mese, giorno)


def festivita(anno):
    fisse = [
        (1, 1), (1, 6), (4, 25), (5, 1), (6, 2), (8, 15), (11, 1), (12, 8), (12, 25), (12, 26),
    ]
    giorni = {date(anno, m, g) for m, g in fisse}
    p = pasqua(anno)
    giorni.add(p)
    giorni.add(p + timedelta(days=1))
    return giorni


def giorni_del_mese(anno, mese):
    feste = festivita(anno)
    n = calendar.monthrange(anno, mese)[1]
    risultato = []
    for g in range(1, n + 1):
        d = date(anno, mese, g)
        risultato.append(
            {
                "data": d,
                "giorno": g,
                "sett": GIORNI_SETTIMANA[d.weekday()],
                "festivo": d.weekday() >= 5 or d in feste,
            }
        )
    return risultato


def mese_precedente(anno, mese):
    return (anno - 1, 12) if mese == 1 else (anno, mese - 1)


def mese_successivo(anno, mese):
    return (anno + 1, 1) if mese == 12 else (anno, mese + 1)
