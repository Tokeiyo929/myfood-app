import io
t = io.open(r'D:/GitHub/MyFood/myfood-app/newfn.txt', encoding='utf-8').read()
p = r'D:/GitHub/MyFood/myfood-app/miniprogram/utils/api.js'
c = io.open(p, encoding='utf-8').read()
i = c.find('function compressAndUpload')
e = c.find('function getConfig', i)
c = c[:i] + t + chr(10) + chr(10) + c[e:]
io.open(p, 'w', encoding='utf-8').write(c)
print('OK done')
