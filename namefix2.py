import io,sys,re
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()

# A) syncSelected fallback: setData records AND ensure fillDetail always sets fields; add [detail] log
old="""        const loaded = (that.data.records || []).concat([r]);"""
assert js.count(old)==1, js.count(old)
js=js.replace(old, """        const loaded = (that.data.records || []).filter(x => Number(x.id) !== Number(id)).concat([r]);""")

# B) add [detail] log at fillDetail entry
old2="""  fillDetail(rec) {"""
assert js.count(old2)==1
js=js.replace(old2, """  fillDetail(rec) {

    console.log('[detail] fillDetail id=' + rec.id + ' name=' + (rec.name == null ? 'NULL' : JSON.stringify(rec.name)) + ' brand=' + (rec.brand_name == null ? 'NULL' : JSON.stringify(rec.brand_name)));""")

io.open(D+"detail.js","w",encoding="utf-8",newline="").write(js)
print("js patched")

# C) wxml: van-field value -> model:value for dishName/brandName/price
wxml=io.open(D+"detail.wxml",encoding="utf-8",newline="").read()
for fld,var in [("\u4ea7\u54c1","dishName"),("\u54c1\u724c","brandName"),("\u4ef7\u683c","price")]:
    old3=f'label="{fld}" value="{{{{{var}}}}}"'
    new3=f'label="{fld}" model:value="{{{{{var}}}}}"'
    n=wxml.count(old3)
    print(fld, "count", n)
    if n==1: wxml=wxml.replace(old3,new3)
io.open(D+"detail.wxml","w",encoding="utf-8",newline="").write(wxml)
print("wxml patched")
