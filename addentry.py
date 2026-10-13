import io
p = r'D:/GitHub/MyFood/myfood-app/miniprogram/app.json'
c = io.open(p, encoding='utf-8').read()
if 'entryPagePath' not in c:
    c = c.replace('"lazyCodeLoading": "requiredComponents",', '"entryPagePath": "pages/records/records",
  "lazyCodeLoading": "requiredComponents",')
    io.open(p, 'w', encoding='utf-8').write(c)
    print('entryPagePath added', 'entryPagePath' in c)
else:
    print('exists')
