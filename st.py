import subprocess
r=subprocess.run(['git','status','--short'],capture_output=True,text=True)
print(r.stdout[:400])
