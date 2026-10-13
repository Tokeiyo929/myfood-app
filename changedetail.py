import io
import re
d = r'D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/detail.js'
c = io.open(d, encoding='utf-8').read()
# loadRecords: only today + selected
new = 'async loadRecords() { try { if (!this.data.settings) return; const limit = this.data.settings.pagination.max_page_size; const result = await api.getFoods(1, limit, '', true); this.setData({ records: result.items || [], selectedId: getApp().globalData.selectedRecordId || null }); this.syncSelected(); } catch (e) { wx.showToast({ title: e.message || '······', icon: 'none' }); } },'
c = re.sub(r'async loadRecords\(\) \{.*?\},\n?' , new, c, count=1)
io.open(d, 'w', encoding='utf-8').write(c)
print('loadRecords today+selected done')
