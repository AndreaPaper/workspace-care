# Workspace Care – app desktop personale per la cura dell'ufficio

## Contesto
App personale (un solo utente) per gestire il ruolo di "Workspace Care" in un ufficio di consulenti programmatori:
ordine e riorganizzazione degli spazi, idee di miglioramento, acquisti, manutenzione, richieste dei colleghi,
controlli periodici e regole condivise. Il lavoro si svolge a margine dell'attività di sviluppo: l'app deve
essere veloce da usare e richiedere poca manutenzione.

## Stack
- Frontend: Angular (ultima versione stabile), componenti standalone, signals, **Angular Material** (non PrimeNG:
  dalla v22 richiede una licenza PrimeUI). Icone con il pacchetto `material-icons`; font Inter e Plus Jakarta Sans da `@fontsource` (nessun font da rete).
- Backend: PocketBase (SQLite, API REST). Logica lato server con hook JavaScript in `backend/pb_hooks/`.
- Distribuzione: **app Windows locale con Electron** (`desktop/`). Gratis, sempre disponibile, nessun hosting.
- Aggiornamenti: `electron-updater` con le release di GitHub (`build.publish` in `desktop/package.json`, repository `AndreaPaper/workspace-care`). L'app controlla all'avvio e ogni 6 ore; un avviso in cima alle pagine (`core/ui/update-banner.ts`, `services/update.service.ts`) propone «Aggiorna ora» → scarico con avanzamento → «Riavvia e installa». Il main process (`desktop/main.js`) ferma PocketBase prima di installare. `WC_UPDATE_FEED` (cartella servita via http) sostituisce l'origine, solo per i test. Il file dell'installer si chiama `Workspace-Care-Setup-<versione>.exe` (deve coincidere con `latest.yml`).
  Electron avvia `pocketbase.exe` su 127.0.0.1:8090, lo usa anche per servire la build Angular e resta nella tray.
- Un solo utente, **nessuna schermata di login**: al primo avvio Electron crea un account interno con password casuale
  (`%APPDATA%\workspace-care\credentials.json`) e lo espone ad Angular tramite `desktop/preload.js`; l'API resta protetta.
  Electron crea anche un superutente interno con password casuale (`ensureSuperuser` in `desktop/main.js`): senza, PocketBase aprirebbe il browser sulla pagina di installazione a ogni avvio pulito. La pagina di login esiste solo come ripiego fuori da Electron (es. `ng serve` nel browser).
- Interfaccia in italiano, responsive.

## Struttura del repository
- `frontend/` – app Angular (`src/app/{core,models,services,pages}`)
- `backend/` – `pocketbase.exe` (non versionato), `pb_migrations/`, `pb_hooks/`
- `desktop/` – processo principale Electron, tray, notifiche, export PDF, installer (electron-builder)
- Le collezioni PocketBase si definiscono con **migrazioni JS versionate**, non a mano dal pannello.

