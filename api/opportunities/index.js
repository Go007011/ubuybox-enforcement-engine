const {
  createOpportunity,
  listOpportunities,
} = require('../../services/platformDataService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

function validateOpportunityInput(payload) {
  const required = [
    'title',
    'description',
    'location',
    'deal_type',
    'purchase_price',
    'capital_required',
    'expected_roi',
  ];

  const missing = required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
  return missing;
}

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const opportunities = await listOpportunities();
    sendJson(context, 200, { opportunities });
    return;
  }

  if (method === 'POST') {
    try {
      const payload = parseJsonBody(req);
      const missingFields = validateOpportunityInput(payload);

      if (missingFields.length > 0) {
        sendJson(context, 400, {
          error: 'Missing required opportunity fields.',
          missingFields,
        });
        return;
      }

      const created = await createOpportunity(payload);
      sendJson(context, 201, { opportunity: created });
    } catch (error) {
      sendJson(context, 500, { error: error.message });
    }

    return;
  }

  methodNotAllowed(context, ['GET', 'POST']);
};
