# Orizon

Orizon è un assistente AI che aiuta a stimare le emissioni di CO₂e legate a un viaggio. L'utente può descrivere il viaggio con parole semplici, indicando partenza, arrivo, mezzo di trasporto e peso dei bagagli.

Il progetto è stato realizzato per il corso **AI e Agenti AI per il Business** di Start2Impact.

## Obiettivo

L'idea nasce dal tema del turismo più consapevole. Capire l'impatto ambientale di un viaggio non è sempre semplice: per questo Orizon prova a rendere il dato più immediato e comprensibile anche per chi non ha conoscenze tecniche.

## Come funziona

1. L'utente scrive una richiesta nella chat.
2. L'assistente raccoglie i dati necessari: mezzo, origine, destinazione e peso dei bagagli.
3. Quando i dati sono completi, il backend usa EcoFreight per calcolare le emissioni.
4. La chat mostra la stima CO₂e insieme ai dati del viaggio.

In locale la conversazione viene salvata in SQLite. Online Orizon usa PostgreSQL su Supabase, così le chat restano disponibili anche dopo un riavvio del servizio.

## Tecnologie utilizzate

- React e Vite per il frontend
- Node.js ed Express per il backend
- OpenAI per la parte conversazionale e il function calling
- EcoFreight API per il calcolo delle emissioni
- SQLite in locale e PostgreSQL/Supabase per la memoria online
- Zod per validare le richieste della chat e i parametri del tool

## Avvio del progetto

Prima di iniziare, crea un file `.env` copiando `.env.example` e inserisci le tue chiavi API:

```bash
OPENAI_API_KEY=la_tua_chiave
ECOFREIGHT_API_KEY=la_tua_chiave
DATABASE_URL=la_stringa_di_connessione_supabase
```

La variabile `DATABASE_URL` è opzionale in locale: lasciala vuota per usare SQLite.
Serve Node.js 22 o successivo.

Installa le dipendenze e avvia l'app:

```bash
npm install
npm run dev
```

Apri poi `http://localhost:5173` nel browser.

Per controllare che il progetto compili correttamente:

```bash
npm run check
```

## Struttura del progetto

```text
src/                         Interfaccia React
server/
  index.js                   Avvio del server e collegamento delle dipendenze
  app.js                     Configurazione Express, middleware e frontend
  config/                    Lettura delle variabili d'ambiente
  routes/                    Dichiarazione degli endpoint
  controllers/               Gestione delle richieste e risposte HTTP
  services/                  Logica della chat, agente, OpenAI ed EcoFreight
  repositories/              Lettura e salvataggio delle conversazioni
  database/                  Connessioni e inizializzazione SQLite/PostgreSQL
  schemas/                   Schemi di validazione Zod
  middleware/                Validazione HTTP e gestione centralizzata errori
  errors/                    Errori applicativi con stato HTTP
  prompts/                   System prompt
  tools/                     Definizione della funzione disponibile al modello
tests/                       Test HTTP, servizi e memoria
docs/                        Documentazione del prompt
```

## Organizzazione del backend

Ho separato le responsabilità per poter modificare e verificare ogni parte del backend.
La rotta dichiara l'endpoint e applica la validazione. Il controller legge i dati validati
e costruisce la risposta HTTP. Il servizio chat salva il messaggio, recupera la cronologia
e chiede una risposta all'agente. Il repository contiene le query al database.

L'agente decide quando eseguire il tool. Il servizio OpenAI gestisce la comunicazione
con il modello, mentre il servizio EcoFreight esegue la chiamata di calcolo.
Entrambi prevedono un timeout e restituiscono errori leggibili senza esporre risposte
interne o credenziali. I controller non contengono SQL né chiamate ai provider.

Zod controlla corpo e parametri delle richieste. Lo schema del viaggio genera anche
la definizione JSON del tool: i campi inviati al modello e la validazione backend
restano allineati. Anche la risposta EcoFreight deve contenere un valore WTW valido.

L'organizzazione prende spunto dalla separazione tra rotte, controller e servizi di
[MeditActive API](https://github.com/Deborah-Porchia/meditactive-api), adattata alla chat di Orizon.

## Endpoint

L'unico endpoint che invia dati al modello è `POST /api/chat`.

```json
{
  "conversationId": "identificativo-chat",
  "message": "Volo da Milano a Tokyo con 20 kg di bagagli"
}
```

La risposta contiene `message` con `id`, `role`, `content` e `result`.
Quando mancano informazioni, `result` è nullo e l'assistente chiede i dati mancanti.
Il frontend usa inoltre `GET /api/conversations/:conversationId` per recuperare la
cronologia e Render usa `GET /api/health` per controllare che il server risponda.
L'health check non esegue chiamate ai provider o al database.

## Pubblicazione

Render serve frontend e backend dallo stesso servizio. I comandi restano
`npm ci && npm run build` per la build e `npm start` per l'avvio.
Le chiavi API e `DATABASE_URL` vanno nelle variabili d'ambiente di Render.
PostgreSQL conserva le chat anche quando Render riavvia il servizio.
Il refactoring mantiene gli endpoint e le tabelle esistenti, senza migrazioni distruttive.

## Sicurezza e limiti

Le chiavi API vengono lette solo dal backend tramite variabili d'ambiente. Il file `.env` e il database locale non devono essere pubblicati su GitHub.

Il risultato restituito da Orizon è una stima. Non rappresenta una certificazione ambientale o una compensazione delle emissioni.

EcoFreight calcola emissioni di trasporto merci: il peso dei bagagli è usato come
carico trasportato. La stima non rappresenta l'impronta totale del passeggero.
Le conversazioni sono identificate da un ID conservato nel browser, senza account:
chi conosce l'ID può recuperare la relativa chat.
La geolocalizzazione dipende da EcoFreight: il prompt richiede città e Paese per
ridurre le omonimie, ma non sostituisce una verifica indipendente della tratta.

## Verifiche

Esegui `npm test` per verificare richieste HTTP, validazione, function calling,
recupero cronologia, errori dei provider e persistenza SQLite dopo la riapertura.
`npm run check` esegue sia la build frontend sia i test.

I test automatici usano un database isolato e risposte OpenAI/EcoFreight simulate.
Verificano la logica dell'applicazione, non la qualità delle risposte di un modello
reale né la disponibilità attuale di Supabase.

Per il controllo manuale, invia “Volo da Milano a Tokyo con 20 kg di bagagli”,
poi “Il bagaglio invece pesa 15 kg” e infine cambia mezzo. Controlla il risultato
e ricarica la pagina per verificare il recupero della conversazione.
