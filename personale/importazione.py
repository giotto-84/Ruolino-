"""Importazione del brogliaccio Excel (foglio BROGLIACCIO) nel database.

Struttura attesa del foglio:
  riga 1: NUM | GRADO | COGNOME | NOME | POSIZIONE | PATENTI | NR. TEL | <mesi (celle unite)>
  riga 2: numeri dei giorni sotto ciascun mese
  dalla riga 3: un militare per riga, una colonna per giorno con il codice di impiego

Il file viene letto solo in memoria: non viene salvato da nessuna parte.
"""
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date

import openpyxl
from django.db import transaction

from .dati_iniziali import ALIAS_GRADI, carica_dati_iniziali
from .models import Grado, Impiego, Militare, TipoImpiego

NOMI_MESI = {
    "GENNAIO": 1, "FEBBRAIO": 2, "MARZO": 3, "APRILE": 4, "MAGGIO": 5, "GIUGNO": 6,
    "LUGLIO": 7, "AGOSTO": 8, "SETTEMBRE": 9, "OTTOBRE": 10, "NOVEMBRE": 11, "DICEMBRE": 12,
}

# Grafie diverse dello stesso codice -> codice standard (confronto in MAIUSCOLO)
ALIAS_CODICI = {
    "GDG": "Gdg",
    "UDP": "Udp",
    "LIC": "LIC ORD",
    "REC FEST": "RC FEST",
    "POL": "POL.",
    "EX BRAG": "EX BRAG.",
    "EX BRAGADIN": "EX BRAG.",
    "SMI": "VISITA SMI",
    "LIC CONC": "LIC CONC.",
    "LIC STRA": "LIC STRA.",
    "LIC CONV.": "LIC CONV",
    "RIL.IMM": "RIL. IMM",
    "GURDIA 4 UOMO": "GUARDIA B (4)",
    "GUARDIA 4 UOMO": "GUARDIA B (4)",
    "GUARDIA B(4)": "GUARDIA B (4)",
}

ALIAS_LOCALITA = {
    "MALCO.": "MALCONTENTA",
    "MALCO": "MALCONTENTA",
    "RAV": "RAVENNA",
    "PESARO.": "PESARO",
}

RE_NOTA = re.compile(r"\s+(?=IN DATA\b)|\s+-\s+|\s+(?=GIA'? INV\b)", re.IGNORECASE)
RE_SI = re.compile(r"^S\.?\s?I\.?(?:\s+|$)(.*)$", re.IGNORECASE)
RE_SS = re.compile(r"^S\.\s?S\.(?:\s+|$)(.*)$", re.IGNORECASE)
RE_PAREN = re.compile(r"^(.*?)\s*\(([^()]+)\)$")


def pulisci(testo):
    return re.sub(r"\s+", " ", str(testo)).strip()


@dataclass
class Voce:
    codice: str
    localita: str = ""


@dataclass
class Rapporto:
    militari_creati: int = 0
    militari_aggiornati: int = 0
    impieghi: int = 0
    codici_nuovi: Counter = field(default_factory=Counter)
    avvisi: list = field(default_factory=list)

    def righe(self):
        out = [
            f"Militari creati: {self.militari_creati}",
            f"Militari aggiornati: {self.militari_aggiornati}",
            f"Impieghi giornalieri importati: {self.impieghi}",
        ]
        if self.codici_nuovi:
            out.append(
                "Codici non presenti in elenco, creati in categoria 'Altro' "
                "(verificarli in Configurazione > Codici): "
                + ", ".join(f"{c} ({n})" for c, n in self.codici_nuovi.most_common())
            )
        out.extend(self.avvisi)
        return out


class Interprete:
    """Trasforma il testo di una casella in (lista di Voce, nota)."""

    def __init__(self):
        self.noti = {t.codice.upper(): t.codice for t in TipoImpiego.objects.all()}

    def normalizza_codice(self, testo):
        u = pulisci(testo).upper()
        u = ALIAS_CODICI.get(u, u)
        return self.noti.get(u.upper(), u)

    def voce(self, parte):
        parte = pulisci(parte)
        if not parte:
            return None
        cod = self.normalizza_codice(parte)
        if cod.upper() in self.noti:
            return Voce(self.noti[cod.upper()])
        m = RE_SS.match(parte)
        if m:
            return Voce(self.noti.get("S.S.", "S.S."), self._loc(m.group(1)))
        m = RE_SI.match(parte)
        if m:
            return Voce(self.noti.get("S.I.", "S.I."), self._loc(m.group(1)))
        m = RE_PAREN.match(parte)
        if m:
            base = self.normalizza_codice(m.group(1))
            if base.upper() in self.noti:
                return Voce(self.noti[base.upper()], self._loc(m.group(2)))
        return Voce(cod)

    @staticmethod
    def _loc(testo):
        t = pulisci(testo).upper()
        return ALIAS_LOCALITA.get(t, t)

    def interpreta(self, valore):
        testo = pulisci(valore)
        if not testo:
            return [], ""
        parti = RE_NOTA.split(testo, maxsplit=1)
        testa = parti[0]
        nota = testo if len(parti) > 1 else ""
        if re.match(r"^(IN DATA|GIA'? INV)\b", testa, re.IGNORECASE):
            return [Voce(self.noti.get("NOTA", "NOTA"))], testo
        if testa.upper().endswith(" IN DATA"):
            testa = testa[: -len(" IN DATA")]
            nota = testo
        voci = [v for v in (self.voce(p) for p in testa.split("+")) if v]
        if not voci:
            return [Voce(self.noti.get("NOTA", "NOTA"))], testo
        return voci, nota


