"use strict";
/**
 * 사주 운세 분류 모델 (Saju Fortune Classification Model)
 *
 * ── 아키텍처 ─────────────────────────────────────────────────────────────────
 *   입력층  : 24차원 정규화 피처 벡터 (featureExtractor.js 참조)
 *   은닉층1 : 16유닛 (ReLU) — 개별 명리학 패턴 감지기
 *   은닉층2 :  8유닛 (ReLU) — 복합 패턴 조합기
 *   출력층  :  5유닛 (Softmax) — 운세 클래스 확률 분포
 *
 * ── 출력 클래스 ──────────────────────────────────────────────────────────────
 *   0: 대길(大吉) — 매우 길한 운세
 *   1: 길(吉)     — 길한 운세
 *   2: 중길(中吉) — 보통·안정적 운세
 *   3: 흉(凶)     — 주의가 필요한 운세
 *   4: 대흉(大凶) — 어려운 국면
 *
 * ── 가중치 초기화 ─────────────────────────────────────────────────────────────
 *   고전 명리학(命理學) 이론을 도메인 지식으로 인코딩한 초기값입니다.
 *   실제 사주 데이터·결과 레이블이 수집되면 역전파(backpropagation)로
 *   파인튜닝(fine-tuning) 할 수 있습니다.
 *
 *   인코딩된 주요 규칙:
 *     - 오행(五行) 비율이 0.2 수준으로 고른 경우 → 안정 운세
 *     - 단일 오행이 0.5 초과 지배 → 불균형 경고
 *     - 월간 관성(官星) → 사회적 지위·책임 강화
 *     - 연간·월간 인성(印星) → 귀인·학문 지원
 *     - 연간·월간 비견/겁재(比肩/劫財) → 경쟁·갈등 에너지
 *     - 목화(木火) 생 체인 → 양기 활성 → 활발한 길운
 *     - 금수(金水) 생 체인 → 지혜·귀인 흐름
 *
 * ── 학습 데이터 형식 (참고) ──────────────────────────────────────────────────
 *   { features: number[24], label: 0|1|2|3|4, sampleWeight?: number }
 */

const { forward }          = require("./network");
const { extractFeatures }  = require("./featureExtractor");
const { embedPillar, EMBED_DIM } = require("./embeddings");

/** 출력 클래스 레이블 */
const CLASSES = ["대길", "길", "중길", "흉", "대흉"];

// ── 가중치 초기화 함수 ────────────────────────────────────────────────────────

/**
 * 명리학 도메인 지식을 인코딩한 가중치 행렬을 생성합니다.
 *
 * 피처 인덱스 요약:
 *   0,4,8,12  — 연/월/일/시 천간 인덱스(정규화)
 *   1,5,9,13  — 연/월/일/시 지지 인덱스(정규화)
 *   2,6,10,14 — 연/월/일/시 천간 오행 인덱스(정규화)
 *   3,7,11,15 — 연/월/일/시 음양(양=1)
 *   16..20    — 오행 비율 [목,화,토,금,수] (합=1)
 *   21        — 연간 십신 인덱스/5
 *   22        — 월간 십신 인덱스/5
 *   23        — 시간 십신 인덱스/5
 */
