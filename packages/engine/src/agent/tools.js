"use strict";
/**
 * Agentic Fortune Analyzer — Tool Registry
 *
 * 에이전트가 호출할 수 있는 도메인 도구들을 정의합니다.
 * 각 도구는 { name, description, execute(ctx) } 형태입니다.
 *
 * ctx (AgentContext) 구조:
 *   input      — 사용자 입력 (year, month, day, hour, minute, gender, longitude)
 *   ruleset    — 만세력 규칙셋
 *   memo       — 도구 실행 결과를 누적하는 공유 메모 객체
 */

const { calculateSajuSolar } = require("../adapters/manseryeok");
const { deriveElements }      = require("../domain/elements");
const { deriveTenGods }       = require("../domain/tenGods");
const { calcDaeun }           = require("../domain/daeun");
const { calcDailyFortune }    = require("../domain/daily");
const { compareGunghap }      = require("../domain/relations");
const { predict: mlPredict }  = require("../ml");
const { STEM_ELEMENT, BRANCH_ELEMENT, STEM_YINYANG } = require("../domain/ganzhi");

// ── 오행 관계표 ─────────────────────────────────────────────────────────────
const ELEMENT_GENERATE = { "목": "화", "화": "토", "토": "금", "금": "수", "수": "목" };
const ELEMENT_CONTROL  = { "목": "토", "토": "수", "수": "화", "화": "금", "금": "목" };

const ELEMENT_TRAITS = {
  "목": {
    keywords:  ["창의", "성장", "리더십", "추진력"],
    career:    "교육·출판·환경·목공·기획",
    health:    "간·담",
    remedy:    "수(水) 기운 보강 (파란색 착용, 물 가까이)",
    season:    "봄",
  },
  "화": {
    keywords:  ["열정", "표현력", "사교성", "직관"],
    career:    "예술·방송·요리·마케팅·에너지",
    health:    "심장·소장",
    remedy:    "목(木) 기운 보강 (초록색, 숲 산책)",
    season:    "여름",
  },
  "토": {
    keywords:  ["신뢰", "안정감", "중재력", "현실감"],
    career:    "부동산·농업·건설·교육·금융",
    health:    "비장·위",
    remedy:    "화(火) 기운 보강 (붉은색, 따뜻한 음식)",
    season:    "환절기",
  },
  "금": {
    keywords:  ["결단력", "정의감", "추진력", "원칙"],
    career:    "법률·금융·의료·군경·IT",
    health:    "폐·대장",
    remedy:    "토(土) 기운 보강 (노란색, 흙과 가까운 활동)",
    season:    "가을",
  },
  "수": {
    keywords:  ["지혜", "직관", "유연성", "창의"],
    career:    "학문·IT·유통·철학·무역",
    health:    "신장·방광",
    remedy:    "금(金) 기운 보강 (흰색 착용, 정리정돈)",
    season:    "겨울",
  },
};

const TEN_GOD_MEANINGS = {
  "비견/겁재": {
    theme:       "독립·자존·경쟁",
    positive:    "강한 자아의식, 독립심, 동료와의 협력",
    negative:    "고집, 경쟁심 과잉, 협업 어려움",
    lifeArea:    "형제·친구·동업자 관계에서 에너지가 발현됩니다.",
  },
  "식신/상관": {
    theme:       "표현·창의·재능",
    positive:    "창의력, 예술적 재능, 표현력",
    negative:    "지나친 자기 표현, 규율 거부",
    lifeArea:    "예술·교육·발표·서비스 분야에서 두각을 나타냅니다.",
  },
  "인성": {
    theme:       "학습·귀인·지원",
    positive:    "높은 학습 능력, 귀인의 도움, 직관",
    negative:    "의존성, 결단력 부족",
    lifeArea:    "학문·연구·정신적 성장·부모와의 관계에서 에너지가 나타납니다.",
  },
  "재성": {
    theme:       "재물·현실·실행",
    positive:    "현실 감각, 재물 관리 능력, 실행력",
    negative:    "물질 집착, 감정 무시",
    lifeArea:    "재물 관리·사업·배우자 관계에서 에너지가 발현됩니다.",
  },
  "관성": {
    theme:       "사회·책임·권위",
    positive:    "조직 적응력, 책임감, 사회적 지위 추구",
    negative:    "스트레스, 과도한 의무감",
    lifeArea:    "직장·사회적 역할·자녀 관계에서 에너지가 나타납니다.",
  },
  "기타": {
    theme:       "복합·특수",
    positive:    "독특한 에너지 조합",
    negative:    "방향성 모색 필요",
    lifeArea:    "다양한 분야에서 복합적으로 작용합니다.",
  },
};

