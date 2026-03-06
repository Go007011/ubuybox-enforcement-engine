const {
  recordCommitment,
  getSpvById,
  createDocuments,
  upsertInvestorCriteria,
} = require('../../services/platformDataService');
const { generateParticipationDocuments } = require('../../services/documentService');
const { parseJsonBody, sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    methodNotAllowed(context, ['POST']);
    return;
  }

  try {
    const payload = parseJsonBody(req);
    const amount = Number(payload.investment_amount);

    if (!payload.spv_id || !payload.investor_id || !payload.investor_name || !Number.isFinite(amount) || amount <= 0) {
      sendJson(context, 400, {
        error: 'spv_id, investor_id, investor_name, and positive investment_amount are required.',
      });
      return;
    }

    const existingSpv = await getSpvById(payload.spv_id);
    if (!existingSpv) {
      sendJson(context, 404, { error: 'SPV not found.' });
      return;
    }

    const commitmentResult = await recordCommitment({
      spv_id: payload.spv_id,
      investor_id: payload.investor_id,
      investor_name: payload.investor_name,
      amount,
    });

    if (payload.investor_criteria && typeof payload.investor_criteria === 'object') {
      await upsertInvestorCriteria(payload.investor_id, payload.investor_criteria);
    }

    const generatedDocuments = generateParticipationDocuments({
      investor_name: payload.investor_name,
      spv_name: existingSpv.spv_name,
      investment_amount: amount,
    });

    const storedDocuments = await createDocuments(
      generatedDocuments.map((item) => ({
        spv_id: payload.spv_id,
        investor_id: payload.investor_id,
        doc_type: item.doc_type,
        content: item.content,
      }))
    );

    sendJson(context, 200, {
      commitment: commitmentResult.commitment,
      spv: commitmentResult.spv,
      documents: storedDocuments,
    });
  } catch (error) {
    sendJson(context, 500, { error: error.message });
  }
};
