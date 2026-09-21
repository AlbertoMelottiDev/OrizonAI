const API_URL = 'https://api.ecofreight.co/api/v1/calculate';
const modes = new Set(['air', 'road', 'rail', 'sea']);

export async function calculateEcofreight(input) {
  const transportMode = String(input.transport_mode || '').toLowerCase();
  const weight = Number(input.weight_kg);
  if (!modes.has(transportMode)) throw new Error('Mezzo non supportato: scegli aereo, auto/strada, treno o nave.');
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Il peso dei bagagli deve essere un numero maggiore di zero.');
  if (!input.origin?.trim() || !input.destination?.trim()) throw new Error('Servono sia origine sia destinazione.');
  if (!process.env.ECOFREIGHT_API_KEY) throw new Error('EcoFreight non è configurato: aggiungi ECOFREIGHT_API_KEY nel file .env.');

  const response = await fetch(API_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.ECOFREIGHT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { query: input.origin }, destination: { query: input.destination },
      cargo: { weight, type: 'general' }, transport_mode: transportMode
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error?.message || `EcoFreight ha risposto con errore ${response.status}.`);
  return {
    co2Kg: payload.emissions?.wtw, distanceKm: payload.distance?.km ?? payload.distance_km,
    methodology: payload.methodology?.version ? `EcoFreight · ${payload.methodology.version}` : 'EcoFreight · GLEC Framework v3.2', raw: payload
  };
}
