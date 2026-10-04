export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Dati della richiesta non validi',
        details: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
      });
    }
    res.locals[source] = result.data;
    next();
  };
}
