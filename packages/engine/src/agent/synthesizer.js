"use strict";
/**
 * Agentic Fortune Analyzer — Synthesizer
 *
 * 모든 도구 실행 결과를 통합하여 최종 분석 보고서를 생성합니다.
 * 단순 데이터 조합이 아닌, 여러 분석 레이어의 교차 검증을 통해
 * 일관성 있는 종합 해석을 만들어냅니다.
 */

const LEVEL_KO = { great: "매우 좋음", good: "좋음", neutral: "보통", caution: "주의 필요" };

const PREDICTION_SUMMARY = {
  "대길": "전반적으로 매우 길한 흐름입니다. 중요한 도전이나 새로운 시작에 적합한 시기입니다.",
  "길":   "순탄하고 안정적인 흐름입니다. 꾸준한 노력이 결실을 맺을 수 있는 시기입니다.",
  "중길": "평온하고 안정적인 기운이 흐릅니다. 현상 유지와 내실을 다지는 데 좋은 시기입니다.",
  "흉":   "일부 어려움이 예상됩니다. 신중한 판단과 리스크 관리가 중요한 시기입니다.",
  "대흉": "어려운 국면이 예상됩니다. 무리한 도전보다 안정과 회복에 집중하는 것이 좋습니다.",
};

/**
 * 오행 기반 성격 분석 텍스트를 생성합니다.
 */
function buildPersonalityText(memo) {
  const ed  = memo.elementDetail;
  const tgd = memo.tenGodsDetail;
  const els = memo.elements;
  if (!ed || !els) return null;

  const dom      = els.dominant.element;
  const weakEl   = els.weak.element;
  const domTrait = ed.domTrait || {};
  const weakTrait = ed.weakTrait || {};
  const parts = [];

  if (dom && domTrait.keywords) {
    parts.push(`일간(日干) 오행 ${dom}(${domTrait.keywords.slice(0, 2).join("·")}) 기운이 강합니다.`);
  }
  if (domTrait.career) {
    parts.push(`${dom} 기운이 강한 분은 ${domTrait.career} 분야에서 역량이 잘 발휘됩니다.`);
  }
  if (tgd?.dominantTheme) {
    parts.push(`월간 십신 테마는 "${tgd.dominantTheme}"으로, ${tgd.month?.lifeArea || ""}`);
  }
  if (ed.balanceScore < 50 && weakEl) {
    parts.push(`${weakEl} 기운이 부족하여 균형 보완이 필요합니다. (${weakTrait.remedy || "보완 방법 참고"})`);
  }
  if (tgd?.patterns?.length > 0) {
    parts.push(...tgd.patterns.map((p) => `• ${p}`));
  }

  return parts.join("\n");
}

/**
 * 운세 영역별 분석 텍스트를 생성합니다.
 */
function buildFortuneAreas(memo) {
  const ml    = memo.mlResult;
  const daily = memo.daily;
  const ed    = memo.elementDetail;
  const cc    = memo.consistencyCheck;

  const mlPred  = ml?.prediction || "중길";
  const mlConf  = ml?.confidence || 0;
  const mlProbs = ml?.probabilities || {};

  // 분야별 운세 (daily 있으면 활용, 없으면 ML + 오행으로 추정)
  const areas = {};
  const areaKeys = ["love", "work", "money", "health"];
  for (const key of areaKeys) {
    const dailyArea = daily?.areas?.[key];
    areas[key] = {
      level:   dailyArea?.level || null,
      levelKo: dailyArea ? (LEVEL_KO[dailyArea.level] || dailyArea.level) : null,
      message: dailyArea?.message || null,
    };
  }

  // 건강 분야에 오행 건강 정보 보강
  if (ed?.domTrait?.health) {
    const dom = memo.elements?.dominant?.element;
    const healthNote = dom ? `${dom} 과잉 시 ${ed.domTrait.health} 관련 주의가 필요합니다.` : null;
    if (healthNote) areas.health.elementNote = healthNote;
  }

  // 일관성 점검 결과 반영
  const adjustmentNotes = cc?.adjustments || [];

  return { areas, mlPred, mlConf, mlProbs, adjustmentNotes };
}

/**
 * 대운 전망 텍스트를 생성합니다.
 */
