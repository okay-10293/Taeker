# 📌 태커(Taeker) Project

## 프로젝트 정보

- 프로젝트명 : 태커
- 설명 : 태성고등학교 학생들을 위한 익명 커뮤니티
- Frontend : HTML / CSS / JavaScript
- Backend : Supabase
- Database : PostgreSQL
- API : NEIS Open API (미연동)

---

## 이번 회차(Supabase 직접 연동 점검) 업데이트 요약

이번 회차는 Supabase MCP로 실제 운영 DB에 직접 접속해서, 이전 회차까지 업로드된 zip 기준 문서와
실제 DB/레포 상태를 대조 검증했습니다.

- **문서-코드 불일치 정정** : 이전 문서에는 "신고하기 버튼/폼이 UI에 없음(❌)"으로 기록되어 있었지만,
  실제 레포(`post.html`, `js/post.js`)에는 신고 버튼·모달·제출 로직이 이미 구현되어 커밋까지 완료된 상태였습니다. 상태를 ✅로 정정.
- **중복 함수 정리** : `is_admin()`과 `is_admin_user()`가 완전히 동일한 기능으로 중복 존재했고,
  정책마다 서로 다른 함수를 참조하고 있었습니다. `is_admin_user()`로 통일하고 `is_admin()`은 제거.
- **중복 정책 정리** : `profiles` 테이블에 관리자용 UPDATE 정책이 2개(각각 다른 함수 참조) 존재해서 하나로 통합.
- **보안 취약점 수정** : `reports` 테이블 INSERT 정책에 정지 계정 차단 로직(`is_suspended()`)이 빠져있어서,
  정지/영구정지된 계정도 신고를 접수할 수 있는 상태였습니다. `posts`/`comments`/`likes`와 동일한 규칙으로 수정.
- **마이그레이션 이력 백필** : `sql/admin_setup.sql`이 실제로는 한 번도 레포에 커밋된 적이 없었습니다
  (DB에는 이미 적용되어 있어 기능은 정상 동작 중이었음). 현재 DB 상태 기준으로 소급 작성하여 커밋.
- **Supabase Security Advisor 확인** : 남은 경고 항목 대부분은 RLS 정책/트리거 내부에서 쓰이는
  헬퍼 함수들이 anon/authenticated 롤에 EXECUTE 권한이 열려있다는 경고인데, 이는 RLS 동작을 위해
  필수적인 구조라 정상입니다 (실제 위험 없음).
- **미해결 — 수동 조치 필요** : "Leaked Password Protection"이 꺼져있음. SQL로는 켤 수 없고
  Supabase 대시보드 → Authentication → Sign In / Providers → Password 에서 직접 활성화 필요.
- **확인됨(의도된 설계)** : `comments` 테이블에 UPDATE 정책이 없어서 댓글 수정이 안 되는 건 의도된 설계임을 확인. 추가 조치 없음.
- **실사용 검증 완료(DB 레벨)** : Supabase에서 실제 앱과 동일한 흐름(글쓰기 → 조회수 증가 → 좋아요 → 댓글 → 신고 접수 → 좋아요/댓글 삭제)을
  테스트 데이터로 실행해 트리거·제약조건이 전부 정상 동작함을 확인. 검증 후 테스트 데이터는 전부 삭제함.
  단, 이건 서비스 롤(관리 권한) 기준 검증이라 실제 로그인 세션에서 RLS까지 통과하는지는 브라우저로 한 번 더 확인 권장.

---

## 전체 완성률 (추정)

**약 65%**

| 영역 | 비중 | 완성도 | 비고 |
|---|---|---|---|
| 인증 (로그인/회원가입/세션) | 15% | 90% | 변경 없음 |
| 홈/레이아웃/다크모드/반응형 | 15% | 90% | 변경 없음 |
| 게시판 (목록/글쓰기/상세/댓글/좋아요) | 25% | 70% | 트리거/제약조건 실사용 검증 완료. 댓글 수정 불가는 의도된 설계로 확인 |
| 마이페이지 | 10% | 60% | 변경 없음 |
| 학교 기능 (급식/시간표/학사일정, NEIS 연동) | 15% | 0% | 변경 없음 |
| 관리자 페이지 | 10% | 60% | 관리자 판별 함수/정책 중복 정리로 유지보수성 개선 |
| 신고 기능 | 5% | 70% | 신고 접수 UI(post.html/js/post.js)가 이미 구현되어 있었음을 확인(문서 오기 정정). 정지 계정 신고 차단 정책 추가 |
| DB/인프라 (Supabase 스키마) | 5% | 100% | `sql/admin_setup.sql` 백필 커밋, 함수/정책 중복 제거 |

