"use strict";
/**
 * Agentic Fortune Analyzer — 오케스트레이터
 *
 * Agentic AI 루프를 구현합니다:
 *   1. Plan   — 입력 컨텍스트에 맞는 실행 계획 수립
 *   2. Execute — 계획된 도구들을 순서대로 실행
 *   3. Reflect — 결과를 평가하고 추가 분석 필요 여부 판단
 *   4. Re-plan/Execute — 필요시 추가 도구 실행 (최대 1회 반복)
 *   5. Synthesize — 모든 결과를 통합한 최종 보고서 생성
 *
 * 이는 단순 "prompt → response" 패턴이 아닌,
 * 스스로 계획하고 결과를 평가하고 경로를 수정하는 Agentic AI 동작입니다.
 */

const { TOOL_REGISTRY }                              = require("./tools");
const { createInitialPlan, createReflectionPlan, explainReflectionPlan } = require("./planner");
const { reflect }                                    = require("./reflector");
const { synthesize }                                 = require("./synthesizer");

const MAX_ITERATIONS = 2; // 최대 반성 반복 횟수

/**
 * Agentic 사주 분석을 수행합니다.
 *
 * @param {object} input   — 사용자 입력
 *   @param {number} input.year     — 출생 연도
 *   @param {number} input.month    — 출생 월
 *   @param {number} input.day      — 출생 일
 *   @param {number} [input.hour=12]    — 출생 시
 *   @param {number} [input.minute=0]   — 출생 분
 *   @param {string} [input.gender]     — 성별 ('M' | 'F')
 *   @param {number} [input.longitude]  — 경도 (시간 보정용)
 * @param {object} ruleset — 만세력 규칙셋
 * @param {object} [opts]
 *   @param {boolean} [opts.includeDailyFortune=true] — 오늘의 운세 포함 여부
 *
 * @returns {Promise<object>} 종합 분석 보고서
 */
async function analyzeAgentic(input, ruleset, opts = {}) {
  // ── AgentContext: 도구들이 공유하는 실행 컨텍스트 ───────────────────────
  const ctx = {
    input,
    ruleset,
    memo: {},        // 누적 분석 결과 (도구 간 공유 메모리)
  };

  const trace    = [];   // 실행 추적 로그
  const executed = [];   // 실행된 도구 이름 목록

  let stepIdx = 0;

  // ── Step 헬퍼 ────────────────────────────────────────────────────────────
  async function runTool(toolName, reason) {
    stepIdx++;
    const tool = TOOL_REGISTRY[toolName];
    if (!tool) {
      trace.push({ step: stepIdx, tool: toolName, reason, status: "skipped", note: "도구를 찾을 수 없음" });
      return;
    }

    const start = Date.now();
    let result;
    let status = "success";
    let errorNote = null;

    try {
      result = await Promise.resolve(tool.execute(ctx));
    } catch (err) {
      status    = "error";
      errorNote = String(err?.message || err);
      result    = null;
    }

    const elapsed = Date.now() - start;
    executed.push(toolName);
    trace.push({
      step:    stepIdx,
      tool:    toolName,
      reason,
      status,
      elapsed: `${elapsed}ms`,
      ...(errorNote ? { error: errorNote } : {}),
      ...(result !== null ? { summary: _summarizeResult(toolName, result) } : {}),
    });
  }

  // ── Phase 1: Plan ────────────────────────────────────────────────────────
  stepIdx++;
  const initialPlan = createInitialPlan(input, opts);
  trace.push({
    step:   stepIdx,
    action: "plan",
    plan:   initialPlan,
    reason: "입력 컨텍스트 기반 초기 실행 계획 수립",
  });

  // ── Phase 2: Execute (초기 계획) ─────────────────────────────────────────
  // saju_calc은 반드시 먼저 실행 (다른 도구들의 의존성)
  const firstTool = initialPlan[0];
  if (firstTool === "saju_calc") {
    await runTool("saju_calc", "초기 계획: 모든 분석의 기초 계산");
  }

  // 나머지 도구들을 계획 순서대로 실행
  for (const toolName of initialPlan.slice(1)) {
    const reason = `초기 계획: ${TOOL_REGISTRY[toolName]?.description || toolName}`;
    await runTool(toolName, reason);
  }

  // ── Phase 3: Reflect ─────────────────────────────────────────────────────
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    stepIdx++;
    const reflection = reflect(ctx.memo, executed);
    trace.push({
      step:    stepIdx,
      action:  "reflect",
      summary: reflection.summary,
      findings: reflection.findings,
    });

    if (!reflection.needsMoreAnalysis) {
      break;
    }

    // ── Phase 4: Re-plan & Execute (추가 분석) ───────────────────────────
    stepIdx++;
    const additionalPlan = createReflectionPlan(ctx.memo);
    const reflectionReason = explainReflectionPlan(ctx.memo);
    trace.push({
      step:   stepIdx,
      action: "re-plan",
      plan:   additionalPlan,
      reason: `반성 후 추가 계획: ${reflectionReason}`,
    });

    for (const toolName of additionalPlan) {
      if (!executed.includes(toolName)) {
        await runTool(toolName, `반성 후 추가: ${reflectionReason}`);
      }
    }
  }

  // ── Phase 5: Synthesize ──────────────────────────────────────────────────
  stepIdx++;
  trace.push({
    step:   stepIdx,
    action: "synthesize",
    reason: `${executed.length}개 도구 실행 결과 통합 → 최종 보고서 생성`,
  });

  const report = synthesize(ctx.memo, {
    iterations:    trace.filter((t) => t.action === "reflect").length,
    totalSteps:    stepIdx,
    toolsExecuted: executed,
    steps:         trace,
  });

  return report;
}

/**
 * 도구 결과의 간략한 요약 문자열을 반환합니다 (추적 로그용).
 */
function _summarizeResult(toolName, result) {
  if (!result) return null;
  switch (toolName) {
    case "saju_calc":
      return `일주: ${result.pillars?.day}, 주도오행: ${result.dominantElement}`;
    case "ml_predict":
      return `예측: ${result.prediction}, 신뢰도: ${(result.confidence * 100).toFixed(0)}%`;
    case "daeun_forecast":
      return result.currentPeriod
        ? `현재 대운: ${result.currentPeriod.pillar}(${result.currentPeriod.fromAge}~${result.currentPeriod.toAge}세)`
        : "대운 기산 범위 외";
    case "daily_context":
      return `오늘 일진: ${result.todayGanzhi?.pillar}, 운세점수: ${result.score}`;
    case "element_detail":
      return `균형도: ${result.balanceScore}, 주도: ${result.dominant?.element}`;
    case "ten_gods_detail":
      return `월간 십신: ${result.month?.god}, 테마: ${result.dominantTheme}`;
    case "consistency_check":
      return result.consistent ? "일관성 확인 완료" : `${result.issues?.length}개 조정 포인트`;
    default:
      return JSON.stringify(result).slice(0, 80);
  }
}

module.exports = { analyzeAgentic };
