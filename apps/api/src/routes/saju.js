const router = require("express").Router();
const {
  calcAll, mlPredict, analyzeAgentic,
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
 * Request body:
 * {
 *   year, month, day, hour, minute?, gender, longitude?,
 *   calendarType?: "solar" | "lunar", isLeapMonth?: boolean
 * }
 * Response:
 *   result.prediction      — 예측 클래스 (대길|길|중길|흉|대흉)
 *   result.confidence      — 예측 신뢰도 (0~1)
 *   result.probabilities   — 5개 클래스별 확률 분포
 *   result.features        — 24차원 정규화 피처 벡터
 *   result.embeddings      — 4주 × 8차원 간지 임베딩 + 평균 임베딩
 *   result.sajuMeta        — 사주 계산 메타 (달력 타입, KASI 데이터 출처, 변환 정보)
 *   result.meta            — 모델 아키텍처 메타데이터
 */
router.post("/ml-predict", async (req, res) => {
  try {
    const input = req.body || {};
    const saju     = await calculateSajuSolar(input);
    const elements = deriveElements(saju);
    const tenGods  = deriveTenGods(saju);
    const mlResult = mlPredict(saju, elements, tenGods, {
      includeEmbeddings: true,
      includeFeatures:   true,
    });
    const result = { ...mlResult, sajuMeta: saju.meta };
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

/**
 * POST /api/saju/agentic
 *
 * Agentic AI 기반 사주팔자 종합 분석을 수행합니다.
 *
 * 일반 /api/saju/calc와의 차이점:
 *   - 단순 계산·반환이 아닌, Plan → Execute → Reflect → Synthesize 루프 실행
 *   - ML 신뢰도가 낮거나 오행 불균형이 감지되면 자동으로 심층 분석 추가
 *   - 일관성 점검을 통해 ML 예측과 오행/십신 분석 사이의 모순을 조정
 *   - 실행 추적(agenticTrace)을 통해 에이전트의 추론 과정 투명하게 공개
 *
 * Request body:
 * {
 *   year, month, day, hour?, minute?, gender?, longitude?,
 *   calendarType?: "solar" | "lunar", isLeapMonth?: boolean
 * }
 *
 * Response:
 *   result.executiveSummary  — 핵심 요약
 *   result.personality       — 성격·기질 분석
 *   result.fortune.areas     — 연애/직업/재물/건강 영역별 운세
 *   result.daeun             — 대운(大運) 분석 (gender 제공 시)
 *   result.today             — 오늘의 운세
 *   result.ml                — ML 예측 결과
 *   result.recommendations   — 실행 가능한 권고사항
 *   result.raw               — 원시 사주/오행/십신/대운 데이터
 *   result.agenticTrace      — 에이전트 실행 추적 (Plan→Execute→Reflect→Synthesize)
 */
router.post("/agentic", async (req, res) => {
  try {
    const input = req.body || {};
    const result = await analyzeAgentic(input, ruleset, {
      includeDailyFortune: true,
    });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
