const {
  listDealsForFeed,
  getInvestorCriteria,
} = require('../../services/platformDataService');
const { scoreDeals } = require('../../services/buyboxEngine');
const { sendJson, methodNotAllowed } = require('../../services/requestUtils');

function parseCriteria(req) {
  const query = req.query || {};
  return {
    location: query.location,
    price_min: query.price_min,
    price_max: query.price_max,
    roi_min: query.roi_min,
    asset_type: query.asset_type,
    deal_size: query.deal_size,
  };
}

function hasAnyCriteria(criteria) {
  return Object.values(criteria).some((value) => value !== undefined && value !== null && value !== '');
}

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    methodNotAllowed(context, ['GET']);
    return;
  }

  try {
    const query = req.query || {};
    const deals = await listDealsForFeed();

    let criteria = parseCriteria(req);
    if (!hasAnyCriteria(criteria) && query.investor_id) {
      const stored = await getInvestorCriteria(query.investor_id);
      if (stored) {
        criteria = {
          location: stored.location,
          price_min: stored.price_min,
          price_max: stored.price_max,
          roi_min: stored.roi_min,
          asset_type: stored.asset_type,
          deal_size: stored.deal_size,
        };
      }
    }

    const scoredDeals = scoreDeals(deals, criteria).map((deal) => ({
      deal_id: deal.id,
      title: deal.title,
      location: deal.location,
      expected_roi: deal.expected_roi,
      capital_required: deal.capital_required,
      match_score: deal.match_score,
      spv: deal.spv,
      ai_summary: deal.ai_summary,
      participation_endpoint: '/api/participate',
    }));

    sendJson(context, 200, {
      criteria,
      deals: scoredDeals,
    });
  } catch (error) {
    sendJson(context, 500, { error: error.message });
  }
};
