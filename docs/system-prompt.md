# System prompt di Orizon

Il system prompt effettivamente inviato al modello è conservato in [`server/agent.js`](../server/agent.js). È separato concettualmente dagli input utente per mantenere l'agente coerente, sicuro e verificabile.

## Obiettivi

1. Raccogliere mezzo, origine, destinazione e peso dei bagagli.
2. Non stimare mai la CO₂ con formule inventate: quando i dati sono completi, richiamare il tool `calculate_travel_emissions`.
3. Usare la cronologia persistita per aggiornare un solo parametro senza far ripetere l'intero viaggio.
4. Restituire un linguaggio semplice, senza promesse ambientali non dimostrabili.

Il backend possiede le chiavi delle API e media tutte le chiamate. Il browser non può invocare EcoFreight o OpenAI direttamente.