// ── 개별 도구 정의 ───────────────────────────────────────────────────────────

/**
 * 도구 1: 사주 기본 계산
 * 연/월/일/시 사주팔자와 오행, 십신을 계산합니다.
 */
const TOOL_SAJU_CALC = {
  name:        "saju_calc",
  description: "사주팔자(연·월·일·시주) + 오행(五行) + 십신(十神) 기본 계산",
  async execute(ctx) {
    const saju     = await calculateSajuSolar(ctx.input);
    const elements = deriveElements(saju);
    const tenGods  = deriveTenGods(saju);
    ctx.memo.saju      = saju;
    ctx.memo.elements  = elements;
    ctx.memo.tenGods   = tenGods;
    ctx.memo.birthYear = ctx.input.year;
    return {
      pillars: {
        year:  saju.pillars.year.text,
        month: saju.pillars.month.text,
        day:   saju.pillars.day.text,
        hour:  saju.pillars.hour.text,
      },
      dayStem:          saju.pillars.day.stem,
      dayElement:       STEM_ELEMENT[saju.pillars.day.stem],
      dominantElement:  elements.dominant.element,
      weakElement:      elements.weak.element,
      elementRatios:    elements.ratios,
      tenGodMap:        tenGods.map,
    };
  },
};

/**
 * 도구 2: ML 운세 예측
 * 24차원 피처 벡터 → MLP(24→16→8→5) → 길흉 확률 분포
 */
const TOOL_ML_PREDICT = {
  name:        "ml_predict",
  description: "MLP 기반 길흉 분류 (대길/길/중길/흉/대흉) + 신뢰도",
  execute(ctx) {
    const { saju, elements, tenGods } = ctx.memo;
    const result = mlPredict(saju, elements, tenGods, {
      includeFeatures: true,
    });
    ctx.memo.mlResult = result;
    return {
      prediction:    result.prediction,
      confidence:    result.confidence,
      probabilities: result.probabilities,
    };
  },
};

/**
 * 도구 3: 대운 분석
 * 10년 주기 대운 흐름을 계산합니다.
 */
const TOOL_DAEUN = {
  name:        "daeun_forecast",
  description: "대운(大運) 10년 주기 계산 + 현재 대운 식별",
  async execute(ctx) {
    const daeun = await calcDaeun({
      saju:    ctx.memo.saju,
      input:   ctx.input,
      ruleset: ctx.ruleset,
    });
    ctx.memo.daeun = daeun;

    const age = new Date().getFullYear() - ctx.input.year;
    const currentPeriod = daeun.periods?.find(
      (p) => p.fromAge != null && p.fromAge <= age && p.toAge > age
    ) || null;

    return {
      direction:     daeun.direction === 1 ? "순행" : "역행",
      startAge:      daeun.startAge?.breakdown ?? null,
      currentPeriod: currentPeriod
        ? { pillar: currentPeriod.pillar, fromAge: Math.round(currentPeriod.fromAge), toAge: Math.round(currentPeriod.toAge) }
        : null,
      upcomingPeriods: (daeun.periods || [])
        .filter((p) => p.fromAge != null && p.fromAge > age)
        .slice(0, 3)
        .map((p) => ({ pillar: p.pillar, fromAge: Math.round(p.fromAge), toAge: Math.round(p.toAge) })),
      warning: daeun.warning || null,
    };
  },
};

/**
 * 도구 4: 오늘의 운세
 * 일진 기반 오늘의 운세를 계산합니다.
 */
