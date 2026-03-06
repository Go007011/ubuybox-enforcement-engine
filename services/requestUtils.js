function parseJsonBody(req) {
  if (!req || req.body === undefined || req.body === null) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      throw new Error('Request body must be valid JSON.');
    }
  }

  return {};
}

function sendJson(context, status, payload) {
  context.res = {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
  };
}

function methodNotAllowed(context, allowedMethods) {
  sendJson(context, 405, {
    error: 'Method not allowed.',
    allowedMethods,
  });
}

module.exports = {
  parseJsonBody,
  sendJson,
  methodNotAllowed,
};
