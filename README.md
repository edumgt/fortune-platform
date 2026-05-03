# Fortune Platform

Node(CommonJS) + Open-source manseryeok 기반으로 **사주/대운/궁합/풀이/오늘운세** 가 동작하는 플랫폼입니다.

![실행 화면 1](1.png)
![실행 화면 2](2.png)

## 주요 기능
- 🔮 사주팔자(사주 계산, 오행, 십신, 대운)
- 💑 궁합(합/충/해/파 분석 + 점수)
- 📅 오늘의 운세(일진·세운 기반 연애/직업/재물/건강운)
- 👤 회원가입 · 로그인 (JWT 인증)
- 🔔 매일 아침 푸시 알림(Web Push + GitHub Actions 스케줄)
- 🐳 Docker 지원 (개발/배포)

## 테스트 계정
| 이메일 | 비밀번호 |
|--------|---------|
| test1@test.com | 123456 |
| test2@test.com | 123456 |

## 빠른 시작 (로컬 개발)

```bash
# 1. 의존성 설치
pnpm install

# 2-A. 개발 서버 실행 (터미널 두 개)
pnpm -C apps/api dev     # API: http://localhost:3000
pnpm -C apps/web dev     # WEB: http://localhost:5173
```

## Docker로 실행

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 파일에서 JWT_SECRET 등을 수정

# 2. 빌드 & 실행
docker compose up --build

# WEB: http://localhost:8080
# API: http://localhost:3000
```

## GitHub Actions 설정

### Docker Hub 푸시 (main 브랜치 push 시 자동 실행)
Secrets 등록:
- `DOCKERHUB_USERNAME` - Docker Hub 사용자명
- `DOCKERHUB_TOKEN` - Docker Hub 액세스 토큰

### 매일 아침 운세 푸시 알림 (오전 8시 KST)
Secrets 등록:
- `FORTUNE_API_URL` - 배포된 API URL
- `PUSH_CRON_SECRET` - push 엔드포인트 보안 키 (`.env`의 `PUSH_CRON_SECRET`와 동일)

### VAPID 키 생성 (Web Push)
```bash
npx web-push generate-vapid-keys
# 출력된 키를 .env 또는 Docker 환경변수에 설정
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/me` | 내 정보 (JWT 필요) |
| POST | `/api/saju/calc` | 사주/오행/십신/대운 계산 + ML 예측(compact) |
| POST | `/api/saju/ml-predict` | ML/DL 상세 예측 (피처 벡터·임베딩 포함) |
| POST | `/api/gunghap` | 궁합 계산 |
| POST | `/api/daily` | 오늘의 운세 (생년월일 선택) |
| GET | `/api/daily/today-ganzhi` | 오늘 일진 정보 |
| GET | `/api/push/vapid-public` | VAPID 공개키 |
| POST | `/api/push/subscribe` | 푸시 알림 구독 (JWT 필요) |
| DELETE | `/api/push/subscribe` | 구독 취소 (JWT 필요) |
| POST | `/api/push/send-daily` | 전체 구독자에게 운세 발송 (cron용) |

## 구성

- `packages/engine` : 만세력 어댑터 + 오행/십신/대운/궁합/일진/오늘운세 엔진 + **ML/DL 모듈**
- `apps/api` : Express API 서버 (인증, 푸시, ML 예측 포함)
- `apps/web` : Vite + Tailwind + Offcanvas 웹 앱 (로그인/회원가입 포함)

## ML/DL 아키텍처

`packages/engine/src/ml/` 폴더에 외부 라이브러리 없이 구현된 ML/DL 파이프라인이 포함되어 있습니다.

### 처리 흐름

```
사주 계산 결과
  │
  ▼
