const router = require("express").Router();
const {
  calcAll, mlPredict,
  calculateSajuSolar, deriveElements, deriveTenGods,
} = require("@fortune/engine");
const ruleset = require("@fortune/engine/src/rulesets/standard.kr");

router.post("/calc", async (req, res) => {
  try {
    const input = req.body || {};
    const result = await calcAll(input, ruleset);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

/**
 * POST /api/saju/ml-predict
 *
 * 사주 데이터에 대해 ML/DL 기반 상세 운세 예측을 수행합니다.
 * /api/saju/calc 보다 가벼우며, 임베딩·피처 벡터를 포함한 전체 ML 결과를 반환합니다.
 *
 * Request body: { year, month, day, hour, minute?, gender, longitude? }
 * Response:
 *   result.prediction      — 예측 클래스 (대길|길|중길|흉|대흉)
 *   result.confidence      — 예측 신뢰도 (0~1)
 *   result.probabilities   — 5개 클래스별 확률 분포
 *   result.features        — 24차원 정규화 피처 벡터
 *   result.embeddings      — 4주 × 8차원 간지 임베딩 + 평균 임베딩
 *   result.meta            — 모델 아키텍처 메타데이터
 */
router.post("/ml-predict", async (req, res) => {
  try {
    const input = req.body || {};
    const saju     = await calculateSajuSolar(input);
    const elements = deriveElements(saju);
    const tenGods  = deriveTenGods(saju);
    const result   = mlPredict(saju, elements, tenGods, {
      includeEmbeddings: true,
      includeFeatures:   true,
    });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
