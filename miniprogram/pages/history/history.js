const api = require('../../utils/api');
const DataBus = require('../../utils/databus');
const setCurrentTab = require('../../utils/tab');
let recordsRequest = 0;

Page({
  data: {
    settings: null,
    records: [],
    recordSearch: '',
    page: 1,
    hasMore: true,
    loading: false,
    showBackTop: false,
  },

  onLoad() {
    this.loadConfig();
  },

  onShow() {
    setCurrentTab(this);
    DataBus.subscribe('records', this, () => {
      if (this.data.settings) this.loadRecords(true);
    });
    // 统一规则：版本号落后或后台超时才重拉，否则用内存缓存
    if (DataBus.stale('records', this) && this.data.settings) {
      this.loadRecords(true);
    }
  },

  onHide() {
    DataBus.unsubscribe('records', this);
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
      this.loadRecords(true);
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
    }
  },

  async loadRecords(reset) {
    if (!this.data.settings) return;
    if (!reset && this.data.loading) return;
    const requestId = ++recordsRequest;
    this.setData({ loading: true });
    const page = reset ? 1 : this.data.page + 1;
    try {
      const limit = this.data.settings.pagination.page_size;
      const result = await api.getFoods(page, limit, this.data.recordSearch);
      if (requestId !== recordsRequest) return;
      let records = reset ? result.items : this.data.records.concat(result.items);
      records = records.map(record => this.decorate(record));
      this.setData({ records, page, hasMore: records.length < result.total });
      if (reset) DataBus.fresh('records', this);
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
