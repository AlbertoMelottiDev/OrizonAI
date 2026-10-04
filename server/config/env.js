export function getConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3001),
    openaiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL || 'gpt-4.1-mini',
    ecofreightKey: env.ECOFREIGHT_API_KEY,
    databaseUrl: env.DATABASE_URL,
  };
}
