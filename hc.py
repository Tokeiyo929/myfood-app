import io
for pg in ['history','records']:
    c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/'+pg+'/'+pg+'.wxml',encoding='utf-8').read()
    has_modal = 'commentingId' in c or 'openComment' in c or 'record' in c
    print(pg, 'wxml len', len(c), 'modal-ish:', has_modal)
    # check js for voice (startRecord/RecorderManager)
    j=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/'+pg+'/'+pg+'.js',encoding='utf-8').read()
    print(pg, 'js voice:', 'RecorderManager' in j, 'openComment:', 'openComment' in j)
