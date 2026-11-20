"""Modello dati del ruolino del personale."""
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum


# ---------------------------------------------------------------------------
# Anagrafica
# ---------------------------------------------------------------------------
class Grado(models.Model):
    sigla = models.CharField("sigla", max_length=30, unique=True)
    descrizione = models.CharField("descrizione", max_length=100, blank=True)
    ordine = models.PositiveIntegerField(
        "ordine gerarchico",
        default=100,
        help_text="Numero piu' basso = grado piu' alto (serve per ordinare il ruolino).",
    )

    class Meta:
        ordering = ["ordine", "sigla"]
        verbose_name = "grado"
        verbose_name_plural = "gradi"

    def __str__(self):
        return self.sigla


class Militare(models.Model):
    class Stato(models.TextChoices):
        EFFETTIVO = "EFF", "Effettivo"
        EXTRA = "EXT", "Extra / aggregato"
        PERSO = "PER", "Perso dalla forza"

    grado = models.ForeignKey(Grado, on_delete=models.PROTECT, verbose_name="grado")
    cognome = models.CharField("cognome", max_length=80)
    nome = models.CharField("nome", max_length=80, blank=True)
    incarico = models.CharField("posizione / incarico", max_length=120, blank=True)
    patenti = models.CharField("patenti", max_length=120, blank=True)
    telefono = models.CharField("telefono", max_length=30, blank=True)
    stato = models.CharField(
        "stato", max_length=3, choices=Stato.choices, default=Stato.EFFETTIVO
    )
    data_ingresso = models.DateField("in forza dal", null=True, blank=True)
    data_uscita = models.DateField(
        "perso dalla forza il",
        null=True,
        blank=True,
        help_text="Ultimo giorno in forza. Dopo questa data non compare piu' nel ruolino.",
    )
    ordine = models.PositiveIntegerField(
        "posizione nel ruolino",
        default=0,
        help_text="Lasciare 0 per ordinare automaticamente per grado e cognome.",
    )
    note = models.TextField("note", blank=True)

    class Meta:
        ordering = ["stato", "ordine", "grado__ordine", "cognome", "nome"]
        verbose_name = "militare"
        verbose_name_plural = "militari"

    def __str__(self):
        return f"{self.grado} {self.cognome} {self.nome}".strip()

    @property
    def nominativo(self):
        return f"{self.cognome} {self.nome}".strip()

    @classmethod
    def in_forza(cls, dal, al=None):
        """Militari in forza in almeno un giorno dell'intervallo [dal, al]."""
        al = al or dal
        return cls.objects.select_related("grado").filter(
            Q(data_ingresso__isnull=True) | Q(data_ingresso__lte=al),
            Q(data_uscita__isnull=True) | Q(data_uscita__gte=dal),
        ).exclude(stato=cls.Stato.PERSO, data_uscita__isnull=True)

    def in_forza_il(self, giorno):
        if self.data_ingresso and giorno < self.data_ingresso:
            return False
        if self.data_uscita and giorno > self.data_uscita:
            return False
        return True


# ---------------------------------------------------------------------------
# Contatori (licenze, recuperi, ore...)
# ---------------------------------------------------------------------------
class Contatore(models.Model):
    """Un tipo di spettanza da controllare: licenza ordinaria, recuperi, ore..."""

    class Unita(models.TextChoices):
        GIORNI = "GG", "Giorni"
        ORE = "ORE", "Ore"

    nome = models.CharField("nome", max_length=60, unique=True)
    unita = models.CharField("unita'", max_length=3, choices=Unita.choices, default=Unita.GIORNI)
    ordine = models.PositiveIntegerField("ordine", default=100)
    attivo = models.BooleanField("attivo", default=True)

    class Meta:
        ordering = ["ordine", "nome"]
        verbose_name = "contatore licenze/recuperi"
        verbose_name_plural = "contatori licenze/recuperi"

    def __str__(self):
        return f"{self.nome} ({self.get_unita_display().lower()})"


class Spettanza(models.Model):
    """Quantita' assegnata a un militare per un contatore e un anno (inserita a mano)."""

    militare = models.ForeignKey(Militare, on_delete=models.CASCADE, related_name="spettanze")
    contatore = models.ForeignKey(Contatore, on_delete=models.PROTECT, verbose_name="contatore")
    anno = models.PositiveIntegerField("anno di riferimento")
    quantita = models.DecimalField("quantita' spettante", max_digits=7, decimal_places=2)
    note = models.CharField("note", max_length=200, blank=True)

    class Meta:
        ordering = ["-anno", "contatore__ordine"]
        unique_together = [("militare", "contatore", "anno")]
        verbose_name = "spettanza"
        verbose_name_plural = "spettanze"

    def __str__(self):
        return f"{self.militare} - {self.contatore.nome} {self.anno}: {self.quantita}"


