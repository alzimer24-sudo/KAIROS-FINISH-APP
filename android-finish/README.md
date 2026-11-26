# KAIROS FINISH V12 – versione Android di collaudo

Questa versione NON sostituisce la V11 installata tramite Chrome: è un'app Android distinta con archivio locale proprio, realizzata per leggere il firmware FINISH verificato dall'utente.

## Architettura

- Firmware Heltec FINISH (non modificato): rete Wi-Fi locale KAIROS-FINISH; `GET http://192.168.4.1/api/tempo` restituisce `{"state":0..3,"us":numero}`.
- Android nativo: chiama l'indirizzo tramite la rete Wi-Fi locale e consegna il JSON all'interfaccia caricata localmente.
- Lo schermo FINISH V12: importa concorrenti CSV, associa manualmente un pettorale al prossimo START, mostra il tempo progressivo come **stima visiva** a partire dall'osservazione dello stato 1; allo stato 2 visualizza e registra il tempo candidato della Heltec dopo conferma dell'operatore.
- Salvataggio nel browser interno del pacchetto Android; esportazione CSV tramite selettore file nativo Android.
- Nessuna connessione Internet necessaria durante l'allenamento; nessuna sincronizzazione cloud ancora disponibile.

## Limitazioni importanti

- Il firmware risponde solo con **stato** e **ultimo tempo in microsecondi**, non con il numero pettorale, l'identificatore della prova o timestamp di START/FINISH. Per questo l'associazione è manuale e questa versione gestisce **una prova alla volta** in modalità Heltec reale.
- Il tempo progressivo sullo schermo non è il tempo GPS/PPS definitivo; parte quando il telefono vede il cambio di stato 1 e può iniziare in ritardo. Il tempo concluso è letto da `us`.
- Non considerare ufficiali i tempi finché sincronizzazione GPS/PPS e accuratezza non sono state validate con test indipendenti.
- Se l'utente apre l'app dopo l'arrivo (`state:2` senza aver osservato `state:1`), il vecchio tempo non viene associato a un atleta.
- I risultati **non** sono online; la pubblicazione su GitHub Pages riguarda l'interfaccia dimostrativa, non il database privato di atleti, allenamenti, gruppi e account.

## Test sul dispositivo

1. Scaricare l'APK di collaudo dell'ultimo workflow riuscito: Actions → KAIROS FINISH Android APK (prova) → Artifacts.
2. Installare soltanto l'APK generato dal proprio repository. Restare connessi alla rete Wi-Fi `KAIROS-FINISH` anche se Android segnala assenza Internet.
3. Importare il CSV degli atleti nella nuova app, scegliere un pettorale e premere **ASSOCIA PETTORALE** prima della partenza.
4. Verificare cambiamenti da `HELTEC PRONTA` a `START RICEVUTO` e `ARRIVO CANDIDATO`, confermando manualmente il tempo candidato.
5. Esportare un CSV e verificare un solo risultato di prova.

Non usare questa versione per cronometrare un allenamento ufficiale; non installare APK non verificati.
