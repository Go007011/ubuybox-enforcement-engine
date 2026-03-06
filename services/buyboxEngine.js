function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function scoreLocation(opportunity, criteria) {
  if (!criteria.location) {
    return 10;
  }

  const expected = String(criteria.location).toLowerCase();
  const actual = String(opportunity.location || '').toLowerCase();
  return actual.includes(expected) ? 25 : 0;
}

function scorePrice(opportunity, criteria) {
  const purchasePrice = normalizeNumber(opportunity.purchase_price);
  const priceMin = normalizeNumber(criteria.price_min);
  const priceMax = normalizeNumber(criteria.price_max);

  if (purchasePrice === null || (priceMin === null && priceMax === null)) {
    return 10;
  }

  if (priceMin !== null && purchasePrice < priceMin) {
    return 0;
  }

  if (priceMax !== null && purchasePrice > priceMax) {
    return 0;
  }

  return 25;
}

function scoreRoi(opportunity, criteria) {
  const expectedRoi = normalizeNumber(opportunity.expected_roi);
  const roiMin = normalizeNumber(criteria.roi_min);

  if (expectedRoi === null || roiMin === null) {
    return 10;
  }

  return expectedRoi >= roiMin ? 25 : 0;
}

function scoreAssetType(opportunity, criteria) {
  if (!criteria.asset_type) {
    return 7;
  }

  const expected = String(criteria.asset_type).toLowerCase();
  const actual = String(opportunity.deal_type || '').toLowerCase();
  return actual === expected ? 15 : 0;
}

function scoreDealSize(opportunity, criteria) {
  const dealSize = normalizeNumber(opportunity.capital_required);
  const preferredSize = normalizeNumber(criteria.deal_size);

  if (dealSize === null || preferredSize === null) {
    return 5;
  }

  const deviation = Math.abs(dealSize - preferredSize) / Math.max(preferredSize, 1);
  if (deviation <= 0.15) {
    return 10;
  }

  if (deviation <= 0.35) {
    return 6;
  }

  return 0;
}

function scoreOpportunity(opportunity, criteria = {}) {
  const rawScore =
    scoreLocation(opportunity, criteria) +
    scorePrice(opportunity, criteria) +
    scoreRoi(opportunity, criteria) +
    scoreAssetType(opportunity, criteria) +
    scoreDealSize(opportunity, criteria);

  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

function scoreDeals(opportunities, criteria = {}) {
  return opportunities.map((deal) => ({
    ...deal,
    match_score: scoreOpportunity(deal, criteria),
  }));
}

module.exports = {
  scoreOpportunity,
  scoreDeals,
};
