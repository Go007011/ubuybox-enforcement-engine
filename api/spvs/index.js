const {
  createSpv,
  listSpvs,
  getOpportunityById,
} = require('../../services/platformDataService');
const { registerSpvForEnforcement } = require('../../services/enforcementBridgeService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const spvs = await listSpvs();
    sendJson(context, 200, { spvs });
    return;
  }

  if (method === 'POST') {
    try {
      const payload = parseJsonBody(req);
      if (!payload.deal_id || payload.capital_required === undefined) {
        sendJson(context, 400, {
          error: 'deal_id and capital_required are required.',
        });
        return;
      }

      const deal = await getOpportunityById(payload.deal_id);
      if (!deal) {
        sendJson(context, 404, { error: 'Associated deal not found.' });
        return;
      }

      const spv = await createSpv(payload);
      const bridgeStatus = await registerSpvForEnforcement(spv, context);

      sendJson(context, 201, {
        spv,
        enforcement_registration: bridgeStatus,
      });
    } catch (error) {
      sendJson(context, 500, { error: error.message });
    }

    return;
  }

  methodNotAllowed(context, ['GET', 'POST']);
};
