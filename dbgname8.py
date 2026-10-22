import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()
i=js.find("onShow(")
print("ONSHOW:", js[i:i+1300])
A=r"D:/GitHub/MyFood/myfood-app/miniprogram/utils/api.js"
try:
    a=io.open(A,encoding="utf-8",newline="").read()
except Exception:
    import glob
    print("api.js not at utils")
    a=""
if a:
    j=a.find("getFoods")
    print("API getFoods:", a[j:j+400])
