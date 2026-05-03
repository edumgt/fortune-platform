"use strict";
/**
 * 사주 ML 피처 추출기 (Feature Extractor)
 *
 * 사주팔자(四柱八字) 계산 결과를 머신러닝 모델에 입력 가능한
 * 24차원 정규화 수치 벡터로 변환합니다.
 *
 * 벡터 구조 (FEATURE_DIM = 24):
 *   [0-3]   연주(年柱): 천간인덱스/9, 지지인덱스/11, 천간오행인덱스/4, 음양(1=양)
 *   [4-7]   월주(月柱): 위와 동일
 *   [8-11]  일주(日柱): 위와 동일
 *   [12-15] 시주(時柱): 위와 동일
 *   [16-20] 오행 비율 5개: 목·화·토·금·수 (합 = 1.0)
 *   [21-23] 십신 인덱스/5: 연간·월간·시간 위치
 *
 * 모든 값은 [0, 1] 범위로 정규화되어 있습니다.
 */

const { STEMS, BRANCHES, STEM_ELEMENT, STEM_YINYANG } = require("../domain/ganzhi");

/** 오행 순서 (고정) */
const ELEMENTS = ["목", "화", "토", "금", "수"];

/**
 * 십신 목록 (인덱스 → 정규화 값 매핑):
 *   0=비견/겁재(0.0), 1=식신/상관(0.2), 2=인성(0.4),
 *   3=재성(0.6), 4=관성(0.8), 5=기타(1.0)
 *
 * 비견/겁재, 식신/상관은 각각 두 신(神)을 통합한 표현으로
 * 음양(陰陽) 구분을 생략한 간략화입니다.
 */
const TEN_GODS_LIST = ["비견/겁재", "식신/상관", "인성", "재성", "관성", "기타"];

/** 피처 벡터 차원 */
const FEATURE_DIM = 24;

/**
 * 사주 계산 결과에서 ML 피처 벡터를 추출합니다.
 *
 * @param {object} saju     - calculateSajuSolar() 결과
 * @param {object} elements - deriveElements() 결과
 * @param {object} tenGods  - deriveTenGods() 결과
 * @returns {number[]} 24차원 정규화 피처 벡터 (값 범위: [0, 1])
 */
function extractFeatures(saju, elements, tenGods) {
  const vec = new Array(FEATURE_DIM).fill(0);
  let i = 0;

  // ── 사주 4주 피처 (4 pillars × 4 features = 16) ──────────────────────────
  const pillarOrder = ["year", "month", "day", "hour"];
  for (const key of pillarOrder) {
    const pillar = saju.pillars[key];
    // 천간 인덱스 (갑=0 … 계=9) → /9
    vec[i++] = STEMS.indexOf(pillar.stem) / 9;
    // 지지 인덱스 (자=0 … 해=11) → /11
    vec[i++] = BRANCHES.indexOf(pillar.branch) / 11;
    // 천간 오행 인덱스 (목=0 … 수=4) → /4
    vec[i++] = ELEMENTS.indexOf(STEM_ELEMENT[pillar.stem]) / 4;
    // 음양 (양=1, 음=0)
    vec[i++] = STEM_YINYANG[pillar.stem] === "양" ? 1.0 : 0.0;
  }
  // i = 16

  // ── 오행 비율 피처 (5) ────────────────────────────────────────────────────
  for (const el of ELEMENTS) {
    vec[i++] = elements.ratios[el] ?? 0;
  }
  // i = 21

  // ── 십신 포지션 피처 (3: 연간·월간·시간) ─────────────────────────────────
  const tgPositions = ["year", "month", "hour"];
  for (const pos of tgPositions) {
    const tg = tenGods.map[pos] ?? "기타";
    const tgIdx = TEN_GODS_LIST.indexOf(tg);
    vec[i++] = (tgIdx < 0 ? TEN_GODS_LIST.length - 1 : tgIdx) / (TEN_GODS_LIST.length - 1);
  }
  // i = 24

  return vec;
}

module.exports = { extractFeatures, FEATURE_DIM, ELEMENTS, TEN_GODS_LIST };
