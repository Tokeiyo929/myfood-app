import io
p=r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/detail.js'
c=io.open(p,encoding='utf-8').read()
n=c.count('api.getFoods(1, limit, chr(39)+chr(39))') 
# targeted: add true for today in loadRecords
c=c.replace('api.getFoods(1, limit, '+chr(39)+chr(39)+')', 'api.getFoods(1, limit, '+chr(39)+chr(39)+', true)')
io.open(p,'w',encoding='utf-8').write(c)
print('added true', c.count(', true)'))