※ 이 추정치는 코드 존재 여부 기준으로 산정한 것으로, 정성적 판단이 섞여 있어 참고용입니다.
이번 회차는 Supabase MCP로 운영 DB에 직접 접속해 실제 스키마/정책/함수/Advisor 결과를 확인했습니다.

---

## ⚠️ 반복 회귀 이슈

`js/auth.js`가 과거 여러 세션에서 **같은 버그가 여러 번 다시 나타나는 패턴**이 있었습니다:

- 중복 `submit` 리스너 (로그인 요청 2번 발생) — 최소 2회 재발
- `checkSession()` 무조건 리다이렉트 (index.html 무한 새로고침) — 1회 재발
- `ensureProfile()`이 회원가입 메타데이터를 무시하고 이메일 앞부분을 닉네임으로 사용 — 1회 재발, 실제 계정(atokay10293@gmail.com) 데이터 유실로 이어져 Supabase에서 수동 복구함

이번 회차에는 `js/auth.js`를 직접 수정하지 않았습니다 (DB/SQL 정리 위주 작업). 근본 원인 파악은 여전히 미해결이며 git 커밋 히스토리 추적을 권장합니다.

---

## UI

### 홈 (index.html)

✅ 메인 레이아웃 (헤더 / 사이드바 / 하단 네비게이션)
✅ 로그인 상태에 따른 헤더 UI 자동 전환 (로그인 버튼 ↔ 프로필 드롭다운)
✅ 알림 드롭다운 (UI만, 실제 알림 데이터 연동은 미구현)
✅ 검색 (Supabase posts 테이블 대상 ilike 검색)
✅ 카테고리 필터 / 정렬(최신순·인기순)
✅ 게시글 목록
✅ 실시간 인기글 위젯
✅ 다크모드 대응
✅ 모바일 반응형
✅ 게시글 카드 클릭 시 post.html?id= 로 이동
✅ 글쓰기 버튼 → write.html로 이동
✅ `profile.is_admin === true`인 계정만 프로필 드롭다운에 "관리자 패널" 링크 노출

### 로그인 / 회원가입

✅ 로그인 (login.html, auth.js)
✅ 회원가입 (register.html)
✅ 정지/영구정지 계정 로그인·세션 복원 시 자동 차단
✅ `getProfile()` 자가복구 로직

### 게시판 (board.html)

✅ 게시판 목록 레이아웃
✅ Supabase `posts` 테이블 연동
✅ 게시글 상세 (post.html) — 조회수/좋아요/댓글 트리거 실사용(DB 레벨) 검증 완료
✅ 글쓰기 (write.html) — 글 등록 트리거 실사용(DB 레벨) 검증 완료
✅ 댓글 — 작성/조회/삭제 트리거까지 실사용 검증 완료. 수정 기능은 의도적으로 미제공(RLS에 UPDATE 정책 없음, 정상)
✅ 좋아요 — 추가/취소 트리거 실사용(DB 레벨) 검증 완료
✅ **신고 — "신고하기" 버튼/모달/제출 로직 구현 완료** (이전 문서에 ❌로 잘못 기재되어 있었음, 이번에 정정)

### 학교

❌ 급식 / 시간표 / 학사일정 (NEIS API 미연동)

### 사용자

🚧 프로필(마이페이지) 페이지 — 실사용 검증 더 필요
❌ 설정 페이지

### 관리자

✅ `admin.html` / `js/admin.js`
✅ 접근 제어
✅ 신고 내역 탭 (필터, 처리/반려)
✅ 회원 검색 탭, 계정 정지/영구정지/정지해제
🚧 게시글/댓글 직접 삭제 UI는 아직 없음 (DB 정책은 준비됨: `posts_delete_admin`, `comments_delete_admin`)
❌ 회원관리/게시글관리 전체 목록 대시보드는 아직 없음

---

## Backend

### Auth

✅ 회원가입 / 로그인 / 세션 확인 / 로그아웃 / 프로필 캐시
✅ 정지/영구정지 계정 로그인·세션 복원 시 차단
❌ 자동로그인 상세 동작 미검증

### Database

