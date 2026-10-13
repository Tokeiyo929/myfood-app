import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/history/history.wxml',encoding='utf-8').read()
print(c.encode('ascii','replace').decode('ascii'))
