# -adjustment

청년일경험 팀지원금 정산, 결산

---

# 2026 대한민국 지속가능경영 대상 — 홍보 사이트

Claude Design 핸드오프 시안(`site_v2_modern.html`)을 그대로 옮긴 **정적 홍보 사이트**입니다.
빌드 도구·프레임워크 없이 HTML/CSS/JS 파일만으로 동작하며, 어떤 정적 호스팅에도 그대로 올릴 수 있습니다.

## 파일 구조

```
index.html                 사이트 본문 (단일 페이지)
assets/css/style.css       시안 스타일 + 프로덕션 보강(접근성·모바일·인쇄)
assets/js/main.js          카운트다운 · 스크롤 페이드 · 연도 탭 · 타임라인 · 모바일 메뉴
assets/favicon.svg         파비콘
assets/og-image.png        공유용 OG 이미지 (1200×630)
robots.txt / sitemap.xml   검색엔진용
tools/og-image.template.html   OG 이미지 원본 템플릿 (재생성용)
design/                    Claude Design 핸드오프 원본 시안 3종 (참고용, 배포 대상 아님)
.github/workflows/pages.yml    main 브랜치 → GitHub Pages 자동 배포
```

## 로컬에서 보기

`index.html`을 브라우저로 열어도 되지만, 상대 경로 자산 때문에 로컬 서버 사용을 권장합니다.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## 배포

`.github/workflows/pages.yml`이 `main` 브랜치 푸시 시 `index.html`, `assets/`, `robots.txt`,
`sitemap.xml`만 추려 GitHub Pages로 배포합니다. 저장소 **Settings → Pages → Source**를
`GitHub Actions`로 한 번 설정해 주세요. Netlify·S3 등 다른 호스팅에 올릴 때도 같은 4개만 올리면 됩니다.

배포 도메인이 확정되면 다음 값을 실제 주소로 바꿔야 합니다 (현재는 `https://www.kismesg.com/awards/2026/` 기준).

- `index.html`의 `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`
- `robots.txt`의 `Sitemap:` 줄
- `sitemap.xml`의 `<loc>`

## 콘텐츠 수정 위치

| 항목 | 위치 |
| --- | --- |
| 시상식 카운트다운 기준 시각 | `assets/js/main.js`의 `CEREMONY` 상수 + `index.html`의 JSON-LD `startDate` |
| 시상 절차 4단계 일정 | `index.html`의 `.tstep` 블록 |
| 역대 수상 기업 | `index.html`의 `.wpanel[data-panel="연도"]` 블록. 연도를 추가하려면 `.wtabs`에 버튼을, 아래에 같은 구조의 패널을 추가하고 `id`/`aria-controls`/`aria-labelledby`를 맞춰 주세요 |
| 연락처·마감일 | `index.html`의 `.contact-card` 및 푸터 |
| 히어로 상단 지표 | `index.html`의 `.pv-stats` |

## 시안 대비 추가한 것

시안의 시각적 결과물은 그대로 두고, 실제 서비스에 필요한 부분만 보강했습니다.

- **SEO/공유** — meta description, canonical, Open Graph/Twitter 카드, `Event` JSON-LD 구조화 데이터, sitemap, robots
- **모바일 내비게이션** — 시안은 1024px 이하에서 메뉴 링크를 숨기기만 했습니다. 같은 톤의 햄버거 버튼과 드롭다운을 추가했습니다
- **접근성** — 본문 바로가기 링크, 포커스 링, 연도 탭의 `tablist`/`tab`/`tabpanel` + 좌우 방향키 이동, 타임라인 카드 키보드 접근(시안은 hover 전용), 장식 요소 `aria-hidden`
- **견고성** — JS가 없거나 실패해도 본문이 보이도록 페이드인 처리, `prefers-reduced-motion` 대응, 카운트다운 종료 시 타이머 정지, 탭 복귀 시 시각 동기화
- **기타** — 전화·이메일·웹사이트를 실제 링크로, 인쇄 스타일시트

## OG 이미지 재생성

`tools/og-image.template.html`을 1200×630으로 캡처하면 됩니다.

```bash
chromium --headless=new --window-size=1200,630 \
  --screenshot=assets/og-image.png tools/og-image.template.html
```

> 현재 커밋된 `assets/og-image.png`는 웹폰트(Pretendard) CDN에 접근할 수 없는 환경에서 생성되어
> 대체 고딕으로 렌더링돼 있습니다. 인터넷이 되는 환경에서 위 명령으로 한 번 다시 뽑으면
> 사이트와 동일한 Pretendard로 렌더링됩니다.

## 참고 — 확인이 필요한 문구

시안 원문을 그대로 옮겼습니다. 다만 아래 두 가지는 주최 측 확인이 필요해 보입니다.

- 심사 자료 기준이 **“2024 ~ 2025년 발간된 지속가능경영보고서”**로 되어 있습니다. 2026년 시상 기준으로는
  2025~2026년 발간분이 맞는지 확인해 주세요. (`index.html`의 `.judging-note`와 접수 섹션 두 곳)
- 히어로의 `3Y 누적 개최`, `24+ 수상 기업`은 역대 수상 목록(2023·2024·2025 / 총 24곳)과 일치합니다.
  2026년 개최분을 포함해 표기를 바꿀지 결정해 주세요.

## 다른 시안

`design/`에 핸드오프 원본 3종이 그대로 들어 있습니다. 톤을 바꾸고 싶을 때 참고하세요.

- `site_v2_modern.html` — 현재 사이트의 원본 (라이트 그린 + 라임, Pretendard·Space Grotesk)
- `site_v1_premium.html` — 딥 포레스트 + 골드 + 크림, Noto Serif KR
- `site_v3_editorial.html` — 종이 질감 + 먹색 + 러스트, 나눔명조·IBM Plex Mono
