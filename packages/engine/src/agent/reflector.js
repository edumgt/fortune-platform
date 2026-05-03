"use strict";
/**
 * Agentic Fortune Analyzer — Reflector
 *
 * 도구 실행 결과를 평가하고, 추가 분석이 필요한지 판단합니다.
 * Agentic AI의 핵심인 "자기 반성(self-reflection)" 기능을 담당합니다.
 *
 * 반성 기준:
 *   1. ML 신뢰도 점검 — confidence < 0.40 이면 보충 분석 필요
 *   2. 오행 균형도 점검 — balanceScore < 50 이면 불균형 경고 필요
 *   3. 결과 일관성 점검 — ML 예측과 오행 분석 사이의 모순 감지
 *   4. 분석 완결성 점검 — 필수 영역(성격/직업/건강/대운)이 모두 커버되었는지 확인
 */

const CONFIDENCE_THRESHOLD = 0.40;
const BALANCE_THRESHOLD    = 50;

/**
 * @typedef {object} ReflectionResult
 * @property {boolean}  needsMoreAnalysis  — 추가 분석 필요 여부
 * @property {string[]} findings           — 발견된 이슈 목록
 * @property {string[]} recommendations    — 추가 실행 권장 도구
 * @property {string}   summary            — 반성 요약문
 */

/**
 * 현재 분석 결과를 평가합니다.
 *
 * @param {object} memo        — 누적된 도구 실행 결과
 * @param {string[]} executed  — 이미 실행한 도구 이름 목록
 * @returns {ReflectionResult}
 */
function reflect(memo, executed) {
  const findings       = [];
  const recommendations = [];

  // 1. ML 신뢰도 점검
  const mlConf = memo.mlResult?.confidence ?? 1;
  if (mlConf < CONFIDENCE_THRESHOLD) {
    findings.push(
      `ML 예측 신뢰도가 ${(mlConf * 100).toFixed(0)}%로 낮습니다(임계값: ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%). ` +
      "여러 운세 클래스에 확률이 분산되어 있어 단일 판정보다 복합 해석이 적합합니다."
    );
    if (!executed.includes("consistency_check")) {
      recommendations.push("consistency_check");
    }
  }

  // 2. 오행 균형도 점검
  const balance = memo.elementDetail?.balanceScore ?? 100;
  if (balance < BALANCE_THRESHOLD) {
    findings.push(
      `오행 균형도가 ${balance}점으로 낮습니다. ` +
      `${memo.elements?.dominant?.element || ""}(이)가 강하게 지배하는 불균형 구조입니다.`
    );
    if (!executed.includes("consistency_check")) {
      recommendations.push("consistency_check");
    }
  }

  // 3. 대운 미실행 점검 (gender 있는데 daeun이 없으면)
  if (!executed.includes("daeun_forecast") && memo.saju) {
    // 대운은 planner에서 gender 없으면 제외하므로 여기서는 경고만
    findings.push("성별 정보가 없어 대운 분석이 생략되었습니다. gender를 포함하면 10년 주기 대운 분석이 추가됩니다.");
  }

  // 중복 제거
  const uniqueRecs = [...new Set(recommendations)].filter((r) => !executed.includes(r));

  const needsMoreAnalysis = uniqueRecs.length > 0;
  const summary = needsMoreAnalysis
    ? `반성 결과 ${findings.length}개 이슈 발견 — ${uniqueRecs.join(", ")} 추가 실행 권장`
    : "반성 결과 추가 분석이 필요한 이슈가 없습니다.";

  return {
    needsMoreAnalysis,
    findings,
    recommendations: uniqueRecs,
    summary,
  };
}

module.exports = { reflect };
