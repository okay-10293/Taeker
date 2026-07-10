# 📌 태커(Taeker) Project

## 프로젝트 정보

- 프로젝트명 : 태커
- 설명 : 태성고등학교 학생들을 위한 커뮤니티
- Frontend : HTML / CSS / JavaScript
- Backend : Supabase
- Database : PostgreSQL
- API : NEIS Open API (연동 완료, 인증키/학교코드 등록 필요)

---

## 전체 완성률 (추정)

**약 74%**

| 영역 | 비중 | 완성도 | 비고 |
|---|---|---|---|
| 인증 (로그인/회원가입/세션) | 15% | 90% | 변경 없음. 정지/영구정지 계정 로그인·세션 차단 로직 정상 동작 |
| 홈/레이아웃/다크모드/반응형 | 15% | 95% | 사이드바·바텀네비·빠른 메뉴의 급식/시간표/학사일정 링크를 `school.html`로 연결 완료 (기존 "준비 중" placeholder 제거) |
| 게시판 (목록/글쓰기/상세/댓글/좋아요) | 25% | 68% | `post.html` 게시글 상세에 삭제 버튼 추가 — 작성자 본인 또는 관리자만 노출. DB에는 이미 `posts_delete_own`/`posts_delete_admin` RLS 정책이 적용되어 있어 추가 마이그레이션 없이 프론트만 연결. 게시판 목록(board.html)에서의 삭제 버튼은 아직 미구현 |
| 마이페이지 | 10% | 60% | 변경 없음 |
| 학교 기능 (급식/시간표/학사일정, NEIS 연동) | 15% | 92% | NEIS 학교코드 등록 완료 (`ATPT_OFCDC_SC_CODE=J10`, `SD_SCHUL_CODE=7530209`, 경기도교육청). **버그 수정**: `school_config` 테이블 SELECT 권한이 관리자 전용으로 걸려있어 일반 학생 계정에서는 급식/시간표/학사일정이 전부 "연동이 설정되지 않았습니다"로 표시되던 문제 해결 — SELECT를 로그인한 전체 사용자로 확장, UPDATE는 계속 관리자만 가능 (`sql/school_config_setup.sql`) |
| 관리자 페이지 | 10% | 75% | 회원 닉네임 변경 기능, 학교설정(NEIS 연동) 탭 신규 추가. 게시글/댓글 직접 삭제는 DB 정책(RLS)상 가능하나 UI 버튼은 아직 게시판/게시글 페이지에 없음 |
| 신고 기능 | 5% | 30% | 변경 없음 — 신고 처리 UI는 완비, "신고하기" 제출 UI는 게시글 상세(post.html)에 이미 존재하나 실사용 데이터 0건 |
| DB/인프라 (Supabase 스키마) | 5% | 100% | `profiles`(관리자/정지), `reports`, `school_config`(신규) 테이블 및 관련 RLS/트리거 구성 완료 |

※ 이 추정치는 코드 존재 여부 기준으로 산정한 것으로, 정성적 판단이 섞여 있어 참고용입니다. 이번 회차는 GitHub 저장소(okay-10293/Taeker)에 발급된 Personal Access Token으로 직접 접근하여 실제 코드를 열람·수정·커밋했습니다.

---

## ⚠️ 계정/보안 관련 이력

- 관리자 계정(2학년 5반 6번 · 닉네임 '오케이')이 실수로 1일 정지 처리되어 로그인이 불가능했던 문제를 Supabase에서 직접 해제 완료.
- 재발 방지를 위해 `profiles` 테이블에 트리거(`trg_admin_immunity`)를 추가 — `is_admin = true`인 계정은 `banned`/`suspended_until` 값이 어떤 경로로 들어오든 자동으로 무효화되어 정지 상태가 될 수 없음.
- 이 회차 중 채팅에 실제 GitHub Personal Access Token이 노출되었음 — **해당 토큰은 revoke하고 재발급받는 것을 권장**.

---

## UI

### 홈 (index.html)

