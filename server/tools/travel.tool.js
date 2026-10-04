import { z } from 'zod';
import { travelSchema } from '../schemas/travel.schema.js';

export const travelTool = {
  type: 'function',
  function: {
    name: 'calculate_travel_emissions',
    description: 'Stima le emissioni del peso trasportato con EcoFreight. Servono mezzo, origine, destinazione e kg.',
    parameters: z.toJSONSchema(travelSchema, { target: 'draft-7' }),
  },
};
