import subprocess
# find a commit where records.wxml had voice/commentingId
r=subprocess.run(['git','log','--oneline','--','miniprogram/pages/records/records.wxml'],capture_output=True,text=True,encoding='utf-8',errors='replace')
lines=r.stdout.strip().split('\n')[:15]
print('\n'.join(lines).encode('ascii','replace').decode('ascii'))
