import io,sys,re
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
wxml=io.open(D+"detail.wxml",encoding="utf-8",newline="").read()
# print all van-field lines and any dishName/brandName references
for m in re.finditer(r'[^\n]*(dishName|brandName)[^\n]*', wxml):
    print(repr(m.group(0)[:220]))
print("=== all van-field tags ===")
for m in re.finditer(r'<van-field[^>]*>', wxml):
    print(repr(m.group(0)[:260]))
