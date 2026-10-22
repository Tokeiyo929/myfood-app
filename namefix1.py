import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
js=io.open(D+"detail.js",encoding="utf-8",newline="").read()

# 1) fix concat bug in syncSelected fallback
old="""        const rec = this.data.records.find(r => Number(r.id) === Number(id));

    if (!rec) {

      const that = this;

      api.getFoodById(id).then(r => {

        const loaded = this.data.records.concat([r]);"""
if old not in js:
    # try compact variant
    import re
    m=re.search(r"api\.getFoodById\(id\)\.then\(r => \{[\s\S]{0,300}", js)
    print("VARIANT:", repr(m.group(0)) if m else "none")
else:
    print("old found")
