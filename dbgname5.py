import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()
# find fillDetail and onShow - print them fully
i=js.find("fillDetail(")
print("FILLDETAIL ctx:")
print(js[max(0,i-100):i+2200])
