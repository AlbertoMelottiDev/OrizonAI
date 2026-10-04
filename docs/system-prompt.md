# System prompt di Orizon

Il system prompt inviato al modello è in [`server/prompts/system.prompt.js`](../server/prompts/system.prompt.js). Il servizio agente lo aggiunge alla cronologia come messaggio di sistema. OpenAI riceve separatamente i messaggi utente e la definizione del tool.

## Obiettivi

1. Raccogliere mezzo, origine, destinazione e peso dei bagagli.
2. Non stimare mai la CO₂ con formule inventate: quando i dati sono completi, richiamare il tool `calculate_travel_emissions`.
3. Usare la cronologia persistita per aggiornare un solo parametro senza far ripetere l'intero viaggio.
4. Restituire un linguaggio semplice, senza promesse ambientali non dimostrabili.
5. Specificare città e Paese nelle query EcoFreight; chiedere chiarimenti sulle località ambigue.

Il backend possiede le chiavi delle API e media tutte le chiamate. Il browser non può invocare EcoFreight o OpenAI direttamente.
