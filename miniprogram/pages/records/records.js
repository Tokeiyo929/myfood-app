const api = require('../../utils/api');
let recordsRequest = 0;
let ingredientRequest = 0;

// 雷达图常量（与 web 端一致）
const WHEEL = { size: 220, center: 110, radius: 76, labelRadius: 95, handleRadius: 7 };

Page({
  data: {
    settings: null,
    flavors: [],
    flavorLevels: {},
    preferenceOptions: [],
    preference: '',
    preferenceFace: '',
    preferenceLabel: '',
    // 动态理由字段
    reasonField: 'none',     // 'none' | 'bad' | 'good'
    badlyReason: '',
    goodReason: '',
    dishName: '',
    brandName: '',
    price: '',
    ingredientSearch: '',
    ingredientSuggestions: [],
    ingredientAmount: '',
    ingredients: [],
    categories: [],
    selectedCategory: '',
    categorySearch: '',
    categorySuggestions: [],
    records: [],
    recordSearch: '',
    page: 1,
    hasMore: true,
    loading: false,
    imagePath: '',
    fileList: [],
    expandedId: null,
    detailRecord: null,
    prefGood: '',
    prefBad: '',
    prefExcellent: '',
    prefLevel: 50,
    prefStep: 50,
  },

  onLoad() {
    this.loadConfig();
    this.loadCategories();
  },

  onReady() {
    if (this.data.flavors.length) this.drawWheel();
  },

  onShow() {
    if (this.data.settings && !this.data.records.length) {
      this.loadRecords(true);
      if (this.data.flavors.length) this.drawWheel();
    }
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      const flavorLevels = {};
      config.flavors.forEach(f => flavorLevels[f] = config.flavor_scale.default_level);
      const prefs = Object.values(config.preferences).sort((a, b) => a.level - b.level);
      const good = config.preferences.good;
      this.setData({
        settings: config,
        flavors: config.flavors,
        flavorLevels,
        preferenceOptions: prefs,
        preference: good.value,
        preferenceFace: good.face,
        preferenceLabel: good.label,
        reasonField: good.value === config.preferences.bad.value ? 'bad' : good.value === config.preferences.excellent.value ? 'good' : 'none',
        prefGood: config.preferences.good.value,
        prefBad: config.preferences.bad.value,
        prefExcellent: config.preferences.excellent.value,
        prefLevel: config.preferences.good.level,
      }, () => {
        this.drawWheel();
        this.loadRecords(true);
      });
    } catch (e) {
      this.loadRecords(true);
    }
  },

  async loadCategories() {
    try {
      const result = await api.getCategories();
      this.setData({ categories: result.items });
    } catch (e) {}
  },

  async loadRecords(reset) {
    if (!reset && this.data.loading) return;
    const requestId = ++recordsRequest;
    this.setData({ loading: true });
    const page = reset ? 1 : this.data.page + 1;
    try {
      const limit = this.data.settings ? this.data.settings.pagination.page_size : 20;
      const result = await api.getFoods(page, limit, this.data.recordSearch);
      if (requestId !== recordsRequest) return;
      let records = reset ? result.items : this.data.records.concat(result.items);
      const bad = this.data.prefBad, good = this.data.prefGood, excellent = this.data.prefExcellent;
      const scale = this.data.settings ? this.data.settings.flavor_scale : {default_level:50, low_threshold:25, mid_threshold:50, high_threshold:75};
      const flavorLabel = (name, level) => { const lv = level || scale.default_level; if (lv < scale.low_threshold) return "不"+name; if (lv < scale.mid_threshold) return "微"+name; if (lv < scale.high_threshold) return name; return "太"+name; };
      records = records.map(record => ({
        ...record,
        prefClass: record.preference === excellent ? 'preference-excellent' : record.preference === bad ? 'preference-bad' : 'preference-good',
        pickable: record.preference !== bad && record.preference !== excellent,
        flavorLabels: (record.flavors || []).filter(f => f.level && f.level !== (scale.default_level)).map(f => flavorLabel(f.name, f.level)),
        ingredientLabels: (record.ingredients || []).map(it => it.amount ? it.name + '(' + it.amount + '%)' : it.name),
      }));
      this.setData({ records, page, hasMore: records.length < result.total });
    } catch (e) {} finally {
      if (requestId === recordsRequest) this.setData({ loading: false });
    }
  },

  // ---------- 雷达图 ----------
  drawWheel() {
    const canvas = wx.createCanvasContext('flavorWheel', this);
    const config = this.data.settings;
    const flavors = this.data.flavors;
    const levels = this.data.flavorLevels;
    const scale = config.flavor_scale;
    const cx = WHEEL.center, cy = WHEEL.center, r = WHEEL.radius;
    // 背景
    canvas.clearRect(0, 0, WHEEL.size, WHEEL.size);
    // 网格多边形
    canvas.setStrokeStyle('#d9c7ff');
    const points = flavors.map((v, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / flavors.length;
      return { v, a, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
    canvas.beginPath();
    points.forEach(p => p === points[0] ? canvas.moveTo(p.x, p.y) : canvas.lineTo(p.x, p.y));
    canvas.closePath();
    canvas.stroke();
    // 轴线
    points.forEach(p => {
      canvas.beginPath();
      canvas.moveTo(cx, cy);
      canvas.lineTo(p.x, p.y);
      canvas.setStrokeStyle('#e5dff0');
      canvas.stroke();
    });
    // 数值多边形
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
    // 标签
    canvas.setFontSize(12);
    canvas.setFillStyle('#333');
    points.forEach(p => {
      canvas.setTextAlign('center');
      canvas.setTextBaseline('middle');
      const lx = cx + Math.cos(p.a) * WHEEL.labelRadius;
      const ly = cy + Math.sin(p.a) * WHEEL.labelRadius;
      canvas.fillText(this.flavorName(p.v, levels[p.v]), lx, ly);
    });
    // 手柄
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

  // 触摸雷达图调整味道
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
      let best = 0, bestDot = -Infinity;
      flavors.forEach(function(v, i) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / flavors.length;
        const dot = x * Math.cos(a) + y * Math.sin(a);
        if (dot > bestDot) { bestDot = dot; best = i; }
      });
      that.setData({ draggingAxis: best });
      that.updateWheelAxis(best, x, y);
    }).exec();
  },

  onWheelMove(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const axis = this.data.draggingAxis;
    if (axis < 0) return;
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

  resetFlavors() {
    const flavorLevels = {};
    const config = this.data.settings;
    config.flavors.forEach(f => flavorLevels[f] = config.flavor_scale.default_level);
    this.setData({ flavorLevels }, () => this.drawWheel());
  },

  // ---------- 偏好滑块 ----------
  onPreferenceChange(e) {
    const level = Number(e.detail.value);
    const prefs = this.data.preferenceOptions;
    const pref = prefs.reduce((best, p) => Math.abs(p.level - level) < Math.abs(best.level - level) ? p : best, prefs[0]);
    const bad = this.data.settings.preferences.bad.value;
    const good = this.data.settings.preferences.excellent.value;
    const reasonField = pref.value === bad ? 'bad' : pref.value === good ? 'good' : 'none';
    this.setData({ preference: pref.value, preferenceFace: pref.face, preferenceLabel: pref.label, reasonField, prefLevel: pref.level });
  },

  onBadlyReason(e) { this.setData({ badlyReason: e.detail }); },
  onGoodReason(e) { this.setData({ goodReason: e.detail }); },

  onDishName(e) { this.setData({ dishName: e.detail }); },
  onBrandName(e) { this.setData({ brandName: e.detail }); },
  onPrice(e) { this.setData({ price: e.detail }); },
  onIngredientAmount(e) { this.setData({ ingredientAmount: e.detail }); },
  onRecordSearch(e) { this.setData({ recordSearch: e.detail }); this.loadRecords(true); },

  // 产品类别搜索 + chips
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

  chooseImage(e) {
    const file = e.detail && e.detail.file;
    const path = file && (file.path || file.url);
    if (path) this.setData({ imagePath: path, fileList: [{ url: path }] });
  },
  removeImage() { this.setData({ imagePath: '', fileList: [] }); },

  onIngredientSearch(e) {
    const q = e.detail.trim();
    const requestId = ++ingredientRequest;
    this.setData({ ingredientSearch: q });
    if (!q) { this.setData({ ingredientSuggestions: [] }); return; }
    const limit = this.data.settings ? this.data.settings.pagination.ingredient_page_size : 50;
    api.searchIngredients(q, limit).then(result => {
      if (requestId === ingredientRequest) this.setData({ ingredientSuggestions: result.items || [] });
    }).catch(() => {
      if (requestId === ingredientRequest) this.setData({ ingredientSuggestions: [] });
    });
  },

  pickIngredient(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.ingredientSuggestions[idx];
    if (!item) return;
    const amount = this.data.ingredientAmount === '' ? null : Number(this.data.ingredientAmount) || null;
    this.setData({ ingredients: this.data.ingredients.concat([{ name: item.name, amount }]), ingredientSearch: '', ingredientSuggestions: [], ingredientAmount: '' });
  },

  removeIngredient(e) {
    const idx = e.currentTarget.dataset.idx;
    const ingredients = this.data.ingredients.slice();
    ingredients.splice(idx, 1);
    this.setData({ ingredients });
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id;
    const rec = this.data.records.find(r => r.id === id);
    if (rec) this.setData({ detailRecord: rec });
  },

  closeDetail() { this.setData({ detailRecord: null }); },

  // 复购 / 改偏好
  async repurchase(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.currentTarget.dataset.value;
    try {
      await api.updateFoodPreference(id, value, '');
      this.loadRecords(true);
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async submit() {
    if (!this.data.ingredients.length) {
      wx.showToast({ title: '请添加原料', icon: 'none' });
      return;
    }
    const bad = this.data.settings.preferences.bad.value;
    const excellent = this.data.settings.preferences.excellent.value;
    const reason = this.data.preference === bad ? this.data.badlyReason : this.data.preference === excellent ? this.data.goodReason : '';
    wx.showLoading({ title: '保存中' });
    let imagePath = '';
    let imageMetadata = {};
    try {
      if (this.data.imagePath) {
        const upload = await api.uploadImage(this.data.imagePath);
        imagePath = upload.path;
        imageMetadata = upload.metadata || {};
      }
      const config = this.data.settings;
      const flavors = Object.keys(this.data.flavorLevels)
        .filter(f => this.data.flavorLevels[f] > config.flavor_scale.min_level)
        .map(f => ({ name: f, level: this.data.flavorLevels[f] }));
      const record = {
        name: this.data.dishName,
        brand_name: this.data.brandName,
        price: this.data.price === '' ? null : Number(this.data.price),
        categories: this.data.selectedCategory ? [this.data.selectedCategory] : [],
        ingredients: this.data.ingredients,
        flavors,
        preference: this.data.preference,
        reason,
        image_path: imagePath,
        image_metadata: imageMetadata,
        client_key: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      };
      await api.submitFood(record);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      // 重置
      const flavorLevels = {};
      config.flavors.forEach(f => flavorLevels[f] = config.flavor_scale.default_level);
      const good = config.preferences.good;
      this.setData({ dishName: '', brandName: '', price: '', ingredients: [], selectedCategory: '', imagePath: '', fileList: [], flavorLevels, preference: good.value, preferenceFace: good.face, preferenceLabel: good.label, reasonField: 'none', badlyReason: '', goodReason: '' }, () => this.drawWheel());
      this.loadRecords(true);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadRecords(false);
  },

  onReachBottomDistance: 100,
});
