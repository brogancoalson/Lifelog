"""Pack the Expo web export (dist/) into one self-contained HTML page.

Run after: EXPO_OFFLINE=1 npx expo export -p web
Output:    web-preview/lifelog.html
"""
import base64
import glob
import os

js_path = glob.glob('dist/_expo/static/js/web/*.js')[0]
js = open(js_path, encoding='utf-8').read()
for font in glob.glob('dist/assets/**/*.ttf', recursive=True):
    url = '/' + font[len('dist/'):]
    if url in js:
        b64 = base64.b64encode(open(font, 'rb').read()).decode()
        js = js.replace(url, 'data:font/ttf;base64,' + b64)
js = js.replace('</script', '<\\/script')

page = f'''<title>Lifelog</title>
<style>
:root {{
  --bg: #F6F6F4;
  --text: #15171A;
  color-scheme: light;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --bg: #0E0F11; --text: #F2F3F5; color-scheme: dark; }}
}}
:root[data-theme="dark"] {{ --bg: #0E0F11; --text: #F2F3F5; color-scheme: dark; }}
html {{ box-sizing: border-box; height: 100%; }}
body {{ height: 100%; margin: 0; overflow: hidden; background: var(--bg); color: var(--text); }}
#root {{ display: flex; height: 100%; flex: 1; }}
</style>
<noscript>Lifelog needs JavaScript turned on.</noscript>
<div id="root"></div>
<script>
{js}
</script>
'''
os.makedirs('web-preview', exist_ok=True)
open('web-preview/lifelog.html', 'w', encoding='utf-8').write(page)
print('web-preview/lifelog.html', len(page.encode()), 'bytes')
