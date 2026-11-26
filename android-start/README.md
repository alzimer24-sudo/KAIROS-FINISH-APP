# KAIROS START Android

Applicazione Android **installata localmente** sul telefono e **senza Internet**: comunicazione tramite rete Wi-Fi locale della Heltec START (IP `192.168.4.1`).

## Schermata outdoor
Tema nero, caratteri bianchi/gialli ad alto contrasto; pettorale e countdown molto grandi, pulsanti grandi, schermo mantenuto acceso finché l'app è aperta.

## Protocollo atteso
- `GET /api/status` → JSON `{"ready":true,"stage":"idle|locked|ready|countdown|go|sent","remaining_sec":15,"lookup":{"bib":23,"nonce":123,"status":"found","name":"Mario Rossi"},"confirmed_bib":23}`.
- `POST /api/lookup` (form bib,nonce) chiede alla FINISH via LoRa il nome del pettorale, senza trasferire né modificare la lista.
- `POST /api/confirm` (form bib,nonce) conferma il concorrente verificato e attende il permesso della FINISH.

FINISH conserva elenco atleti, prova in pista, risultato e consenso. START può preparare il prossimo pettorale mentre un atleta è in pista, ma il firmware non deve accettare una nuova partenza fino a chiusura e via libera FINISH.

La sequenza acustica (bip iniziale, quattro brevi -4..-1 e ultimo di **750 ms** a zero) è responsabilità della Heltec START. Il countdown è regolabile da FINISH; il timer visibile è solo informativo. L'istante cronometrico è quello del sensore, non del telefono.

**Stato attuale:** sorgente dell'app e workflow di compilazione salvati. Le API `lookup`/`confirm` e il protocollo LoRa bidirezionale devono ancora essere implementati e collaudati sul firmware. L'app NON è quindi pronta per uso sul campo. Nessun firmware originale modificato.

APK di prova da GitHub Actions → KAIROS START Android APK (prova) → Artifacts, dopo compilazione riuscita.
