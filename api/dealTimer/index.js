const { fetchSpvList } = require('../../services/spvService');
const { evaluateSpvs } = require('../../services/ruleEngine');

module.exports = async function (context, myTimer) {
  context.log('RuleRunner started');

  if (myTimer && myTimer.isPastDue) {
    context.log('[RuleRunner] Timer trigger is running late.');
  }

  try {
    const spvs = await fetchSpvList(context);
    const evaluations = evaluateSpvs(spvs);

    if (evaluations.length === 0) {
      context.log('SPV evaluated | no SPVs returned by API');
    }

    let triggeredRuleCount = 0;
    let enforcementActionCount = 0;

    evaluations.forEach((evaluation) => {
      const { spv, violations } = evaluation;
      context.log(`SPV evaluated | id=${spv.id} | name=${spv.name}`);

      violations.forEach((violation) => {
        triggeredRuleCount += 1;
        context.log(
          `Rule triggered | spvId=${spv.id} | rule=${violation.rule} | message=${violation.message}`
        );

        enforcementActionCount += 1;
        context.log(
          `Enforcement action | spvId=${spv.id} | action=${violation.action} | rule=${violation.rule}`
        );
      });
    });

    if (triggeredRuleCount === 0) {
      context.log('Rule triggered | none');
    }

    if (enforcementActionCount === 0) {
      context.log('Enforcement action | none');
    }

    context.log(
      `[RuleRunner] Completed cycle. SPVs=${evaluations.length} Rules=${triggeredRuleCount} Actions=${enforcementActionCount}`
    );
  } catch (error) {
    context.log(`[RuleRunner] Failed: ${error.message}`);
    throw error;
  }
};
