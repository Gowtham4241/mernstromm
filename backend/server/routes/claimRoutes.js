import { Router } from 'express';
import { assignMechanic } from '../controllers/claimController.js';
import { requireAuth } from '../auth.js';
import { validateAssignMechanicPayload } from '../validations/claimValidation.js';

const router = Router();

router.put('/:id/assign-mechanic', requireAuth, validateAssignMechanicPayload, assignMechanic);

export default router;
