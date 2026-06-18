import { assignMechanicToClaim } from '../services/claimService.js';

export function assignMechanic(req, res) {
  try {
    const result = assignMechanicToClaim({
      claimId: req.params.id,
      mechanicId: req.body.mechanicId,
      user: req.user,
    });

    return res.json({
      success: true,
      claim: result.claim,
      mechanic: result.mechanic,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to assign mechanic.',
    });
  }
}