class Detrazione(models.Model):
    """Movimento manuale su un contatore (es. ore di recupero maturate o consumate a ore)."""

    militare = models.ForeignKey(Militare, on_delete=models.CASCADE, related_name="detrazioni")
    contatore = models.ForeignKey(Contatore, on_delete=models.PROTECT, verbose_name="contatore")
    anno = models.PositiveIntegerField("anno di riferimento")
    data = models.DateField("data", default=date.today)
    quantita = models.DecimalField(
        "quantita'",
        max_digits=7,
        decimal_places=2,
        help_text="Positivo = consumato. Negativo = maturato/aggiunto.",
    )
    note = models.CharField("motivo", max_length=200, blank=True)

    class Meta:
        ordering = ["-data"]
        verbose_name = "movimento manuale"
        verbose_name_plural = "movimenti manuali"


# ---------------------------------------------------------------------------
# Codici di impiego giornaliero (LIC ORD, RC, GUARDIA A, S.S. ...)
# ---------------------------------------------------------------------------
class TipoImpiego(models.Model):
    class Categoria(models.TextChoices):
        SERVIZIO = "SER", "Servizio in sede (guardie, Gdg, Udp...)"
        ATTIVITA = "ATT", "Attivita' / visite in sede"
        FUORI_SEDE = "FUO", "Impiego fuori sede (S.S., S.I., operazioni, esercitazioni, corsi)"
        ASSENZA = "ASS", "Assenza (licenze, recuperi, riposo medico...)"
        ALTRO = "ALT", "Altro / note"

    codice = models.CharField("codice", max_length=30, unique=True)
    descrizione = models.CharField("descrizione", max_length=120, blank=True)
    categoria = models.CharField(
        "categoria", max_length=3, choices=Categoria.choices, default=Categoria.ALTRO
    )
    colore_sfondo = models.CharField("colore sfondo", max_length=7, default="#FFFFFF")
    colore_testo = models.CharField("colore testo", max_length=7, default="#000000")
    presente_in_sede = models.BooleanField(
        "conta come presente in sede",
        default=True,
        help_text="Usato per la situazione della forza giornaliera.",
    )
    contatore = models.ForeignKey(
        Contatore,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="scala dal contatore",
        help_text="Es. LIC ORD scala dalla licenza ordinaria.",
    )
    quantita_per_giorno = models.DecimalField(
        "quantita' scalata per giorno",
        max_digits=5,
        decimal_places=2,
        default=Decimal("1"),
        help_text="Giorni (o ore) scalati dal contatore per ogni giornata con questo codice.",
    )
    ordine = models.PositiveIntegerField("ordine nell'elenco", default=100)
    attivo = models.BooleanField("attivo", default=True)

    class Meta:
        ordering = ["ordine", "codice"]
        verbose_name = "codice di impiego"
        verbose_name_plural = "codici di impiego"

    def __str__(self):
        return self.codice

    def clean(self):
        for campo in ("colore_sfondo", "colore_testo"):
            valore = getattr(self, campo)
            if not (len(valore) == 7 and valore.startswith("#")):
                raise ValidationError({campo: "Usare il formato #RRGGBB."})


class Impiego(models.Model):
    """Cosa fa un militare in un determinato giorno (una casella del ruolino)."""

    militare = models.ForeignKey(Militare, on_delete=models.CASCADE, related_name="impieghi")
    data = models.DateField("data", db_index=True)
    tipo = models.ForeignKey(TipoImpiego, on_delete=models.PROTECT, verbose_name="codice")
    localita = models.CharField("localita'", max_length=80, blank=True)
    quantita = models.DecimalField(
        "quantita' scalata",
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lasciare vuoto per usare il valore del codice (es. ore effettive di recupero).",
    )
    note = models.TextField("note", blank=True)
    modificato_da = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, editable=False
    )
    modificato_il = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["data", "tipo__ordine"]
        unique_together = [("militare", "data", "tipo")]
        verbose_name = "impiego giornaliero"
        verbose_name_plural = "impieghi giornalieri"

    def __str__(self):
        return f"{self.data:%d/%m/%Y} {self.militare.cognome} {self.etichetta}"

    @property
    def etichetta(self):
        if self.localita:
            return f"{self.tipo.codice} {self.localita}"
        return self.tipo.codice

    @property
    def quantita_effettiva(self):
        return self.quantita if self.quantita is not None else self.tipo.quantita_per_giorno