✅ `profiles` / `posts` / `comments` / `likes` / `reports` / `notices` 테이블 모두 실존 확인 (Supabase 직접 조회)
✅ RLS 정책 전수 확인 완료 — **이번 회차에 중복/누락 정리함**:
  - `is_admin()` (중복 함수) 제거, `is_admin_user()`로 통일
  - `profiles` 관리자 UPDATE 중복 정책 통합
  - `reports` INSERT 정책에 정지 계정 차단 조건 추가
✅ 댓글/좋아요 변경 시 `posts` count 자동 갱신 트리거 확인
✅ `sql/notice_setup.sql`, `sql/admin_setup.sql` 둘 다 레포에 커밋 완료 (이번 회차에 admin_setup.sql 백필)
✅ `comments` 테이블 UPDATE 정책 부재 = 의도된 설계 확인됨 (댓글 수정 기능 없음, 정상)
🚧 Leaked Password Protection 비활성 상태 (Supabase 대시보드에서 수동 활성화 필요)
✅ posts/comments/likes/reports 트리거·제약조건 실사용(DB 레벨) 검증 완료. 실제 로그인 세션 기준 브라우저 검증은 아직 권장

프로필 테이블 실제 컬럼 (Supabase 조회 기준):
`id, email, nickname, student_number(text), grade(int), class_number(int), number(int), avatar_url, bio, is_admin, suspended_until, suspended_reason, banned, ban_reason, created_at, updated_at`

---

## 현재 작업

🚧 auth.js 반복 회귀의 근본 원인 파악 (git 히스토리 확인 권장)
🚧 마이페이지(mypage.html) 실사용 검증
🚧 실제 로그인 세션 기준 브라우저 클릭 테스트 (지금까지는 DB 레벨/서비스 롤 검증만 완료)

## 다음 작업

1. Supabase 대시보드에서 Leaked Password Protection 수동 활성화 (수동 조치, 오케이 담당)
2. 마이페이지(mypage.html) 실사용 검증
3. auth.js가 왜 계속 예전 버전으로 되돌아갔었는지 원인 파악 (git 커밋 추적)
4. 관리자 페이지에 게시글/댓글 직접 삭제 UI, 전체 회원/게시글 목록 대시보드 추가
5. 실제 로그인 세션으로 브라우저에서 전체 플로우 한 번 더 클릭 테스트 (RLS 최종 확인)

---

## 버그

- (해결됨) login.html Supabase CDN 스크립트 누락
- (해결됨 — 반복 재발 이력) auth.js 중복 submit 리스너
- (해결됨 — 반복 재발 이력) auth.js checkSession() 무한루프
- (해결됨 — 반복 재발 이력) ensureProfile() 메타데이터 유실
- (해결됨) 로그인 창 실시간 검증 문구 오노출
- (해결됨) 회원가입 완료 안내 누락
- (해결됨) 회원가입 "← 홈으로" 버튼 스타일
- (해결됨, 이번 회차) `is_admin()`/`is_admin_user()` 중복 함수 및 `profiles` 중복 관리자 정책
- (해결됨, 이번 회차) `reports` INSERT 정책에 정지 계정 차단 누락
- (확인됨, 버그 아님) `comments` 테이블에 UPDATE RLS 정책 없음 = 댓글 수정 미제공은 의도된 설계
- **(미해결) Leaked Password Protection이 꺼져있음** (SQL로 해결 불가, 대시보드에서 수동 처리 필요)
- register.html 닉네임 중복확인이 프로필 생성 전 시점이라 사실상 무의미 (설계상 이슈, 논의 필요)
- `js/mypage.js`는 `student_number`를 Number로, `js/auth.js`의 `ensureProfile()`은 String으로 저장 — 타입 혼재 (수정 안 함, 범위 밖)

---

## 파일 구조

```
Taeker/
├── index.html
├── board.html
├── login.html
├── register.html
├── post.html
├── write.html
├── mypage.html
├── admin.html
├── PROJECT_STATUS.md
├── README.md
├── css/
│   └── style.css
├── sql/
│   ├── notice_setup.sql   (공지사항 기능 마이그레이션)
│   └── admin_setup.sql    (관리자/신고/정지 기능 마이그레이션 — 이번 회차 백필)
└── js/
    ├── app.js
    ├── auth.js
    ├── admin.js
    ├── board.js
    ├── write.js
    ├── post.js
    └── mypage.js
```
