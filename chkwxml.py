import io,re,os
base=r'D:/GitHub/MyFood/myfood-app/miniprogram'
for root,dirs,files in os.walk(base):
    for f in files:
        if f.endswith('.wxml'):
            p=os.path.join(root,f)
            c=io.open(p,encoding='utf-8',errors='ignore').read()
            vo=c.count('<view')
            vc=c.count('</view>')
            if vo!=vc:
                print('MISMATCH',f,'view open',vo,'close',vc)
print('done')   
