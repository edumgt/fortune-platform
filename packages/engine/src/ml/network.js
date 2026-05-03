"use strict";
/**
 * 순수 JavaScript MLP (다층 퍼셉트론) — 외부 라이브러리 없음
 *
 * Node.js / 브라우저 어디서든 동작하는 신경망 순전파(forward pass) 구현입니다.
 * TensorFlow.js 등 무거운 의존성 없이 사주 ML 모델을 서빙합니다.
 *
 * 지원 활성화 함수: relu | sigmoid | tanh | softmax
 *
 * 사용 예:
 *   const net = { layers: [
 *     { W: [[...], ...], b: [...], activation: "relu" },
 *     { W: [[...], ...], b: [...], activation: "softmax" },
 *   ]};
 *   const out = forward(net, inputVector);
 */

// ── 활성화 함수 ──────────────────────────────────────────────────────────────

function relu(x)    { return x > 0 ? x : 0; }
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function htanh(x)   { return Math.tanh(x); }

/** 수치 안정화(max 차감)가 적용된 softmax */
function softmax(arr) {
  const max  = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

const ACTIVATIONS = { relu, sigmoid, tanh: htanh, softmax };

// ── 레이어 연산 ──────────────────────────────────────────────────────────────

/**
 * 완전연결(Dense) 레이어 순전파: y = activation(W·x + b)
 *
 * @param {number[][]} W   - 가중치 행렬 [out_dim × in_dim]
 * @param {number[]}   b   - 편향 벡터   [out_dim]
 * @param {number[]}   x   - 입력 벡터   [in_dim]
 * @param {string}     act - 활성화 함수 이름
 * @returns {number[]} 출력 벡터 [out_dim]
 */
function denseForward(W, b, x, act) {
  // 행렬-벡터 곱셈 + 편향 덧셈
  const z = b.map((bi, i) => bi + W[i].reduce((acc, wij, j) => acc + wij * x[j], 0));

  const fn = ACTIVATIONS[act];
  if (!fn) throw new Error(`Unknown activation: "${act}"`);

  // softmax는 전체 배열에 적용, 나머지는 원소별 적용
  return act === "softmax" ? fn(z) : z.map(fn);
}

// ── 전체 네트워크 순전파 ─────────────────────────────────────────────────────

/**
 * 전체 네트워크 순전파를 수행합니다.
 *
 * @param {{ layers: Array<{W: number[][], b: number[], activation: string}> }} net
 * @param {number[]} x - 입력 벡터
 * @returns {number[]} 최종 출력 벡터
 */
function forward(net, x) {
  let h = Array.from(x);
  for (const layer of net.layers) {
    h = denseForward(layer.W, layer.b, h, layer.activation);
  }
  return h;
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/**
 * 두 벡터의 코사인 유사도를 계산합니다 (임베딩 검색에 활용).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} [-1, 1] 범위의 유사도
 */
function cosineSimilarity(a, b) {
  const dot   = a.reduce((acc, ai, i) => acc + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((acc, ai) => acc + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((acc, bi) => acc + bi * bi, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/**
 * 두 벡터의 유클리드 거리를 계산합니다.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((acc, ai, i) => acc + (ai - b[i]) ** 2, 0));
}

module.exports = { forward, denseForward, cosineSimilarity, euclideanDistance };
