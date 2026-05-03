"use strict";
/**
 * 육십갑자(六十甲子) 임베딩 테이블 — 딥러닝 임베딩 레이어
 *
 * 60개 육십갑자를 각각 8차원 실수 벡터로 표현합니다.
 * 고전 명리학 속성을 기반으로 초기화된 "도메인 프리트레인(domain pre-trained)"
 * 임베딩이며, 실제 사주 데이터가 수집되면 파인튜닝(fine-tuning) 가능한
 * 구조로 설계되었습니다.
 *
 * 임베딩 차원 의미:
 *   dim 0 — 천간 오행 강도  (목=0.00 … 수=1.00, 1/4 간격)
 *   dim 1 — 천간 음양       (양=1.0, 음=0.0)
 *   dim 2 — 육십갑자 순환 위치 (0번째=0.0 … 59번째=1.0)
 *   dim 3 — 지지 오행 강도  (천간과 동일 스케일)
 *   dim 4 — 지지 계절 에너지 (봄=0.2, 여름=0.6, 가을=0.8, 겨울=0.4, 환절기=0.5)
 *   dim 5 — 천간-지지 오행 조화 (동류=0.6, 생관계=0.8, 극관계=0.2, 기타=0.5)
 *   dim 6 — 기운 활성도     (양간·활동적 간지일수록 1.0)
 *   dim 7 — 길흉 기저값     (고전 이론 기반, 길=1.0 … 흉=0.0)
 *
 * 학습 가능 구조:
 *   이 테이블을 가중치 행렬(W ∈ ℝ^{60×8})로 간주하면
 *   역전파(backpropagation)를 통해 임베딩을 업데이트할 수 있습니다.
 *   training data 형식: { pillarIndex: number(0-59), label: number(0-4) }
 */

const {
  STEMS, BRANCHES,
  STEM_ELEMENT, STEM_YINYANG, BRANCH_ELEMENT,
  pillarToIndex,
} = require("../domain/ganzhi");

/** 임베딩 차원 수 */
const EMBED_DIM = 8;

const ELEM_SCORE = { "목": 0.00, "화": 0.25, "토": 0.50, "금": 0.75, "수": 1.00 };
// 오행 상생(相生) 순환: 목→화→토→금→수→목
const GEN  = { "목": "화", "화": "토", "토": "금", "금": "수", "수": "목" };
// 오행 상극(相剋) 순환: 목→토, 토→수, 수→화, 화→금, 금→목
const KILL = { "목": "토", "토": "수", "수": "화", "화": "금", "금": "목" };

/** 지지별 계절 에너지 (봄=생장, 여름=성장, 가을=수렴, 겨울=저장) */
const BRANCH_SEASON = {
  "인": 0.20, "묘": 0.20, "진": 0.40,  // 봄 (목)
  "사": 0.60, "오": 0.60, "미": 0.50,  // 여름 (화)
  "신": 0.80, "유": 0.80, "술": 0.60,  // 가을 (금)
  "해": 0.40, "자": 0.40, "축": 0.30,  // 겨울 (수)
};

/**
 * 고전 명리 이론 기반 간지별 길흉 기저값.
 * 값이 높을수록 본래 길한 기운을 가진 간지입니다.
 * (출처: 고전 명리학 납음오행·공망 이론의 간략화)
 */
const GANZHI_LUCK_BASE = {
  "갑자": 0.70, "을축": 0.60, "병인": 0.75, "정묘": 0.65, "무진": 0.55,
  "기사": 0.50, "경오": 0.60, "신미": 0.65, "임신": 0.70, "계유": 0.60,
  "갑술": 0.55, "을해": 0.70, "병자": 0.65, "정축": 0.55, "무인": 0.60,
  "기묘": 0.65, "경진": 0.50, "신사": 0.55, "임오": 0.70, "계미": 0.60,
  "갑신": 0.65, "을유": 0.60, "병술": 0.50, "정해": 0.70, "무자": 0.55,
  "기축": 0.50, "경인": 0.70, "신묘": 0.65, "임진": 0.60, "계사": 0.50,
  "갑오": 0.70, "을미": 0.60, "병신": 0.55, "정유": 0.65, "무술": 0.50,
  "기해": 0.70, "경자": 0.60, "신축": 0.50, "임인": 0.75, "계묘": 0.65,
  "갑진": 0.55, "을사": 0.50, "병오": 0.70, "정미": 0.60, "무신": 0.55,
  "기유": 0.60, "경술": 0.50, "신해": 0.65, "임자": 0.70, "계축": 0.55,
  "갑인": 0.80, "을묘": 0.70, "병진": 0.60, "정사": 0.55, "무오": 0.65,
  "기미": 0.60, "경신": 0.70, "신유": 0.65, "임술": 0.55, "계해": 0.70,
};

/**
 * 60×8 임베딩 테이블을 생성합니다.
 * @returns {number[][]} shape: [60][EMBED_DIM]
 */
function buildEmbeddingTable() {
  const table = [];
  for (let k = 0; k < 60; k++) {
    const stem   = STEMS[k % 10];
    const branch = BRANCHES[k % 12];
    const text   = stem + branch;

    const stemElem   = STEM_ELEMENT[stem];
    const branchElem = BRANCH_ELEMENT[branch];
    const isYang     = STEM_YINYANG[stem] === "양";

    // dim 0: 천간 오행 강도
    const d0 = ELEM_SCORE[stemElem];

    // dim 1: 음양
    const d1 = isYang ? 1.0 : 0.0;

    // dim 2: 순환 위치
    const d2 = k / 59;

    // dim 3: 지지 오행 강도
    const d3 = ELEM_SCORE[branchElem];

    // dim 4: 지지 계절 에너지
    const d4 = BRANCH_SEASON[branch] ?? 0.5;

    // dim 5: 천간-지지 오행 조화
    let d5 = 0.5;
    if (stemElem === branchElem) {
      d5 = 0.6; // 동류 (比和)
    } else if (GEN[stemElem] === branchElem || GEN[branchElem] === stemElem) {
      d5 = 0.8; // 생관계 (生)
    } else if (KILL[stemElem] === branchElem || KILL[branchElem] === stemElem) {
      d5 = 0.2; // 극관계 (剋)
    }

    // dim 6: 기운 활성도 (양간·활성적 오행일수록 높음)
    const d6 = isYang
      ? 0.5 + 0.5 * ELEM_SCORE[stemElem]
      : 0.2 + 0.3 * ELEM_SCORE[stemElem];

    // dim 7: 길흉 기저값
    const d7 = GANZHI_LUCK_BASE[text] ?? 0.60;

    table.push([d0, d1, d2, d3, d4, d5, d6, d7]);
  }
  return table;
}

// 싱글턴 임베딩 테이블
let _table = null;

/** 임베딩 테이블 싱글턴을 반환합니다. */
function getEmbeddingTable() {
  if (!_table) _table = buildEmbeddingTable();
  return _table;
}

/**
 * 육십갑자 텍스트(예: "갑자")의 8차원 임베딩 벡터를 반환합니다.
 * @param {string} pillarText - 2자리 간지 문자열 (예: "갑자")
 * @returns {number[]} 8차원 임베딩 벡터
 */
function embedPillar(pillarText) {
  const idx = pillarToIndex(pillarText);
  return getEmbeddingTable()[idx];
}

module.exports = { embedPillar, getEmbeddingTable, EMBED_DIM };
