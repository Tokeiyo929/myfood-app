import subprocess
r=subprocess.run(['git','show','9661acc:miniprogram/pages/records/records.js'],capture_output=True,text=True,encoding='utf-8',errors='replace')
c=r.stdout
i=c.find('startRecord')
print(c[i:i+1800].encode('ascii','replace').decode('ascii'))