function initWeights() {
  // ── Layer 1: 24 → 16 (ReLU) ──────────────────────────────────────────────
  // 16개 은닉 유닛이 각각 하나의 명리학 패턴을 감지합니다.
  const W1 = Array.from({ length: 16 }, () => new Array(24).fill(0));
  const b1 = new Array(16).fill(0);

  // h0-h4: 오행별 비율 강도 감지 (비율 > 0.25 일 때 활성화)
  //        features[16]=목, [17]=화, [18]=토, [19]=금, [20]=수
  for (let j = 0; j < 5; j++) {
    W1[j][16 + j] = 4.0;
    b1[j]         = -1.0;  // threshold: 4×0.25 - 1 = 0
  }

  // h5: 목화(木火) 생 체인 감지 (목 비율 + 화 비율이 함께 높을 때)
  W1[5][16] = 2.5;  // 목 비율
  W1[5][17] = 2.5;  // 화 비율
  b1[5]     = -2.0;

  // h6: 금수(金水) 생 체인 감지 (지혜·귀인 흐름)
  W1[6][19] = 2.5;  // 금 비율
  W1[6][20] = 2.5;  // 수 비율
  b1[6]     = -2.0;

  // h7: 토(土) 과잉 감지 (土 비율 > 0.375 → 막힘 에너지)
  W1[7][18] = 5.0;
  b1[7]     = -1.5;  // threshold: 5×0.375 - 1.5 ≈ 0

  // h8: 월간(月干) 관성(官星) 시그널
  //     features[22] = 월간 십신 idx/5, 관성=4 → 4/5=0.8
  //     활성화 조건: 5×0.8 - 3.5 = 0.5 > 0  ✓
  //     비활성화:   5×0.0 - 3.5 = -3.5 < 0  ✓
  W1[8][22] = 5.0;
  b1[8]     = -3.5;

  // h9: 연간(年干) 인성(印星) 시그널
  //     features[21] = 연간 십신 idx/5, 인성=2 → 2/5=0.4
  //     활성화 조건: 5×0.4 - 1.5 = 0.5 > 0  ✓
  W1[9][21]  = 5.0;
  b1[9]      = -1.5;

  // h10: 시간(時干) 재성(財星) 시그널
  //      features[23] = 시간 십신 idx/5, 재성=3 → 3/5=0.6
  //      활성화 조건: 5×0.6 - 2.5 = 0.5 > 0  ✓
  W1[10][23] = 5.0;
  b1[10]     = -2.5;

  // h11: 비견/겁재(比肩/劫財) 갈등 시그널
  //      비견/겁재=0 → idx/5=0.0, 연간+월간 모두 낮을 때 활성화
  //      음의 가중치를 사용: bias=3, 두 값이 낮을수록 (3 - W×value) 증가
  W1[11][21] = -3.0;  // 연간 십신 낮을수록 기여
  W1[11][22] = -3.0;  // 월간 십신 낮을수록 기여
  b1[11]     =  3.0;

  // h12: 일주(日柱) 양기(陽氣) 강도
  //      features[11] = 일주 음양 (양=1.0)
  W1[12][11] = 3.0;
  b1[12]     = -0.5;

  // h13: 연주-일주 오행 유사도
  //      features[2]=연간 오행idx/4, features[10]=일간 오행idx/4
  //      두 값이 모두 중간(0.5) 근처일 때 활성화
  W1[13][2]  = 2.0;
  W1[13][10] = 2.0;
  b1[13]     = -1.5;

  // h14: 양기(陽氣) 조합 — 목·화 비율 + 양 천간
  W1[14][16] = 2.0;  // 목 비율
  W1[14][17] = 2.0;  // 화 비율
  W1[14][3]  = 1.0;  // 연주 양/음
  W1[14][7]  = 1.0;  // 월주 양/음
  b1[14]     = -2.0;

  // h15: 음기(陰氣) 조합 — 금·수 비율 + 음 천간
  W1[15][19] =  2.0;  // 금 비율
  W1[15][20] =  2.0;  // 수 비율
  W1[15][3]  = -1.0;  // 연주: 음이면(0) 활성화 도움
  b1[15]     = -1.0;

  // ── Layer 2: 16 → 8 (ReLU) ───────────────────────────────────────────────
  // 8개 유닛이 복합 패턴을 조합합니다.
  const W2 = Array.from({ length: 8 }, () => new Array(16).fill(0));
  const b2 = new Array(8).fill(0);

  // g0: 길운 오행 패턴 (목화 생 체인 + 관성 + 양기)
  W2[0][5]  = 2.0;  // h5: 목화 생 체인
  W2[0][8]  = 2.5;  // h8: 관성
  W2[0][14] = 1.5;  // h14: 양기 조합
  W2[0][12] = 1.0;  // h12: 양 일주
  b2[0]     = -1.5;

  // g1: 지혜·인성 패턴 (금수 생 체인 + 인성)
  W2[1][6]  = 2.0;  // h6: 금수 생 체인
  W2[1][9]  = 2.5;  // h9: 인성
  W2[1][15] = 1.5;  // h15: 음기 조합
  b2[1]     = -1.5;

  // g2: 재물 패턴 (재성 + 관성 조합)
  W2[2][8]  = 1.5;  // h8: 관성
  W2[2][10] = 2.5;  // h10: 재성
  b2[2]     = -1.5;

  // g3: 극(剋) 갈등 패턴 (비견/겁재 + 토 과잉)
  W2[3][7]  = 2.0;  // h7: 토 과잉
  W2[3][11] = 2.5;  // h11: 비견/겁재 갈등
  b2[3]     = -0.5;

  // g4: 오행 불균형 패턴 (단일 오행 극단 집중 — 4원소 중 어느 하나)
  W2[4][0]  = 1.5;  // h0: 목 극단
  W2[4][1]  = 1.5;  // h1: 화 극단
  W2[4][3]  = 1.5;  // h3: 금 극단
  W2[4][4]  = 1.5;  // h4: 수 극단
  b2[4]     = -2.0;

  // g5: 오행 조화 패턴 (연주-일주 조화 + 극단 없음)
  W2[5][13] =  2.0;  // h13: 연주-일주 조화
  W2[5][0]  = -1.0;  // h0: 목 극단이면 감소
  W2[5][3]  = -1.0;  // h3: 금 극단이면 감소
  b2[5]     =  0.0;

  // g6: 복합 길운 (여러 길 신호 합산)
  W2[6][0]  = 0.5;  W2[6][1] = 0.5;  W2[6][2] = 0.5;
  W2[6][8]  = 1.0;  W2[6][9] = 1.0;  W2[6][10] = 1.0;
  b2[6]     = -2.0;

  // g7: 복합 흉운 (갈등·불균형 신호 합산)
  W2[7][3]  = 0.5;  W2[7][4]  = 0.5;
  W2[7][7]  = 1.0;  W2[7][11] = 1.5;
  b2[7]     = -1.0;

  // ── Layer 3: 8 → 5 (Softmax) ─────────────────────────────────────────────
  // 출력 클래스: ["대길", "길", "중길", "흉", "대흉"]
  //             g0    g1    g2    g3    g4    g5    g6    g7
  //
  // 주의: 은닉층2(g0-g7) 유닛값이 0~7 범위까지 커질 수 있으므로
  //       소프트맥스가 near-deterministic 해지지 않도록 가중치를 0.1 스케일로 설정합니다.
  //       → 로짓 차이 ≈ ±2 범위 → 확률 분포가 다양한 클래스에 걸쳐 퍼짐
  const W3 = [
    // 대길(大吉): g0(길운오행)·g1(인성)·g2(재물)·g5(조화)·g6(복합길) 강화
    [ 0.30,  0.25,  0.20, -0.15, -0.20,  0.20,  0.25, -0.20],
    // 길(吉): 길운 신호 중간, 흉운 신호 약함
    [ 0.20,  0.20,  0.15, -0.05, -0.10,  0.15,  0.15, -0.10],
    // 중길(中吉): 중립적, 모든 신호에 고른 약한 양의 가중치
    [ 0.05,  0.05,  0.05,  0.05,  0.05,  0.05,  0.05,  0.00],
    // 흉(凶): g3(갈등)·g4(불균형)·g7(복합흉) 강화
    [-0.10, -0.10, -0.05,  0.20,  0.15, -0.10, -0.10,  0.25],
    // 대흉(大凶): 강한 갈등·불균형 복합
    [-0.20, -0.20, -0.10,  0.30,  0.25, -0.20, -0.20,  0.35],
  ];
  const b3 = [0.5, 0.3, 0.2, -0.5, -1.5];

  return {
    layers: [
      { W: W1, b: b1, activation: "relu" },
      { W: W2, b: b2, activation: "relu" },
      { W: W3, b: b3, activation: "softmax" },
    ],
  };
}