const TOOL_DAILY = {
  name:        "daily_context",
  description: "오늘 일진(日辰)과 내 일간(日干)의 상생·상극 관계 분석",
  async execute(ctx) {
    const daily = await calcDailyFortune({
      userSaju:   ctx.memo.saju,
      birthInput: ctx.input,
    });
    ctx.memo.daily = daily;
    return {
      todayGanzhi: daily.todayGanzhi,
      score:       daily.score,
      luckLevel:   daily.luckLevel,
      overall:     daily.overall,
      areas:       daily.areas,
    };
  },
};

/**
 * 도구 5: 오행 상세 분석
 * 오행 균형, 생극 관계, 보완 방향을 심층 분석합니다.
 */
const TOOL_ELEMENT_DETAIL = {
  name:        "element_detail",
  description: "오행(五行) 균형 심층 분석 — 과잉·부족 진단 + 보완 방향",
  execute(ctx) {
    const { elements, saju } = ctx.memo;
    const ratios  = elements.ratios;
    const dom     = elements.dominant.element;
    const weak    = elements.weak.element;
    const domRatio = ratios[dom];
    const domTrait = ELEMENT_TRAITS[dom] || {};
    const weakTrait = ELEMENT_TRAITS[weak] || {};

    // 생극 관계 분석
    const generates = ELEMENT_GENERATE[dom]; // 강한 오행이 생하는 오행
    const controls  = ELEMENT_CONTROL[dom];  // 강한 오행이 극하는 오행

    // 균형도 점수 (0~100, 100 = 완벽한 균형 = 각 0.2)
    const variance = Object.values(ratios).reduce((sum, r) => sum + Math.pow(r - 0.2, 2), 0);
    const balanceScore = Math.max(0, Math.round(100 - variance * 500));

    // 불균형 경고
    const warnings = [];
    Object.entries(ratios).forEach(([el, r]) => {
      if (r > 0.45) warnings.push(`${el}(${(r * 100).toFixed(0)}%) 과잉 — ${ELEMENT_TRAITS[el]?.health || ""} 관련 주의`);
      if (r === 0)  warnings.push(`${el} 완전 부재 — ${ELEMENT_TRAITS[el]?.remedy || ""}`);
    });

    const stemElement = STEM_ELEMENT[saju.pillars.day.stem];
    const stemYinyang = STEM_YINYANG[saju.pillars.day.stem];

    ctx.memo.elementDetail = {
      balanceScore,
      warnings,
      domTrait,
      weakTrait,
      dominant: { element: dom, traits: domTrait },
      weak:     { element: weak, remedy: weakTrait.remedy },
    };

    return {
      dominant:     { element: dom, ratio: +(domRatio * 100).toFixed(1) + "%", traits: domTrait },
      weak:         { element: weak, ratio: +(ratios[weak] * 100).toFixed(1) + "%", remedy: weakTrait.remedy },
      balanceScore,
      generates,
      controls,
      warnings,
      dayStemProfile: {
        element:  stemElement,
        yinyang:  stemYinyang,
        keywords: ELEMENT_TRAITS[stemElement]?.keywords || [],
      },
      allRatios: Object.fromEntries(
        Object.entries(ratios).map(([k, v]) => [k, +(v * 100).toFixed(1) + "%"])
      ),
    };
  },
};

/**
 * 도구 6: 십신 상세 분석
 * 연간·월간·시간 십신 패턴과 삶의 영역별 의미를 분석합니다.
 */
