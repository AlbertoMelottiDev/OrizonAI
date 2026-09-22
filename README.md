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

## Avvio del progetto

Prima di iniziare, crea un file `.env` copiando `.env.example` e inserisci le tue chiavi API:

```bash
OPENAI_API_KEY=la_tua_chiave
ECOFREIGHT_API_KEY=la_tua_chiave
DATABASE_URL=la_stringa_di_connessione_supabase
```

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
src/       Interfaccia React
server/    API, agente AI, tool EcoFreight e memoria SQLite
docs/      System prompt dell'assistente
```

## Sicurezza e limiti

Le chiavi API vengono lette solo dal backend tramite variabili d'ambiente. Il file `.env` e il database locale non devono essere pubblicati su GitHub.

Il risultato restituito da Orizon è una stima. Non rappresenta una certificazione ambientale o una compensazione delle emissioni.

## Test eseguiti

- Calcolo di un volo da Milano a Tokyo con 20 kg di bagagli
- Ricalcolo della stessa tratta cambiando solo il peso a 15 kg
- Richiesta incompleta con domanda dell'assistente per i dati mancanti
- Build frontend e controllo sintattico del backend con `npm run check`
