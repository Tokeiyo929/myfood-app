import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.js',encoding='utf-8').read()
i=c.find('openComment')
print(c[i:i+700].encode('ascii','replace').decode('ascii'))
