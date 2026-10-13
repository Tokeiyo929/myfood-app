import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.wxml',encoding='utf-8').read()
for kw in ['commentingId','showComment','recording','record','modal','voice','bindtouchstart','bindtouchend']:
    print(kw, ('YES' if kw in c else 'no'))
print('len',len(c))
print(c[-1200:].encode('ascii','replace').decode('ascii'))
