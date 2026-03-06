const {
  getInvestorCriteria,
  upsertInvestorCriteria,
} = require('../../services/platformDataService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const investorId = req.query?.investor_id;
    if (!investorId) {
      sendJson(context, 400, { error: 'investor_id query parameter is required.' });
      return;
    }

    const criteria = await getInvestorCriteria(investorId);
    sendJson(context, 200, { criteria });
    return;
  }

  if (method === 'POST') {
    try {
      const payload = parseJsonBody(req);
      if (!payload.investor_id) {
        sendJson(context, 400, { error: 'investor_id is required.' });
        return;
      }

      const criteria = await upsertInvestorCriteria(payload.investor_id, payload);
      sendJson(context, 200, { criteria });
    } catch (error) {
      sendJson(context, 500, { error: error.message });
    }

    return;
  }

  methodNotAllowed(context, ['GET', 'POST']);
};
