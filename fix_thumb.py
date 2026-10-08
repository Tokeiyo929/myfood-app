p = r'D:\GitHub\MyFood\myfood-app\miniprogram\pages\detail\detail.wxss'
with open(p, encoding='utf-8') as f:
    c = f.read()
old = ".pref-thumb { position: absolute; left: -6px; width: 36px; height: 36px; background: #66508f; border-radius: 50%; transform: translateX(-25%); }"
new = ".pref-thumb { position: absolute; left: 50%; width: 36px; height: 36px; background: #66508f; border-radius: 50%; transform: translate(-50%, 50%); }"
assert old in c, 'pref-thumb not found'
c = c.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('pref-thumb centered')
