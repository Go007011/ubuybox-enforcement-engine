const axios = require('axios');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function fallbackSummary(deal) {
  return {
    deal_summary: `${deal.title} is a ${deal.deal_type} opportunity in ${deal.location} requiring ${deal.capital_required} in capital with an expected ROI of ${deal.expected_roi}.`,
    risk_overview: 'Key risks include execution timelines, market liquidity, and capital concentration in a single SPV.',
    investor_brief: 'Suitable for investors seeking structured SPV exposure with active enforcement monitoring.',
    model_used: 'fallback',
  };
}

async function generateDealSummary(deal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackSummary(deal);
  }

  const prompt = {
    title: deal.title,
    description: deal.description,
    location: deal.location,
    deal_type: deal.deal_type,
    purchase_price: deal.purchase_price,
    capital_required: deal.capital_required,
    expected_roi: deal.expected_roi,
  };

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON with exactly these keys: deal_summary, risk_overview, investor_brief. Keep each value concise and factual.',
          },
          {
            role: 'user',
            content: JSON.stringify(prompt),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);

    if (!parsed.deal_summary || !parsed.risk_overview || !parsed.investor_brief) {
      return fallbackSummary(deal);
    }

    return {
      deal_summary: String(parsed.deal_summary),
      risk_overview: String(parsed.risk_overview),
      investor_brief: String(parsed.investor_brief),
      model_used: DEFAULT_MODEL,
    };
  } catch (error) {
    return fallbackSummary(deal);
  }
}

module.exports = {
  generateDealSummary,
};
