import io
p=r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/records/records.wxml'
c=io.open(p,encoding='utf-8').read()
print('has canvas:', 'thumbCanvas' in c)
print('tail:', repr(c[-200:]))
