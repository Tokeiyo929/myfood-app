const api = require('../../utils/api');
const setCurrentTab = require('../../utils/tab');
const REFRESH_POLL_MS = 1500;
let recordsRequest = 0;

Page({
  data: {
    settings: null,
    records: [],
    recordSearch: '',
    page: 1,
    hasMore: true,
    loading: false,
    selectedId: null,
    showBackTop: false,
  },

  onLoad() {
    this.loadConfig();
  },

  onShow() {
    setCurrentTab(this);
    const app = getApp();
    // 新增了记录：整体刷新
    if (app.globalData.refreshList) {
      app.globalData.refreshList = false;
      this.loadRecords(true);
    }
    // 上传完成后可能不会再次触发 onShow，轮询消费完成标记。
    this.startRefreshWatch(app);
    // 详情页保存了某条：局部刷新该条（不重拉全列表，保留滑动位置）
    if (app.globalData.lastUpdatedRecordId != null && this.data.settings && this.data.records.length) {
      const id = app.globalData.lastUpdatedRecordId;
      app.globalData.lastUpdatedRecordId = null;
      this.refreshRecord(id);
    }
  },

  onHide() { this.stopRefreshWatch(); },

  startRefreshWatch(app) {
    if (this.refreshWatch) return;
    this.refreshWatch = setInterval(() => {
      if (app.globalData.refreshList) {
        app.globalData.refreshList = false;
        this.stopRefreshWatch();
        this.loadRecords(true);
      }
    }, REFRESH_POLL_MS);
  },

  stopRefreshWatch() {
    if (this.refreshWatch) { clearInterval(this.refreshWatch); this.refreshWatch = null; }
  },

  refreshRecord(id) {
    api.getFoodById(id).then(r => {
      const records = this.data.records.map(item => Number(item.id) === Number(id) ? this.decorate(r) : item);
      this.setData({ records });
    }).catch(() => wx.showToast({ title: '记录刷新失败', icon: 'none' }));
  },

  decorate(record) {
    const scale = this.data.settings.flavor_scale;
    const prefs = this.data.settings.preferences;
    const { bad, excellent } = prefs;
    const flavorLabel = (name, level) => { const lv = level || scale.default_level; if (lv < scale.low_threshold) return '不' + name; if (lv < scale.mid_threshold) return '微' + name; if (lv < scale.high_threshold) return name; return '太' + name; };
    return {
      ...record,
      prefClass: record.preference === excellent.value ? 'preference-excellent' : record.preference === bad.value ? 'preference-bad' : 'preference-good',
      flavorLabels: (record.flavors || []).filter(f => f.level && f.level !== (scale.default_level)).map(f => flavorLabel(f.name, f.level)),
      ingredientLabels: (record.ingredients || []).map(it => it.amount ? it.name + '(' + it.amount + '%)' : it.name),
    };
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      this.setData({ settings: config });
      // 首次进入（records 为空）才加载
      if (!this.data.records.length) this.loadRecords(true);
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
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
      records = records.map(record => this.decorate(record));
      this.setData({ records, page, hasMore: records.length < result.total, selectedId: this.data.selectedId });
    } catch (e) {
      if (requestId === recordsRequest) wx.showToast({ title: e.message || '记录加载失败', icon: 'none' });
    } finally {
      if (requestId === recordsRequest) this.setData({ loading: false });
    }
  },

  onRecordSearch(e) {
    this.setData({ recordSearch: e.detail.value });
    this.loadRecords(true);
  },

  clearSearch() {
    this.setData({ recordSearch: '' });
    this.loadRecords(true);
  },

  selectRecord(e) {
    const id = Number(e.currentTarget.dataset.id);
    getApp().globalData.selectedRecordId = id;
    getApp().globalData.refreshDetail = true;
    wx.switchTab({ url: '/pages/detail/detail' });
  },

  onPageScroll(e) {
    const showBackTop = e.scrollTop > 400;
    if (showBackTop !== this.data.showBackTop) this.setData({ showBackTop });
  },

  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadRecords(false);
  },
  onReachBottomDistance: 100,
});
