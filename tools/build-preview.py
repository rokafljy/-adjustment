#!/usr/bin/env python3
"""index.html + assets 를 하나의 자립형 HTML 로 합칩니다.

검토용 미리보기(단일 파일 공유·업로드)를 위한 스크립트입니다. 배포본은
index.html 과 assets/ 를 그대로 쓰세요.

미리보기에서는 웹폰트 출처가 Google Fonts 로 제한되는 환경을 가정해
Pretendard(jsDelivr) 대신 Gothic A1 을 대체 폰트로 씁니다. 뷰어의 기기에
Pretendard 가 설치돼 있으면 그대로 Pretendard 로 렌더링됩니다.

사용법:
    python3 tools/build-preview.py [출력경로]              완전한 HTML 문서
    python3 tools/build-preview.py --fragment [출력경로]   문서 골격(doctype/html/head/body)
                                                          없이 본문만. 페이지를 자체 골격으로
                                                          감싸는 호스팅에 올릴 때 씁니다.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
FRAGMENT = "--fragment" in args
args = [a for a in args if a != "--fragment"]
OUT = pathlib.Path(args[0]) if args else ROOT / ("preview-fragment.html" if FRAGMENT else "preview.html")

html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
js = (ROOT / "assets/js/main.js").read_text(encoding="utf-8")
favicon = (ROOT / "assets/favicon.svg").read_bytes()


def sub1(pattern, repl, text, flags=0):
    text, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"패턴을 찾지 못했습니다: {pattern[:60]}")
    return text


# 폰트: jsDelivr(Pretendard) → Google Fonts(Gothic A1)
html = sub1(
    r'<link href="https://cdn\.jsdelivr\.net[^>]*>\n',
    "",
    html,
)
html = sub1(
    r'<link rel="preconnect" href="https://cdn\.jsdelivr\.net" crossorigin>\n',
    "",
    html,
)
html = sub1(
    r'<link href="https://fonts\.googleapis\.com/css2\?family=Space\+Grotesk[^"]*" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;600;700;800'
    '&family=Noto+Sans+KR:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700'
    '&display=swap" rel="stylesheet">',
    html,
)
css = sub1(
    r"font-family:'Pretendard Variable','Pretendard',-apple-system",
    "font-family:'Pretendard Variable','Pretendard','Gothic A1','Noto Sans KR',-apple-system",
    css,
)

# 파비콘 인라인
b64 = base64.b64encode(favicon).decode("ascii")
html = sub1(
    r'<link rel="icon" href="assets/favicon\.svg" type="image/svg\+xml">',
    f'<link rel="icon" href="data:image/svg+xml;base64,{b64}" type="image/svg+xml">',
    html,
)
html = sub1(r'<link rel="apple-touch-icon" href="assets/favicon\.svg">\n', "", html)

# CSS·JS 인라인
html = sub1(
    r'<link rel="stylesheet" href="assets/css/style\.css">',
    "<style>\n" + css + "\n</style>",
    html,
)
html = sub1(
    r'<script src="assets/js/main\.js" defer></script>',
    "<script>\n" + js + "\n</script>",
    html,
)

# 미리보기에는 없는 자산을 가리키는 절대 URL 메타 제거
html = re.sub(r'^<meta (?:property|name)="(?:og:image|twitter:image)[^>]*>\n', "", html, flags=re.M)

if FRAGMENT:
    # 호스트가 <!doctype>…<head>…<body> 를 씌워 주므로 본문만 남깁니다.
    # <title>·폰트 <link>·<style> 는 body 안에 있어도 브라우저가 정상 처리합니다.
    title = re.search(r"<title>.*?</title>", html, re.S).group(0)
    fonts = "\n".join(re.findall(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html))
    style = re.search(r"<style>.*?</style>", html, re.S).group(0)
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1).strip()
    html = "\n".join([title, fonts, style, "", body, ""])

OUT.write_text(html, encoding="utf-8")
print(f"{OUT} ({len(html.encode('utf-8')):,} bytes)")
