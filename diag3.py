import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/utils/api.js',encoding='utf-8').read()
i=c.find('function uploadImage')
seg=c[i:i+700].encode('ascii','replace').decode('ascii')
print('UPLOADIMAGE:', seg)
