# KAIROS START Android

Applicazione Android **installata localmente** sul telefono e **senza Internet**: comunicazione tramite rete Wi-Fi locale della Heltec START (IP `192.168.4.1`).

## Schermata outdoor
Tema nero, caratteri bianchi/gialli ad alto contrasto; pettorale e countdown molto grandi, pulsanti grandi, schermo mantenuto acceso finché l'app è aperta.

## Protocollo atteso
- `GET /api/status` → JSON `{"ready":true,"stage":"idle|locked|ready|recall|countdown|go|sent","remaining_sec":15,"lookup":{"bib":23,"nonce":123,"status":"found","name":"Mario Rossi"},"confirmed_bib":23}`.
- `POST /api/lookup` (form bib,nonce) chiede alla FINISH via LoRa il nome del pettorale, senza trasferire né modificare la lista.
- `POST /api/confirm` (form bib,nonce) conferma il concorrente verificato e attende il permesso della FINISH.

FINISH conserva elenco atleti, prova in pista, risultato e consenso. START può preparare il prossimo pettorale mentre un atleta è in pista, ma il firmware non deve accettare una nuova partenza fino a chiusura e via libera FINISH.

La sequenza acustica (bip iniziale, quattro brevi -4..-1 e ultimo di **750 ms** a zero) è responsabilità della Heltec START. Il countdown predefinito è di 15 secondi, regolabile da FINISH; inizia dopo il bip di richiamo (stage recall). il timer visibile è solo informativo. L'istante cronometrico è quello del sensore, non del telefono.

**Stato attuale:** sorgente dell'app e workflow di compilazione salvati. Le API `lookup`/`confirm` e il protocollo LoRa bidirezionale devono ancora essere implementati e collaudati sul firmware. L'app NON è quindi pronta per uso sul campo. Nessun firmware originale modificato.

APK di prova da GitHub Actions → KAIROS START Android APK (prova) → Artifacts, dopo compilazione riuscita.

## Estensione interfaccia START (collaudo)

La risposta status include inoltre `link_ok` (booleano, consenso radio fresco), `confirmed_nonce` (nonce della conferma) e facoltativamente `elapsed_us` (non visualizzato su START; il risultato resta sul tablet FINISH). La schermata START mostra solo pettorale, nome, conferma, stato collegamento, semaforo e countdown grande. L'interfaccia mostra VIA LIBERA esclusivamente con `ready=true`, `link_ok=true`, `stage=go`; timeout o errore Wi-Fi riportano STOP. Il verde fisico e l'accettazione del sensore restano responsabilità del firmware, non dell'app. Il firmware deve restituire il nonce della conferma e invalidare ogni consenso scaduto. Nessuna modifica ai firmware in questo aggiornamento.
