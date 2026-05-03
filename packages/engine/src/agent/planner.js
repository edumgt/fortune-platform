"use strict";
/**
 * Agentic Fortune Analyzer — Planner
 *
 * 사용자 입력을 분석하여 실행할 도구 목록(실행 계획)을 결정합니다.
 * 이것이 "agentic" 동작의 시작점입니다 — 단순히 모든 도구를 실행하는 것이 아니라,
 * 입력 컨텍스트에 맞게 필요한 도구만 선택합니다.
 *
 * 계획 결정 규칙:
 *   1. saju_calc     — 항상 실행 (모든 분석의 기초)
 *   2. ml_predict    — 항상 실행 (길흉 예측)
 *   3. element_detail — 항상 실행 (오행 상세 필요)
 *   4. ten_gods_detail — 항상 실행 (십신 패턴 분석)
 *   5. daeun_forecast — gender가 제공된 경우에만 실행
 *   6. daily_context  — includeDailyFortune 옵션이 true(기본값)일 때 실행
 *
 * 반성(Reflect) 후 추가 도구:
 *   7. consistency_check — ML 신뢰도 < 0.40 이거나 오행 균형도 < 50일 때
 */

const LOW_CONFIDENCE_THRESHOLD = 0.40;
const LOW_BALANCE_THRESHOLD    = 50;

/**
 * 초기 실행 계획을 수립합니다.
 *
 * @param {object} input    — 사용자 입력 (year, month, day, hour, gender?, ...)
 * @param {object} [opts]
 * @param {boolean} [opts.includeDailyFortune=true]
 * @returns {string[]} 실행할 도구 이름 목록 (순서 중요)
 */
function createInitialPlan(input, opts = {}) {
  const plan = ["saju_calc", "ml_predict", "element_detail", "ten_gods_detail"];

  if (input.gender === "M" || input.gender === "F") {
    plan.push("daeun_forecast");
  }

  if (opts.includeDailyFortune !== false) {
    plan.push("daily_context");
  }

  return plan;
}

/**
 * 반성(Reflect) 후 추가 도구를 결정합니다.
 *
 * @param {object} memo — 현재까지의 분석 결과 메모
 * @returns {string[]}  — 추가로 실행할 도구 목록 (빈 배열이면 추가 불필요)
 */
function createReflectionPlan(memo) {
  const additionalTools = [];
  const mlConf  = memo.mlResult?.confidence ?? 1;
  const balance = memo.elementDetail?.balanceScore ?? 100;

  if (mlConf < LOW_CONFIDENCE_THRESHOLD || balance < LOW_BALANCE_THRESHOLD) {
    additionalTools.push("consistency_check");
  }

  return additionalTools;
}

/**
 * 반성 결과로 추가 실행이 필요한 이유를 설명합니다.
 *
 * @param {object} memo
 * @returns {string}
 */
function explainReflectionPlan(memo) {
  const reasons = [];
  const mlConf  = memo.mlResult?.confidence ?? 1;
  const balance = memo.elementDetail?.balanceScore ?? 100;

  if (mlConf < LOW_CONFIDENCE_THRESHOLD) {
    reasons.push(`ML 신뢰도 낮음(${(mlConf * 100).toFixed(1)}% < ${(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`);
  }
  if (balance < LOW_BALANCE_THRESHOLD) {
    reasons.push(`오행 균형도 낮음(${balance} < ${LOW_BALANCE_THRESHOLD})`);
  }

  return reasons.join(", ");
}

module.exports = { createInitialPlan, createReflectionPlan, explainReflectionPlan };