## Modello dati (collezioni PocketBase)
- **aree**, **idee**, **link_idea** (anche `immagine_url` per il fallback manuale), **richieste**, **acquisti**
  (anche `data_acquisto`, valorizzata dall'hook), **controlli** (frequenze: settimanale, bisettimanale, mensile, trimestrale), **esecuzioni_controllo**,
  **eventi_richiesta** (cronologia di una richiesta: creazione e cambi di stato scritti dall'hook, note aggiunte dall'app), **inventario** (con `contenitore` facoltativo; `posizione` è il punto dentro il contenitore), **contenitori** (nome, area, descrizione),
  **cassettiere** (numero e area), **cassetti** (i singoli cassetti di una cassettiera: tipo personale | condiviso | libero, `assegnato_a`, `contenuto`; eliminati a cascata), **regole** (con `area` facoltativa). Campi e valori ammessi: vedi `backend/pb_migrations/`.
- Importi di `acquisti`: stime e prezzo effettivo sono totali di riga (quantità già compresa).

## Logica lato server (`backend/pb_hooks/`)
- `anteprima.pb.js` + `lib/preview.js`: all'inserimento di un link scarica og:image/og:title/og:site_name e prezzo;
  mai bloccante, `stato_anteprima = fallita` se non riesce. Amazon e simili si gestiscono col fallback manuale.
- `controlli.pb.js` + `lib/scadenze.js`: calcolo di `prossima_scadenza`; `POST /api/controlli/:id/fatto` registra
  l'esecuzione e sposta la scadenza contando da oggi (nessun arretrato). Bisettimanale: giorno della settimana fisso,
  prossima occorrenza almeno 8 giorni dopo oggi. La stessa regola è replicata in `frontend/src/app/services/scadenze.ts`
  solo per l'anteprima «Il prossimo sarà…»: se cambi una, cambia l'altra.
- `richieste.pb.js` + `lib/richieste.js`: ogni richiesta registra «Ricevuta da…» alla creazione e «Passata a «…»» a ogni cambio di stato.
- `acquisti.pb.js`: `data_acquisto` automatica; `POST /api/idee/:id/converti` (idempotente) crea l'acquisto da un'idea.
- `setup.pb.js`: `GET/POST /api/setup` per creare il primo e unico utente.

## Schermate
La grafica di dashboard e sidebar segue la proposta «D · Mix» del design (artifact "Workspace Care – Dashboard e sidebar").
- **Sidebar**: rail compatta (92 px; su telefono diventa una striscia scorrevole in alto) con il logo dell'app (`frontend/public/logo.png`, ricavato da `icons/logo_office_care.jpg`), menu **Nuovo** (idea, richiesta, acquisto, controllo), contatori su Richieste (aperte) e Controlli (in ritardo o di oggi), poi Ufficio (icona mappa), Regole, Riepilogo. I contatori stanno in `services/badges.service.ts`.
- **Ricerca globale** (Ctrl K) in cima a ogni pagina: idee, richieste, acquisti, inventario, cassetti (per persona o contenuto), regole (`core/search`). I risultati aprono la pagina con `?q=`; un cassetto apre la scheda Cassettiere con `?cassetto=<id>` già selezionato; `?nuova=1` apre il dialog di creazione (`core/page-params.ts`).
- **Dashboard**: saluto e riepilogo del giorno, avviso se un controllo è in ritardo, tutti i controlli ordinati per scadenza, idee da valutare (stato idea o da_valutare) con filtro per urgenza e smistamento Alta/Media/Bassa con un clic, richieste aperte, idee approvate pronte per l'acquisto e budget.

**Idee, Richieste, Controlli, Acquisti** sono pagine «lista a sinistra, dettaglio a destra» (tela di design: Idee-Dettaglio, Richieste-Dettaglio,
Controlli-Dettaglio, Acquisti-Dettaglio), senza finestre di dialogo: creazione e modifica avvengono nel pannello di dettaglio, con l'azione del
passo successivo in fondo. La selezione sta nell'URL (`#/richieste?id=…`, `?id=new` per il modulo di creazione); `#/idee/:id` reindirizza a `#/idee?id=:id`.
Pezzi comuni in `core/ui` (`master-detail`, `steps-bar`, `page-head`, `selection`) e stili in `styles/_master-detail.scss`.
Idee: tab (da valutare / in corso / chiuse), filtro per urgenza (campo `priorita`) e link con anteprime; non ci sono più la griglia con immagini né il kanban.
Acquisti: fascia budget con speso / ordinato da pagare / stima ancora da decidere (`PurchasesService.totals`).

**Ufficio** (`#/ufficio?tab=inventario|cassettiere|aree`, `pages/office`): un'unica voce di menu con tre schede e contatori; sostituisce le voci Inventario, Cassettiere e Aree (i vecchi indirizzi `#/inventario`, `#/cassettiere`, `#/aree` reindirizzano alla scheda giusta, conservando `?q=`). Inventario: oggetti raggruppati per area e per contenitore (armadio, scatola…), con «Senza contenitore» e «Metti in…»; modifica in linea, niente dialog; eliminando un contenitore gli oggetti restano. Cassettiere: legenda (personale / condiviso / libero, contata sui cassetti), un riquadro per area con le cassettiere disegnate come mobili di cassetti impilati colorati per tipo; un clic su un cassetto apre a destra il riquadro per assegnarlo (una persona può avere anche un solo cassetto, oppure tutta la cassettiera); un clic sull'etichetta «Cassettiera N» permette di cambiare numero e area, aggiungere un cassetto o eliminarla. «+ Cassettiera» chiede anche il numero di cassetti. Aree: una scheda per area (nome con rinomina, oggetti / cassettiere o contenitori / controlli, riga di riepilogo, riquadro rosso se un controllo è in ritardo, «Elimina area» solo se vuota, «Nuova area»); un clic apre il dettaglio `#/ufficio/aree/:id` (`area-detail.ts`) con cassettiere dell'area (stesso componente `Drawers` con `areaId`), regole, idee aperte e richieste con azioni rapide, e «Aggiungi qui» (`?nuova=1&area=<id>` preimposta l'area in Idee, Richieste, Inventario e Cassettiere). I conteggi stanno in `services/area-overview.service.ts`. I componenti `Inventory`, `Drawers`, `Areas` emettono `changed` per aggiornare i contatori.