// ── 싱글턴 모델 인스턴스 ──────────────────────────────────────────────────────
let _model = null;

function getModel() {
  if (!_model) _model = initWeights();
  return _model;
}

// ── 예측 함수 ─────────────────────────────────────────────────────────────────

/**
 * 사주 계산 결과에 대해 ML 운세 예측을 수행합니다.
 *
 * @param {object}  saju              - calculateSajuSolar() 결과
 * @param {object}  elements          - deriveElements() 결과
 * @param {object}  tenGods           - deriveTenGods() 결과
 * @param {object}  [opts]
 * @param {boolean} [opts.includeEmbeddings=false] - 임베딩 벡터 포함 여부
 * @param {boolean} [opts.includeFeatures=false]   - 원시 피처 벡터 포함 여부
 * @returns {object} ML 예측 결과
 */
function predict(saju, elements, tenGods, opts) {
  const includeEmbeddings = opts?.includeEmbeddings ?? false;
  const includeFeatures   = opts?.includeFeatures   ?? false;

  const features = extractFeatures(saju, elements, tenGods);
  const probs    = forward(getModel(), features);
  const maxIdx   = probs.indexOf(Math.max(...probs));

  const result = {
    prediction:    CLASSES[maxIdx],
    confidence:    +probs[maxIdx].toFixed(4),
    probabilities: Object.fromEntries(CLASSES.map((c, i) => [c, +probs[i].toFixed(4)])),
  };

  if (includeFeatures) {
    result.features = features.map(v => +v.toFixed(4));
  }

  if (includeEmbeddings) {
    const pillarKeys = ["year", "month", "day", "hour"];
    const pillarEmbeddings = {};
    let avg = new Array(EMBED_DIM).fill(0);

    for (const key of pillarKeys) {
      const emb = embedPillar(saju.pillars[key].text);
      pillarEmbeddings[key] = emb.map(v => +v.toFixed(4));
      avg = avg.map((v, i) => v + emb[i] / 4);
    }

    result.embeddings = {
      pillars: pillarEmbeddings,
      average: avg.map(v => +v.toFixed(4)),
      dim:     EMBED_DIM,
      note:    "육십갑자 임베딩 (8차원). 각 차원 의미는 embeddings.js 참조.",
    };
  }

  result.meta = {
    architecture:  "MLP 24→16→8→5 (ReLU×2 + Softmax)",
    featureDim:    24,
    classes:       CLASSES,
    weightInit:    "명리학 도메인 지식 기반 초기화",
    trainable:     true,
    trainingHint:  "labels: { features: number[24], label: 0-4 } 형식 데이터로 파인튜닝 가능",
  };

  return result;
}

module.exports = { predict, CLASSES, getModel, initWeights };
