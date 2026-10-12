import io
try:
    c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.js',encoding='utf-8').read()
    j=c.find('saveQuick')
    seg=c[j:j+700].encode('ascii','replace').decode('ascii')
    print('SAVEQUICK:', seg)
except Exception as ex:
    print('err', ex)
