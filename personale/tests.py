from datetime import date
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.contrib.auth.models import Group, User
from django.test import TestCase

from .calendario import festivita, pasqua
from .dati_iniziali import carica_dati_iniziali
from .importazione import Interprete, importa_brogliaccio
from .models import (
    Contatore,
    Grado,
    Impiego,
    Militare,
    Scadenza,
    Spettanza,
    TipoImpiego,
    TipoScadenza,
    situazione_contatore,
)
from .views import situazione_giorno


class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        carica_dati_iniziali()
        cls.grado = Grado.objects.get(sigla="SOL.")
        cls.m1 = Militare.objects.create(grado=cls.grado, cognome="ROSSI", nome="MARIO")
        cls.m2 = Militare.objects.create(grado=cls.grado, cognome="BIANCHI", nome="LUCA")
        cls.admin = User.objects.create_superuser("admin", password="x")
        cls.op = User.objects.create_user("op", password="x")
        cls.op.groups.add(Group.objects.get(name="Operatori"))
        cls.lettore = User.objects.create_user("lett", password="x")
        cls.lettore.groups.add(Group.objects.get(name="Consultazione"))

    def tipo(self, codice):
        return TipoImpiego.objects.get(codice=codice)


class CalendarioTest(TestCase):
    def test_pasqua_e_festivita(self):
        self.assertEqual(pasqua(2026), date(2026, 4, 5))
        self.assertIn(date(2026, 4, 6), festivita(2026))
        self.assertIn(date(2026, 6, 2), festivita(2026))


class InterpreteTest(Base):
    def test_codici(self):
        i = Interprete()
        voci, nota = i.interpreta("LIC ORD IN DATA 12/08/26 INV LIC ORD GG 5")
        self.assertEqual([v.codice for v in voci], ["LIC ORD"])
        self.assertIn("12/08/26", nota)
        voci, _ = i.interpreta("S.I. MALCO.")
        self.assertEqual((voci[0].codice, voci[0].localita), ("S.I.", "MALCONTENTA"))
        voci, _ = i.interpreta("S.S. VENEZIA")
        self.assertEqual((voci[0].codice, voci[0].localita), ("S.S.", "VENEZIA"))
        voci, _ = i.interpreta("RC FEST (LONDRA)")
        self.assertEqual((voci[0].codice, voci[0].localita), ("RC FEST", "LONDRA"))
        voci, _ = i.interpreta("GDG")
        self.assertEqual(voci[0].codice, "Gdg")
        voci, _ = i.interpreta("APRM + PRELIEVI")
        self.assertEqual([v.codice for v in voci], ["APRM", "PRELIEVI"])
        voci, _ = i.interpreta("GUARDIA B (4)")
        self.assertEqual(voci[0].codice, "GUARDIA B (4)")
        voci, nota = i.interpreta("IN DATA 06/08/26 IMMESSO IN T.")
        self.assertEqual(voci[0].codice, "NOTA")
        voci, _ = i.interpreta("EX\nBRAG.")
        self.assertEqual(voci[0].codice, "EX BRAG.")


