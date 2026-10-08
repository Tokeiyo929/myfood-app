p = r'D:\GitHub\MyFood\myfood-app\miniprogram\pages\detail\detail.js'
with open(p, encoding='utf-8') as f:
    c = f.read()

# syncSelected 找不到时按 id 加载
old = "  syncSelected() {\n    const id = getApp().globalData.selectedRecordId || this.data.selectedId;\n    if (!id) return;\n    const rec = this.data.records.find(r => Number(r.id) === Number(id));\n    if (!rec || !this.data.settings) return;"
new = "  syncSelected() {\n    const id = getApp().globalData.selectedRecordId || this.data.selectedId;\n    if (!id || !this.data.settings) return;\n    const rec = this.data.records.find(r => Number(r.id) === Number(id));\n    if (!rec) {\n      // 记录不在已加载列表里（如昨天的），按 id 单独加载\n      const that = this;\n      api.getFoodById(id).then(r => {\n        const loaded = (that.data.records || []).concat([r]);\n        that.setData({ records: loaded, scrollIntoId: \'img-\' + id });\n        that.fillDetail(r);\n      }).catch(() => {\n        wx.showToast({ title: \'记录加载失败\', icon: \'none\' });\n      });\n      return;\n    }\n    if (!rec) return;"
assert old in c, 'syncSelected not found'
c = c.replace(old, new)

# 把 syncSelected 里的填充逻辑抽成 fillDetail (供单独加载调用)
# 找到 syncSelected 的 setData 部分，改成调用 fillDetail
old_fill = "    this.setData({\n      editId: rec.id,\n      dishName: rec.name || '',\n      brandName: rec.brand_name || '',\n      price: rec.price == null ? '' : String(rec.price),\n      repurchase: rec.repurchase_count == null ? '' : String(rec.repurchase_count),\n      selectedCategory: (rec.categories && rec.categories[0]) || '',\n      categorySearch: '',\n      categorySuggestions: [],\n      ingredients: (rec.ingredients || []).map(it => typeof it === 'string' ? { name: it, amount: null } : it),\n      ingredientSearch: '',\n      ingredientSuggestions: [],\n      ingredientAmount: '',\n      flavorLevels,\n      preference: pref.value,\n      preferenceFace: pref.face,\n      preferenceLabel: pref.label,\n      prefLevel: pref.level,\n      prefPercent: this.preferencePercent(pref.level),\n      comments: rec.comment || [],\n      commentInput: '',\n    }, () => {\n      this.setData({ scrollIntoId: 'img-' + this.data.editId });\n      this.drawWheel();\n    });\n  },"
new_fill = "    this.fillDetail(rec);\n  },\n  fillDetail(rec) {\n    const scale = this.data.settings.flavor_scale;\n    const flavorLevels = {};\n    this.data.flavors.forEach(f => flavorLevels[f] = scale.default_level);\n    (rec.flavors || []).forEach(f => { if (f && f.name) flavorLevels[f.name] = f.level; });\n    const sorted = [...this.data.preferenceOptions].sort((a, b) => a.level - b.level);\n    let pref = sorted.find(p => p.value === rec.preference) || this.data.settings.preferences.good;\n    this.setData({\n      editId: rec.id,\n      dishName: rec.name || '',\n      brandName: rec.brand_name || '',\n      price: rec.price == null ? '' : String(rec.price),\n      repurchase: rec.repurchase_count == null ? '' : String(rec.repurchase_count),\n      selectedCategory: (rec.categories && rec.categories[0]) || '',\n      categorySearch: '',\n      categorySuggestions: [],\n      ingredients: (rec.ingredients || []).map(it => typeof it === 'string' ? { name: it, amount: null } : it),\n      ingredientSearch: '',\n      ingredientSuggestions: [],\n      ingredientAmount: '',\n      flavorLevels,\n      preference: pref.value,\n      preferenceFace: pref.face,\n      preferenceLabel: pref.label,\n      prefLevel: pref.level,\n      prefPercent: this.preferencePercent(pref.level),\n      comments: rec.comment || [],\n      commentInput: '',\n    }, () => {\n      this.setData({ scrollIntoId: 'img-' + this.data.editId });\n      this.drawWheel();\n    });\n  },"
assert old_fill in c, 'syncSelected fill not found'
c = c.replace(old_fill, new_fill)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('detail.js syncSelected uses getFoodById + fillDetail'
