const api = require('../../utils/api');
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
  },

  onLoad() {
    this.loadConfig();
  },


  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },
  onShow() {
    this.setTab();    this.loadRecords(true);
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
      const flavorLabel = (name, level) => {
        const lv = level || scale.default_level;
        if (lv < scale.low_threshold) return '不' + name;
        if (lv < scale.mid_threshold) return '微' + name;
        if (lv < scale.high_threshold) return name;
        return '太' + name;
      };
      records = records.map(record => ({
        ...record,
        prefClass: record.preference === excellent.value ? 'preference-excellent' : record.preference === bad.value ? 'preference-bad' : 'preference-good',
        flavorLabels: (record.flavors || []).filter(f => f.level && f.level !== (scale.default_level)).map(f => flavorLabel(f.name, f.level)),
        ingredientLabels: (record.ingredients || []).map(it => it.amount ? it.name + '(' + it.amount + '%)' : it.name),
      }));
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
    this.setData({ selectedId: id });
    getApp().globalData.selectedRecordId = id;
    wx.switchTab({ url: '/pages/detail/detail' });
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadRecords(false);
  },
  onReachBottomDistance: 100,
});
