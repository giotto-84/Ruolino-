from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib import messages
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.db import transaction
from django.db.models import ProtectedError
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse, reverse_lazy
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DeleteView, ListView, UpdateView

from . import calendario
from .forms import (
    ContatoreForm,
    DetrazioneForm,
    GradoForm,
    ImportaExcelForm,
    MilitareForm,
    PeriodoForm,
    ScadenzaForm,
    SpettanzaForm,
    TipoImpiegoForm,
    TipoScadenzaForm,
)
from .models import (
    Contatore,
    Detrazione,
    Grado,
    Impiego,
    Militare,
    RegistroModifiche,
    Scadenza,
    Spettanza,
    TipoImpiego,
    TipoScadenza,
    registra,
    situazione_contatore,
)


def _data_da_richiesta(request, nome="data"):
    return parse_date(request.GET.get(nome) or "") or date.today()


# ---------------------------------------------------------------------------
# Situazione giornaliera della forza
# ---------------------------------------------------------------------------
def situazione_giorno(giorno):
    militari = list(Militare.in_forza(giorno))
    impieghi = defaultdict(list)
    for imp in Impiego.objects.filter(data=giorno).select_related("tipo"):
        impieghi[imp.militare_id].append(imp)

    presenti, servizio, assenti, fuori = [], [], defaultdict(list), defaultdict(list)
    for m in militari:
        lista = [i for i in impieghi.get(m.id, []) if i.tipo.codice != "NOTA"]
        assenza = next((i for i in lista if not i.tipo.presente_in_sede), None)
        if assenza is None:
            presenti.append((m, lista))
            if any(i.tipo.categoria == TipoImpiego.Categoria.SERVIZIO for i in lista):
                servizio.append((m, lista))
        elif assenza.tipo.categoria == TipoImpiego.Categoria.FUORI_SEDE:
            fuori[assenza.tipo.codice].append((m, assenza))
        else:
            assenti[assenza.tipo.codice].append((m, assenza))
    return {
        "giorno": giorno,
        "forza": len(militari),
        "presenti": presenti,
        "servizio": servizio,
        "assenti": sorted(assenti.items()),
        "fuori": sorted(fuori.items()),
        "n_assenti": sum(len(v) for v in assenti.values()),
        "n_fuori": sum(len(v) for v in fuori.values()),
    }


def _stato_scadenze(oggi=None):
    """Ultima scadenza per militare/tipo + scadenze obbligatorie mancanti."""
    oggi = oggi or date.today()
    ultime = {}
    for s in Scadenza.objects.select_related("tipo", "militare", "militare__grado").order_by(
        "data_scadenza", "data_esecuzione"
    ):
        ultime[(s.militare_id, s.tipo_id)] = s
    militari = list(Militare.in_forza(oggi))
    tipi = list(TipoScadenza.objects.all())
    mancanti = [
        (m, t)
        for t in tipi
        if t.obbligatoria
        for m in militari
        if (m.id, t.id) not in ultime
    ]
    ids_forza = {m.id for m in militari}
    scadute = [
        s for s in ultime.values() if s.militare_id in ids_forza and s.stato(oggi) == Scadenza.Stato.SCADUTA
    ]
    in_scadenza = [
        s
        for s in ultime.values()
        if s.militare_id in ids_forza and s.stato(oggi) == Scadenza.Stato.IN_SCADENZA
    ]
    return ultime, militari, tipi, scadute, in_scadenza, mancanti


@login_required
def home(request):
    giorno = _data_da_richiesta(request)
    contesto = situazione_giorno(giorno)
    _, _, _, scadute, in_scadenza, mancanti = _stato_scadenze()
    contesto.update(
        {
            "scadute": sorted(scadute, key=lambda s: s.data_scadenza),
            "in_scadenza": sorted(in_scadenza, key=lambda s: s.data_scadenza),
            "n_mancanti": len(mancanti),
            "ieri": giorno - timedelta(days=1),
            "domani": giorno + timedelta(days=1),
        }
    )
    return render(request, "personale/home.html", contesto)


