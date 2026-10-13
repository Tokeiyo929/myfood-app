import io
c=io.open(r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.js',encoding='utf-8').read()
for kw in ['requirePlugin','initRecorder','startRecord','stopRecord','commentingId','commentInput','comments','recording','recorder']:
    print(kw, kw in c)
print('len', len(c))
