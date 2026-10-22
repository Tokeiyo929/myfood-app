import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()
# find syncSelected full body
i=js.find("syncSelected")
print(js[i:i+1600])