function buildDaeunText(memo) {
  const daeun = memo.daeun;
  if (!daeun) return null;

  const dir = daeun.direction === 1 ? "순행" : "역행";
  const parts = [];

  if (daeun.startAge) {
    const b = daeun.startAge.breakdown;
    parts.push(`대운은 ${dir} 방향으로 약 ${b.years}년 ${b.months}개월에 시작합니다.`);
  } else {
    parts.push(`대운 방향: ${dir} (절기 데이터 범위 밖으로 시작 나이는 추정 불가)`);
  }

  // 현재 대운
  const nowAge = memo.birthYear ? (new Date().getFullYear() - memo.birthYear) : null;
  const current = nowAge != null
    ? (daeun.periods || []).find((p) => p.fromAge != null && p.fromAge <= nowAge && p.toAge > nowAge) || null
    : null;

  if (current) {
    parts.push(`현재 대운: ${current.pillar}(${Math.round(current.fromAge)}~${Math.round(current.toAge)}세)`);
  }

  // 다가오는 대운 3개
  const upcoming = (daeun.periods || [])
    .filter((p) => p.fromAge != null)
    .slice(0, 3);
  if (upcoming.length > 0) {
    parts.push("향후 대운: " + upcoming.map((p) => `${p.pillar}(${Math.round(p.fromAge)}세~)`).join(" → "));
  }

  if (daeun.warning) {
    parts.push(`⚠️ ${daeun.warning}`);
  }

  return parts.join("\n");
}

/**
 * 실행 가능한 권고사항을 생성합니다.
 */
function buildRecommendations(memo) {
  const recs = [];
  const ed   = memo.elementDetail;
  const tgd  = memo.tenGodsDetail;
  const ml   = memo.mlResult;
  const cc   = memo.consistencyCheck;

  // 오행 보완
  if (ed?.weak?.remedy) {
    recs.push(`오행 보완: ${ed.weak.element} 기운 보충 → ${ed.weak.remedy}`);
  }
  // 오행 경고
  if (ed?.warnings?.length > 0) {
    ed.warnings.slice(0, 2).forEach((w) => recs.push(`주의: ${w}`));
  }
  // 십신 패턴
  if (tgd?.patterns?.length > 0) {
    recs.push(`십신 활용: ${tgd.patterns[0]}`);
  }
  // 흉운 시 조언
  if (ml?.prediction === "흉" || ml?.prediction === "대흉") {
    recs.push("신중한 의사결정 — 충동적 투자·직업 변경·갈등 상황을 자제하세요.");
    recs.push("명상·휴식·건강 관리를 통해 내면 에너지를 충전하세요.");
  }
  // 일관성 조정 사항
  if (cc?.adjustments?.length > 0) {
    cc.adjustments.forEach((a) => recs.push(`해석 조정: ${a}`));
  }

  return recs.slice(0, 5); // 최대 5개
}

/**
 * 전체 종합 보고서를 생성합니다.
 *
 * @param {object} memo        — 도구 실행 결과 메모
 * @param {object[]} trace     — 에이전트 실행 추적 (agenticTrace)
 * @returns {object}           — 최종 분석 보고서
 */
function synthesize(memo, trace) {
  const ml   = memo.mlResult;
  const pred = ml?.prediction || "중길";
  const conf = ml?.confidence || 0;

  const predSummary   = PREDICTION_SUMMARY[pred] || "";
  const personalityText = buildPersonalityText(memo);
  const fortuneAreas    = buildFortuneAreas(memo);
  const daeunText       = buildDaeunText(memo);
  const recommendations = buildRecommendations(memo);

  // 핵심 요약 (Executive Summary)
  const dominantEl = memo.elements?.dominant?.element;
  const pillars    = memo.saju?.pillars;
  const pillarStr  = pillars
    ? `${pillars.year.text} ${pillars.month.text} ${pillars.day.text} ${pillars.hour.text}`
    : null;

  const executiveSummary = [
    pillarStr ? `사주: ${pillarStr}` : null,
    dominantEl ? `주도 오행: ${dominantEl}` : null,
    `ML 운세 예측: ${pred} (신뢰도 ${(conf * 100).toFixed(0)}%)`,
    predSummary,
  ].filter(Boolean).join("\n");

  return {
    executiveSummary,
    personality:      personalityText,
    fortune:          fortuneAreas,
    daeun:            daeunText,
    today:            memo.daily ? {
      date:        memo.daily.date,
      ganzhi:      memo.daily.todayGanzhi,
      score:       memo.daily.score,
      luckLevel:   memo.daily.luckLevel,
      overall:     memo.daily.overall,
    } : null,
    ml: {
      prediction:    pred,
      confidence:    conf,
      probabilities: ml?.probabilities || {},
    },
    recommendations,
    raw: {
      saju:     memo.saju,
      elements: memo.elements,
      tenGods:  memo.tenGods,
      daeun:    memo.daeun,
    },
    agenticTrace: trace,
  };
}

module.exports = { synthesize };
