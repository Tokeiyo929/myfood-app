import subprocess
r=subprocess.run(['node','--check','miniprogram/pages/detail/detail.js'],capture_output=True,text=True)
print('node',r.stderr[:60])
r=subprocess.run(['git','add','--all'],capture_output=True,text=True)
print('add',r.returncode)
r=subprocess.run(['git','-c','http.proxy=http://127.0.0.1:7897','commit','-m','fix:今日记录页标题+删今日滑动条+onShow缓存+详情只今日+删流量+服务天数2026-09-29'],capture_output=True,text=True)
print('commit',r.stdout[:60])
r=subprocess.run(['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897','push','origin','main'],capture_output=True,text=True)
print('push',r.stderr[-70:])
