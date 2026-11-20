// Ruolino mensile: inserimento rapido ("pennello") e dettaglio della casella.
(function () {
  const griglia = document.getElementById("griglia");
  if (!griglia) return;
  const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;
  const dlg = document.getElementById("dlg");
  const pnTipo = document.getElementById("pn-tipo");
  const pnLoc = document.getElementById("pn-loc");
  const pnSost = document.getElementById("pn-sost");
  let cellaAperta = null;
  let dipingendo = false;

  function invia(url, dati) {
    const body = new FormData();
    Object.entries(dati).forEach(([k, v]) => body.append(k, v));
    return fetch(url, { method: "POST", body, headers: { "X-CSRFToken": csrf } }).then((r) => {
      if (!r.ok) throw new Error(r.status === 403 ? "Permesso negato" : "Errore " + r.status);
      return r.json();
    });
  }

  function sostituisciCella(td, html) {
    const tmp = document.createElement("tbody");
    tmp.innerHTML = "<tr>" + html + "</tr>";
    const nuova = tmp.querySelector("td");
    if (td.classList.contains("festivo")) nuova.classList.add("festivo");
    td.replaceWith(nuova);
    return nuova;
  }

  function cercaCella(m, d) {
    return griglia.querySelector(`td.cella[data-m="${m}"][data-d="${d}"]`);
  }

  // ----- Pennello -----
  function applicaPennello(td) {
    if (!pnTipo || !pnTipo.value || td.dataset.inCorso) return;
    td.dataset.inCorso = "1";
    td.style.opacity = "0.5";
    const base = { militare: td.dataset.m, data: td.dataset.d };
    const richiesta =
      pnTipo.value === "cancella"
        ? invia(URL_ELIMINA, base)
        : invia(URL_AGGIUNGI, Object.assign(base, {
            tipo: pnTipo.value,
            localita: pnLoc.value,
            sostituisci: pnSost.checked ? "1" : "0",
          }));
    richiesta
      .then((j) => sostituisciCella(td, j.html))
      .catch((e) => { td.style.opacity = ""; delete td.dataset.inCorso; alert(e.message); });
  }

  griglia.addEventListener("mousedown", (ev) => {
    const td = ev.target.closest("td.cella");
    if (!td || !pnTipo || !pnTipo.value) return;
    ev.preventDefault();
    dipingendo = true;
    applicaPennello(td);
  });
  griglia.addEventListener("mouseover", (ev) => {
    if (!dipingendo) return;
    const td = ev.target.closest("td.cella");
    if (td) applicaPennello(td);
  });
  document.addEventListener("mouseup", () => (dipingendo = false));

  // ----- Dettaglio casella -----
  function apriDettaglio(td) {
    cellaAperta = td;
    const url = `${URL_DETTAGLIO}?militare=${td.dataset.m}&data=${td.dataset.d}`;
    fetch(url).then((r) => r.json()).then((j) => {
      document.getElementById("dlg-titolo").textContent = `${j.militare} - ${j.data}`;
      const tab = document.getElementById("dlg-elenco");
      tab.innerHTML = "";
      if (!j.impieghi.length) tab.innerHTML = "<tr><td class='vuoto'>Nessun codice inserito.</td></tr>";
      j.impieghi.forEach((i) => {
        const tr = document.createElement("tr");
        const cel = (t) => { const c = document.createElement("td"); c.textContent = t; tr.appendChild(c); return c; };
        cel(i.codice + (i.localita ? " " + i.localita : ""));
        cel(i.quantita);
        cel(i.note);
        const info = cel(i.modificato); info.className = "piccolo";
        if (PUO_MODIFICARE) {
          const c = document.createElement("td");
          const b = document.createElement("button");
          b.textContent = "elimina"; b.className = "link pericolo";
          b.onclick = () => invia(URL_ELIMINA, { militare: td.dataset.m, data: td.dataset.d, id: i.id })
            .then((r) => { cellaAperta = sostituisciCella(cellaAperta, r.html); apriDettaglio(cellaAperta); });
          c.appendChild(b); tr.appendChild(c);
        }
        tab.appendChild(tr);
      });
      if (!dlg.open) dlg.showModal();
    });
  }

  griglia.addEventListener("click", (ev) => {
    const td = ev.target.closest("td.cella");
    if (!td || (pnTipo && pnTipo.value)) return;
    apriDettaglio(td);
  });

  const form = document.getElementById("dlg-form");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const dati = { militare: cellaAperta.dataset.m, data: cellaAperta.dataset.d };
      fd.forEach((v, k) => (dati[k] = v));
      invia(URL_AGGIUNGI, dati).then((r) => {
        cellaAperta = sostituisciCella(cellaAperta, r.html);
        form.reset();
        apriDettaglio(cellaAperta);
      }).catch((e) => alert(e.message));
    });
    document.getElementById("dlg-svuota").onclick = () => {
      if (!confirm("Cancellare tutti i codici di questa casella?")) return;
      invia(URL_ELIMINA, { militare: cellaAperta.dataset.m, data: cellaAperta.dataset.d }).then((r) => {
        cellaAperta = sostituisciCella(cellaAperta, r.html);
        dlg.close();
      });
    };
  }

  // Evidenzia il codice scelto nel pennello
  if (pnTipo) {
    pnTipo.addEventListener("change", () => {
      const opt = pnTipo.selectedOptions[0];
      pnTipo.style.background = opt.dataset.sfondo || "";
      pnTipo.style.color = opt.dataset.testo || "";
      griglia.classList.toggle("pennello-attivo", !!pnTipo.value);
    });
  }
})();
