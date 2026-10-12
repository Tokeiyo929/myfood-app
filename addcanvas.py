import io
p=r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.wxml'
c=io.open(p,encoding='utf-8').read()
if 'thumbCanvas' not in c:
    c=c+'
<canvas canvas-id="thumbCanvas" style="width:320px;height:320px;position:fixed;left:-9999px;"/>
'
    io.open(p,'w',encoding='utf-8').write(c)
    print('canvas added')
else:
    print('exists')
