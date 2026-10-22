import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()
# show syncSelected + loadRecords + fillDetail entry paths
i=js.find("async loadRecords()")
print("LOADRECORDS:", js[i:i+600])
print("=====")
i2=js.find("syncSelected() {")
print("SYNCSELECTED:", js[i2:i2+900])
