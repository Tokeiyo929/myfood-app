import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.wxml',encoding='utf-8').read()
print(c[-400:].encode('ascii','replace').decode('ascii'))
