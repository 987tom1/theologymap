"""Syntax-check every inline <script> and .js file in the app.

A single unescaped apostrophe kills a whole module, and the page just renders
nothing with no server-side signal (web/gallery.html, phase 10). Nothing in this
repo parsed the browser-side code, so it shipped.
"""
import re, subprocess, glob, os, sys

tmp = os.path.join(os.environ.get('TMP', '/tmp'), 'syncheck')
os.makedirs(tmp, exist_ok=True)

files = (sorted(glob.glob('web/*.html')) + sorted(glob.glob('engine/*.html'))
         + sorted(glob.glob('web/*.js')) + sorted(glob.glob('engine/*.js'))
         + sorted(glob.glob('tests/*.js')))

bad = 0
for f in files:
    src = open(f, encoding='utf-8').read()
    if f.endswith('.html'):
        # inline blocks only: a <script src=...> has no body to check here
        blocks = re.findall(r'<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>', src, re.S)
    else:
        blocks = [src]
    for i, b in enumerate(blocks):
        if not b.strip():
            continue
        name = f.replace('/', '_').replace(os.sep, '_') + '.%d.mjs' % i
        p = os.path.join(tmp, name)
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(b)
        r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        if r.returncode:
            bad += 1
            print('FAIL %s (inline block %d)' % (f, i))
            for line in r.stderr.splitlines()[:5]:
                print('   ', line)

print('\nchecked %d files, %d syntax failures' % (len(files), bad))
sys.exit(1 if bad else 0)
