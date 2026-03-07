module.exports = async function (context, myTimer) {
  context.log("dealTimer tick", new Date().toISOString());
};