const api = require('../../utils/api');

const WHEEL = { size: 180, center: 90, radius: 62, labelRadius: 84, handleRadius: 5 };

Page({
  data: {
    settings: null,
    flavors: [],
    editId: null,
    flavorLevels: {},
    preferenceOptions: [],
    preference: '',
    preferenceFace: '',
    preferenceLabel: '',
    comments: [],
    commentInput: '',
    dishName: '',
    brandName: '',
    price: '',
    repurchase: '',
    ingredientSearch: '',
    ingredientAmount: '',
    ingredients: [],
    categories: [],
    selectedCategory: '',
    categorySearch: '',
    categorySuggestions: [],
    records: [],
    selectedId: null,
    scrollIntoId: '',
    draggingAxis: -1,
    prefLevel: 0,
    prefPercent: 0,
  },

  onLoad() {
    this.loadConfig();
    this.initVoice();
  },

  initVoice() {
    try {
      const plugin = wx.requirePlugin("WechatSI");
      const manager = plugin.getRecordRecognitionManager();
      const that = this;
      manager.onStop = function (res) {
        const text = (res && res.result) || "";
        if (text) that.setData({ commentInput: that.data.commentInput + (that.data.commentInput ? " " : "") + text });
      };
      manager.onError = function () {
        wx.showToast({ title: "语音识别失败", icon: "none" });
      };
      this.recorder = manager;
    } catch (e) {
      wx.showToast({ title: "语音组件不可用", icon: "none" });
    }
  },

  onVoiceStart() {
    const that = this;
    if (!this.recorder) { this.initVoice(); }
    if (!this.recorder) return;
    this.recorder.start({ duration: 30000, lang: "zh_CN" });
  },

  onVoiceEnd() {
    if (!this.recorder) return;
    this.recorder.stop();
  },


  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },
  onShow() {
    this.setTab();    const app = getApp();
    const gid = app.globalData.selectedRecordId;
    if (gid && gid !== this.data.selectedId) {
      // 选中项变了，重新加载记录并选中
      this.setData({ selectedId: gid });
      this.loadRecords();
    } else {
      this.syncSelected();
    }
    if (app.globalData.refreshDetail) {
      app.globalData.refreshDetail = false;
      this.loadRecords();
    }
    if (this.data.flavors.length) this.drawWheel();
  },

  onReady() {
    if (this.data.flavors.length) this.drawWheel();
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      const prefs = Object.values(config.preferences).sort((a, b) => a.level - b.level);
      this.setData({
        settings: config,
        flavors: config.flavors,
        preferenceOptions: prefs,
      }, () => {
        this.loadRecords();
      });
      // 加载类别供搜索
      api.getCategories().then(r => this.setData({ categories: r.items || [] })).catch(() => {
        wx.showToast({ title: '类别加载失败', icon: 'none' });
      });
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
    }
  },

  async loadRecords() {
    try {
      if (!this.data.settings) return;
      const limit = this.data.settings.pagination.max_page_size;
      const result = await api.getFoods(1, limit, '');
      this.setData({ records: result.items || [], selectedId: getApp().globalData.selectedRecordId || null });
      this.syncSelected();
    } catch (e) {
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    }
  },

  syncSelected() {
    const id = getApp().globalData.selectedRecordId || this.data.selectedId;
    if (!id || !this.data.settings) return;
    const rec = this.data.records.find(r => Number(r.id) === Number(id));
    if (!rec) {
      const that = this;
      api.getFoodById(id).then(r => {
        const loaded = (that.data.records || []).concat([r]);
        that.setData({ records: loaded, scrollIntoId: 'img-' + id });
        that.fillDetail(r);
      }).catch(() => {
        wx.showToast({ title: '记录加载失败', icon: 'none' });
      });
      return;
    }
    this.fillDetail(rec);
  },
  fillDetail(rec) {
    const scale = this.data.settings.flavor_scale;
    const flavorLevels = {};
    this.data.flavors.forEach(f => flavorLevels[f] = scale.default_level);
    (rec.flavors || []).forEach(f => { if (f && f.name) flavorLevels[f.name] = f.level; });
    const sorted = [...this.data.preferenceOptions].sort((a, b) => a.level - b.level);
    let pref = sorted.find(p => p.value === rec.preference) || this.data.settings.preferences.good;
    this.setData({
      editId: rec.id,
      dishName: rec.name || '',
      brandName: rec.brand_name || '',
      price: rec.price == null ? '' : String(rec.price),
      repurchase: rec.repurchase_count == null ? '' : String(rec.repurchase_count),
      selectedCategory: (rec.categories && rec.categories[0]) || '',
      categorySearch: '',
      categorySuggestions: [],
      ingredients: (rec.ingredients || []).map(it => typeof it === 'string' ? { name: it, amount: null } : it),
      ingredientSearch: '',
      ingredientAmount: '',
      flavorLevels,
      preference: pref.value,
      preferenceFace: pref.face,
      preferenceLabel: pref.label,
      prefLevel: pref.level,
      prefPercent: this.preferencePercent(pref.level),
      comments: rec.comment || [],
      commentInput: '',
    }, () => {
      this.setData({ scrollIntoId: 'img-' + this.data.editId });
      this.drawWheel();
    });
  },

  selectImage(e) {
    const id = Number(e.currentTarget.dataset.id);
    getApp().globalData.selectedRecordId = id;
    this.setData({ selectedId: id, scrollIntoId: 'img-' + id });
    this.syncSelected();
  },

  drawWheel() {
    if (!this.data.flavors.length) return;
    const canvas = wx.createCanvasContext('flavorWheel', this);
    const config = this.data.settings;
    const flavors = this.data.flavors;
    const levels = this.data.flavorLevels;
    const scale = config.flavor_scale;
    const cx = WHEEL.center, cy = WHEEL.center, r = WHEEL.radius;
    canvas.clearRect(0, 0, WHEEL.size, WHEEL.size);
    canvas.setStrokeStyle('#d9c7ff');
    const points = flavors.map((v, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / flavors.length;
      return { v, a, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
    canvas.beginPath();
    points.forEach(p => p === points[0] ? canvas.moveTo(p.x, p.y) : canvas.lineTo(p.x, p.y));
    canvas.closePath();
    canvas.stroke();
    points.forEach(p => {
      canvas.beginPath();
      canvas.moveTo(cx, cy);
      canvas.lineTo(p.x, p.y);
      canvas.setStrokeStyle('#e5dff0');
      canvas.stroke();
    });
    canvas.beginPath();
    points.forEach((p, i) => {
      const dist = r * levels[p.v] / scale.max_level;
      const x = cx + Math.cos(p.a) * dist, y = cy + Math.sin(p.a) * dist;
      i === 0 ? canvas.moveTo(x, y) : canvas.lineTo(x, y);
    });
    canvas.closePath();
    canvas.setFillStyle('rgba(102,80,143,0.25)');
    canvas.setStrokeStyle('#66508f');
    canvas.fill();
    canvas.stroke();
    canvas.setFontSize(12);
    canvas.setFillStyle('#333');
    points.forEach(p => {
      canvas.setTextAlign('center');
      canvas.setTextBaseline('middle');
      const lx = cx + Math.cos(p.a) * WHEEL.labelRadius;
      const ly = cy + Math.sin(p.a) * WHEEL.labelRadius;
      canvas.fillText(this.flavorName(p.v, levels[p.v]), lx, ly);
    });
    points.forEach(p => {
      const dist = r * levels[p.v] / scale.max_level;
      const x = cx + Math.cos(p.a) * dist, y = cy + Math.sin(p.a) * dist;
      canvas.beginPath();
      canvas.arc(x, y, WHEEL.handleRadius, 0, Math.PI * 2);
      canvas.setFillStyle('#66508f');
      canvas.fill();
    });
    canvas.draw();
  },

  flavorName(name, level) {
    const s = this.data.settings.flavor_scale;
    return level < s.low_threshold ? '不' + name : level < s.mid_threshold ? '微' + name : level < s.high_threshold ? name : '太' + name;
  },

  onWheelTouch(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const that = this;
    wx.createSelectorQuery().select('#flavorWheel').boundingClientRect(function(rect) {
      if (!rect) return;
      const scale = WHEEL.size / rect.width;
      const x = (touch.clientX - rect.left) * scale - WHEEL.center;
      const y = (touch.clientY - rect.top) * scale - WHEEL.center;
      const flavors = that.data.flavors;
      let best = 0, bestAngle = Infinity;
      flavors.forEach(function(v, i) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / flavors.length;
        let diff = Math.atan2(y, x) - a;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const ad = Math.abs(diff);
        if (ad < bestAngle) { bestAngle = ad; best = i; }
      });
      that.setData({ draggingAxis: best });
      that.updateWheelAxis(best, x, y);
    }).exec();
  },

  onWheelMove(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const axis = this.data.draggingAxis;
    if (!Number.isInteger(axis) || axis < 0) return;
    const that = this;
    wx.createSelectorQuery().select('#flavorWheel').boundingClientRect(function(rect) {
      if (!rect) return;
      const scale = WHEEL.size / rect.width;
      const x = (touch.clientX - rect.left) * scale - WHEEL.center;
      const y = (touch.clientY - rect.top) * scale - WHEEL.center;
      that.updateWheelAxis(axis, x, y);
    }).exec();
  },

  updateWheelAxis(axis, x, y) {
    const flavors = this.data.flavors;
    const sc = this.data.settings.flavor_scale;
    const a = -Math.PI / 2 + axis * Math.PI * 2 / flavors.length;
    const level = Math.max(sc.min_level, Math.min(sc.max_level, Math.round((x * Math.cos(a) + y * Math.sin(a)) / WHEEL.radius * sc.max_level)));
    const flavorLevels = this.data.flavorLevels;
    flavorLevels[flavors[axis]] = level;
    this.setData({ flavorLevels }, () => this.drawWheel());
  },

  onPrefTouch(e) { this.updatePrefFromTouch(e); },
  onPrefMove(e) { this.updatePrefFromTouch(e); },
  updatePrefFromTouch(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const that = this;
    wx.createSelectorQuery().select('.pref-track').boundingClientRect(function(rect) {
      if (!rect) return;
      const prefs = that.data.preferenceOptions;
      const min = prefs[0].level, max = prefs[prefs.length-1].level;
      let ratio = (rect.height - (touch.clientY - rect.top)) / rect.height;
      ratio = Math.max(0, Math.min(1, ratio));
      const level = Math.round(min + ratio * (max - min));
      that.setPrefLevel(level);
    }).exec();
  },
  preferencePercent(level) {
    const prefs = this.data.preferenceOptions;
    const min = prefs[0].level, max = prefs[prefs.length - 1].level;
    return Math.round((level - min) / (max - min) * 100);
  },
  setPrefLevel(level) {
    const prefs = this.data.preferenceOptions;
    const pref = prefs.reduce((best, pp) => Math.abs(pp.level - level) < Math.abs(best.level - level) ? pp : best, prefs[0]);
    this.setData({ preference: pref.value, preferenceFace: pref.face, preferenceLabel: pref.label, prefLevel: pref.level, prefPercent: this.preferencePercent(pref.level) });
  },
  resetFlavors() {
    if (!this.data.settings) return;
    const flavorLevels = {};
    const config = this.data.settings;
    config.flavors.forEach(f => flavorLevels[f] = config.flavor_scale.default_level);
    this.setData({ flavorLevels }, () => this.drawWheel());
  },

  onCommentInput(e) { this.setData({ commentInput: e.detail.value }); },

  onDishName(e) { this.setData({ dishName: e.detail }); },
  onBrandName(e) { this.setData({ brandName: e.detail }); },
  onPrice(e) { this.setData({ price: e.detail }); },
  onRepurchaseChange(e) { this.setData({ repurchase: e.detail }); },
  onIngredientAmount(e) { this.setData({ ingredientAmount: e.detail }, () => { if ((this.data.ingredientSearch || '').trim()) this.addIngredientBlock(); }); },

  onCategorySearch(e) {
    const q = e.detail;
    this.setData({ categorySearch: q });
    const all = this.data.categories.map(c => c.name);
    const selected = this.data.selectedCategory ? [this.data.selectedCategory] : [];
    const suggestions = q ? all.filter(n => !selected.includes(n) && n.toLowerCase().includes(q.toLowerCase())) : [];
    this.setData({ categorySuggestions: suggestions });
  },
  pickCategory(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ selectedCategory: name, categorySearch: '', categorySuggestions: [] });
  },
  removeCategory() {
    this.setData({ selectedCategory: '', categorySearch: '', categorySuggestions: [] });
  },

  onIngredientSearch(e) {
    this.setData({ ingredientSearch: e.detail });
  },
  // 添加原料: 拼装原料+含量, 不存在自动创建
  async addIngredientBlock() {
    const name = (this.data.ingredientSearch || '').trim();
    if (!name) { wx.showToast({ title: '请输入原料名', icon: 'none' }); return; }
    const amount = this.data.ingredientAmount === '' ? null : Number(this.data.ingredientAmount) || null;
    try {
      await api.addIngredient(name);
      this.setData({
        ingredients: this.data.ingredients.concat([{ name, amount }]),
        ingredientSearch: '',
        ingredientAmount: '',
      });
    } catch (e) {
      wx.showToast({ title: e.message || '原料添加失败', icon: 'none' });
    }
  },

  removeIngredient(e) {
    const idx = e.currentTarget.dataset.idx;
    const ingredients = this.data.ingredients.slice();
    ingredients.splice(idx, 1);
    this.setData({ ingredients });
  },

  deleteCurrent() {
    const id = this.data.editId;
    if (id == null) return;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？此操作不可恢复',
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success(res) {
        if (res.confirm) that.doDelete(id);
      }
    });
  },
  async doDelete(id) {
    try {
      await api.deleteFood(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      getApp().globalData.selectedRecordId = null;
      getApp().globalData.refreshList = true;
      this.setData({ editId: null, records: [] });
      this.loadRecords();
    } catch (e) {
      wx.showToast({ title: e.message || '删除失败', icon: 'none' });
    }
  },

  async saveDetail() {
    if (this.data.editId == null || !this.data.settings) return;
    const config = this.data.settings;
    const text = this.data.commentInput.trim();
    const comment = text ? this.data.comments.concat([text]) : this.data.comments;
    const flavors = Object.keys(this.data.flavorLevels)
      .filter(f => this.data.flavorLevels[f] > config.flavor_scale.min_level)
      .map(f => ({ name: f, level: this.data.flavorLevels[f] }));
    const price = this.data.price === '' ? null : Number(this.data.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      wx.showToast({ title: '价格无效', icon: 'none' });
      return;
    }
    const repurchase = this.data.repurchase === '' ? null : Number(this.data.repurchase);
    if (repurchase !== null && (!Number.isInteger(repurchase) || repurchase < 0)) {
      wx.showToast({ title: '复购次数无效', icon: 'none' });
      return;
    }
    const fields = {
      name: this.data.dishName,
      brand_name: this.data.brandName,
      price,
      repurchase_count: repurchase,
      categories: this.data.selectedCategory ? [this.data.selectedCategory] : [],
      ingredients: this.data.ingredients,
      flavors,
      preference: this.data.preference,
      comment,
    };
    wx.showLoading({ title: '保存中' });
    try {
      await api.updateFoodDetails(this.data.editId, fields);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      getApp().globalData.refreshDetail = true;
      getApp().globalData.lastUpdatedRecordId = this.data.editId;
      this.loadRecords();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },
});
