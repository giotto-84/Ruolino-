from datetime import timedelta

from django import forms

from .models import (
    Contatore,
    Detrazione,
    Grado,
    Militare,
    Scadenza,
    Spettanza,
    TipoImpiego,
    TipoScadenza,
)


class DataInput(forms.DateInput):
    input_type = "date"

    def __init__(self, **kwargs):
        super().__init__(format="%Y-%m-%d", **kwargs)


class ColoreInput(forms.TextInput):
    input_type = "color"


class MilitareForm(forms.ModelForm):
    class Meta:
        model = Militare
        fields = [
            "grado", "cognome", "nome", "incarico", "patenti", "telefono",
            "stato", "data_ingresso", "data_uscita", "ordine", "note",
        ]
        widgets = {
            "data_ingresso": DataInput(),
            "data_uscita": DataInput(),
            "note": forms.Textarea(attrs={"rows": 3}),
        }


class GradoForm(forms.ModelForm):
    class Meta:
        model = Grado
        fields = ["sigla", "descrizione", "ordine"]


class TipoImpiegoForm(forms.ModelForm):
    class Meta:
        model = TipoImpiego
        fields = [
            "codice", "descrizione", "categoria", "colore_sfondo", "colore_testo",
            "presente_in_sede", "contatore", "quantita_per_giorno", "ordine", "attivo",
        ]
        widgets = {"colore_sfondo": ColoreInput(), "colore_testo": ColoreInput()}


class ContatoreForm(forms.ModelForm):
    class Meta:
        model = Contatore
        fields = ["nome", "unita", "ordine", "attivo"]


class TipoScadenzaForm(forms.ModelForm):
    class Meta:
        model = TipoScadenza
        fields = ["nome", "validita_mesi", "preavviso_giorni", "obbligatoria", "descrizione", "ordine"]


class ScadenzaForm(forms.ModelForm):
    class Meta:
        model = Scadenza
        fields = ["militare", "tipo", "data_esecuzione", "data_scadenza", "esito", "note"]
        widgets = {"data_esecuzione": DataInput(), "data_scadenza": DataInput()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["militare"].queryset = Militare.objects.exclude(stato=Militare.Stato.PERSO)


class SpettanzaForm(forms.ModelForm):
    class Meta:
        model = Spettanza
        fields = ["militare", "contatore", "anno", "quantita", "note"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["militare"].queryset = Militare.objects.exclude(stato=Militare.Stato.PERSO)
        self.fields["contatore"].queryset = Contatore.objects.filter(attivo=True)


class DetrazioneForm(forms.ModelForm):
    class Meta:
        model = Detrazione
        fields = ["militare", "contatore", "anno", "data", "quantita", "note"]
        widgets = {"data": DataInput()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["militare"].queryset = Militare.objects.exclude(stato=Militare.Stato.PERSO)
        self.fields["contatore"].queryset = Contatore.objects.filter(attivo=True)


class PeriodoForm(forms.Form):
    """Inserimento dello stesso codice su piu' giorni (es. 10 giorni di LIC ORD)."""

    militari = forms.ModelMultipleChoiceField(
        queryset=Militare.objects.none(),
        widget=forms.SelectMultiple(attrs={"size": 12}),
        help_text="Tenere premuto CTRL per selezionarne piu' di uno.",
    )
    tipo = forms.ModelChoiceField(queryset=TipoImpiego.objects.filter(attivo=True), label="codice")
    localita = forms.CharField(label="localita'", required=False, max_length=80)
    dal = forms.DateField(widget=DataInput())
    al = forms.DateField(widget=DataInput())
    escludi_festivi = forms.BooleanField(
        label="escludi sabati, domeniche e festivi", required=False
    )
    sostituisci = forms.BooleanField(
        label="sostituisci i codici gia' presenti in quei giorni", required=False
    )
    note = forms.CharField(widget=forms.Textarea(attrs={"rows": 2}), required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["militari"].queryset = Militare.objects.exclude(
            stato=Militare.Stato.PERSO
        ).select_related("grado")

    def clean(self):
        dati = super().clean()
        dal, al = dati.get("dal"), dati.get("al")
        if dal and al:
            if al < dal:
                raise forms.ValidationError("La data finale e' precedente a quella iniziale.")
            if al - dal > timedelta(days=366):
                raise forms.ValidationError("Periodo troppo lungo (massimo un anno).")
        return dati


class ImportaExcelForm(forms.Form):
    file = forms.FileField(label="file Excel (.xlsx)")
    anno = forms.IntegerField(label="anno del brogliaccio", min_value=2000, max_value=2100)
    foglio = forms.CharField(label="nome del foglio", initial="BROGLIACCIO")
