const api = require('../../utils/api');
let recordsRequest = 0;
let ingredientRequest = 0;

// 雷达图常量（与 web 端一致）
const WHEEL = { size: 220, center: 110, radius: 76, labelRadius: 95, handleRadius: 7 };

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
    reasonField: 'none',
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
    // 历史记录
    records: [],
    recordSearch: '',
    page: 1,
    hasMore: true,
    loading: false,
    // 外层：图片（必填）
    imagePath: '',
    fileList: [],
    panelVisible: false,
    draggingAxis: -1,
    prefLevel: 0,
    prefStep: 1,
  },

  onLoad() {
    this.loadConfig();
    this.loadCategories();
  },

  onReady() {
    if (this.data.flavors.length && this.data.panelVisible) this.drawWheel();
  },

  onShow() {
    if (this.data.settings && !this.data.records.length) {
      this.loadRecords(true);
      if (this.data.flavors.length && this.data.panelVisible) this.drawWheel();
    }
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      const prefs = Object.values(config.preferences).sort((a, b) => a.level - b.level);
      const prefStep = prefs.length > 1 ? Math.max(1, Math.min(...prefs.slice(1).map((item, i) => item.level - prefs[i].level))) : 1;
      this.setData({
        settings: config,
        flavors: config.flavors,
        preferenceOptions: prefs,
        prefLevel: config.preferences.good.level,
        prefStep,
      }, () => {
        this.loadRecords(true);
      });
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
    }
  },

  async loadCategories() {
    try {
      const result = await api.getCategories();
      this.setData({ categories: result.items });
    } catch (e) {
      wx.showToast({ title: '类别加载失败', icon: 'none' });
    }
  },

  async loadRecords(reset) {
    if (!reset && this.data.loading) return;
    const requestId = ++recordsRequest;
    this.setData({ loading: true });
    const page = reset ? 1 : this.data.page + 1;
    try {
      if (!this.data.settings) return;
      const limit = this.data.settings.pagination.page_size;
      const result = await api.getFoods(page, limit, this.data.recordSearch);
      if (requestId !== recordsRequest) return;
      let records = reset ? result.items : this.data.records.concat(result.items);
      const { bad, excellent } = this.data.settings.preferences;
      const scale = this.data.settings.flavor_scale;
      const flavorLabel = (name, level) => { const lv = level || scale.default_level; if (lv < scale.low_threshold) return "不"+name; if (lv < scale.mid_threshold) return "微"+name; if (lv < scale.high_threshold) return name; return "太"+name; };
      records = records.map(record => ({
        ...record,
        prefClass: record.preference === excellent.value ? 'preference-excellent' : record.preference === bad.value ? 'preference-bad' : 'preference-good',
        flavorLabels: (record.flavors || []).filter(f => f.level && f.level !== (scale.default_level)).map(f => flavorLabel(f.name, f.level)),
        ingredientLabels: (record.ingredients || []).map(it => it.amount ? it.name + '(' + it.amount + '%)' : it.name),
      }));
      this.setData({ records, page, hasMore: records.length < result.total });
    } catch (e) {
      if (requestId === recordsRequest) wx.showToast({ title: e.message || '记录加载失败', icon: 'none' });
    } finally {
      if (requestId === recordsRequest) this.setData({ loading: false });
    }
  },

  // ---------- 雷达图 ----------
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

  // 触摸雷达图调整味道
  onWheelTouch(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const that = this;
    wx.createSelectorQuery().select('#flavorWheel').boundingClientRect(function(rect) {
      if (!rect) return;
      const scale = WHEEL.size / rect.width;
      const cx = rect.left, cy = rect.top;
      const x = (touch.clientX - cx) * scale - WHEEL.center;
      const y = (touch.clientY - cy) * scale - WHEEL.center;
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

  resetFlavors() {
    if (!this.data.settings) return;
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

  // 外层：上传图片（必填）
  chooseImage(e) {
    const file = e.detail && e.detail.file;
    const path = file && (file.path || file.url);
    if (path) this.setData({ imagePath: path, fileList: [{ url: path }] });
  },
  removeImage() { this.setData({ imagePath: '', fileList: [] }); },

  // 详情面板：原料搜索
  onIngredientSearch(e) {
    const q = e.detail.trim();
    const requestId = ++ingredientRequest;
    this.setData({ ingredientSearch: q });
    if (!q) { this.setData({ ingredientSuggestions: [] }); return; }
    if (!this.data.settings) return;
    const limit = this.data.settings.pagination.ingredient_page_size;
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

  preventTouch() {},

  // 外层：保存记录（只上传图片，创建，其他字段留空）
  async submit() {
    if (!this.data.settings) {
      wx.showToast({ title: '配置加载中', icon: 'none' });
      return;
    }
    if (!this.data.imagePath) {
      wx.showToast({ title: '请上传图片', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      const upload = await api.compressAndUpload(this.data.imagePath, this.data.settings.image);
      const record = {
        name: this.data.dishName.trim(),
        brand_name: '',
        price: null,
        categories: [],
        ingredients: [],
        flavors: [],
        preference: this.data.settings.preferences.good.value,
        reason: '',
        image_path: upload.path,
        image_metadata: upload.metadata || {},
        client_key: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      };
      await api.submitFood(record);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ imagePath: '', fileList: [] });
      this.loadRecords(true);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  // 打开详情面板（编辑记录）
  toggleDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    const rec = this.data.records.find(r => Number(r.id) === id);
    if (!rec || !this.data.settings) return;
    // 填充编辑字段
    const scale = this.data.settings.flavor_scale;
    const flavorLevels = {};
    this.data.flavors.forEach(f => flavorLevels[f] = scale.default_level);
    (rec.flavors || []).forEach(f => { if (f && f.name) flavorLevels[f.name] = f.level; });
    const sorted = [...this.data.preferenceOptions].sort((a, b) => a.level - b.level);
    let pref = sorted.find(p => p.value === rec.preference) || this.data.settings.preferences.good;
    const bad = this.data.settings.preferences.bad.value;
    const good = this.data.settings.preferences.excellent.value;
    const reasonField = pref.value === bad ? 'bad' : pref.value === good ? 'good' : 'none';
    this.setData({
      panelVisible: true,
      editId: rec.id,
      dishName: rec.name || '',
      brandName: rec.brand_name || '',
      price: rec.price == null ? '' : String(rec.price),
      selectedCategory: (rec.categories && rec.categories[0]) || '',
      categorySearch: '',
      categorySuggestions: [],
      ingredients: (rec.ingredients || []).map(it => typeof it === 'string' ? { name: it, amount: null } : it),
      ingredientSearch: '',
      ingredientSuggestions: [],
      ingredientAmount: '',
      flavorLevels,
      preference: pref.value,
      preferenceFace: pref.face,
      preferenceLabel: pref.label,
      reasonField,
      badlyReason: rec.preference === bad ? (rec.reason || '') : '',
      goodReason: rec.preference === good ? (rec.reason || '') : '',
    }, () => {
      this.drawWheel();
    });
  },

  closeDetail() {
    this.setData({ panelVisible: false, editId: null });
  },

  // 保存详情面板（更新完整字段）
  async saveDetail() {
    if (this.data.editId == null || !this.data.settings) return;
    const bad = this.data.settings.preferences.bad.value;
    const excellent = this.data.settings.preferences.excellent.value;
    const reason = this.data.preference === bad ? this.data.badlyReason : this.data.preference === excellent ? this.data.goodReason : '';
    const config = this.data.settings;
    const flavors = Object.keys(this.data.flavorLevels)
      .filter(f => this.data.flavorLevels[f] > config.flavor_scale.min_level)
      .map(f => ({ name: f, level: this.data.flavorLevels[f] }));
    const price = this.data.price === '' ? null : Number(this.data.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      wx.showToast({ title: '价格无效', icon: 'none' });
      return;
    }
    const fields = {
      name: this.data.dishName,
      brand_name: this.data.brandName,
      price,
      categories: this.data.selectedCategory ? [this.data.selectedCategory] : [],
      ingredients: this.data.ingredients,
      flavors,
      preference: this.data.preference,
      reason,
    };
    wx.showLoading({ title: '保存中' });
    try {
      await api.updateFoodDetails(this.data.editId, fields);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeDetail();
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
