# Test end-to-end "a mano"

Giro di test eseguito il 18–19 novembre 2026 su tutte le funzionalità delle fasi 1–4, con correzione dei difetti trovati e nuova esecuzione dei casi coinvolti.

**Esito: 166 casi superati, 0 non superati, 1 osservazione non corretta** (totale 167).

## Come è stato eseguito
- App di sviluppo (`desktop/`, Electron) con database e account interno ripartiti da zero.
- Interfaccia pilotata nel browser integrato (desktop 1100 px e telefono 375 px); dati e controlli di coerenza via API di PocketBase.
- Processo principale (`desktop/main.js`) eseguito davvero, con intercettazione delle finestre native, di `Notification`, tray e `shell` e con un orologio simulato per la regola delle 09:00.
- PDF generato dalla finestra reale con `printToPDF` e controllato pagina per pagina.
- Le descrizioni dei casi nelle tabelle sono quelle del registro dei test (in inglese).

## Difetti trovati e corretti
| ID | Difetto | Correzione |
|----|---------|------------|
| BUG-1 | Area con nome già esistente (aggiunta o rinomina): nessun messaggio | Messaggio chiaro; il campo di rinomina resta aperto |
| BUG-2 | Dettaglio di un'idea inesistente: "Caricamento…" per sempre | "Idea non trovata" con collegamento a Idee |
| BUG-3 | Doppio clic duplicava record (idea da richiesta, "Fatto" in dashboard, link, salvataggi dei dialog) | Protezione contro il doppio invio in tutti i punti coinvolti; salvataggio di un valore non valido nel dettaglio idea ora avvisa e ripristina |
| BUG-4 | "Esporta backup" fermava PocketBase e l'app lo scambiava per un crash: errore falso e chiusura dell'app | Lo stop volontario non è più trattato come crash |
| BUG-5 | PDF con molte idee: prima pagina quasi vuota | Le sezioni lunghe possono spezzarsi tra le pagine |
| BUG-6 | Riepilogo a 375 px: tabella acquisti allargava la pagina; richieste senza richiedente mostravano "(, stato)" | Tabella scorrevole nel suo riquadro; virgola nascosta |
| LINK | I link `ftp://` venivano accettati | Solo `http://` e `https://` |

## Osservazioni non corrette
- L'API accetta `quantita = 0` (PocketBase tratta lo zero come campo vuoto); l'interfaccia invia sempre almeno 1.
- Un'area ancora usata da richieste, acquisti o controlli (ma senza idee) si può eliminare: il collegamento viene semplicemente svuotato.
- I testi iniziali delle regole ripetono il nome del tema, quindi nel riepilogo compare "Cassettiere: Cassettiere: …".
- Fare scorrere un controllo con "Fatto" più volte lo stesso giorno registra una esecuzione per ogni conferma (comportamento voluto, ogni conferma è un controllo fatto).
- La data d'acquisto resta quella del primo ordine anche se l'acquisto torna a "da proporre".

