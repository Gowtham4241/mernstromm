export function validateAssignMechanicPayload(req, res, next) {
  const { id } = req.params;
  const { mechanicId } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Claim id is required.' });
  }

  if (!mechanicId || typeof mechanicId !== 'string') {
    return res.status(400).json({ error: 'mechanicId is required.' });
  }

  return next();
}
