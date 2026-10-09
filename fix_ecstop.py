p = r'D:\GitHub\MyFood\myfood-app\miniprogram\ec-canvas\ec-canvas.js'
with open(p, encoding='utf-8') as f:
    c = f.read()
# 把 preventDefault 兜底扩展为 preventDefault + stopPropagation + stopImmediatePropagation
old = "      if (e && typeof e.preventDefault !== 'function') e.preventDefault = function() {};"
new = "      if (e && typeof e.preventDefault !== 'function') e.preventDefault = function() {};\n      if (e && typeof e.stopPropagation !== 'function') e.stopPropagation = function() {};\n      if (e && typeof e.stopImmediatePropagation !== 'function') e.stopImmediatePropagation = function() {};"
if old in c:
    c = c.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print("stopPropagation guard added")
