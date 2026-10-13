import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.wxml',encoding='utf-8').read()
i=c.find('commentingId')
print(c[i-200:i+900].encode('ascii','replace').decode('ascii'))
