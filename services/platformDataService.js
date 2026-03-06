const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const hasDatabase = Boolean(process.env.DATABASE_URL);
let pool;
let schemaReady;

const memoryState = {
  opportunities: [],
  spvs: [],
  commitments: [],
  investorCriteria: new Map(),
  aiSummaries: new Map(),
  documents: [],
};

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeOpportunity(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    location: row.location,
    deal_type: row.deal_type,
    purchase_price: normalizeNumber(row.purchase_price),
    capital_required: normalizeNumber(row.capital_required),
    expected_roi: normalizeNumber(row.expected_roi),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeSpv(row) {
  if (!row) {
    return null;
  }

  return {
    spv_id: String(row.spv_id),
    deal_id: String(row.deal_id),
    spv_name: row.spv_name,
    capital_required: normalizeNumber(row.capital_required),
    capital_committed: normalizeNumber(row.capital_committed),
    status: row.status,
    expiration_date: row.expiration_date,
    monitored: Boolean(row.monitored),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getPool() {
  if (!hasDatabase) {
    return null;
  }

  if (!pool) {
    const useSsl = process.env.DATABASE_SSL === 'true';
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl
        ? {
            rejectUnauthorized,
          }
        : undefined,
    });
  }

  return pool;
}

async function ensureSchema() {
  if (!hasDatabase) {
    return;
  }

  if (!schemaReady) {
    const db = getPool();
    schemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS opportunities (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          location TEXT NOT NULL,
          deal_type TEXT NOT NULL,
          purchase_price DOUBLE PRECISION NOT NULL,
          capital_required DOUBLE PRECISION NOT NULL,
          expected_roi DOUBLE PRECISION NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS spvs (
          spv_id TEXT PRIMARY KEY,
          deal_id TEXT NOT NULL,
          spv_name TEXT NOT NULL,
          capital_required DOUBLE PRECISION NOT NULL,
          capital_committed DOUBLE PRECISION NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'OPEN',
          expiration_date TIMESTAMPTZ,
          monitored BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS commitments (
          id TEXT PRIMARY KEY,
          spv_id TEXT NOT NULL,
          investor_id TEXT NOT NULL,
          investor_name TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS investor_criteria (
          investor_id TEXT PRIMARY KEY,
          location TEXT,
          price_min DOUBLE PRECISION,
          price_max DOUBLE PRECISION,
          roi_min DOUBLE PRECISION,
          asset_type TEXT,
          deal_size DOUBLE PRECISION,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS ai_summaries (
          deal_id TEXT PRIMARY KEY,
          deal_summary TEXT NOT NULL,
          risk_overview TEXT NOT NULL,
          investor_brief TEXT NOT NULL,
          model_used TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          spv_id TEXT NOT NULL,
          investor_id TEXT NOT NULL,
          doc_type TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })();
  }

  await schemaReady;
}

async function createOpportunity(input) {
  const record = {
    id: input.id || randomUUID(),
    title: input.title,
    description: input.description,
    location: input.location,
    deal_type: input.deal_type,
    purchase_price: normalizeNumber(input.purchase_price),
    capital_required: normalizeNumber(input.capital_required),
    expected_roi: normalizeNumber(input.expected_roi),
    status: input.status || 'OPEN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!hasDatabase) {
    memoryState.opportunities.unshift(record);
    return record;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query(
    `
      INSERT INTO opportunities (
        id, title, description, location, deal_type,
        purchase_price, capital_required, expected_roi, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `,
    [
      record.id,
      record.title,
      record.description,
      record.location,
      record.deal_type,
      record.purchase_price,
      record.capital_required,
      record.expected_roi,
      record.status,
    ]
  );

  return normalizeOpportunity(rows[0]);
}

async function listOpportunities() {
  if (!hasDatabase) {
    return [...memoryState.opportunities];
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM opportunities ORDER BY created_at DESC;');
  return rows.map((row) => normalizeOpportunity(row));
}

async function getOpportunityById(id) {
  if (!hasDatabase) {
    return memoryState.opportunities.find((item) => item.id === id) || null;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM opportunities WHERE id = $1 LIMIT 1;', [id]);
  return normalizeOpportunity(rows[0]);
}

async function updateOpportunity(id, patch) {
  if (!hasDatabase) {
    const idx = memoryState.opportunities.findIndex((item) => item.id === id);
    if (idx === -1) {
      return null;
    }

    const current = memoryState.opportunities[idx];
    const next = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    memoryState.opportunities[idx] = next;
    return next;
  }

  await ensureSchema();
  const db = getPool();
  const existing = await getOpportunityById(id);
  if (!existing) {
    return null;
  }

  const merged = {
    ...existing,
    ...patch,
    purchase_price: patch.purchase_price !== undefined ? normalizeNumber(patch.purchase_price) : existing.purchase_price,
    capital_required:
      patch.capital_required !== undefined
        ? normalizeNumber(patch.capital_required)
        : existing.capital_required,
    expected_roi:
      patch.expected_roi !== undefined ? normalizeNumber(patch.expected_roi) : existing.expected_roi,
  };

  const { rows } = await db.query(
    `
      UPDATE opportunities
      SET title = $2,
          description = $3,
          location = $4,
          deal_type = $5,
          purchase_price = $6,
          capital_required = $7,
          expected_roi = $8,
          status = $9,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [
      id,
      merged.title,
      merged.description,
      merged.location,
      merged.deal_type,
      merged.purchase_price,
      merged.capital_required,
      merged.expected_roi,
      merged.status,
    ]
  );

  return normalizeOpportunity(rows[0]);
}

async function createSpv(input) {
  const record = {
    spv_id: input.spv_id || randomUUID(),
    deal_id: input.deal_id,
    spv_name: input.spv_name || `SPV-${String(input.deal_id).slice(0, 8)}`,
    capital_required: normalizeNumber(input.capital_required),
    capital_committed: normalizeNumber(input.capital_committed || 0),
    status: input.status || 'OPEN',
    expiration_date: input.expiration_date || null,
    monitored: input.monitored !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!hasDatabase) {
    memoryState.spvs.unshift(record);
    return record;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query(
    `
      INSERT INTO spvs (
        spv_id, deal_id, spv_name, capital_required,
        capital_committed, status, expiration_date, monitored
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `,
    [
      record.spv_id,
      record.deal_id,
      record.spv_name,
      record.capital_required,
      record.capital_committed,
      record.status,
      record.expiration_date,
      record.monitored,
    ]
  );

  return normalizeSpv(rows[0]);
}

async function listSpvs() {
  if (!hasDatabase) {
    return [...memoryState.spvs];
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM spvs ORDER BY created_at DESC;');
  return rows.map((row) => normalizeSpv(row));
}

async function getSpvById(spvId) {
  if (!hasDatabase) {
    return memoryState.spvs.find((item) => item.spv_id === spvId) || null;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM spvs WHERE spv_id = $1 LIMIT 1;', [spvId]);
  return normalizeSpv(rows[0]);
}

async function updateSpvStatus(spvId, status) {
  if (!hasDatabase) {
    const idx = memoryState.spvs.findIndex((item) => item.spv_id === spvId);
    if (idx === -1) {
      return null;
    }

    memoryState.spvs[idx] = {
      ...memoryState.spvs[idx],
      status,
      updated_at: new Date().toISOString(),
    };

    return memoryState.spvs[idx];
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query(
    'UPDATE spvs SET status = $2, updated_at = NOW() WHERE spv_id = $1 RETURNING *;',
    [spvId, status]
  );

  return normalizeSpv(rows[0]);
}

async function recordCommitment(input) {
  const commitment = {
    id: randomUUID(),
    spv_id: input.spv_id,
    investor_id: input.investor_id,
    investor_name: input.investor_name,
    amount: normalizeNumber(input.amount),
    created_at: new Date().toISOString(),
  };

  if (!hasDatabase) {
    const spvIndex = memoryState.spvs.findIndex((item) => item.spv_id === commitment.spv_id);
    if (spvIndex === -1) {
      throw new Error('SPV not found.');
    }

    const currentSpv = memoryState.spvs[spvIndex];
    const updatedCommitted = normalizeNumber(currentSpv.capital_committed) + commitment.amount;
    const nextStatus =
      updatedCommitted >= normalizeNumber(currentSpv.capital_required) ? 'FUNDED' : currentSpv.status;

    const updatedSpv = {
      ...currentSpv,
      capital_committed: updatedCommitted,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    memoryState.spvs[spvIndex] = updatedSpv;
    memoryState.commitments.unshift(commitment);

    return {
      commitment,
      spv: updatedSpv,
    };
  }

  await ensureSchema();
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const spvResult = await client.query('SELECT * FROM spvs WHERE spv_id = $1 FOR UPDATE;', [
      commitment.spv_id,
    ]);

    if (spvResult.rows.length === 0) {
      throw new Error('SPV not found.');
    }

    const currentSpv = normalizeSpv(spvResult.rows[0]);
    const updatedCommitted = currentSpv.capital_committed + commitment.amount;
    const nextStatus = updatedCommitted >= currentSpv.capital_required ? 'FUNDED' : currentSpv.status;

    await client.query(
      `
        INSERT INTO commitments (id, spv_id, investor_id, investor_name, amount)
        VALUES ($1,$2,$3,$4,$5);
      `,
      [
        commitment.id,
        commitment.spv_id,
        commitment.investor_id,
        commitment.investor_name,
        commitment.amount,
      ]
    );

    const updatedSpvResult = await client.query(
      `
        UPDATE spvs
        SET capital_committed = $2,
            status = $3,
            updated_at = NOW()
        WHERE spv_id = $1
        RETURNING *;
      `,
      [commitment.spv_id, updatedCommitted, nextStatus]
    );

    await client.query('COMMIT');

    return {
      commitment,
      spv: normalizeSpv(updatedSpvResult.rows[0]),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listCommitments() {
  if (!hasDatabase) {
    return [...memoryState.commitments];
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM commitments ORDER BY created_at DESC;');
  return rows.map((row) => ({
    id: row.id,
    spv_id: row.spv_id,
    investor_id: row.investor_id,
    investor_name: row.investor_name,
    amount: normalizeNumber(row.amount),
    created_at: row.created_at,
  }));
}

async function upsertInvestorCriteria(investorId, criteria) {
  const normalized = {
    location: criteria.location || null,
    price_min: criteria.price_min !== undefined ? normalizeNumber(criteria.price_min) : null,
    price_max: criteria.price_max !== undefined ? normalizeNumber(criteria.price_max) : null,
    roi_min: criteria.roi_min !== undefined ? normalizeNumber(criteria.roi_min) : null,
    asset_type: criteria.asset_type || null,
    deal_size: criteria.deal_size !== undefined ? normalizeNumber(criteria.deal_size) : null,
  };

  if (!hasDatabase) {
    memoryState.investorCriteria.set(investorId, {
      investor_id: investorId,
      ...normalized,
      updated_at: new Date().toISOString(),
    });

    return memoryState.investorCriteria.get(investorId);
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query(
    `
      INSERT INTO investor_criteria (
        investor_id, location, price_min, price_max, roi_min, asset_type, deal_size, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (investor_id)
      DO UPDATE SET
        location = EXCLUDED.location,
        price_min = EXCLUDED.price_min,
        price_max = EXCLUDED.price_max,
        roi_min = EXCLUDED.roi_min,
        asset_type = EXCLUDED.asset_type,
        deal_size = EXCLUDED.deal_size,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      investorId,
      normalized.location,
      normalized.price_min,
      normalized.price_max,
      normalized.roi_min,
      normalized.asset_type,
      normalized.deal_size,
    ]
  );

  return rows[0];
}

async function getInvestorCriteria(investorId) {
  if (!hasDatabase) {
    return memoryState.investorCriteria.get(investorId) || null;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM investor_criteria WHERE investor_id = $1 LIMIT 1;', [
    investorId,
  ]);

  return rows[0] || null;
}

async function saveAiSummary(dealId, summary) {
  const payload = {
    deal_id: dealId,
    deal_summary: summary.deal_summary,
    risk_overview: summary.risk_overview,
    investor_brief: summary.investor_brief,
    model_used: summary.model_used || null,
    updated_at: new Date().toISOString(),
  };

  if (!hasDatabase) {
    memoryState.aiSummaries.set(dealId, payload);
    return payload;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query(
    `
      INSERT INTO ai_summaries (deal_id, deal_summary, risk_overview, investor_brief, model_used, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (deal_id)
      DO UPDATE SET
        deal_summary = EXCLUDED.deal_summary,
        risk_overview = EXCLUDED.risk_overview,
        investor_brief = EXCLUDED.investor_brief,
        model_used = EXCLUDED.model_used,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      payload.deal_id,
      payload.deal_summary,
      payload.risk_overview,
      payload.investor_brief,
      payload.model_used,
    ]
  );

  return rows[0];
}

async function getAiSummary(dealId) {
  if (!hasDatabase) {
    return memoryState.aiSummaries.get(dealId) || null;
  }

  await ensureSchema();
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM ai_summaries WHERE deal_id = $1 LIMIT 1;', [dealId]);
  return rows[0] || null;
}

async function createDocuments(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const docs = records.map((record) => ({
    id: record.id || randomUUID(),
    spv_id: record.spv_id,
    investor_id: record.investor_id,
    doc_type: record.doc_type,
    content: record.content,
    created_at: new Date().toISOString(),
  }));

  if (!hasDatabase) {
    docs.forEach((doc) => memoryState.documents.unshift(doc));
    return docs;
  }

  await ensureSchema();
  const db = getPool();
  const inserted = [];

  for (const doc of docs) {
    const { rows } = await db.query(
      `
        INSERT INTO documents (id, spv_id, investor_id, doc_type, content)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *;
      `,
      [doc.id, doc.spv_id, doc.investor_id, doc.doc_type, doc.content]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

async function listDocuments(filter = {}) {
  if (!hasDatabase) {
    return memoryState.documents.filter((doc) => {
      if (filter.spv_id && doc.spv_id !== filter.spv_id) {
        return false;
      }

      if (filter.investor_id && doc.investor_id !== filter.investor_id) {
        return false;
      }

      return true;
    });
  }

  await ensureSchema();
  const db = getPool();

  if (filter.spv_id && filter.investor_id) {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE spv_id = $1 AND investor_id = $2 ORDER BY created_at DESC;',
      [filter.spv_id, filter.investor_id]
    );
    return rows;
  }

  if (filter.spv_id) {
    const { rows } = await db.query('SELECT * FROM documents WHERE spv_id = $1 ORDER BY created_at DESC;', [
      filter.spv_id,
    ]);
    return rows;
  }

  if (filter.investor_id) {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE investor_id = $1 ORDER BY created_at DESC;',
      [filter.investor_id]
    );
    return rows;
  }

  const { rows } = await db.query('SELECT * FROM documents ORDER BY created_at DESC;');
  return rows;
}

async function listDealsForFeed() {
  if (!hasDatabase) {
    return memoryState.opportunities.map((opportunity) => {
      const spv = memoryState.spvs.find((item) => item.deal_id === opportunity.id) || null;
      const summary = memoryState.aiSummaries.get(opportunity.id) || null;

      return {
        ...opportunity,
        spv,
        ai_summary: summary,
      };
    });
  }

  await ensureSchema();
  const db = getPool();

  const { rows } = await db.query(`
    SELECT
      o.*,
      s.spv_id,
      s.spv_name,
      s.capital_required AS spv_capital_required,
      s.capital_committed AS spv_capital_committed,
      s.status AS spv_status,
      s.expiration_date,
      a.deal_summary,
      a.risk_overview,
      a.investor_brief,
      a.model_used,
      a.updated_at AS summary_updated_at
    FROM opportunities o
    LEFT JOIN LATERAL (
      SELECT * FROM spvs s2
      WHERE s2.deal_id = o.id
      ORDER BY s2.created_at DESC
      LIMIT 1
    ) s ON TRUE
    LEFT JOIN ai_summaries a ON a.deal_id = o.id
    ORDER BY o.created_at DESC;
  `);

  return rows.map((row) => ({
    ...normalizeOpportunity(row),
    spv: row.spv_id
      ? {
          spv_id: row.spv_id,
          spv_name: row.spv_name,
          capital_required: normalizeNumber(row.spv_capital_required),
          capital_committed: normalizeNumber(row.spv_capital_committed),
          status: row.spv_status,
          expiration_date: row.expiration_date,
        }
      : null,
    ai_summary: row.deal_summary
      ? {
          deal_summary: row.deal_summary,
          risk_overview: row.risk_overview,
          investor_brief: row.investor_brief,
          model_used: row.model_used,
          updated_at: row.summary_updated_at,
        }
      : null,
  }));
}

async function getAdminSnapshot() {
  const [deals, spvs, commitments] = await Promise.all([
    listOpportunities(),
    listSpvs(),
    listCommitments(),
  ]);

  const capitalRaised = commitments.reduce((sum, item) => sum + normalizeNumber(item.amount), 0);

  return {
    deals,
    spvs,
    commitments,
    metrics: {
      total_deals: deals.length,
      total_spvs: spvs.length,
      total_commitments: commitments.length,
      capital_raised: capitalRaised,
    },
  };
}

module.exports = {
  createOpportunity,
  listOpportunities,
  getOpportunityById,
  updateOpportunity,
  createSpv,
  listSpvs,
  getSpvById,
  updateSpvStatus,
  recordCommitment,
  listCommitments,
  upsertInvestorCriteria,
  getInvestorCriteria,
  saveAiSummary,
  getAiSummary,
  createDocuments,
  listDocuments,
  listDealsForFeed,
  getAdminSnapshot,
};