class ImportazioneTest(Base):
    def test_import(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "BROGLIACCIO"
        ws.append(["NUM", "GRADO", "COGNOME", "NOME ", "POSIZIONE", "PATENTI", "NR. TEL", "AGOSTO", None])
        ws.append([None] * 7 + [30, 31])
        ws.append([1, "MAR.CA.", "VERDI", "ANNA", "OAI", "MOD 2", 333, "LIC ORD", "RC"])
        ws.append(["EXTRA", "SOL.", "ROSSI", "MARIO", "LEONTE", None, None, "LEONTE", "NUOVO COD"])
        ws.cell(row=1, column=10, value="SETTEMBRE")
        ws.cell(row=2, column=10, value=1)
        ws.cell(row=3, column=10, value="Udp")
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        r = importa_brogliaccio(buf, 2026)
        self.assertEqual(r.militari_creati, 1)
        self.assertEqual(r.militari_aggiornati, 1)
        self.assertEqual(r.impieghi, 5)
        self.assertIn("NUOVO COD", r.codici_nuovi)
        verdi = Militare.objects.get(cognome="VERDI")
        self.assertEqual(verdi.grado.sigla, "MAR. CA.")
        self.assertTrue(Impiego.objects.filter(militare=verdi, data=date(2026, 9, 1), tipo__codice="Udp").exists())
        self.assertEqual(Militare.objects.get(cognome="ROSSI").stato, Militare.Stato.EXTRA)


class ContatoriTest(Base):
    def test_residuo(self):
        lic = Contatore.objects.get(nome="Licenza ordinaria")
        Spettanza.objects.create(militare=self.m1, contatore=lic, anno=2026, quantita=Decimal("32"))
        for g in (3, 4, 5):
            Impiego.objects.create(militare=self.m1, data=date(2026, 8, g), tipo=self.tipo("LIC ORD"))
        Impiego.objects.create(militare=self.m1, data=date(2025, 8, 3), tipo=self.tipo("LIC ORD"))
        self.assertEqual(situazione_contatore(self.m1, lic, 2026), (Decimal("32"), Decimal("3"), Decimal("29")))


class SituazioneTest(Base):
    def test_forza(self):
        g = date(2026, 8, 10)
        Impiego.objects.create(militare=self.m1, data=g, tipo=self.tipo("LIC ORD"))
        Impiego.objects.create(militare=self.m2, data=g, tipo=self.tipo("GUARDIA A"))
        s = situazione_giorno(g)
        self.assertEqual(s["forza"], 2)
        self.assertEqual(len(s["presenti"]), 1)
        self.assertEqual(len(s["servizio"]), 1)
        self.assertEqual(s["n_assenti"], 1)

    def test_perso_dalla_forza(self):
        self.m2.data_uscita = date(2026, 8, 5)
        self.m2.save()
        self.assertEqual(situazione_giorno(date(2026, 8, 10))["forza"], 1)
        self.assertEqual(situazione_giorno(date(2026, 8, 5))["forza"], 2)


class ScadenzeTest(Base):
    def test_calcolo_scadenza(self):
        tiri = TipoScadenza.objects.get(nome="Tiri")
        s = Scadenza.objects.create(militare=self.m1, tipo=tiri, data_esecuzione=date(2026, 8, 31))
        self.assertEqual(s.data_scadenza, date(2027, 2, 28))
        self.assertEqual(s.stato(date(2027, 3, 1)), Scadenza.Stato.SCADUTA)
        self.assertEqual(s.stato(date(2027, 2, 10)), Scadenza.Stato.IN_SCADENZA)
        self.assertEqual(s.stato(date(2026, 9, 10)), Scadenza.Stato.VALIDA)


class VisteTest(Base):
    def test_pagine(self):
        self.client.force_login(self.admin)
        for url in ["/", "/ruolino/2026/8/", "/militari/", f"/militari/{self.m1.pk}/", "/licenze/",
                    "/scadenze/", "/configurazione/codici/", "/registro/", "/ruolino/2026/8/excel/"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_login_obbligatorio(self):
        self.assertEqual(self.client.get("/ruolino/").status_code, 302)

    def test_cella_operatore(self):
        self.client.force_login(self.op)
        r = self.client.post("/ruolino/cella/aggiungi/", {
            "militare": self.m1.pk, "data": "2026-08-10", "tipo": self.tipo("S.I.").pk, "localita": "roma",
        })
        self.assertEqual(r.status_code, 200)
        self.assertIn("S.I. ROMA", r.json()["html"])
        r = self.client.post("/ruolino/cella/aggiungi/", {
            "militare": self.m1.pk, "data": "2026-08-10", "tipo": self.tipo("RC").pk, "sostituisci": "1",
        })
        self.assertEqual(list(Impiego.objects.filter(militare=self.m1).values_list("tipo__codice", flat=True)), ["RC"])
        self.client.post("/ruolino/cella/elimina/", {"militare": self.m1.pk, "data": "2026-08-10"})
        self.assertFalse(Impiego.objects.exists())

    def test_lettore_non_modifica(self):
        self.client.force_login(self.lettore)
        r = self.client.post("/ruolino/cella/aggiungi/", {
            "militare": self.m1.pk, "data": "2026-08-10", "tipo": self.tipo("RC").pk,
        })
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get("/ruolino/2026/8/").status_code, 200)

    def test_periodo(self):
        self.client.force_login(self.op)
        r = self.client.post("/ruolino/periodo/", {
            "militari": [self.m1.pk, self.m2.pk], "tipo": self.tipo("LIC ORD").pk,
            "dal": "2026-08-10", "al": "2026-08-16", "escludi_festivi": "on",
        })
        self.assertEqual(r.status_code, 302)
        # 10-14 agosto lun-ven = 5 giorni lavorativi (15 festivo, 16 domenica)
        self.assertEqual(Impiego.objects.filter(militare=self.m1).count(), 5)
        self.assertEqual(Impiego.objects.count(), 10)


class OrarioTest(Base):
    def test_ore_recupero_secondo_orario(self):
        from .models import OrarioLavoro

        ore = Contatore.objects.get(nome="Ore di recupero")
        rc = self.tipo("RC")
        self.assertEqual(rc.contatore, ore)
        self.assertTrue(rc.scala_secondo_orario)
        Spettanza.objects.create(militare=self.m1, contatore=ore, anno=2026, quantita=Decimal("100"))
        # lun 10/8 (8) + ven 14/8 (4) + sab 15/8 festivo (0) + dom 16/8 (0)
        for g in (10, 14, 15, 16):
            Impiego.objects.create(militare=self.m1, data=date(2026, 8, g), tipo=rc)
        # RC FEST su giovedi' 13/8 con ore indicate a mano
        Impiego.objects.create(militare=self.m1, data=date(2026, 8, 13), tipo=self.tipo("RC FEST"), quantita=Decimal("3"))
        self.assertEqual(situazione_contatore(self.m1, ore, 2026), (Decimal("100"), Decimal("15"), Decimal("85")))
        orario = OrarioLavoro.corrente()
        orario.ore_ven = Decimal("6")
        orario.save()
        self.assertEqual(situazione_contatore(self.m1, ore, 2026)[1], Decimal("17"))

    def test_operatore_anagrafica(self):
        self.client.force_login(self.op)
        self.assertEqual(self.client.get(f"/militari/{self.m1.pk}/modifica/").status_code, 200)
        self.assertEqual(self.client.get("/militari/nuovo/").status_code, 200)
        self.assertEqual(self.client.get(f"/militari/{self.m1.pk}/elimina/").status_code, 403)

    def test_pagina_orario(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get("/configurazione/orario/").status_code, 200)
        self.assertEqual(self.client.get("/configurazione/orario/1/").status_code, 200)
        self.assertEqual(self.client.get("/configurazione/orario/nuovo/").status_code, 404)
