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
    currentRepurchase: 0,
    worthIt: '',
    ingredientSearch: '',
    ingredientAmount: '',
    ingredientPreview: null,
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
    prefBottom: 0,
    editingCommentIndex: null,
    ocrOverlay: false,
    ocrItems: [],
    ocrTarget: 'name',
    ocrPicked: {},
    ocrStrokeMode: null,
    ocrBuiltText: '',
  },

  onLoad() {
    this.loadConfig();
    this.initVoice();
  },

  initVoice() {
    try {
      const plugin = requirePlugin("WechatSI");
      const manager = plugin.getRecordRecognitionManager();
      const that = this;

      manager.onStop = function (res) {
        const text = (res && res.result) || "";
        if (text) that.setData({ commentInput: text });
        else wx.showToast({ title: "未识别到内容", icon: "none" });
      };
      manager.onError = function (res) {
        wx.showToast({ title: (res && res.msg) || "语音识别失败", icon: "none" });
      };
      this.recorder = manager;
    } catch (e) {
      wx.showToast({ title: "语音组件不可用", icon: "none" });
    }
  },

  onVoiceStart() {
    if (!this.recorder) { this.initVoice(); }
    if (!this.recorder) return;
    try {
      this.recorder.start({ duration: 30000, lang: "zh_CN" });
    } catch (e) {
      wx.showToast({ title: "语音识别失败", icon: "none" });
    }
  },

  onVoiceEnd() {
    if (!this.recorder) return;
    try { this.recorder.stop(); } catch {}
  },


  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },
  onShow() {
    this.setTab();
    const app = getApp();
    if (app.globalData.cameraReturnPage === 'ocr' && app.globalData.cameraImagePath) {
      const path = app.globalData.cameraImagePath;
      app.globalData.cameraImagePath = null;
      app.globalData.cameraReturnPage = null;
      this.runOcr(path);
    } else if (app.globalData.cameraReturnPage === 'ocr') {
      app.globalData.cameraReturnPage = null;
    }
    const gid = app.globalData.selectedRecordId;
    let reload = app.globalData.refreshDetail;
    if (gid && gid !== this.data.selectedId) {
      // 选中项变了，重新加载记录并选中
      this.setData({ selectedId: gid });
      reload = true;
    } else {
      this.syncSelected();
    }
    if (reload) {
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
      const result = await api.getFoods(1, limit, '', true);
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
        const loaded = (that.data.records || []).filter(x => Number(x.id) !== Number(id)).concat([r]);
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
    const pref = this.data.preferenceOptions.find(p => p.value === rec.preference) || this.data.settings.preferences.good;
    this.setData({
      editId: rec.id,
      dishName: rec.name || '',
      brandName: rec.brand_name || '',
      price: rec.price == null ? '' : String(rec.price),
      currentRepurchase: rec.repurchase || 0,
      worthIt: rec.worth_it || '',
      prevRecordLabel: this.prevRecordLabel(rec.modify_at || []),
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
      prefBottom: this.prefBottom(this.preferencePercent(pref.level)),
      comments: rec.comment || [],
      commentInput: '',
      editingCommentIndex: null,
    }, () => {
      this.setData({ scrollIntoId: 'img-' + this.data.editId });
      this.drawWheel();
    });
  },

  prevRecordLabel(modifyAt) {
    if (!Array.isArray(modifyAt) || modifyAt.length < 2) return '';
    const d = new Date(modifyAt[modifyAt.length - 2] + 'T00:00:00');
    if (isNaN(d)) return modifyAt[modifyAt.length - 2];
    const now = new Date();
    const day = 24 * 3600 * 1000;
    const dd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((dd - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / day);
    const base = modifyAt[modifyAt.length - 2];
    if (diff === 1) return base + ' (昨天)';
    if (diff === 2) return base + ' (前天)';
    return base;
  },

  replaceImage(e) {
    const id = Number(e.currentTarget.dataset.id);
    const rec = this.data.records.find(r => Number(r.id) === id);
    if (!rec) return;
    const that = this;
    wx.showActionSheet({
      itemList: ["\u4ece\u76f8\u518c\u9009\u62e9", "\u62cd\u7167"],
      success(res) {
        const sourceType = res.tapIndex === 1 ? ["camera"] : ["album"];
        wx.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType,
          success: async function(cho) {
            const path = cho.tempFilePaths && cho.tempFilePaths[0];
            if (!path) return;
            wx.showLoading({ title: "\u4e0a\u4f20\u4e2d" });
            try {
              const upload = await api.compressAndUpload(path, that.data.settings.image, Date.now());
              await api.updateFoodDetails(id, { image_path: upload.path, image_metadata: upload.metadata || {} });
              wx.hideLoading();
              wx.showToast({ title: "\u5df2\u66f4\u6362", icon: "success" });
              const records = that.data.records.map(r => Number(r.id) === id ? Object.assign({}, r, { image_path: upload.path }) : r);
              that.setData({ records });
            } catch (err) {
              wx.hideLoading();
              wx.showToast({ title: "\u66f4\u6362\u5931\u8d25", icon: "none" });
            }
          }
        });
      }
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
  prefBottom(pct) {
    return Math.round(pct / 100 * 116);
  },
  setPrefLevel(level) {
    const prefs = this.data.preferenceOptions;
    const pref = prefs.reduce((best, pp) => Math.abs(pp.level - level) < Math.abs(best.level - level) ? pp : best, prefs[0]);
    const pct = this.preferencePercent(pref.level);
    this.setData({ preference: pref.value, preferenceFace: pref.face, preferenceLabel: pref.label, prefLevel: pref.level, prefPercent: pct, prefBottom: this.prefBottom(pct) });
  },
  resetFlavors() {
    if (!this.data.settings) return;
    const flavorLevels = {};
    const config = this.data.settings;
    config.flavors.forEach(f => flavorLevels[f] = config.flavor_scale.default_level);
    this.setData({ flavorLevels }, () => this.drawWheel());
  },

  onCommentInput(e) { this.setData({ commentInput: e.detail.value }); },
  editComment(e) {
    const idx = e.currentTarget.dataset.idx;
    const text = this.data.comments[idx];
    if (text == null) return;
    this.setData({ commentInput: text, editingCommentIndex: idx });
  },
  deleteComment(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.showModal({
      title: "删除评论",
      content: "确定要删除这条评论吗？",
      confirmText: "删除",
      confirmColor: "#ee0a24",
      success: async res => {
        if (!res.confirm) return;
        const comments = this.data.comments.slice();
        comments.splice(idx, 1);
        try {
          await api.addComment(this.data.editId, comments);
          this.setData({ comments, editingCommentIndex: null, commentInput: "" });
        } catch (e) {
          wx.showToast({ title: e.message || '删除评论失败', icon: 'none' });
        }
      }
    });
  },

  removeTempFile(path) {
    if (!path) return;
    try { wx.getFileSystemManager().unlink({ filePath: path, fail() {} }); } catch (e) {}
  },
  runOcr(path) {
    const that = this;
    wx.showLoading({ title: '识别中' });
        wx.serviceMarket.invokeService({
          service: 'wx79ac3de8be320b71',
          api: 'OcrAllInOne',
          data: { img_url: new wx.serviceMarket.CDN({ type: 'filePath', filePath: path }), data_type: 3, ocr_type: 8 },
        }).then(r => {
              wx.hideLoading();
              const resData = (r && r.data) || r;
              const comm = resData && resData.ocr_comm_res;
              const items = [];
              ((comm && comm.items) || []).forEach(it => {
                const text = it && it.text ? String(it.text).trim() : '';
                if (!text) return;
                Array.from(text).forEach(ch => items.push({ ch, key: items.length }));
              });
              if (!items.length) { that.removeTempFile(path); wx.showToast({ title: '未识别到文字', icon: 'none' }); return; }
              that.removeTempFile(path);
              that.setData({ ocrOverlay: true, ocrItems: items, ocrTarget: 'name', ocrPicked: {}, ocrBuiltText: '' });
            }).catch(err => {
              wx.hideLoading();
              that.removeTempFile(path);
              wx.showToast({ title: 'OCR调用失败: ' + ((err && err.errMsg) || ''), icon: 'none' });
          });
  },
  startOcr() {
    const that = this;
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照'],
      success(res) {
        if (res.tapIndex === 1) {
          getApp().globalData.cameraImagePath = null;
          getApp().globalData.cameraReturnPage = 'ocr';
          wx.navigateTo({ url: '/pages/camera/camera' });
        } else {
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album'],
            success(res) {
              const path = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
              if (path) that.runOcr(path);
            }
          });
        }
      }
    });
  },
  closeOcr() {
    this.applyOcrBuilt(() => {
      this.setData({ ocrOverlay: false, ocrItems: [], ocrPicked: {}, ocrBuiltText: '', ocrStrokeMode: null }, () => {
        if (this.data.flavors.length) this.drawWheel();
      });
    });
  },
  applyOcrBuilt(done) {
    const text = (this.data.ocrBuiltText || '').trim();
    const target = this.data.ocrTarget;
    const patch = {};
    if (!text) { if (done) done(); return; }
    if (target === 'name') patch.dishName = text;
    else if (target === 'brand') patch.brandName = text;
    else if (target === 'ingredient') {
      this.confirmIngredient(text);
      if (done) done();
      return;
    }
    if (Object.keys(patch).length) this.setData(patch);
    if (done) done();
  },
  setOcrTarget(e) {
    this.applyOcrBuilt(() => {
      this.setData({ ocrTarget: e.currentTarget.dataset.t, ocrPicked: {}, ocrBuiltText: '' });
    });
  },
  ocrBuiltText() {
    const items = this.data.ocrItems;
    const picked = this.data.ocrPicked;
    return items.filter(it => picked[it.key]).map(it => it.ch).join('');
  },
  ocrSetChar(key, on) {
    const picked = Object.assign({}, this.data.ocrPicked);
    if (on) picked[key] = true; else delete picked[key];
    const items = this.data.ocrItems;
    const text = items.filter(it => picked[it.key]).map(it => it.ch).join('');
    this.setData({ ocrPicked: picked, ocrBuiltText: text });
  },
  ocrTouchStart(e) {
    const key = e.currentTarget.dataset.key;
    if (key == null) return;
    const mode = this.data.ocrPicked[key] ? 'off' : 'on';
    this.setData({ ocrStrokeMode: mode });
    this.ocrSetChar(key, mode === 'on');
    const that = this;
    wx.createSelectorQuery().selectAll('.ocr-char').boundingClientRect(function(rects) {
      that.ocrRects = rects || [];
    }).exec();
  },
  ocrTouchMove(e) {
    const mode = this.data.ocrStrokeMode;
    if (!mode) return;
    const touch = e.touches && e.touches[0];
    if (!touch || !this.ocrRects) return;
    const rects = this.ocrRects;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
        this.ocrSetChar(this.data.ocrItems[i].key, mode === 'on');
        break;
      }
    }
  },
  ocrTouchEnd() {
    this.setData({ ocrStrokeMode: null });
  },
  addToOcrField() {
    this.applyOcrBuilt(() => {
      this.setData({ ocrPicked: {}, ocrBuiltText: '' });
    });
  },
  clearOcrBuilt() {
    this.setData({ ocrPicked: {}, ocrBuiltText: '' });
  },
  onWorthIt(e) { this.setData({ worthIt: e.currentTarget.dataset.v === this.data.worthIt ? '' : e.currentTarget.dataset.v }); },
  onDishName(e) { this.setData({ dishName: e.detail }); },
  onBrandName(e) { this.setData({ brandName: e.detail }); },
  onPrice(e) { this.setData({ price: e.detail }); },
  onIngredientAmount(e) {
    const amount = e.detail;
    this.setData({ ingredientAmount: amount });
    this.updateIngredientPreview();
  },
  updateIngredientPreview() {
    const name = (this.data.ingredientSearch || "").trim();
    const amount = this.data.ingredientAmount === "" ? null : Number(this.data.ingredientAmount);
    this.setData({ ingredientPreview: name ? { name, amount } : null });
  },

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
    this.updateIngredientPreview();
  },
  async confirmIngredient(nameOverride) {
    let name, amount;
    if (typeof nameOverride === 'string' && nameOverride) {
      name = nameOverride;
      amount = null;
    } else {
      const preview = this.data.ingredientPreview;
      if (!preview || !preview.name) return;
      name = preview.name;
      amount = preview.amount;
    }
    try {
      await api.addIngredient(name);
      this.setData({
        ingredients: this.data.ingredients.concat([{ name, amount }]),
        ingredientSearch: "",
        ingredientAmount: "",
        ingredientPreview: null,
      });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || "原料添加失败", icon: "none" });
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
    let comment = this.data.comments.slice();
    const editIdx = this.data.editingCommentIndex;
    if (editIdx != null) {
      if (text) comment[editIdx] = text;
      else comment.splice(editIdx, 1);
    } else if (text) {
      comment.push(text);
    }
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
      worth_it: this.data.worthIt === '' ? null : this.data.worthIt === 'yes',
      comment,
    };
    wx.showLoading({ title: '保存中' });
    try {
      await api.updateFoodDetails(this.data.editId, fields);
      this.setData({ editingCommentIndex: null, commentInput: "" });
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
