const api = require('../../utils/api');

Page({
  data: {
    stats: null,
    version: '',
    days: null,
    storage: '',
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
    let version = '';
    try {
      const info = wx.getAccountInfoSync();
      version = (info.miniProgram || {}).version || '';
    } catch (e) { version = ''; }
    this.setData({ version });

    try {
      const s = await api.getStats();
      let days = null;
      if (s.start_date) {
        const start = new Date(s.start_date).getTime();
        days = Math.max(1, Math.floor((Date.now() - start) / 86400000));
      }
      this.setData({
        stats: s,
        days,
        storage: s.storage || '',
        traffic: s.traffic || '',
      });
    } catch (e) {
      this.setData({ stats: null });
    }
  },
});
