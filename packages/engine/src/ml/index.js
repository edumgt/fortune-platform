"use strict";
/**
 * @fortune/engine — ML/DL 모듈 공개 API
 *
 * 포함 기능:
 *   featureExtractor — 사주 데이터 → 24차원 정규화 피처 벡터
 *   embeddings       — 60 육십갑자 × 8차원 DL 임베딩 테이블
 *   network          — 순수 JS MLP 순전파 (외부 의존성 없음)
 *   model            — 명리학 초기화 가중치 + predict() 함수
 */

const { extractFeatures, FEATURE_DIM, ELEMENTS, TEN_GODS_LIST } = require("./featureExtractor");
const { embedPillar, getEmbeddingTable, EMBED_DIM }              = require("./embeddings");
const { forward, denseForward, cosineSimilarity, euclideanDistance } = require("./network");
const { predict, CLASSES, getModel, initWeights }                = require("./model");

module.exports = {
  // Feature extraction
  extractFeatures,
  FEATURE_DIM,
  ELEMENTS,
  TEN_GODS_LIST,

  // Embeddings (DL)
  embedPillar,
  getEmbeddingTable,
  EMBED_DIM,

  // Neural network primitives
  forward,
  denseForward,
  cosineSimilarity,
  euclideanDistance,

  // Model
  predict,
  CLASSES,
  getModel,
  initWeights,
};