# ---------------------------------------------------------------------------
# Ruolino mensile (griglia militari x giorni)
# ---------------------------------------------------------------------------
def dati_cella(militare, giorno, impieghi, in_forza=True):
    reali = [i for i in impieghi if i.tipo.codice != "NOTA"] or impieghi
    principale = reali[0].tipo if reali else None
    note = [i.note for i in impieghi if i.note]
    titolo = "\n".join(
        [f"{i.tipo.codice} {i.localita} - {i.tipo.descrizione}".strip(" -") for i in reali if i.tipo.codice != "NOTA"]
        + note
    )
    return {
        "militare_id": militare.id,
        "data": giorno,
        "testo": " + ".join(i.etichetta for i in reali if i.tipo.codice != "NOTA"),
        "sfondo": principale.colore_sfondo if principale else "",
        "colore": principale.colore_testo if principale else "",
        "ha_note": bool(note),
        "titolo": titolo,
        "fuori_forza": not in_forza,
    }


def html_cella(militare, giorno):
    impieghi = list(
        Impiego.objects.filter(militare=militare, data=giorno).select_related("tipo").order_by("tipo__ordine")
    )
    return render_to_string(
        "personale/_cella.html", {"c": dati_cella(militare, giorno, impieghi, militare.in_forza_il(giorno))}
    )


def _filtro_stato(request):
    filtro = request.GET.get("stato", "tutti")
    return filtro if filtro in ("tutti", "EFF", "EXT") else "tutti"


@login_required
@permission_required("personale.view_impiego", raise_exception=True)
def ruolino(request, anno=None, mese=None):
    oggi = date.today()
    anno, mese = anno or oggi.year, mese or oggi.month
    if not 1 <= mese <= 12:
        raise Http404
    giorni = calendario.giorni_del_mese(anno, mese)
    inizio, fine = giorni[0]["data"], giorni[-1]["data"]
    filtro = _filtro_stato(request)
    militari = list(Militare.in_forza(inizio, fine))
    if filtro != "tutti":
        militari = [m for m in militari if m.stato == filtro]

    impieghi = defaultdict(list)
    for imp in (
        Impiego.objects.filter(data__range=(inizio, fine), militare__in=militari)
        .select_related("tipo")
        .order_by("tipo__ordine")
    ):
        impieghi[(imp.militare_id, imp.data)].append(imp)

    righe = []
    presenti = [0] * len(giorni)
    for m in militari:
        celle = []
        for i, g in enumerate(giorni):
            lista = impieghi.get((m.id, g["data"]), [])
            in_forza = m.in_forza_il(g["data"])
            c = dati_cella(m, g["data"], lista, in_forza)
            c["festivo"] = g["festivo"]
            celle.append(c)
            if in_forza and all(x.tipo.presente_in_sede for x in lista):
                presenti[i] += 1
        righe.append({"militare": m, "celle": celle})

    precedente = calendario.mese_precedente(anno, mese)
    successivo = calendario.mese_successivo(anno, mese)
    return render(
        request,
        "personale/ruolino.html",
        {
            "anno": anno,
            "mese": mese,
            "nome_mese": calendario.MESI[mese],
            "giorni": giorni,
            "righe": righe,
            "presenti": presenti,
            "precedente": precedente,
            "successivo": successivo,
            "filtro": filtro,
            "tipi": TipoImpiego.objects.filter(attivo=True),
            "oggi": oggi,
            "puo_modificare": request.user.has_perm("personale.change_impiego"),
        },
    )


@login_required
@permission_required("personale.view_impiego", raise_exception=True)
def cella_dettaglio(request):
    militare = get_object_or_404(Militare, pk=request.GET.get("militare"))
    giorno = parse_date(request.GET.get("data") or "")
    if not giorno:
        raise Http404
    impieghi = Impiego.objects.filter(militare=militare, data=giorno).select_related("tipo")
    return JsonResponse(
        {
            "militare": str(militare),
            "data": giorno.strftime("%d/%m/%Y"),
            "impieghi": [
                {
                    "id": i.id,
                    "codice": i.tipo.codice,
                    "descrizione": i.tipo.descrizione,
                    "localita": i.localita,
                    "quantita": str(i.quantita) if i.quantita is not None else "",
                    "note": i.note,
                    "modificato": (
                        f"{i.modificato_da or '-'} il {i.modificato_il:%d/%m/%Y %H:%M}"
                        if i.modificato_il
                        else ""
                    ),
                }
                for i in impieghi
            ],
        }
    )


def _decimale(valore):
    try:
        return Decimal(str(valore).replace(",", ".")) if str(valore).strip() else None
    except Exception:
        return None