**Regole** (`pages/rules`): bacheca con un riquadro per tema, senza dialog. Attive su fondo verde, bozze tratteggiate con «Attiva», da definire con «Scrivi la bozza»; clic sul testo = modifica in linea; avviso «N regole da sistemare» con filtro `?da_sistemare=1`. Il pulsante «Cartello» apre `#/regole/cartello?tema=…` (`rule-sign.ts`): le sole regole attive del tema in grande, esportabili in PDF come il riepilogo.

**Riepilogo** (`pages/report`, «Anteprima del foglio»): a sinistra le impostazioni (periodo a pulsanti, sezioni con conteggi, «Mostra i costi», due righe di apertura facoltative, «Esporta PDF» con stima delle pagine A4 e data dell'ultimo invio in `localStorage`); a destra l'anteprima del foglio con 4 numeri chiave. In stampa resta solo il foglio. Le righe di apertura non vengono salvate.

Altre pagine: Dashboard.
Il PDF si genera dalla pagina `#/riepilogo` con `webContents.printToPDF` di Electron (stile `@media print`).

## Impostazioni (design «Lista e dettaglio»)
- Voce «Impostazioni» in fondo alla rail (solo nell'app desktop), pagina `#/impostazioni?sezione=generale|notifiche|backup|aggiornamenti|informazioni` (`pages/settings`), master-detail, salvataggio automatico con «Salvato». Pallino arancione sulla voce se l'ultimo backup è vecchio di 7+ giorni o manca.
- Le preferenze del desktop stanno in `settings.json` nella cartella dati di Electron (`desktop/main.js`: `settings`, `saveSettings`, IPC `settings-get/-set`, `backup-list`, `backup-choose-folder`, `open-folder`): avvio con Windows, resta nella tray alla chiusura, promemoria (sì/no e ora), cartella dei backup, controllo aggiornamenti automatico, nome per il saluto. Lato Angular: `services/settings.service.ts` e `models/settings.ts`.
- Backup: «Fai un backup ora» (anche dalla tray) scrive una cartella `workspace-care-backup-AAAA-MM-GG_HHMM` nella cartella configurata (predefinita: Documenti\Backup Workspace Care), senza dialog; l'elenco «Backup fatti» legge quella cartella.
- Non ancora fatto (seconda parte): backup automatico, ripristino, budget, persone, notifiche extra.

## Popup (design «Nel pannello»)
- Niente `window.confirm` né dialog Material: ogni conferma passa da `services/confirm.service.ts` (`ask` per eliminazioni e sì/no, `choose` per la scelta del link). Il riquadro (`core/ui/confirm-box.ts`) compare accanto all'elemento che l'ha richiesto — dentro `.md-detail`, sotto il modulo in linea o la riga — e blocca (`inert`) la parte di pagina a cui appartiene; Esc annulla e il focus torna al pulsante di partenza. Sotto i 480 px diventa un foglio dal basso.
- Esiti: `services/toast.service.ts` + `core/ui/toast-host.ts` (in basso al centro; il positivo sparisce dopo 6 s, l'errore resta). Il main process invia al renderer l'esito del backup (`sendToast`, coda `toast-take` / evento `toast-ready`), così non resta nessuna finestra di Electron tranne i selettori di Windows (Salva con nome, Scegli cartella) e gli errori all'avvio.
- La striscia degli aggiornamenti (`core/ui/update-banner.ts`) mostra le novità prese dalle note della release GitHub.
- Test accanto all'app installata: `WC_PORT=8091` e `electron . --user-data-dir=<cartella temporanea>`; mai toccare `%APPDATA%\workspace-care` dell'app installata.

## Convenzioni
- Codice e nomi in inglese, testi dell'interfaccia in italiano (i nomi delle collezioni PocketBase restano italiani).
- Un servizio Angular per collezione, tipi TypeScript allineati alle collezioni (`models/models.ts`).
- Router con `withHashLocation()`: la build è servita come file statici da PocketBase.
- Prima di implementare una nuova fase, proponi il piano e attendi conferma.

## Note operative
- Windows PowerShell 5.1: i body JSON con accenti vanno inviati come byte UTF-8 (`charset=utf-8`).
- `npm run dist` in `desktop/` genera l'installer; la build Angular (`ng build` in `frontend/`) va fatta prima.