## Non testato
- Banner reale di notifica di Windows, clic sulle voci della tray e finestre native di dialogo (sostituite dall'intercettazione descritta sopra).
- L'installer: installarlo registra l'avvio automatico con Windows, quindi resta da provare a mano.
- Siti esterni oltre a IKEA, example.com, Amazon e httpbin; assenza di connessione.
- Ripristino di un backup in un'installazione pulita (verificato solo che la cartella copiata contenga database, file WAL e immagini).

## Casi

### A. Avvio, account e sicurezza

| ID | Esito | Caso | Note |
|----|-------|------|------|
| A1b | PASS | first-run account exists, setup closed |  |
| A1c | PASS | credentials file created with random password |  |
| A1d | PASS | internal user can authenticate |  |
| A2a | PASS | seed: 8 aree |  |
| A2b | PASS | seed: 10 idee |  |
| A2c | PASS | seed: 3 controlli with due dates |  |
| A2d | PASS | seed: 3 regole da_definire |  |
| A3-acquisti | PASS | anonymous cannot read or write acquisti | list=200/0 write=400 |
| A3-anon-token | PASS | anonymous cannot read the aree list contents |  |
| A3-aree | PASS | anonymous cannot read or write aree | list=200/0 write=400 |
| A3-cassettiere | PASS | anonymous cannot read or write cassettiere | list=200/0 write=400 |
| A3-controlli | PASS | anonymous cannot read or write controlli | list=200/0 write=400 |
| A3-converti | PASS | anonymous cannot call /converti | status=401 |
| A3-esecuzioni_controllo | PASS | anonymous cannot read or write esecuzioni_controllo | list=200/0 write=400 |
| A3-fatto | PASS | anonymous cannot call /fatto | status=401 |
| A3-idee | PASS | anonymous cannot read or write idee | list=200/0 write=400 |
| A3-inventario | PASS | anonymous cannot read or write inventario | list=200/0 write=400 |
| A3-link_idea | PASS | anonymous cannot read or write link_idea | list=200/0 write=400 |
| A3-regole | PASS | anonymous cannot read or write regole | list=200/0 write=400 |
| A3-richieste | PASS | anonymous cannot read or write richieste | list=200/0 write=400 |
| A3-setup | PASS | POST /api/setup refused once a user exists | status=403 |
| A3-users | PASS | still only one user after attempts |  |
| A4a | PASS | wrong password rejected |  |
| A4b | PASS | unknown user rejected |  |
| A4c | PASS | UI fallback login: wrong credentials show error message |  |
| A4d | PASS | UI fallback login: valid credentials reach dashboard |  |
| A5a | PASS | special characters stored intact |  |
| A5b | PASS | newline in description preserved |  |
| A5c | PASS | UI renders special characters/script tag as plain text, no script executed |  |

### B. Aree

| ID | Esito | Caso | Note |
|----|-------|------|------|
| B1 | PASS | create area |  |
| B2 | PASS | duplicate area name rejected by backend |  |
| B3 | PASS | empty area name rejected |  |
| B4 | PASS | rename area |  |
| B5 | PASS | delete empty area |  |
| B6 | PASS | backend deletes an area still referenced (UI blocks only for ideas) | delete=204 idea.area='' controllo.area='' |
| B7 | PASS | UI areas: duplicate name on add and on rename now shows a message (rename keeps the field open); a free name works | re-verified after BUG-1 fix |

### C. Idee

| ID | Esito | Caso | Note |
|----|-------|------|------|
| C1 | PASS | idea without stato rejected |  |
| C2 | PASS | idea without title rejected |  |
| C3 | PASS | negative cost rejected |  |
| C4 | PASS | invalid enum values rejected |  |
| C5 | PASS | missing idea id returns 404 |  |
| C6 | PASS | very long title (5000 chars) behaviour | status=200 |
| C7 | PASS | every status/category/priority value accepted |  |
| C8 | PASS | deleting an idea removes its links and un-links purchase/request | delete=204 links 1->0 purchase.idea='' request.idea='' |
| C9 | PASS | photos: add 3, then remove one | after add=3 after remove=2 |
| C10 | PASS | photo with non-image type rejected | status=400 |
| C11 | PASS | detail edits persisted in DB (title, area, category, status, priority, costs, description, notes) | titolo='Titolo E2E modificato è ù' area=cucina cat=benessere stato=proposta pri=alta cost=120-340 note='Note E2E' |
| C12 | PASS | kanban drag persisted (Riordino terrazzo -> da_valutare) | stato=da_valutare |
| C13 | PASS | kanban select move persisted (st da_valutare -> proposta) | stato=proposta |
| C14 | PASS | UI idea detail: unknown id shows "Idea non trovata" with a back link, no JS error | re-verified after BUG-2 fix |
| C15 | PASS | UI grid: search (case-insensitive), area/category/status filters, combined filters, empty message, reset |  |
| C16 | PASS | UI kanban: drag between columns, same-column drop ignored, select move, counts, persistence |  |
| C17 | PASS | UI new-idea dialog: empty/blank title disables button, area, 2 links (blank line ignored), redirect to detail |  |
| C18 | PASS | UI detail: Segna come fatta disables button; multi-photo upload and remove; invalid link shows alert and keeps input; remove link; delete idea redirects |  |

### D. Anteprima dei link

| ID | Esito | Caso | Note |
|----|-------|------|------|
| D1 | PASS | IKEA: ok with title, site, image | state=ok title='KALLAX Scaffale, bianco, 77x147 cm' site=IKEA img=True price='' t=1s |
| D2 | PASS | example.com: parziale with title | state=parziale title='Example Domain' |
| D3 | PASS | Amazon: link saved, preview fallita/parziale, not blocking | state=parziale t=0.1s |
| D4 | PASS | non-existent domain: saved as fallita, fast | state=fallita t=0s |
| D5 | PASS | URL pointing to an image (not HTML): saved, no crash | state=fallita status=200 t=0.3s |
| D6 | PASS | HTTP 404 page: saved as fallita | state=fallita |
| D7 | PASS | redirect followed (httpbin -> example.com) | state=parziale title='Example Domain' status=200 |
| D8 | PASS | ftp:// URL rejected |  |
| D9 | PASS | free text instead of URL rejected |  |
| D10 | PASS | link without idea rejected |  |
| D11 | PASS | duplicate link on same idea is accepted (no uniqueness rule) | status=200 |
| D12 | PASS | fallback image URL downloads the image, state parziale | state=parziale img=anteprima_7k5hi6eeuy.png |
| D13 | PASS | fallback image URL that is not an image is ignored (no image set) | status=200 img='' |
| D14 | PASS | fallback image URL returning 404 is ignored | status=200 img='' |
| D15 | PASS | javascript: URL is not accepted as a link | status=400 |
| D16 | PASS | file:// URL: accepted or rejected, but never fetched | status=400 state= title='' |
| D17 | PASS | screenshot upload (small PNG) accepted |  |
| D18 | PASS | screenshot over 10 MB rejected | status=400 |
| D19 | PASS | non-image file as screenshot rejected | status=400 |
| D20 | PASS | UI fallback: image URL and screenshot upload verified earlier in the session and via API (D12-D19) |  |

### E. Controlli periodici

| ID | Esito | Caso | Note |
|----|-------|------|------|
| E1 | PASS | seed due dates: Mon 23/11, Fri 20/11, 1 Dec | Pulizia frigorifero=2026-11-20, Controllo in area ref=2026-11-25, Giro settimanale spazi comuni=2026-11-23, Riordino terrazzo=2026-12-01 |
| E2a | PASS | weekly on today weekday -> due today | 2026-11-25 |
| E2b | PASS | weekly Tuesday -> next Tuesday 24/11 | 2026-11-24 |
| E2c | PASS | weekly Sunday -> 22/11 | 2026-11-22 |
| E3a | PASS | monthly day = today -> due today | 2026-12-18 |
| E3b | PASS | monthly day already passed -> next month 10/12 | 2026-12-10 |
| E3c | PASS | monthly day 28 -> 28/11 | 2026-11-28 |
| E3d | PASS | quarterly day 5 (passed) -> first due 05/12 | 2026-12-05 |
| E4a | PASS | weekly done on its due weekday -> next week 25/11 | 2026-11-25 |
| E4b | PASS | monthly done -> next month 18/12 | 2026-12-18 |
| E4c | PASS | monthly day 28 done -> 28/12 | 2026-12-28 |
| E4d | PASS | quarterly done -> +3 months 05/02/2027 | 2027-02-05 |
| E4e | PASS | weekly Friday done on Wednesday -> next Friday 20/11 (strictly after today) | 2026-11-20 |
| E4f | PASS | weekly Monday done on Wednesday -> Mon 23/11 | 2026-11-23 |
| E5a | PASS | execution recorded with outcome, note and today date | n=1 esito=da_sistemare nota='nota di prova' data=2026-11-19 |
| E5b | PASS | double "Fatto" same day: two runs, due date stable | runs=3 due=2026-11-25 |
| E5c | PASS | unknown outcome value is treated as ok | esito=ok |
| E5d | PASS | fatto on a missing check -> 404 |  |
| E6a | PASS | renaming only does not move the due date | 2026-11-25 |
| E6b | PASS | changing the weekday recalculates (Fri 20/11) | 2026-11-20 |
| E6c | PASS | changing frequency to monthly day 25 -> 25/11 | 2026-11-25 |
| E6d | PASS | manual due date set via API is kept | 2026-12-31 |
| E7 | PASS | check overdue by 7 weeks: one "Fatto" -> next Monday 23/11, no backlog | 2026-11-23 |
| E8a | PASS | empty name rejected |  |
| E8b | PASS | day 0 rejected |  |
| E8c | PASS | day 29 rejected |  |
| E8d | PASS | weekly day 8 accepted by backend (UI limits it to 1-7) | status=200 due=2026-11-23 |
| E8e | PASS | invalid frequency rejected |  |
| E9 | PASS | deleting a check removes its execution history | delete=204 runs left=0 |
| E10 | PASS | UI checks page: sections at day boundaries (-1 Scaduti, 0 Oggi, +7 Settimana, +8 Piu avanti) |  |
| E11 | PASS | UI create dialog: empty name disables Salva, frequency switches weekday/month-day input (1-28), area, saved row and due date correct |  |
| E12 | PASS | UI edit dialog: switching to weekly clamps day, due date recalculated (22/11); delete from dialog works |  |
| E13 | PASS | UI Fatto dialog: default esito, da_sistemare + note, row moves to Piu avanti, history shows note; Annulla keeps state |  |

### F. Richieste

| ID | Esito | Caso | Note |
|----|-------|------|------|
| F1 | PASS | request without title rejected |  |
| F2 | PASS | request without stato rejected |  |
| F3 | PASS | invalid stato rejected |  |
| F4 | PASS | link to a non-existent idea rejected |  |
| F5 | PASS | request with no date accepted |  |
| F6 | PASS | all 5 states accepted |  |
| F7 | PASS | Create idea from request with a double click creates exactly one idea | re-verified after BUG-3 fix |
| F8 | PASS | UI requests: default Aperte filter, per-state filters, Tutti, search matches requester |  |
| F9 | PASS | UI request dialog: blank title disables Salva, defaults (ricevuta, today), no idea controls on create, Fatta leaves Aperte, link to created idea persists |  |

### G. Acquisti e budget

| ID | Esito | Caso | Note |
|----|-------|------|------|
| G1a | PASS | purchase without name rejected |  |
| G1b | PASS | purchase without stato rejected |  |
| G1c | NOTA | quantity 0 rejected | returned: False  |
| G1d | PASS | negative estimate/price rejected |  |
| G1e | PASS | invalid link URL rejected |  |
| G1f | PASS | decimal quantity rejected (integer field) |  |
| G2a | PASS | no purchase date while still da_proporre |  |
| G2b | PASS | purchase date set when first ordinato | 2026-11-19 |
| G2c | PASS | purchase date not overwritten on later states | 2026-10-01 |
| G2d | PASS | created directly as arrivato gets a purchase date | 2026-11-19 |
| G2e | PASS | moving back to da_proporre keeps the date (documented behaviour) | date=2026-10-01 |
| G3a | PASS | idea without links: purchase created, empty supplier/link, qty 1, da_proporre | forn='' link='' qty=1 stato=da_proporre |
| G3b | PASS | idea in state idea becomes approvata |  |
| G3c | PASS | one link: copied to purchase, costs copied, idea approvata | forn=IKEA link ok=True est=100-250 |
| G3d | PASS | second conversion is idempotent (same purchase, no duplicate) | esistente=True rows=1 |
| G3e | PASS | two links: the chosen (second) one is used | forn=IKEA |
| G3f | PASS | link_id belonging to another idea rejected, nothing created | status=400 rows=0 |
| G3g | PASS | ideas already fatta / scartata / in_corso keep their state | fatta=fatta scartata=scartata in_corso=in_corso |
| G3h | PASS | conversion of a missing idea -> 404 |  |
| G3i | PASS | idea costs empty -> estimates 0 |  |
| G4 | PASS | UI totals match hand-computed values (estimate 230-440, spent 145, remaining 320, to order 2); budget card 145/465 = 31% |  |
| G5 | PASS | UI montato flow: NO keeps idea, partial montato asks nothing, YES marks idea fatta, no-idea and already-fatta cases ask nothing |  |
| G6 | PASS | idea "Idea totali" ended fatta after the YES answer | stato=fatta |
| G7 | PASS | UI purchase dialog: invalid link error kept open, decimals, quantity, filters (status/area/search), delete from dialog, totals refresh |  |

### H. Dashboard

| ID | Esito | Caso | Note |
|----|-------|------|------|
| H1 | PASS | Dashboard populated: 4 widgets, requests capped at 5 with total, quick Fatto, overdue label |  |
| H2 | PASS | Dashboard budget edge cases: 0 total (no NaN, 0%), 100% bar |  |
| H3 | PASS | Nuova idea button opens the dialog once via ?nuova=1 and not again after reload |  |

### I. Inventario, cassettiere, regole

| ID | Esito | Caso | Note |
|----|-------|------|------|
| I1 | PASS | inventory item without name rejected |  |
| I2 | PASS | inventory CRUD |  |
| I3 | PASS | drawer create |  |
| I4 | PASS | duplicate drawer number rejected |  |
| I5 | PASS | drawer number 0 / negative rejected |  |
| I6 | PASS | invalid drawer type rejected |  |
| I7 | PASS | rule without text rejected |  |
| I8 | PASS | invalid rule topic/status rejected |  |
| I9 | PASS | UI inventory: list, search by name/position/note, area filter, group by area (incl. Senza area), create/rename/delete via dialog |  |
| I10 | PASS | UI drawers: bulk create 1..4 then 1..6 idempotent, 0/empty disabled, N=250 clamped to 200 and button disabled while running, duplicate number error, suggested next number, assign/unassign, counters, delete |  |
| I11 | PASS | UI rules: da_definire->bozza->attiva (no button on attiva), new rule defaults, multiline preserved, edit, delete, grouped by topic |  |

### J. Riepilogo e PDF

| ID | Esito | Caso | Note |
|----|-------|------|------|
| J1 | PASS | Report periods 30/90/365/tutto: execution and request counts equal independent API computation, boundaries (29/31, 89/91, 400 days) correct |  |
| J2 | PASS | Report checkboxes hide/restore every section; costs toggle removes euro amounts, Importo column and totals |  |
| J3 | PASS | Multi-page PDF: pages are filled, images and totals correct; table scrolls inside the report on phones; no stray comma for empty requester | re-verified after BUG-5/6 fixes |

### K. Processo principale (notifiche, backup, tray)

| ID | Esito | Caso | Note |
|----|-------|------|------|
| K1 | PASS | Reminder text and counts (startup, 09:00 gate: 08:00 none, 09:30 once, same day none, tray forces) |  |
| K2 | PASS | Notification click opens #/controlli; Esporta PDF writes file, cancel leaves file untouched; save dialog gets Documents folder + PDF filter |  |
| K3 | PASS | Esporta backup keeps the app and server running and reloads the window | re-verified after BUG-4 fix |
| K4 | PASS | After fix: backup copies the data folder (incl. WAL), server stays up, window reloads; closing window hides it, tray reopens; second instance exits in ~1s and focuses the first; Esci stops PocketBase |  |

### L. Layout e console

| ID | Esito | Caso | Note |
|----|-------|------|------|
| L1 | PASS | Desktop (1100 px): all 10 pages + idea detail without horizontal overflow, sidebar visible |  |
| L2 | PASS | 375 px: all 10 pages + idea detail without horizontal overflow; report purchases table scrolls inside its box | fixed report overflow found during the run |
| L3 | PASS | Browser console: only the expected 400/404 responses caused by the deliberate negative tests, no JS errors or unhandled rejections |  |

### M. Doppio invio e robustezza

| ID | Esito | Caso | Note |
|----|-------|------|------|
| M1 | PASS | Double click does not duplicate: new idea, request, request->idea, dashboard Fatto, inventory, drawer, rule, purchase, check, Fatto dialog, add link, convert | BUG-3 fix verified in the DB |
| M2 | PASS | Idea detail: saving an invalid value (negative cost) shows an alert and restores the stored value, no unhandled error | new hardening, exercised in the UI |

## Aggiornamento del 19 novembre: schede lista + dettaglio

Dopo il giro di test, Richieste, Idee, Controlli e Acquisti sono state rifatte come pagine «lista a sinistra, dettaglio a destra» senza finestre di dialogo,
e i controlli possono ripetersi ogni 2 settimane. **I casi dei capitoli C, E, F e G che parlano di finestre (nuova idea, «Fatto», richiesta, acquisto),
di griglia e di kanban sono superati dalla nuova interfaccia**: le stesse verifiche sono state rifatte qui sotto sul pannello di dettaglio. Il server è stato
rieseguito per intero (gli stessi 128 casi: 127 superati più l'osservazione sulla quantità 0).

Per questo aggiornamento: app di sviluppo con database pulito, interfaccia pilotata nel browser integrato a 1440 e 375 px, ogni azione verificata anche nel database.

### Server
| Caso | Esito | Note |
|------|-------|------|
| Controllo ogni 2 settimane: prima scadenza = prossima domenica | PASS | giorno della settimana fisso |
| Controllo ogni 2 settimane fatto: prossima scadenza almeno 8 giorni dopo | PASS | 29/11 per un controllo di domenica fatto il 19/11; l'anteprima nel browser coincide con il server |
| Creare una richiesta registra «Ricevuta da …»; ogni cambio di stato un evento; altre modifiche nessuno | PASS | |
| Una nota si aggiunge come evento; eliminando la richiesta spariscono gli eventi; senza accesso non si leggono | PASS | |

### Richieste
| Caso | Esito |
|------|-------|
| Elenco con tab Aperte/Chiuse/Tutte e conteggi, ricerca per titolo o collega, «Ultime chiuse», selezione nell'URL | PASS |
| Cronologia nel dettaglio; nota inline aggiunta e campo svuotato | PASS |
| «Segna come fatta» con doppio clic: un solo evento; «Riapri»; «Non fattibile» | PASS |
| Nuova richiesta nel pannello: pulsante spento se vuoto, un solo record con doppio clic, modifica, eliminazione | PASS |
| «Trasforma in idea» con doppio clic: una sola idea, collegata; il pulsante sparisce | PASS |
| Menu Nuovo > Richiesta e ricerca globale aprono o selezionano la richiesta | PASS |

### Controlli
| Caso | Esito |
|------|-------|
| Lista per scadenza con etichette (ritardo, oggi, tra N gg, data); dettaglio con stato e storico | PASS |
| «Com'è andata oggi?»: esito, nota, Registra con doppio clic = una sola esecuzione; data del prossimo identica a quella del server | PASS |
| Dopo Registra la lista si riordina ma il dettaglio resta sullo stesso controllo | PASS (dopo correzione, vedi sotto) |
| «Tutto lo storico»; nuovo controllo ogni 2 settimane con giorno della settimana; passaggio a mensile con giorno del mese; eliminazione | PASS |

### Acquisti
| Caso | Esito |
|------|-------|
| Fascia budget (speso, ordinato da pagare, stima da decidere) con valori calcolati a mano; barra proporzionale | PASS |
| Lista raggruppata (da montare, in arrivo, da ordinare, da proporre), tab In corso/Montati/Tutti | PASS |
| Avanzamento con prezzo pagato inline e doppio clic; data d'acquisto automatica; «nella stima» / «sopra la stima» | PASS |
| «Montato» con l'ultimo acquisto di un'idea: conferma e idea «fatta» | PASS |
| Nuovo acquisto: errore con link non valido, un solo record con doppio clic; modifica; annulla acquisto | PASS |

### Idee
| Caso | Esito |
|------|-------|
| Tab con conteggi, ricerca, filtro per urgenza, raggruppamento ALTA/MEDIA/BASSA/SENZA URGENZA con copertine | PASS |
| Urgenza dal dettaglio (un secondo clic la toglie); percorso Idea > Da valutare > Proposta > Approvata con la barra dei passaggi | PASS |
| «Converti in acquisto»: diretto con 0 o 1 link, scelta del link con 2 link, doppio clic = un solo acquisto, scheda dell'acquisto collegato | PASS |
| Nuova idea con link (uno con schema ftp scartato) e doppio clic: una sola idea | PASS |
| Modifica di tutti i campi; costo negativo mostra errore e resta in modifica | PASS |
| Link: aggiunta valida (doppio clic = uno), non valida con messaggio, immagine di ripiego da URL, rimozione; foto: carica due e rimuovi una | PASS |
| «Scarta» e «Riapri»; eliminazione con link in cascata | PASS |
| Vecchio indirizzo `#/idee/:id` reindirizza; id sconosciuto mostra la prima idea; link da dashboard, richieste, acquisti e ricerca selezionano l'idea | PASS |

### Layout e console
- A 375 px nessuna delle 10 pagine allarga la pagina in orizzontale; lista e dettaglio si impilano e il dettaglio viene portato in vista alla selezione.
- Nessun errore JavaScript né rifiuto non gestito nelle prove.

### Difetti trovati durante l'aggiornamento (corretti)
- Senza `id` nell'URL il dettaglio mostrava il primo elemento della lista, che cambiava quando la lista si riordinava (dopo «Registra» il dettaglio saltava a un altro controllo): il primo elemento ora viene fissato nell'URL.
- In una nuova idea con link non validi il messaggio sui link non aggiunti spariva subito: ora resta visibile.
- Ritocchi: richieste aperte dalla più vecchia, chip di stato su una riga, spazio nel prezzo pagato.

### Non provato
- L'installer non è stato installato né avviato.
- La navigazione da tastiera delle liste (le voci si raggiungono con Tab e si aprono con Invio, ma non l'ho provata a mano) e il comportamento su touch reale.
- La scelta del link nella conversione usa ancora una piccola finestra di dialogo: è l'unico dialogo rimasto nelle quattro schede.

## Aggiornamento del 19 novembre: pagina Ufficio

Inventario, Cassettiere e Aree sono ora tre schede di `#/ufficio`; i casi B e I sopra restano validi, ma la grafica sta nelle schede.

- PASS: tre schede con contatori (2 / 11 / 8) che si aggiornano dopo aggiunta ed eliminazione di un'area.
- PASS: `#/inventario?q=aspira`, `#/aree`, `#/cassettiere` reindirizzano alla scheda giusta; il filtro `q` resta.
- PASS: Cassettiere con legenda (7 personali, 2 condivise, 2 libere), una scatola per area, "Senza area" in fondo; clic su un blocco apre la modifica.
- PASS: nessun overflow orizzontale a 1440 e 375 px su tutte e tre le schede.
- Non provato: creazione in blocco e modifica/elimina inventario dalla nuova grafica (codice invariato).

## Aggiornamento del 19 novembre: Regole come bacheca

- PASS: riquadri per tema, avviso con conteggi, filtro «Mostra solo queste» / «Mostra tutte» (URL `?da_sistemare=1`).
- PASS: «Attiva» su una bozza, «Scrivi la bozza» (porta a bozza e apre il testo), modifica in linea e salvataggio.
- PASS: nuova regola (Salva disattivato con testo vuoto, il riquadro del tema compare solo durante la creazione), eliminazione con conferma.
- PASS: `?q=` dalla ricerca globale filtra le regole; «Togli il filtro».
- PASS: «Cartello» mostra solo le regole attive del tema; disattivato se non ce ne sono; nessun overflow a 375 px.
- Non provato: il file PDF del cartello dalla finestra reale (stesso meccanismo del riepilogo, già provato).

## Aggiornamento del 19 novembre: Riepilogo come anteprima del foglio

- PASS: periodo a pulsanti (ricarica i dati, il titolo del foglio cambia), sezioni con conteggi, ogni casella nasconde la sezione, «Mostra i costi» toglie importi e il numero «spesi», righe di apertura in corsivo sotto l'intestazione.
- PASS: layout a due colonne a 1440 px, colonna unica senza overflow a 375 px.
- PASS (caso J3 rieseguito dalla finestra reale, con 22 idee e 14 acquisti): il PDF ha 2 pagine A4 e contiene solo il foglio (niente impostazioni), numeri chiave e righe di apertura inclusi.
- Nota: la stima «circa N pagine» si aggiorna solo con la finestra visibile; è approssimata (qui 2 stimate, 2 reali).

## Aggiornamento del 19 novembre: Inventario a contenitori

- PASS: migrazione `1700000010_contenitori.js` su database pulito (collezione `contenitori`, campo `contenitore` in `inventario`).
- PASS: riga di testa con conteggi, area per area, riquadri per contenitore, «Senza contenitore» con «Metti in…», oggetti e contenitori senza area in fondo.
- PASS: nuovo contenitore, nuovo oggetto dentro un contenitore (area ereditata), modifica in linea, eliminazione di un contenitore con oggetti (messaggio chiaro, gli oggetti restano senza contenitore), `?q=` filtra gli oggetti.
- PASS: nessun overflow e nessun errore Angular in console a 375 px.
- PASS: API anonima sulla nuova collezione: lista vuota, scrittura rifiutata (400).
- Non provato: eliminare un'area che contiene contenitori (stesso comportamento delle altre relazioni verso `aree`).

## Aggiornamento del 19 novembre: cassettiere disegnate (cassetti singoli)

- PASS: migrazione `1700000011_cassetti.js` su database pulito (collezione `cassetti`, indice unico cassettiera+numero, campi `tipo` e `assegnata_a` tolti da `cassettiere`). I dati esistenti non vengono convertiti: le vecchie cassettiere restano senza cassetti.
- PASS: cassettiere disegnate per area, cassetti colorati per tipo, «tutta» sul primo cassetto quando sono tutti della stessa persona, legenda contata sui cassetti.
- PASS: assegnare un solo cassetto, assegnare tutta la cassettiera, passare da personale a libero, nuova cassettiera con N cassetti (numero proposto), numero duplicato rifiutato con messaggio, «+ Cassetto», eliminazione della cassettiera con i suoi cassetti (cascata), creazione in blocco con cassetti per cassettiera.
- PASS: a 375 px il riquadro di dettaglio sta sotto, senza overflow e senza errori Angular in console.
- PASS: numero di cassetto duplicato nella stessa cassettiera rifiutato dall'API.

## Aggiornamento del 19 novembre: ricerca dei cassetti

- PASS: Ctrl K trova i cassetti per persona o contenuto, con «Cassettiera N · cassetto M · area»; il clic apre la scheda Cassettiere con quel cassetto selezionato, anche quando la scheda è già aperta.
