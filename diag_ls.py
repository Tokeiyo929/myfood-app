import os
base='D:/GitHub/MyFood/myfood-app/miniprogram/pages'
pages=['records','index','categories','history','webpick','detail']
for p in pages:
    d=os.path.join(base,p)
    print(p, sorted(os.listdir(d)) if os.path.isdir(d) else 'MISSING')
