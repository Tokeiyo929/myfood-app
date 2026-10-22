import io,sys,re
sys.stdout.reconfigure(encoding="utf-8")
W=r"D:/GitHub/MyFood/myfood-worker/src/worker.js"
c=io.open(W,encoding="utf-8",newline="").read()
idx=0
while True:
    i=c.find("ORDER BY",idx)
    if i<0: break
    print(repr(c[max(0,i-450):i+120]))
    print("=====")
    idx=i+8
