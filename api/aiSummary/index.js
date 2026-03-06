const {
  getAiSummary,
  saveAiSummary,
  getOpportunityById,
} = require('../../services/platformDataService');
const { generateDealSummary } = require('../../services/aiSummaryService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const dealId = req.query?.deal_id;
    if (!dealId) {
      sendJson(context, 400, { error: 'deal_id query parameter is required.' });
      return;
    }

    const summary = await getAiSummary(dealId);
    sendJson(context, 200, { summary });
    return;
  }

  if (method === 'POST') {
    try {
      const payload = parseJsonBody(req);
      if (!payload.deal_id) {
        sendJson(context, 400, { error: 'deal_id is required.' });
        return;
      }

      const deal = await getOpportunityById(payload.deal_id);
      if (!deal) {
        sendJson(context, 404, { error: 'Deal not found.' });
        return;
      }

      const generatedSummary = await generateDealSummary(deal);
      const saved = await saveAiSummary(payload.deal_id, generatedSummary);

      sendJson(context, 200, { summary: saved });
    } catch (error) {
      sendJson(context, 500, { error: error.message });
    }

    return;
  }

  methodNotAllowed(context, ['GET', 'POST']);
};
