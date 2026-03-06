const TEMPLATES = {
  SPV_PARTICIPATION_AGREEMENT: `SPV Participation Agreement\n\nInvestor: {{investor_name}}\nSPV: {{spv_name}}\nInvestment Amount: {{investment_amount}}\n\nThis agreement confirms participation in the SPV under UBUYBOX terms and governing policy.`,
  CAPITAL_COMMITMENT_AGREEMENT: `Capital Commitment Agreement\n\nInvestor: {{investor_name}}\nSPV: {{spv_name}}\nCommitted Capital: {{investment_amount}}\n\nThis agreement records the investor commitment and funding obligations for the SPV.`,
};

function renderTemplate(template, variables) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function generateParticipationDocuments(input) {
  const templateVariables = {
    investor_name: input.investor_name,
    spv_name: input.spv_name,
    investment_amount: input.investment_amount,
  };

  return [
    {
      doc_type: 'SPV_PARTICIPATION_AGREEMENT',
      content: renderTemplate(TEMPLATES.SPV_PARTICIPATION_AGREEMENT, templateVariables),
    },
    {
      doc_type: 'CAPITAL_COMMITMENT_AGREEMENT',
      content: renderTemplate(TEMPLATES.CAPITAL_COMMITMENT_AGREEMENT, templateVariables),
    },
  ];
}

module.exports = {
  generateParticipationDocuments,
};
