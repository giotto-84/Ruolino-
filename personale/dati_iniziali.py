"""Valori iniziali: gradi, codici di impiego, contatori, tipi di scadenza, ruoli utente.

Tutto quello che e' qui si puo' poi modificare dal programma. La funzione
``carica_dati_iniziali`` non sovrascrive mai cio' che esiste gia'.
"""
from decimal import Decimal

from django.contrib.auth.models import Group, Permission

from .models import Contatore, Grado, OrarioLavoro, TipoImpiego, TipoScadenza

GRADI = [
    ("COL.", "Colonnello"), ("TEN. COL.", "Tenente Colonnello"), ("MAGG.", "Maggiore"),
    ("CAP.", "Capitano"), ("TEN.", "Tenente"), ("S. TEN.", "Sottotenente"),
    ("1° LGT.", "Primo Luogotenente"), ("LGT.", "Luogotenente"),
    ("1° MAR.", "Primo Maresciallo"), ("MAR. CA.", "Maresciallo Capo"),
    ("MAR. ORD.", "Maresciallo Ordinario"), ("MAR.", "Maresciallo"),
    ("SERG. MAGG. CA.", "Sergente Maggiore Capo"), ("SERG. MAGG.", "Sergente Maggiore"),
    ("SERG.", "Sergente"),
    ("GRD. A.", "Graduato Aiutante"), ("1° GRD", "Primo Graduato"),
    ("GRD. SC", "Graduato Scelto"), ("GRD", "Graduato"),
    ("C.M. CA. SC.", "Caporal Maggiore Capo Scelto"), ("C.M. CA.", "Caporal Maggiore Capo"),
    ("C.M. SC.", "Caporal Maggiore Scelto"), ("CM VFP4", "Caporal Maggiore VFP4"),
    ("C.M.", "Caporal Maggiore"), ("CAP. VFP", "Caporale"), ("SOL.", "Soldato"),
]

# Sinonimi incontrati nel brogliaccio Excel -> sigla standard
ALIAS_GRADI = {
    "MAR.CA.": "MAR. CA.",
    "MAR CA": "MAR. CA.",
    "CM VFP4": "CM VFP4",
    "SERG.MAGG.": "SERG. MAGG.",
}

CONTATORI = [
    ("Licenza ordinaria", "GG", 10),
    ("Festivita' soppresse", "GG", 20),
    ("Ore di recupero", "ORE", 30),
]

S, A, F, X, O = (
    TipoImpiego.Categoria.SERVIZIO,
    TipoImpiego.Categoria.ATTIVITA,
    TipoImpiego.Categoria.FUORI_SEDE,
    TipoImpiego.Categoria.ASSENZA,
    TipoImpiego.Categoria.ALTRO,
)
GIALLO, MARRONE, VERDE, VERDE_CHIARO = "#FFFF00", "#833C0B", "#00B050", "#92D050"
ARANCIO, AZZURRO, CELESTE, VIOLA, BIANCO = "#FFC000", "#9CC2E5", "#8EAADB", "#7030A0", "#FFFFFF"

# codice, descrizione, categoria, sfondo, testo, presente_in_sede, contatore
CODICI = [
    ("GUARDIA A", "Guardia A", S, GIALLO, "#000000", True, None),
    ("GUARDIA B", "Guardia B", S, GIALLO, "#000000", True, None),
    ("GUARDIA B (4)", "Guardia B - quarto uomo", S, GIALLO, "#000000", True, None),
    ("Udp", "Ufficiale/Sottufficiale di picchetto", S, GIALLO, "#000000", True, None),
    ("Gdg", "Graduato di giornata", S, GIALLO, "#000000", True, None),
    ("RC", "Recupero compensativo", X, GIALLO, "#000000", False, "Ore di recupero"),
    ("RC FEST", "Recupero festivo", X, MARRONE, "#FFFFFF", False, "Ore di recupero"),
    ("LIC ORD", "Licenza ordinaria", X, MARRONE, "#FFFFFF", False, "Licenza ordinaria"),
    ("LIC FEST", "Licenza festivita' soppresse", X, MARRONE, "#FFFFFF", False, "Festivita' soppresse"),
    ("LIC CONC.", "Licenza per concorso", X, AZZURRO, "#000000", False, None),
    ("LIC CONV", "Licenza di convalescenza", X, GIALLO, "#000000", False, None),
    ("LIC STRA.", "Licenza straordinaria", X, AZZURRO, "#000000", False, None),
    ("LIC SANGUE", "Licenza donazione sangue", X, AZZURRO, "#000000", False, None),
    ("GMF", "Licenza per gravi motivi familiari", X, AZZURRO, "#000000", False, None),
    ("RMD", "Riposo medico domiciliare", X, VIOLA, "#FFFFFF", False, None),
    ("PERM", "Permesso", X, AZZURRO, "#000000", False, None),
    ("CONGEDO", "Congedo", X, AZZURRO, "#000000", False, None),
    ("S.S.", "Operazione Strade Sicure", F, VERDE, "#000000", False, None),
    ("S.I.", "Servizio isolato", F, VERDE_CHIARO, "#000000", False, None),
    ("LEONTE", "Operazione Leonte (Libano)", F, ARANCIO, "#000000", False, None),
    ("EX BRAG.", "Esercitazione Bragadin", F, BIANCO, "#000000", False, None),
    ("RECON", "Corso esploratori", F, VERDE_CHIARO, "#000000", False, None),
    ("APRM", "Corso droni", F, BIANCO, "#000000", False, None),
    ("VM", "Visita medica", A, VERDE_CHIARO, "#000000", True, None),
    ("VISITA SMI", "Visita SMI", A, BIANCO, "#000000", True, None),
    ("ECG", "Elettrocardiogramma", A, BIANCO, "#000000", True, None),
    ("PRELIEVI", "Prelievi", A, BIANCO, "#000000", True, None),
    ("RIL. IMM", "Rilievo immunitario / vaccinazione", A, BIANCO, "#000000", True, None),
    ("PEFO 3000", "PEFO - 3000 metri", A, BIANCO, "#000000", True, None),
    ("PEFO ZAV", "PEFO - zavorrata", A, BIANCO, "#000000", True, None),
    ("POL.", "Poligono / tiri", A, BIANCO, "#000000", True, None),
    ("PAT OBBLIGATORIA", "Patente obbligatoria", A, CELESTE, "#000000", True, None),
    ("BLS-D", "Corso BLS-D", A, BIANCO, "#000000", True, None),
    ("HACCP", "Corso HACCP", A, BIANCO, "#000000", True, None),
    ("C-IED", "Corso C-IED", A, BIANCO, "#000000", True, None),
    ("CORSO LAV", "Corso lavoratori (sicurezza)", A, BIANCO, "#000000", True, None),
    ("CORSO PREPOSTO", "Corso preposto", A, BIANCO, "#000000", True, None),
    ("NOTA", "Solo annotazione (nessun impiego)", O, BIANCO, "#555555", True, None),
]