def _grado(sigla, cache):
    sigla = pulisci(sigla or "?").upper()
    sigla = ALIAS_GRADI.get(sigla, sigla)
    if sigla not in cache:
        esistente = Grado.objects.filter(sigla__iexact=sigla).first()
        cache[sigla] = esistente or Grado.objects.create(sigla=sigla, ordine=999)
    return cache[sigla]


def _colonne_date(ws, anno, prima_colonna=8):
    """Mappa indice colonna -> data, leggendo mesi (riga 1) e giorni (riga 2)."""
    mese_corrente = None
    colonne = {}
    for col in range(prima_colonna, ws.max_column + 1):
        intestazione = ws.cell(row=1, column=col).value
        if intestazione:
            mese_corrente = NOMI_MESI.get(pulisci(intestazione).upper(), mese_corrente)
        giorno = ws.cell(row=2, column=col).value
        if mese_corrente and isinstance(giorno, (int, float)):
            try:
                colonne[col] = date(anno, mese_corrente, int(giorno))
            except ValueError:
                pass
    return colonne


@transaction.atomic
def importa_brogliaccio(file, anno, foglio="BROGLIACCIO", sostituisci=True):
    """Importa anagrafica e impieghi. ``file`` puo' essere un percorso o un file aperto."""
    carica_dati_iniziali()
    wb = openpyxl.load_workbook(file, data_only=True)
    if foglio not in wb.sheetnames:
        raise ValueError(f"Foglio '{foglio}' non trovato. Fogli presenti: {', '.join(wb.sheetnames)}")
    ws = wb[foglio]
    colonne = _colonne_date(ws, anno)
    if not colonne:
        raise ValueError("Non ho trovato le intestazioni dei mesi e dei giorni nelle righe 1-2.")

    rapporto = Rapporto()
    interprete = Interprete()
    gradi = {}
    tipi = {t.codice: t for t in TipoImpiego.objects.all()}
    codici_creati = set()
    ordine = 0

    for riga in range(3, ws.max_row + 1):
        cognome = ws.cell(row=riga, column=3).value
        if not cognome or not pulisci(cognome):
            continue
        ordine += 1
        num, grado, _, nome, incarico, patenti, tel = (
            ws.cell(row=riga, column=c).value for c in range(1, 8)
        )
        cognome, nome = pulisci(cognome).upper(), pulisci(nome or "").upper()
        stato = (
            Militare.Stato.EXTRA
            if isinstance(num, str) and "EXTRA" in num.upper()
            else Militare.Stato.EFFETTIVO
        )
        dati = {
            "grado": _grado(grado, gradi),
            "incarico": pulisci(incarico or ""),
            "patenti": pulisci(patenti or ""),
            "telefono": pulisci(tel or "") if tel is not None else "",
            "stato": stato,
            "ordine": ordine,
        }
        militare = Militare.objects.filter(cognome__iexact=cognome, nome__iexact=nome).first()
        if militare:
            for k, v in dati.items():
                setattr(militare, k, v)
            militare.save()
            rapporto.militari_aggiornati += 1
        else:
            militare = Militare.objects.create(cognome=cognome, nome=nome, **dati)
            rapporto.militari_creati += 1

        if sostituisci:
            Impiego.objects.filter(
                militare=militare, data__gte=min(colonne.values()), data__lte=max(colonne.values())
            ).delete()

        per_giorno = defaultdict(dict)
        for col, giorno in colonne.items():
            valore = ws.cell(row=riga, column=col).value
            if valore is None or not pulisci(valore):
                continue
            voci, nota = interprete.interpreta(valore)
            for v in voci:
                if v.codice not in tipi:
                    tipi[v.codice] = TipoImpiego.objects.create(
                        codice=v.codice[:30],
                        descrizione="(importato da Excel - da verificare)",
                        categoria=TipoImpiego.Categoria.ALTRO,
                        ordine=900,
                    )
                    interprete.noti[v.codice.upper()] = v.codice
                    codici_creati.add(v.codice)
                if v.codice in codici_creati:
                    rapporto.codici_nuovi[v.codice] += 1
                chiave = v.codice
                if chiave in per_giorno[giorno]:
                    esistente = per_giorno[giorno][chiave]
                    if nota and nota not in esistente.note:
                        esistente.note = (esistente.note + " | " + nota).strip(" |")
                    continue
                per_giorno[giorno][chiave] = Impiego(
                    militare=militare,
                    data=giorno,
                    tipo=tipi[v.codice],
                    localita=v.localita[:80],
                    note=nota,
                )
        nuovi = [imp for giorno in per_giorno.values() for imp in giorno.values()]
        Impiego.objects.bulk_create(nuovi)
        rapporto.impieghi += len(nuovi)
    return rapporto
