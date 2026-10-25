import io, sys
sys.stdout.reconfigure(encoding='utf-8')
d = 'D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/'
s = io.open(d + 'detail.js', encoding='utf-8', newline='').read()
i = s.find('ocr')
# print the OCR-related section
import re
# find function names containing ocr or chip
for m in re.finditer(r'\n  (\w*[Oo]cr\w*|\w*[Cc]hip\w*|\w*[Ss]elect\w*)\s*\(', s):
    print(m.group(1), m.start())
