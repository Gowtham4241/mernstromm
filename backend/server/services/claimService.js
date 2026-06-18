import { db } from '../db.js';

export function assignMechanicToClaim({ claimId, mechanicId, user }) {
  const claim = db.repairRequests.findById(claimId) || db.damageReports.findById(claimId);
  if (!claim) {
    const error = new Error('Claim not found.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== 'admin' && claim.userId !== user.id) {
    const error = new Error('You are not allowed to update this claim.');
    error.statusCode = 403;
    throw error;
  }

  const mechanic = db.mechanics.findById(mechanicId);
  if (!mechanic) {
    const error = new Error('Mechanic not found.');
    error.statusCode = 404;
    throw error;
  }

  const collection = db.repairRequests.findById(claimId) ? db.repairRequests : db.damageReports;
  const updates = {
    assignedMechanic: mechanicId,
    mechanicId,
    status: claim.status || 'Pending',
  };

  const updatedClaim = collection.update(claimId, updates);

  return {
    claim: updatedClaim,
    mechanic,
  };
}