@login_required
@permission_required("personale.change_impiego", raise_exception=True)
@require_POST
def cella_aggiungi(request):
    militare = get_object_or_404(Militare, pk=request.POST.get("militare"))
    giorno = parse_date(request.POST.get("data") or "")
    tipo = get_object_or_404(TipoImpiego, pk=request.POST.get("tipo"))
    if not giorno:
        return JsonResponse({"errore": "Data non valida"}, status=400)
    if request.POST.get("sostituisci") == "1":
        Impiego.objects.filter(militare=militare, data=giorno).exclude(tipo=tipo).delete()
    imp, creato = Impiego.objects.get_or_create(militare=militare, data=giorno, tipo=tipo)
    if "localita" in request.POST:
        imp.localita = request.POST.get("localita", "").strip().upper()[:80]
    if "note" in request.POST:
        imp.note = request.POST.get("note", "").strip()
    if "quantita" in request.POST:
        imp.quantita = _decimale(request.POST.get("quantita"))
    imp.modificato_da = request.user
    imp.save()
    registra(request.user, f"{giorno:%d/%m/%Y} {militare}: {'inserito' if creato else 'modificato'} {imp.etichetta}")
    return JsonResponse({"html": html_cella(militare, giorno)})


@login_required
@permission_required("personale.delete_impiego", raise_exception=True)
@require_POST
def cella_elimina(request):
    militare = get_object_or_404(Militare, pk=request.POST.get("militare"))
    giorno = parse_date(request.POST.get("data") or "")
    if not giorno:
        return JsonResponse({"errore": "Data non valida"}, status=400)
    qs = Impiego.objects.filter(militare=militare, data=giorno)
    if request.POST.get("id"):
        qs = qs.filter(pk=request.POST["id"])
    etichette = ", ".join(i.etichetta for i in qs.select_related("tipo"))
    if etichette:
        qs.delete()
        registra(request.user, f"{giorno:%d/%m/%Y} {militare}: cancellato {etichette}")
    return JsonResponse({"html": html_cella(militare, giorno)})


@login_required
@permission_required("personale.change_impiego", raise_exception=True)
def inserimento_periodo(request):
    iniziale = {}
    if request.GET.get("militare"):
        iniziale["militari"] = [request.GET["militare"]]
    form = PeriodoForm(request.POST or None, initial=iniziale)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        feste = set()
        for anno in range(d["dal"].year, d["al"].year + 1):
            feste |= calendario.festivita(anno)
        conteggio = 0
        with transaction.atomic():
            giorno = d["dal"]
            while giorno <= d["al"]:
                festivo = giorno.weekday() >= 5 or giorno in feste
                if not (d["escludi_festivi"] and festivo):
                    for m in d["militari"]:
                        if not m.in_forza_il(giorno):
                            continue
                        if d["sostituisci"]:
                            Impiego.objects.filter(militare=m, data=giorno).exclude(tipo=d["tipo"]).delete()
                        Impiego.objects.update_or_create(
                            militare=m,
                            data=giorno,
                            tipo=d["tipo"],
                            defaults={
                                "localita": d["localita"].strip().upper(),
                                "note": d["note"],
                                "modificato_da": request.user,
                            },
                        )
                        conteggio += 1
                giorno += timedelta(days=1)
        nomi = ", ".join(m.cognome for m in d["militari"])
        registra(
            request.user,
            f"Periodo {d['dal']:%d/%m/%Y}-{d['al']:%d/%m/%Y} {d['tipo']} a {nomi} ({conteggio} giorni)",
        )
        messages.success(request, f"Inseriti {conteggio} giorni di {d['tipo']}.")
        return redirect("ruolino_mese", anno=d["dal"].year, mese=d["dal"].month)
    return render(
        request,
        "personale/form.html",
        {
            "form": form,
            "titolo": "Inserimento per periodo",
            "spiegazione": "Assegna lo stesso codice a uno o piu' militari per piu' giorni consecutivi "
            "(es. licenza ordinaria dal 10 al 20).",
        },
    )


