const { getAdminSnapshot } = require('../../services/platformDataService');
const { sendJson, methodNotAllowed } = require('../../services/requestUtils');

module.exports = async function (context, req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    methodNotAllowed(context, ['GET']);
    return;
  }

  try {
    const snapshot = await getAdminSnapshot();
    sendJson(context, 200, snapshot);
  } catch (error) {
    sendJson(context, 500, { error: error.message });
  }
};