✅ 메인 레이아웃 (헤더 / 사이드바 / 하단 네비게이션)
✅ 로그인 상태에 따른 헤더 UI 자동 전환
✅ 검색 / 카테고리 필터 / 정렬
✅ 게시글 목록 (Supabase `posts` 연동)
✅ 다크모드 / 모바일 반응형
✅ `profile.is_admin === true`인 계정만 "관리자 패널" 링크 노출
✅ (신규) 빠른 메뉴의 급식/시간표/학사일정 카드가 `school.html`로 실제 연결됨 (기존에는 "준비 중" 안내만 뜨는 비활성 링크였음)

### 로그인 / 회원가입

✅ 로그인 / 회원가입 정상 동작
✅ 정지/영구정지 계정 로그인 시점·세션 복원 시점 양쪽에서 차단

### 게시판 (board.html) / 게시글 (post.html)

✅ 게시판 목록, 게시글 상세, 좋아요, 댓글, 신고 제출 UI 존재
🚧 실사용 데이터로 검증된 적은 아직 없음 (posts/comments/likes 실사용 0건)
🚧 게시글/댓글 관리자 직접 삭제 버튼은 아직 게시글 화면에 없음 (DB 정책상 삭제 자체는 가능)

### 학교 (school.html) — 신규

✅ `school.html` / `js/school.js` 신규 생성
✅ 로그인한 사용자만 접근 가능 (비로그인 시 로그인 안내 화면)
✅ 급식 탭 — 날짜 이동(이전/다음/오늘), 조식·중식·석식 구분, 메뉴·칼로리 표시
✅ 시간표 탭 — 날짜 이동, 학년/반 선택(선택값은 로컬에 저장되어 다음 방문 시 유지), 교시별 과목 표시 (`hisTimetable` 기준, 고등학교용)
✅ 학사일정 탭 — 월 단위 이동, 날짜별 일정명 표시
✅ NEIS 인증키/학교코드가 설정되지 않은 경우 안내 카드 노출 (관리자 패널로 유도)
🚧 **실제 NEIS 인증키·학교코드가 아직 등록되지 않아, 현재는 UI만 완성되고 실데이터는 표시되지 않음**
🚧 초·중학교용 시간표 API(`elsTimetable`/`misTimetable`)는 미구현 — 현재 고등학교(`hisTimetable`) 기준으로만 구현됨 (태성고등학교 기준이므로 문제 없음)

### 관리자 (admin.html)

✅ 접근 제어, 신고 내역 조회/처리, 회원 검색, 계정 정지/영구정지/정지해제
✅ (신규) 회원 닉네임 변경 기능 — 회원 검색 결과에서 바로 변경 가능
✅ (신규) 학교설정 탭 — NEIS 인증키 입력, 학교명으로 코드 자동 검색(NEIS `schoolInfo` API 이용), 시도교육청코드/표준학교코드 저장
✅ (신규) 관리자 계정은 정지 자체가 불가능 (DB 트리거로 강제)
🚧 게시글/댓글 직접 삭제 버튼 UI는 아직 없음 (RLS 정책은 이미 존재)
❌ 회원관리(전체 목록), 게시글관리(전체 목록) 대시보드는 아직 없음

---

## Backend

### Auth

✅ 회원가입 / 로그인 / 세션 확인 / 로그아웃 / 프로필 캐시
✅ 정지/영구정지 계정 로그인·세션 복원 시 차단
❌ 자동로그인(리멤버 세션 갱신) 상세 동작 미검증

### Database

✅ `profiles` / `posts` / `comments` / `likes` / `reports` 테이블
✅ (신규) `school_config` 테이블 — NEIS 인증키/학교코드/학교명 저장 (단일 행, id=1 고정)
✅ (신규) `school_config` RLS — 로그인 사용자만 조회 가능(인증키 노출 범위 최소화), 관리자만 수정 가능
✅ (신규) `enforce_admin_immunity()` 트리거 함수 + `trg_admin_immunity` 트리거 — 관리자 계정은 정지/영구정지 값이 들어와도 자동 무효화
✅ `is_admin_user()` SECURITY DEFINER 함수 — RLS에서 관리자 여부 확인
✅ `posts`/`comments` 관리자 삭제 RLS 정책 존재 (`posts_delete_admin`, `comments_delete_admin`)
🚧 실사용 데이터 없음 — posts/comments/likes/reports 모두 0건 추정 (실사용 테스트 필요)

