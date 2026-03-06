const https = require('https');

const SPV_LIST_URL = 'https://ubuybox-api-007011.azurewebsites.net/api/spv-list';

function pickFirst(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return fallback;
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim().toUpperCase();
}

function normalizeSpv(spv = {}) {
  return {
    id: String(pickFirst(spv, ['id', 'spvId', 'dealId', '_id'], 'UNKNOWN_SPV')),
    name: String(pickFirst(spv, ['name', 'spvName', 'dealName'], 'Unnamed SPV')),
    expirationDate: normalizeDate(
      pickFirst(spv, ['expirationDate', 'expiryDate', 'dealExpiryDate', 'dealExpiry'])
    ),
    capitalCommitted: normalizeNumber(
      pickFirst(spv, ['capitalCommitted', 'committedCapital'])
    ),
    capitalRequired: normalizeNumber(pickFirst(spv, ['capitalRequired', 'requiredCapital'])),
    status: normalizeStatus(pickFirst(spv, ['status', 'spvStatus', 'dealStatus'], '')),
  };
}

function extractSpvRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.spvList)) {
    return payload.spvList;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          const { statusCode = 0 } = response;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`SPV list request failed with status ${statusCode}.`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Unable to parse SPV list response: ${error.message}`));
          }
        });
      }
    );

    request.on('error', (error) => {
      reject(new Error(`SPV list request error: ${error.message}`));
    });

    request.end();
  });
}

async function fetchSpvList(context) {
  const payload = await fetchJson(SPV_LIST_URL);
  const records = extractSpvRecords(payload).map((spv) => normalizeSpv(spv));

  context.log(`[spvService] Retrieved ${records.length} SPV record(s).`);
  return records;
}

module.exports = {
  fetchSpvList,
  normalizeSpv,
  extractSpvRecords,
};
