import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.js',encoding='utf-8').read()
i=c.find('chooseImage()')
print('RECORDS chooseImage+', repr(c[i:i+300]))
# saveQuick
j=c.find('saveQuick')
print('saveQuick:', repr(c[j:j+300]))
# api uploadImage
a=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/utils/api.js',encoding='utf-8').read()
k=a.find('function uploadImage')
print('uploadImage:', repr(a[k:k+600]))