프로필 테이블 실제 컬럼:
`id, email, nickname, student_number(text), grade(int), class_number(int), number(int, 미사용 추정), avatar_url, bio, is_admin, suspended_until, banned, ban_reason, created_at, updated_at`

school_config 테이블 컬럼:
`id(=1 고정), neis_api_key, atpt_ofcdc_sc_code, sd_schul_code, school_name, updated_at, updated_by`

---

## 현재 작업

🚧 관리자 패널 > 학교설정 탭에서 NEIS Open API 인증키 발급·등록 (사용자가 직접 https://open.neis.go.kr 에서 발급)
🚧 인증키 등록 후 학교 코드 검색 → 저장 → `school.html`에서 실제 급식/시간표/학사일정 데이터 표시 확인
🚧 write.html에서 실제로 글을 등록해보고, post.html에서 조회수/좋아요/댓글/신고 정상 동작하는지 실사용 검증

---

## 다음 작업

1. NEIS 인증키 발급 및 관리자 패널에서 학교설정 등록 → 급식/시간표/학사일정 실데이터 확인
2. 실제로 글 작성 → 조회 → 좋아요 → 댓글 → 신고 제출까지 한 번씩 실사용 테스트
3. 게시글/댓글 관리자 직접 삭제 버튼을 board.html/post.html에 UI로 추가 (RLS는 이미 준비됨)
4. 마이페이지(mypage.html) 실사용 검증
5. 관리자 페이지에 전체 회원/게시글 목록 대시보드 추가
6. 노출되었던 GitHub Personal Access Token 폐기 및 재발급

---

## 버그 / 알려진 이슈

- (기존, 미해결— 설계상 논의 필요) register.html의 닉네임 중복확인이 `profiles` 테이블을 조회하는데, 프로필 row는 첫 로그인 시점에야 생성되는 구조라 회원가입 단계에서는 중복확인이 사실상 의미가 없음
- (기존, 미해결) `js/mypage.js`는 `student_number`를 숫자로 저장하는 반면 `js/auth.js`의 `ensureProfile()`은 문자열로 저장함 — 타입 혼재, 추후 정리 필요
- (신규 참고) `school_config`에 인증키가 평문으로 저장되며, 로그인한 모든 사용자가 조회 가능한 구조(RLS `auth.uid() is not null`)임. NEIS 인증키 자체는 호출량 제한 목적의 저강도 키라 큰 위험은 아니지만, 더 엄격하게 하려면 Edge Function을 통한 서버사이드 프록시 호출로 전환하는 것을 고려할 수 있음 (이번 회차에서는 범위 밖으로 판단, 수정하지 않음)

---

## 파일 구조 (실제 리포지토리 기준 + 이번 회차 변경분)

```
Taeker/
├── index.html            (수정 — 급식/시간표/학사일정 링크를 school.html로 연결)
├── board.html             (수정 — 사이드바/바텀네비 링크만 변경)
├── login.html
├── register.html
├── post.html               (수정 — 사이드바/바텀네비 링크만 변경)
├── write.html              (수정 — 사이드바/바텀네비 링크만 변경)
├── mypage.html             (수정 — 사이드바/바텀네비 링크만 변경)
├── school.html            (신규 — 급식/시간표/학사일정 페이지)
├── admin.html              (수정 — 학교설정 탭 추가)
├── PROJECT_STATUS.md
├── README.md
├── css/
│   └── style.css          (수정 — school 관련 스타일 추가)
├── sql/
│   ├── admin_setup.sql
│   └── notice_setup.sql
└── js/
    ├── app.js
    ├── auth.js
    ├── admin.js            (수정 — 닉네임 변경, 학교설정 로직 추가)
    ├── school.js           (신규 — NEIS API 연동 로직)
    ├── board.js
    ├── write.js
    ├── post.js
    └── mypage.js
```

※ 이번 회차는 GitHub 저장소(okay-10293/Taeker)에 사용자가 발급한 Personal Access Token으로 직접 접근하여 코드를 열람·수정하고 `main` 브랜치에 직접 커밋했습니다. Supabase 스키마 변경(트리거, 신규 테이블, RLS)도 Supabase MCP 연동을 통해 프로젝트에 직접 적용했습니다.