const TOOL_TEN_GODS_DETAIL = {
  name:        "ten_gods_detail",
  description: "십신(十神) 패턴 심층 분석 — 성격·직업·대인관계 의미 도출",
  execute(ctx) {
    const { tenGods, elements } = ctx.memo;
    const { map } = tenGods;

    const yearMeaning  = TEN_GOD_MEANINGS[map.year]  || TEN_GOD_MEANINGS["기타"];
    const monthMeaning = TEN_GOD_MEANINGS[map.month] || TEN_GOD_MEANINGS["기타"];
    const hourMeaning  = TEN_GOD_MEANINGS[map.hour]  || TEN_GOD_MEANINGS["기타"];

    // 십신 조합 패턴 감지
    const patterns = [];
    if (map.month === "관성") patterns.push("사회적 책임·직위 지향 강함");
    if (map.month === "재성") patterns.push("현실적·경제 감각 발달");
    if (map.year  === "인성") patterns.push("귀인·학문 지원 에너지 상승");
    if (map.hour  === "식신/상관") patterns.push("창의·표현 재능이 말년에 꽃핌");
    if (map.year === map.month) patterns.push("연간과 월간 십신 일치 — 에너지 집중");

    ctx.memo.tenGodsDetail = { patterns };

    return {
      year:  { god: map.year,  ...yearMeaning  },
      month: { god: map.month, ...monthMeaning },
      hour:  { god: map.hour,  ...hourMeaning  },
      patterns,
      dominantTheme: monthMeaning.theme,
    };
  },
};

/**
 * 도구 7: 일관성 점검 (Reflection Tool)
 * ML 예측과 오행/십신 분석 사이의 일관성을 점검합니다.
 * 모순이 있을 경우 추가 분석이 필요한 영역을 식별합니다.
 */
const TOOL_CONSISTENCY_CHECK = {
  name:        "consistency_check",
  description: "ML 예측 ↔ 오행/십신 분석 일관성 점검 — 모순 감지·조정",
  execute(ctx) {
    const { mlResult, elements, tenGods, elementDetail } = ctx.memo;
    const issues = [];
    const adjustments = [];

    const pred  = mlResult?.prediction;
    const conf  = mlResult?.confidence ?? 0;
    const dom   = elements.dominant.element;
    const weak  = elements.weak.element;
    const bal   = elementDetail?.balanceScore ?? 50;

    // 낮은 신뢰도 처리
    if (conf < 0.35) {
      issues.push(`ML 신뢰도 낮음(${(conf * 100).toFixed(0)}%) — 오행 분석을 우선 참고`);
    }

    // 오행 불균형 vs ML 예측 일관성
    if (bal < 40 && (pred === "대길" || pred === "길")) {
      issues.push("오행 불균형(균형도 " + bal + ") 상태이나 ML이 길운 예측 — 복합 해석 필요");
      adjustments.push("실제 운세는 특정 분야에서 강하고 다른 분야에서 약한 불균형 양상");
    }
    if (bal >= 70 && (pred === "흉" || pred === "대흉")) {
      issues.push("오행 균형(균형도 " + bal + ")이 좋으나 ML이 흉운 예측 — 십신 패턴 우선 검토");
      adjustments.push("십신 구성에 의한 사회적·대인 갈등 요인을 중점 확인");
    }

    // 월간 십신과 대운의 일관성
    const monthGod = tenGods.map.month;
    if (monthGod === "관성" && (pred === "대흉" || pred === "흉")) {
      issues.push("월간 관성(책임·지위)이지만 흉운 예측 — 사회적 스트레스 형태의 흉");
      adjustments.push("직업·사회적 영역에서 압박이 있으나 장기적 성장 가능성 있음");
    }

    const overallAssessment = issues.length === 0
      ? "ML 예측과 오행/십신 분석 사이에 유의미한 모순이 없습니다."
      : `${issues.length}개의 조정 포인트가 발견되었습니다.`;

    ctx.memo.consistencyCheck = { issues, adjustments, overallAssessment };

    return { issues, adjustments, overallAssessment, consistent: issues.length === 0 };
  },
};

// ── 도구 레지스트리 ──────────────────────────────────────────────────────────

const TOOL_REGISTRY = {
  saju_calc:          TOOL_SAJU_CALC,
  ml_predict:         TOOL_ML_PREDICT,
  daeun_forecast:     TOOL_DAEUN,
  daily_context:      TOOL_DAILY,
  element_detail:     TOOL_ELEMENT_DETAIL,
  ten_gods_detail:    TOOL_TEN_GODS_DETAIL,
  consistency_check:  TOOL_CONSISTENCY_CHECK,
};

module.exports = { TOOL_REGISTRY };