featureExtractor.js  ─→  24차원 정규화 피처 벡터
  │                        [연/월/일/시주 인덱스] × 4
  │                        [오행 비율 5개]
  │                        [십신 포지션 3개]
  │
  ├─ embeddings.js  ─→  60 육십갑자 × 8차원 임베딩 테이블 (DL 레이어)
  │                        dim0: 천간 오행 강도
  │                        dim1: 음양
  │                        dim2: 순환 위치
  │                        dim3: 지지 오행 강도
  │                        dim4: 계절 에너지
  │                        dim5: 천간-지지 오행 조화
  │                        dim6: 기운 활성도
  │                        dim7: 길흉 기저값
  │
  └─ network.js + model.js  ─→  MLP 순전파
                                 24 → 16 (ReLU)  — 개별 패턴 감지
                                 16 →  8 (ReLU)  — 복합 패턴 조합
                                  8 →  5 (Softmax)
                                        │
                                        ▼
                              [대길, 길, 중길, 흉, 대흉] 확률 분포
```

### 가중치 초기화 — 명리학 도메인 지식 인코딩

모델 가중치는 고전 명리학(命理學) 이론 기반으로 초기화됩니다:

| 은닉 유닛 | 감지 패턴 | 명리 근거 |
|-----------|-----------|-----------|
| h0–h4 | 오행별 비율 강도 | 단일 오행 0.25 초과 시 활성화 |
| h5 | 목화(木火) 생 체인 | 木生火: 양기 활성·활발한 길운 |
| h6 | 금수(金水) 생 체인 | 金生水: 지혜·귀인 흐름 |
| h7 | 토(土) 과잉 | 土 과다 → 막힘·정체 에너지 |
| h8 | 월간 관성(官星) | 사회적 지위·책임·관직 운 |
| h9 | 연간 인성(印星) | 귀인·학문·지원 에너지 |
| h10 | 시간 재성(財星) | 재물·현실 감각 에너지 |
| h11 | 비견/겁재 갈등 | 경쟁·독립·갈등 에너지 |

### 새 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/saju/ml-predict` | ML 전체 결과 (피처 벡터 + 임베딩 포함) |

`/api/saju/calc` 응답에도 `result.ml` 필드(compact)가 추가됩니다.

**요청 예시:**
```json
POST /api/saju/ml-predict
{
  "year": 1990, "month": 5, "day": 15,
  "hour": 10, "minute": 30, "gender": "M"
}
```

**응답 예시 (일부):**
```json
{
  "ok": true,
  "result": {
    "prediction": "길",
    "confidence": 0.4123,
    "probabilities": { "대길": 0.18, "길": 0.41, "중길": 0.29, "흉": 0.08, "대흉": 0.04 },
    "features": [0.0, 0.36, 0.0, 1.0, ...],
    "embeddings": {
      "pillars": {
        "year":  [0.0, 1.0, 0.0, 1.0, 0.2, 0.8, 0.5, 0.7],
        "month": [...], "day": [...], "hour": [...]
      },
      "average": [0.31, 0.5, 0.49, ...],
      "dim": 8
    },
    "meta": {
      "architecture": "MLP 24→16→8→5 (ReLU×2 + Softmax)",
      "featureDim": 24,
      "weightInit": "명리학 도메인 지식 기반 초기화",
      "trainable": true,
      "trainingHint": "labels: { features: number[24], label: 0-4 } 형식 데이터로 파인튜닝 가능"
    }
  }
}
```

### 파인튜닝(Fine-tuning) 가이드

실제 사주 데이터를 수집하면 모델을 개선할 수 있습니다:

1. **학습 데이터 수집**: `{ features: number[24], label: 0|1|2|3|4 }` 형식
2. **임베딩 파인튜닝**: `embeddings.js`의 60×8 테이블을 역전파로 업데이트
3. **가중치 저장/로드**: `getModel()`로 가중치 접근, JSON으로 직렬화 가능
4. **외부 프레임워크 연동**: 피처 벡터를 Python(PyTorch/TensorFlow) 또는 TensorFlow.js에 그대로 입력 가능

## 주의/면책

- 사주/운세는 참고용 데모입니다.
- 대운 기산/야자시/시간보정 등은 유파별 차이가 크므로 `packages/engine/src/rulesets/standard.kr.js`에서 서비스 기준을 고정하세요.
- 만세력 라이브러리는 2020~2030년 절기 데이터를 지원합니다. 다른 연도는 대운 시작 나이 계산 없이 대운 순서만 표시됩니다.

