import { AppError } from '../errors/AppError.js';

export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Il corpo della richiesta deve essere JSON valido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Richiesta troppo grande' });
  }
  if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
  // Non esporre errori del driver, credenziali o risposte grezze dei provider.
  console.error('request_failed', { name: error.name });
  res.status(500).json({ error: 'Errore interno del server. Riprova più tardi.' });
}
