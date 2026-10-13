import subprocess
r=subprocess.run(['git','show','9661acc:miniprogram/pages/records/records.js'],capture_output=True,text=True,encoding='utf-8',errors='replace')
c=r.stdout
print(c[:1300].encode('ascii','replace').decode('ascii'))
