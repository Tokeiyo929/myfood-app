const api = require('../../utils/api');

Page({
  data: {
    stats: null,
    days: null,
    traffic: '',
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
      let days = null;
      if (s.start_date) {
        const start = new Date(s.start_date).getTime();
        days = Math.max(1, Math.floor((Date.now() - start) / 86400000));
      }
      let traffic = '';
      if (Array.isArray(s.traffic) && s.traffic[0] && Array.isArray(s.traffic[0].Values)) {
        const bytes = s.traffic[0].Values.reduce((a, b) => a + b, 0);
        traffic = this.fmtBytes(bytes);
      }
      this.setData({ stats: s, days, traffic });
    } catch (e) {
      this.setData({ stats: null, days: null, traffic: '' });
    }
  },

  fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  },
});
