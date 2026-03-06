const axios = require('axios');

async function registerSpvForEnforcement(spv, context) {
  const registrationUrl = process.env.SPV_REGISTRATION_URL;

  if (!registrationUrl) {
    context.log('[EnforcementBridge] SPV_REGISTRATION_URL not set. Skipping external registration.');
    return {
      registered: false,
      skipped: true,
    };
  }

  try {
    await axios.post(
      registrationUrl,
      {
        spv_id: spv.spv_id,
        deal_id: spv.deal_id,
        capital_required: spv.capital_required,
        capital_committed: spv.capital_committed,
        status: spv.status,
        expiration_date: spv.expiration_date,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      registered: true,
      skipped: false,
    };
  } catch (error) {
    context.log(`[EnforcementBridge] SPV registration failed: ${error.message}`);
    return {
      registered: false,
      skipped: false,
      error: error.message,
    };
  }
}

module.exports = {
  registerSpvForEnforcement,
};