def situazione_contatore(militare, contatore, anno):
    """Restituisce (spettante, goduto, residuo) per militare/contatore/anno."""
    spettanza = (
        Spettanza.objects.filter(militare=militare, contatore=contatore, anno=anno)
        .values_list("quantita", flat=True)
        .first()
    ) or Decimal("0")
    goduto = Decimal("0")
    impieghi = Impiego.objects.filter(
        militare=militare, tipo__contatore=contatore, data__year=anno
    ).select_related("tipo")
    for imp in impieghi:
        goduto += imp.quantita_effettiva
    goduto += (
        Detrazione.objects.filter(militare=militare, contatore=contatore, anno=anno).aggregate(
            s=Sum("quantita")
        )["s"]
        or Decimal("0")
    )
    return spettanza, goduto, spettanza - goduto


# ---------------------------------------------------------------------------
# Scadenze (idoneita', PEFO, tiri, visite, corsi...)
# ---------------------------------------------------------------------------
class TipoScadenza(models.Model):
    nome = models.CharField("nome", max_length=80, unique=True)
    validita_mesi = models.PositiveIntegerField(
        "validita' (mesi)",
        null=True,
        blank=True,
        help_text="Se indicata, la data di scadenza viene calcolata in automatico.",
    )
    preavviso_giorni = models.PositiveIntegerField(
        "preavviso (giorni)", default=30, help_text="Quanti giorni prima segnalare 'in scadenza'."
    )
    obbligatoria = models.BooleanField(
        "obbligatoria per tutti",
        default=False,
        help_text="Se si', i militari senza questa scadenza vengono segnalati come 'mancante'.",
    )
    descrizione = models.CharField("descrizione", max_length=200, blank=True)
    ordine = models.PositiveIntegerField("ordine", default=100)

    class Meta:
        ordering = ["ordine", "nome"]
        verbose_name = "tipo di scadenza"
        verbose_name_plural = "tipi di scadenza"

    def __str__(self):
        return self.nome


def aggiungi_mesi(giorno, mesi):
    mese = giorno.month - 1 + mesi
    anno = giorno.year + mese // 12
    mese = mese % 12 + 1
    import calendar

    ultimo = calendar.monthrange(anno, mese)[1]
    return date(anno, mese, min(giorno.day, ultimo))


class Scadenza(models.Model):
    class Stato:
        SCADUTA = "scaduta"
        IN_SCADENZA = "in_scadenza"
        VALIDA = "valida"
        SENZA_DATA = "senza_data"

    militare = models.ForeignKey(Militare, on_delete=models.CASCADE, related_name="scadenze")
    tipo = models.ForeignKey(TipoScadenza, on_delete=models.PROTECT, verbose_name="tipo")
    data_esecuzione = models.DateField("eseguita il", null=True, blank=True)
    data_scadenza = models.DateField(
        "scade il",
        null=True,
        blank=True,
        help_text="Se vuota e il tipo ha una validita', viene calcolata in automatico.",
    )
    esito = models.CharField("esito", max_length=80, blank=True)
    note = models.CharField("note", max_length=200, blank=True)

    class Meta:
        ordering = ["data_scadenza"]
        verbose_name = "scadenza"
        verbose_name_plural = "scadenze"

    def __str__(self):
        return f"{self.militare} - {self.tipo}"

    def clean(self):
        if not self.data_esecuzione and not self.data_scadenza:
            raise ValidationError("Indicare almeno la data di esecuzione o di scadenza.")

    def save(self, *args, **kwargs):
        if not self.data_scadenza and self.data_esecuzione and self.tipo.validita_mesi:
            self.data_scadenza = aggiungi_mesi(self.data_esecuzione, self.tipo.validita_mesi)
        super().save(*args, **kwargs)

    def stato(self, oggi=None):
        oggi = oggi or date.today()
        if not self.data_scadenza:
            return self.Stato.SENZA_DATA
        if self.data_scadenza < oggi:
            return self.Stato.SCADUTA
        if (self.data_scadenza - oggi).days <= self.tipo.preavviso_giorni:
            return self.Stato.IN_SCADENZA
        return self.Stato.VALIDA

    @property
    def stato_corrente(self):
        return self.stato()


# ---------------------------------------------------------------------------
# Registro delle modifiche (chi ha fatto cosa)
# ---------------------------------------------------------------------------
class RegistroModifiche(models.Model):
    utente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    quando = models.DateTimeField(auto_now_add=True, db_index=True)
    azione = models.CharField(max_length=300)

    class Meta:
        ordering = ["-quando"]
        verbose_name = "registro modifiche"
        verbose_name_plural = "registro modifiche"

    def __str__(self):
        return f"{self.quando:%d/%m/%Y %H:%M} {self.utente}: {self.azione}"


def registra(utente, testo):
    RegistroModifiche.objects.create(
        utente=utente if utente and utente.is_authenticated else None, azione=testo[:300]
    )