TIPI_SCADENZA = [
    ("Idoneita' al servizio", 12, 30, True),
    ("PEFO", 12, 30, True),
    ("Tiri", 6, 30, True),
    ("Visita medica periodica", 12, 30, False),
    ("BLS-D", 24, 60, False),
    ("Patente militare", None, 60, False),
]

RUOLI = {
    # Vede tutto, modifica ruolino, anagrafica, licenze e scadenze, configurazione
    "Amministratori": None,  # tutti i permessi dell'app
    # Aggiorna ruolino, anagrafica (senza eliminare), licenze e scadenze
    "Operatori": [
        "view_grado", "view_tipoimpiego", "view_contatore", "view_orariolavoro",
        "view_tiposcadenza", "view_registromodifiche",
        "add_militare", "change_militare", "view_militare",
        "add_impiego", "change_impiego", "delete_impiego", "view_impiego",
        "add_scadenza", "change_scadenza", "delete_scadenza", "view_scadenza",
        "add_spettanza", "change_spettanza", "delete_spettanza", "view_spettanza",
        "add_detrazione", "change_detrazione", "delete_detrazione", "view_detrazione",
    ],
    # Sola lettura
    "Consultazione": [
        "view_militare", "view_grado", "view_tipoimpiego", "view_contatore", "view_orariolavoro",
        "view_tiposcadenza", "view_impiego", "view_scadenza", "view_spettanza",
        "view_detrazione",
    ],
}


def carica_dati_iniziali():
    for i, (sigla, descr) in enumerate(GRADI):
        Grado.objects.get_or_create(sigla=sigla, defaults={"descrizione": descr, "ordine": (i + 1) * 10})

    contatori = {}
    for nome, unita, ordine in CONTATORI:
        contatori[nome], _ = Contatore.objects.get_or_create(
            nome=nome, defaults={"unita": unita, "ordine": ordine}
        )

    for i, (cod, descr, cat, sfondo, testo, presente, cont) in enumerate(CODICI):
        TipoImpiego.objects.get_or_create(
            codice=cod,
            defaults={
                "descrizione": descr,
                "categoria": cat,
                "colore_sfondo": sfondo,
                "colore_testo": testo,
                "presente_in_sede": presente,
                "contatore": contatori.get(cont) if cont else None,
                "quantita_per_giorno": Decimal("1"),
                "scala_secondo_orario": cont is not None and contatori[cont].unita == Contatore.Unita.ORE,
                "ordine": (i + 1) * 10,
            },
        )

    for i, (nome, mesi, preavviso, obbl) in enumerate(TIPI_SCADENZA):
        TipoScadenza.objects.get_or_create(
            nome=nome,
            defaults={
                "validita_mesi": mesi,
                "preavviso_giorni": preavviso,
                "obbligatoria": obbl,
                "ordine": (i + 1) * 10,
            },
        )

    for nome_gruppo, codici in RUOLI.items():
        gruppo, _ = Group.objects.get_or_create(name=nome_gruppo)
        permessi = Permission.objects.filter(content_type__app_label="personale")
        if codici is not None:
            permessi = permessi.filter(codename__in=codici)
        gruppo.permissions.add(*permessi)  # non toglie i permessi aggiunti a mano

    OrarioLavoro.corrente()
