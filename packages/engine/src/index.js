const { calculateSajuSolar } = require("./adapters/manseryeok");
const { deriveElements } = require("./domain/elements");
const { deriveTenGods } = require("./domain/tenGods");
const { calcDaeun } = require("./domain/daeun");
const { compareGunghap } = require("./domain/relations");
const { interpretSaju } = require("./domain/interpret/scorer");
const { calcDailyFortune } = require("./domain/daily");
const { predict: mlPredict } = require("./ml");
const { analyzeAgentic } = require("./agent");

async function calcAll(input, ruleset) {
  const saju = await calculateSajuSolar(input);
  const elements = deriveElements(saju);
  const tenGods = deriveTenGods(saju);
  const daeun = await calcDaeun({ saju, input, ruleset });
  const reading = interpretSaju({ elements, tenGods, daeun, ruleset });
  // ML 예측 (compact — 임베딩 제외): prediction, confidence, probabilities
  const ml = mlPredict(saju, elements, tenGods);
  return { saju, elements, tenGods, daeun, reading, ml };
}

module.exports = {
  calcAll,
  compareGunghap,
  calcDailyFortune,
  mlPredict,
  analyzeAgentic,
  // 저수준 함수: ml-predict 엔드포인트에서 공개 API 경계를 통해 접근
  calculateSajuSolar,
  deriveElements,
  deriveTenGods,
};
