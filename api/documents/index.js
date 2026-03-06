const { createDocuments, listDocuments } = require('../../services/platformDataService');
const { generateParticipationDocuments } = require('../../services/documentService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const docs = await listDocuments({
      spv_id: req.query?.spv_id,
      investor_id: req.query?.investor_id,
    });

    sendJson(context, 200, { documents: docs });
    return;
  }

  if (method === 'POST') {
    try {
      const payload = parseJsonBody(req);
      if (!payload.spv_id || !payload.investor_id || !payload.investor_name || !payload.investment_amount || !payload.spv_name) {
        sendJson(context, 400, {
          error: 'spv_id, investor_id, investor_name, spv_name, and investment_amount are required.',
        });
        return;
      }

      const generated = generateParticipationDocuments({
        investor_name: payload.investor_name,
        spv_name: payload.spv_name,
        investment_amount: payload.investment_amount,
      });

      const stored = await createDocuments(
        generated.map((doc) => ({
          spv_id: payload.spv_id,
          investor_id: payload.investor_id,
          doc_type: doc.doc_type,
          content: doc.content,
        }))
      );

      sendJson(context, 201, { documents: stored });
    } catch (error) {
      sendJson(context, 500, { error: error.message });
    }

    return;
  }

  methodNotAllowed(context, ['GET', 'POST']);
};
