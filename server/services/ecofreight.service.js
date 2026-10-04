import { travelSchema, emissionsSchema } from '../schemas/travel.schema.js';
import { AppError } from '../errors/AppError.js';

export function createEcofreightService(config, fetchImpl = fetch) {
  return {
    async calculate(input) {
      const args = travelSchema.parse(input);
      if (!config.ecofreightKey) throw new AppError('Servizio di calcolo non configurato');
      try {
        const response = await fetchImpl('https://api.ecofreight.co/api/v1/calculate', {
          method: 'POST',
          signal: AbortSignal.timeout(30000),
          headers: { Authorization: `Bearer ${config.ecofreightKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { query: args.origin }, destination: { query: args.destination },
            cargo: { weight: args.weight_kg, type: 'general' }, transport_mode: args.transport_mode,
          }),
        });
        if (!response.ok) throw new Error('provider_error');
        const payload = emissionsSchema.parse(await response.json());
        return {
          co2Kg: payload.emissions.wtw,
          distanceKm: payload.calculation?.distance ?? payload.distance?.km ?? payload.distance_km,
          methodology: `EcoFreight · ${payload.methodology?.framework ?? payload.methodology?.version ?? 'metodologia non specificata'}`,
        };
      } catch {
        throw new AppError('EcoFreight non ha restituito una stima valida. Verifica la tratta o riprova più tardi.');
      }
    },
  };
}