@login_required
@permission_required("personale.view_impiego", raise_exception=True)
def esporta_ruolino(request, anno, mese):
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    giorni = calendario.giorni_del_mese(anno, mese)
    inizio, fine = giorni[0]["data"], giorni[-1]["data"]
    militari = list(Militare.in_forza(inizio, fine))
    impieghi = defaultdict(list)
    for imp in Impiego.objects.filter(data__range=(inizio, fine)).select_related("tipo").order_by("tipo__ordine"):
        impieghi[(imp.militare_id, imp.data)].append(imp)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{calendario.MESI[mese]} {anno}"[:31]
    sottile = Side(style="thin", color="999999")
    bordo = Border(left=sottile, right=sottile, top=sottile, bottom=sottile)
    grassetto = Font(bold=True)
    grigio = PatternFill("solid", fgColor="D9D9D9")
    intest = ["N.", "GRADO", "COGNOME", "NOME", "INCARICO"]
    ws.append(intest + [f"{g['sett']}\n{g['giorno']}" for g in giorni])
    for c in ws[1]:
        c.font, c.border = grassetto, bordo
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for i, g in enumerate(giorni):
        if g["festivo"]:
            ws.cell(row=1, column=len(intest) + 1 + i).fill = grigio

    for n, m in enumerate(militari, start=1):
        riga = [n if m.stato == Militare.Stato.EFFETTIVO else "EXTRA", m.grado.sigla, m.cognome, m.nome, m.incarico]
        ws.append(riga)
        r = ws.max_row
        for i, g in enumerate(giorni):
            cella = ws.cell(row=r, column=len(intest) + 1 + i)
            lista = impieghi.get((m.id, g["data"]), [])
            reali = [x for x in lista if x.tipo.codice != "NOTA"]
            cella.value = " + ".join(x.etichetta for x in reali) or None
            cella.border = bordo
            cella.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cella.font = Font(size=8, color=(reali[0].tipo.colore_testo.lstrip("#") if reali else "000000"))
            if reali:
                cella.fill = PatternFill("solid", fgColor=reali[0].tipo.colore_sfondo.lstrip("#"))
            elif g["festivo"]:
                cella.fill = grigio
            note = [x.note for x in lista if x.note]
            if note:
                from openpyxl.comments import Comment

                cella.comment = Comment("\n".join(note)[:2000], "Ruolino")
        for col in range(1, len(intest) + 1):
            ws.cell(row=r, column=col).border = bordo

    larghezze = [6, 12, 18, 16, 22]
    for i, w in enumerate(larghezze, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for i in range(len(giorni)):
        ws.column_dimensions[get_column_letter(len(intest) + 1 + i)].width = 9
    ws.freeze_panes = "F2"

    # Legenda
    leg = wb.create_sheet("Legenda")
    leg.append(["Codice", "Descrizione", "Categoria"])
    for t in TipoImpiego.objects.filter(attivo=True):
        leg.append([t.codice, t.descrizione, t.get_categoria_display()])
        leg.cell(row=leg.max_row, column=1).fill = PatternFill("solid", fgColor=t.colore_sfondo.lstrip("#"))
        leg.cell(row=leg.max_row, column=1).font = Font(color=t.colore_testo.lstrip("#"), bold=True)
    leg.column_dimensions["A"].width = 20
    leg.column_dimensions["B"].width = 45
    leg.column_dimensions["C"].width = 50

    buffer = BytesIO()
    wb.save(buffer)
    risposta = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    risposta["Content-Disposition"] = f'attachment; filename="ruolino_{anno}_{mese:02d}.xlsx"'
    return risposta


# ---------------------------------------------------------------------------
# Anagrafica
# ---------------------------------------------------------------------------
@login_required
@permission_required("personale.view_militare", raise_exception=True)
def militari_elenco(request):
    mostra_persi = request.GET.get("persi") == "1"
    qs = Militare.objects.select_related("grado")
    if not mostra_persi:
        qs = qs.exclude(stato=Militare.Stato.PERSO)
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(cognome__icontains=q) | qs.filter(nome__icontains=q) | qs.filter(incarico__icontains=q)
    return render(
        request,
        "personale/militari.html",
        {"militari": qs, "q": q, "mostra_persi": mostra_persi},
    )


@login_required
@permission_required("personale.view_militare", raise_exception=True)
def militare_dettaglio(request, pk):
    m = get_object_or_404(Militare.objects.select_related("grado"), pk=pk)
    anno = int(request.GET.get("anno") or date.today().year)
    contatori = []
    for c in Contatore.objects.filter(attivo=True):
        spett, goduto, residuo = situazione_contatore(m, c, anno)
        contatori.append({"contatore": c, "spettante": spett, "goduto": goduto, "residuo": residuo})
    oggi = date.today()
    ultime = {}
    for s in m.scadenze.select_related("tipo").order_by("data_scadenza"):
        ultime[s.tipo_id] = s
    impieghi_recenti = (
        m.impieghi.filter(data__gte=oggi - timedelta(days=30), data__lte=oggi + timedelta(days=60))
        .select_related("tipo")
        .order_by("data")
    )
    return render(
        request,
        "personale/militare_dettaglio.html",
        {
            "m": m,
            "anno": anno,
            "contatori": contatori,
            "scadenze": m.scadenze.select_related("tipo").order_by("tipo__ordine", "-data_scadenza"),
            "ultime_ids": {s.id for s in ultime.values()},
            "impieghi": impieghi_recenti,
            "spettanze": m.spettanze.select_related("contatore"),
            "detrazioni": m.detrazioni.select_related("contatore")[:50],
        },
    )


class BaseCrea(LoginRequiredMixin, PermissionRequiredMixin, CreateView):
    template_name = "personale/form.html"
    titolo = ""
    raise_exception = True

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["titolo"] = self.titolo
        return ctx

    def form_valid(self, form):
        risposta = super().form_valid(form)
        registra(self.request.user, f"{self.titolo}: {self.object}")
        messages.success(self.request, "Salvato.")
        return risposta


class BaseModifica(LoginRequiredMixin, PermissionRequiredMixin, UpdateView):
    template_name = "personale/form.html"
    titolo = ""
    raise_exception = True
    url_elimina = None

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["titolo"] = self.titolo
        if self.url_elimina and self.request.user.has_perm(
            f"personale.delete_{self.model._meta.model_name}"
        ):
            ctx["url_elimina"] = reverse(self.url_elimina, args=[self.object.pk])
        return ctx

    def form_valid(self, form):
        risposta = super().form_valid(form)
        registra(self.request.user, f"{self.titolo}: {self.object}")
        messages.success(self.request, "Modifiche salvate.")
        return risposta


class BaseElimina(LoginRequiredMixin, PermissionRequiredMixin, DeleteView):
    template_name = "personale/conferma_elimina.html"
    raise_exception = True

    def form_valid(self, form):
        descrizione = str(self.object)
        try:
            risposta = super().form_valid(form)
        except ProtectedError:
            messages.error(
                self.request,
                "Impossibile eliminare: l'elemento e' ancora usato. Disattivarlo invece di eliminarlo.",
            )
            return redirect(self.get_success_url())
        registra(self.request.user, f"Eliminato {self.model._meta.verbose_name}: {descrizione}")
        messages.success(self.request, "Eliminato.")
        return risposta


class MilitareCrea(BaseCrea):
    model, form_class, titolo = Militare, MilitareForm, "Nuovo militare"
    permission_required = "personale.add_militare"

    def get_success_url(self):
        return reverse("militare", args=[self.object.pk])


class MilitareModifica(BaseModifica):
    model, form_class, titolo = Militare, MilitareForm, "Modifica militare"
    permission_required = "personale.change_militare"
    url_elimina = "militare_elimina"

    def get_success_url(self):
        return reverse("militare", args=[self.object.pk])


class MilitareElimina(BaseElimina):
    model = Militare
    permission_required = "personale.delete_militare"
    success_url = reverse_lazy("militari")


# ---------------------------------------------------------------------------
# Licenze e recuperi
# ---------------------------------------------------------------------------
@login_required
@permission_required("personale.view_spettanza", raise_exception=True)
def licenze(request):
    anno = int(request.GET.get("anno") or date.today().year)
    contatori = list(Contatore.objects.filter(attivo=True))
    militari = list(Militare.in_forza(date(anno, 1, 1), date(anno, 12, 31)))
    spettanze = {
        (s.militare_id, s.contatore_id): s.quantita
        for s in Spettanza.objects.filter(anno=anno)
    }
    goduto = defaultdict(Decimal)
    for imp in Impiego.objects.filter(data__year=anno, tipo__contatore__isnull=False).select_related("tipo"):
        goduto[(imp.militare_id, imp.tipo.contatore_id)] += imp.quantita_effettiva
    for d in Detrazione.objects.filter(anno=anno):
        goduto[(d.militare_id, d.contatore_id)] += d.quantita
    righe = []
    for m in militari:
        valori = []
        for c in contatori:
            sp = spettanze.get((m.id, c.id))
            go = goduto.get((m.id, c.id), Decimal("0"))
            valori.append(
                {
                    "spettante": sp,
                    "goduto": go,
                    "residuo": (sp or Decimal("0")) - go,
                    "contatore": c,
                }
            )
        righe.append({"militare": m, "valori": valori})
    return render(
        request,
        "personale/licenze.html",
        {"anno": anno, "contatori": contatori, "righe": righe},
    )


class SpettanzaCrea(BaseCrea):
    model, form_class, titolo = Spettanza, SpettanzaForm, "Nuova spettanza (licenze / recuperi)"
    permission_required = "personale.add_spettanza"

    def get_initial(self):
        return {
            "militare": self.request.GET.get("militare"),
            "contatore": self.request.GET.get("contatore"),
            "anno": self.request.GET.get("anno") or date.today().year,
        }

    def get(self, request, *args, **kwargs):
        # se esiste gia' la spettanza per militare/contatore/anno, apre la modifica
        esistente = Spettanza.objects.filter(
            militare=request.GET.get("militare") or 0,
            contatore=request.GET.get("contatore") or 0,
            anno=request.GET.get("anno") or 0,
        ).first()
        if esistente:
            return redirect("spettanza_modifica", pk=esistente.pk)
        return super().get(request, *args, **kwargs)

    def get_success_url(self):
        return f"{reverse('licenze')}?anno={self.object.anno}"


class SpettanzaModifica(BaseModifica):
    model, form_class, titolo = Spettanza, SpettanzaForm, "Modifica spettanza"
    permission_required = "personale.change_spettanza"
    url_elimina = "spettanza_elimina"

    def get_success_url(self):
        return f"{reverse('licenze')}?anno={self.object.anno}"


class SpettanzaElimina(BaseElimina):
    model = Spettanza
    permission_required = "personale.delete_spettanza"
    success_url = reverse_lazy("licenze")


class DetrazioneCrea(BaseCrea):
    model, form_class, titolo = Detrazione, DetrazioneForm, "Movimento manuale su licenze / ore"
    permission_required = "personale.add_detrazione"

    def get_initial(self):
        return {
            "militare": self.request.GET.get("militare"),
            "contatore": self.request.GET.get("contatore"),
            "anno": self.request.GET.get("anno") or date.today().year,
        }

    def get_success_url(self):
        return reverse("militare", args=[self.object.militare_id])


class DetrazioneElimina(BaseElimina):
    model = Detrazione
    permission_required = "personale.delete_detrazione"

    def get_success_url(self):
        return reverse("militare", args=[self.object.militare_id])


# ---------------------------------------------------------------------------
# Scadenze
# ---------------------------------------------------------------------------
@login_required
@permission_required("personale.view_scadenza", raise_exception=True)
def scadenze(request):
    oggi = date.today()
    ultime, militari, tipi, scadute, in_scadenza, mancanti = _stato_scadenze(oggi)
    righe = []
    for m in militari:
        celle = []
        for t in tipi:
            s = ultime.get((m.id, t.id))
            stato = s.stato(oggi) if s else ("mancante" if t.obbligatoria else "")
            celle.append({"s": s, "stato": stato, "tipo": t})
        righe.append({"militare": m, "celle": celle})
    return render(
        request,
        "personale/scadenze.html",
        {
            "tipi": tipi,
            "righe": righe,
            "scadute": sorted(scadute, key=lambda s: s.data_scadenza),
            "in_scadenza": sorted(in_scadenza, key=lambda s: s.data_scadenza),
            "mancanti": mancanti,
        },
    )


class ScadenzaCrea(BaseCrea):
    model, form_class, titolo = Scadenza, ScadenzaForm, "Registra scadenza"
    permission_required = "personale.add_scadenza"

    def get_initial(self):
        return {
            "militare": self.request.GET.get("militare"),
            "tipo": self.request.GET.get("tipo"),
            "data_esecuzione": date.today(),
        }

    def get_success_url(self):
        return self.request.GET.get("torna") or reverse("scadenze")


class ScadenzaModifica(BaseModifica):
    model, form_class, titolo = Scadenza, ScadenzaForm, "Modifica scadenza"
    permission_required = "personale.change_scadenza"
    url_elimina = "scadenza_elimina"
    success_url = reverse_lazy("scadenze")


class ScadenzaElimina(BaseElimina):
    model = Scadenza
    permission_required = "personale.delete_scadenza"
    success_url = reverse_lazy("scadenze")


# ---------------------------------------------------------------------------
# Configurazione (codici, colori, tipi scadenza, contatori, gradi)
# ---------------------------------------------------------------------------
CONFIG = {
    "codici": (TipoImpiego, TipoImpiegoForm, "Codici di impiego e colori"),
    "scadenze": (TipoScadenza, TipoScadenzaForm, "Tipi di scadenza"),
    "contatori": (Contatore, ContatoreForm, "Contatori licenze / recuperi"),
    "gradi": (Grado, GradoForm, "Gradi"),
}


def _config(sezione):
    if sezione not in CONFIG:
        raise Http404
    return CONFIG[sezione]


@login_required
def configurazione(request, sezione="codici"):
    modello, _, titolo = _config(sezione)
    if not request.user.has_perm(f"personale.view_{modello._meta.model_name}"):
        raise Http404
    return render(
        request,
        "personale/configurazione.html",
        {
            "sezione": sezione,
            "titolo": titolo,
            "oggetti": modello.objects.all(),
            "sezioni": [(k, v[2]) for k, v in CONFIG.items()],
            "puo_modificare": request.user.has_perm(f"personale.change_{modello._meta.model_name}"),
        },
    )


@login_required
def configurazione_modifica(request, sezione, pk=None):
    modello, form_class, titolo = _config(sezione)
    nome = modello._meta.model_name
    oggetto = get_object_or_404(modello, pk=pk) if pk else None
    permesso = f"personale.{'change' if oggetto else 'add'}_{nome}"
    if not request.user.has_perm(permesso):
        messages.error(request, "Non hai i permessi per questa operazione.")
        return redirect("configurazione", sezione=sezione)
    form = form_class(request.POST or None, instance=oggetto)
    if request.method == "POST":
        if "elimina" in request.POST and oggetto:
            if not request.user.has_perm(f"personale.delete_{nome}"):
                messages.error(request, "Non hai i permessi per eliminare.")
            else:
                try:
                    oggetto.delete()
                    registra(request.user, f"Eliminato {modello._meta.verbose_name}: {oggetto}")
                    messages.success(request, "Eliminato.")
                except ProtectedError:
                    messages.error(
                        request,
                        "Non si puo' eliminare perche' e' gia' usato: disattivalo o rinominalo.",
                    )
            return redirect("configurazione", sezione=sezione)
        if form.is_valid():
            obj = form.save()
            registra(request.user, f"{titolo}: salvato {obj}")
            messages.success(request, "Salvato.")
            return redirect("configurazione", sezione=sezione)
    return render(
        request,
        "personale/form.html",
        {
            "form": form,
            "titolo": f"{titolo} - {'modifica' if oggetto else 'nuovo'}",
            "elimina_inline": oggetto is not None and request.user.has_perm(f"personale.delete_{nome}"),
            "annulla": reverse("configurazione", args=[sezione]),
        },
    )


# ---------------------------------------------------------------------------
# Importazione Excel e registro
# ---------------------------------------------------------------------------
@login_required
@permission_required("personale.add_militare", raise_exception=True)
def importa_excel(request):
    from .importazione import importa_brogliaccio

    form = ImportaExcelForm(request.POST or None, request.FILES or None, initial={"anno": date.today().year})
    rapporto = None
    if request.method == "POST" and form.is_valid():
        try:
            r = importa_brogliaccio(form.cleaned_data["file"], form.cleaned_data["anno"], form.cleaned_data["foglio"])
            rapporto = r.righe()
            registra(request.user, f"Importato brogliaccio Excel anno {form.cleaned_data['anno']}")
            messages.success(request, "Importazione completata.")
        except Exception as e:  # file non valido, foglio mancante...
            messages.error(request, f"Importazione non riuscita: {e}")
    return render(request, "personale/importa.html", {"form": form, "rapporto": rapporto})


@login_required
@permission_required("personale.view_registromodifiche", raise_exception=True)
def registro(request):
    return render(
        request,
        "personale/registro.html",
        {"voci": RegistroModifiche.objects.select_related("utente")[:500]},
    )
