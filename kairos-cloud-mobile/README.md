# KAIROS CLOUD — app Android + iPhone (sviluppo)

Questa cartella contiene **un'app React Native/Expo**, NON un sito Web. Non sostituisce KAIROS FINISH: la FINISH cronometra offline; CLOUD permette a utenti autorizzati di consultare allenamenti e classifiche quando è disponibile Internet.

## Primo traguardo già nel codice
- Login personale con email e password tramite Supabase Auth.
- Elenco dei **gruppi autorizzati** all'utente.
- Elenco degli allenamenti di ogni gruppo.
- Risultati/classifiche, tempi visualizzati in minuti:secondi.centesimi; quando il tempo è candidato appare **Da verificare**.
- Isolamento dei dati tramite Row Level Security (RLS) nel database.
- Una membership del gruppo autorizza automaticamente tutti gli allenamenti di quel gruppo. La rimozione revoca anche la lettura dello storico.
- L'account utente non può auto-iscriversi ai gruppi.

## Ancora da realizzare
- Collegamento reale al progetto Supabase del proprietario e creazione controllata del primo amministratore.
- Inviti, gestione gruppi, esportazione e sincronizzazione dal tablet KAIROS FINISH.
- Build e test su dispositivi Android/iOS, firma degli APK/IPA e pubblicazione negli store.
- Verifiche RLS con più utenti di gruppi diversi, backup e conformità privacy.

## Configurazione solo per sviluppatore
1. Creare un progetto Supabase.
2. Eseguire **una sola volta** `supabase/schema.sql` nel SQL Editor su database vuoto, dopo averlo verificato. Nessuna password/chiave `service_role` nell'app.
3. Configurare le variabili in un file locale `.env`, partendo da `.env.example`:
   `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Usare Node.js compatibile con Expo SDK, poi `npm install` e `npx expo start`.
5. Eseguire l'invito degli utenti e l'assegnazione ai gruppi **da un'interfaccia amministrativa protetta da sviluppare** o temporaneamente dal SQL Editor con adeguata verifica amministrativa.

**Sicurezza:** il repository è pubblico. Non pubblicarvi credenziali, token di servizio, dati personali o elenchi di atleti. Le chiavi publishable sono leggibili nell'app distribuita e la loro esposizione è prevista; le regole RLS devono essere validate server-side prima di qualsiasi uso reale.

**Stato:** sorgenti iniziali; non è un prodotto pronto per la distribuzione. Non è ancora stato configurato l'accesso a un database reale.
