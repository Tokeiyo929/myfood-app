import io,sys
sys.stdout.reconfigure(encoding="utf-8")
H=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/history/history.js"
c=io.open(H,encoding="utf-8",newline="").read()
i=c.find("selectRecord")
print("!!!! FOUND BUG RISK: diff shows `const id = ...` line was REMOVED but my regex view earlier showed it present?!")
print(repr(c[i:i+300]))
