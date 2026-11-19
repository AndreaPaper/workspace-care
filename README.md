# Workspace Care

App Windows personale per gestire la cura dell'ufficio: idee, richieste, acquisti, controlli periodici,
inventario, cassettiere e regole, con riepilogo PDF per la direzione.
Stack: Angular + Angular Material, PocketBase, Electron. Vedi `CLAUDE.md` per l'architettura.

## Requisiti per sviluppare
- Node 22.22+ (o 24 / 26) e npm
- `backend/pocketbase.exe` (Windows x64, [release ufficiali](https://github.com/pocketbase/pocketbase/releases); testato con 0.40.6).
  Il file non è nel repository.

## Sviluppo
```powershell
cd frontend; npm install; npx ng build     # build in frontend/dist/frontend/browser
cd ../desktop; npm install; npm start      # avvia Electron + PocketBase in locale
```
In sviluppo i dati stanno in `backend/pb_data` (non versionato) e l'account interno in `%APPDATA%\workspace-care`.
Per cancellare tutto e ripartire da zero basta eliminare queste due cartelle.

## Installer
```powershell
cd frontend; npx ng build
cd ../desktop; npm run dist                # desktop/out/Workspace Care Setup <versione>.exe
```
L'installer non è firmato: Windows SmartScreen chiede conferma al primo avvio.

## Pubblicare un aggiornamento

L'app installata controlla le release del repository GitHub `AndreaPaper/workspace-care` (vedi `build.publish` in `desktop/package.json`). Per rilasciare una nuova versione:

1. Alza `version` in `desktop/package.json` (es. `0.1.1`).
2. `ng build` in `frontend/`, poi `npm run dist` in `desktop/`: produce in `desktop/out/` `Workspace-Care-Setup-<versione>.exe`, il suo `.blockmap` e `latest.yml`.
3. Crea una release con il tag `v<versione>` e allega **tutti e tre** i file, per esempio con `gh release create v0.1.1 desktop/out/Workspace-Care-Setup-0.1.1.exe desktop/out/Workspace-Care-Setup-0.1.1.exe.blockmap desktop/out/latest.yml --title "0.1.1"`.

Chi ha l'app aperta vede l'avviso entro poche ore (o subito da «Controlla aggiornamenti» nella tray). Il repository deve essere pubblico, oppure l'app deve avere un token di lettura. Senza firma del codice Windows può mostrare «editore sconosciuto». La versione 0.1.0 va reinstallata a mano una volta; da lì in poi gli aggiornamenti arrivano dall'app.

## Dove sono i dati dell'app installata
`%APPDATA%\Workspace Care\pb_data` (database SQLite e immagini). Dal menu della tray, **Esporta backup…** copia
la cartella dove vuoi. L'app parte con Windows e controlla le scadenze all'avvio e ogni giorno dalle 9:00.

## Migrazioni
Le collezioni si modificano solo con nuove migrazioni in `backend/pb_migrations/` (mai a mano dal pannello).
