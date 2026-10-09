const api = require('../../utils/api');

Page({
  data: {
    stats: null,
    version: '1.0.0',
    startDate: '2026-09-30',
    days: null,
  },

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },
  onShow() { this.setTab(); this.loadStats(); },

  gotoMap() {
    wx.navigateTo({ url: '/map-package/pages/map/map' });
  },

  async loadStats() {
    try {
      const s = await api.getStats();
      const days = Math.max(1, Math.floor((Date.now() - new Date(this.data.startDate)) / 86400000));
      this.setData({ stats: s, days });
    } catch (e) {
      this.setData({ stats: null });
    }
  },
});
