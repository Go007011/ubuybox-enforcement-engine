const DEFAULT_ALLOWED_STATUSES = ['OPEN', 'ACTIVE', 'PENDING', 'APPROVED', 'FUNDED'];

function getAllowedStatuses() {
  const rawStatuses = process.env.SPV_ALLOWED_STATUSES;
  if (!rawStatuses) {
    return new Set(DEFAULT_ALLOWED_STATUSES);
  }

  const statuses = rawStatuses
    .split(',')
    .map((status) => status.trim().toUpperCase())
    .filter(Boolean);

  return new Set(statuses.length > 0 ? statuses : DEFAULT_ALLOWED_STATUSES);
}

function evaluateSpv(spv, now = new Date(), allowedStatuses = getAllowedStatuses()) {
  const violations = [];

  if (spv.expirationDate instanceof Date && spv.expirationDate < now) {
    violations.push({
      rule: 'RULE_1_EXPIRATION_DATE',
      message: 'SPV expired',
      action: 'FLAG_EXPIRED',
    });
  }

  if (
    typeof spv.capitalCommitted === 'number' &&
    typeof spv.capitalRequired === 'number' &&
    spv.capitalCommitted < spv.capitalRequired
  ) {
    violations.push({
      rule: 'RULE_2_CAPITAL_DEFICIENCY',
      message: 'Capital deficiency',
      action: 'FLAG_CAPITAL_DEFICIENCY',
    });
  }

  if (!allowedStatuses.has(spv.status)) {
    violations.push({
      rule: 'RULE_3_INVALID_STATUS',
      message: 'Invalid SPV status',
      action: 'FLAG_INVALID_STATUS',
    });
  }

  return {
    spv,
    violations,
  };
}

function evaluateSpvs(spvList, now = new Date()) {
  const allowedStatuses = getAllowedStatuses();
  return spvList.map((spv) => evaluateSpv(spv, now, allowedStatuses));
}

module.exports = {
  evaluateSpv,
  evaluateSpvs,
};
