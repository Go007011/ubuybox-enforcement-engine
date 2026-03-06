const {
  updateSpvStatus,
  updateOpportunity,
} = require('../../services/platformDataService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    methodNotAllowed(context, ['POST']);
    return;
  }

  try {
    const payload = parseJsonBody(req);
    const action = payload.action;

    if (!action) {
      sendJson(context, 400, { error: 'action is required.' });
      return;
    }

    if (action === 'close_spv') {
      if (!payload.spv_id) {
        sendJson(context, 400, { error: 'spv_id is required for close_spv.' });
        return;
      }

      const spv = await updateSpvStatus(payload.spv_id, 'CLOSED');
      if (!spv) {
        sendJson(context, 404, { error: 'SPV not found.' });
        return;
      }

      sendJson(context, 200, { action, spv });
      return;
    }

    if (action === 'pause_deal') {
      if (!payload.deal_id) {
        sendJson(context, 400, { error: 'deal_id is required for pause_deal.' });
        return;
      }

      const opportunity = await updateOpportunity(payload.deal_id, { status: 'PAUSED' });
      if (!opportunity) {
        sendJson(context, 404, { error: 'Deal not found.' });
        return;
      }

      sendJson(context, 200, { action, opportunity });
      return;
    }

    if (action === 'edit_opportunity') {
      if (!payload.deal_id || !payload.patch || typeof payload.patch !== 'object') {
        sendJson(context, 400, {
          error: 'deal_id and patch object are required for edit_opportunity.',
        });
        return;
      }

      const opportunity = await updateOpportunity(payload.deal_id, payload.patch);
      if (!opportunity) {
        sendJson(context, 404, { error: 'Deal not found.' });
        return;
      }

      sendJson(context, 200, { action, opportunity });
      return;
    }

    sendJson(context, 400, {
      error: 'Unsupported action.',
      supported_actions: ['close_spv', 'pause_deal', 'edit_opportunity'],
    });
  } catch (error) {
    sendJson(context, 500, { error: error.message });
  }
};
