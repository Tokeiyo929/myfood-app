import io,sys
sys.stdout.reconfigure(encoding="utf-8")
for p in [r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/detail.js",r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/detail.wxml"]:
    c=io.open(p,encoding="utf-8").read()
    print("="*20, p)
    print(c)
