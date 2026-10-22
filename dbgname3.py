import io,sys
sys.stdout.reconfigure(encoding="utf-8")
W=r"D:/GitHub/MyFood/myfood-worker/src/worker.js"
c=io.open(W,encoding="utf-8",newline="").read()
# find the list endpoint SELECT (with LIMIT / ORDER BY) - search 'ORDER BY'
import re
for m in re.finditer(r'SELECT[^`]{0,300}FROM foods[^`]{0,200}ORDER BY[^`]{0,80}', c):
    print(repr(m.group(0)[:500]))
    print("=====")
