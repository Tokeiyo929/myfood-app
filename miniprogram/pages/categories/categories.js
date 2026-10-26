const api = require('../../utils/api');

Page({
  data: {
    stats: null,
    days: null,
    mapMarkers: [{
      id: 'world',
      latitude: 26.0745,
      longitude: 119.2965,
      iconPath: '/images/category.png',
      width: 28,
      height: 28,
      label: {
        content: '世界地图',
        color: '#66508f',
        fontSize: 11,
        anchorX: -18,
        anchorY: -34,
        bgColor: '#ffffff',
        borderRadius: 6,
        padding: 4,
      },
    }],
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

  onMapMarker(e) {
    const id = e.detail && e.detail.markerId;
    if (id === 'world') {
      wx.navigateTo({ url: '/map-package/pages/map/map' });
    }
  },

  async loadStats() {
    try {
      const s = await api.getStats();
      let days = null;
      if (s.start_date) {
        const start = new Date(s.start_date).getTime();
        days = Math.max(1, Math.floor((Date.now() - start) / 86400000));
      }
      this.setData({ stats: s, days });
    } catch (e) {
      this.setData({ stats: null, days: null });
    }
  },
});
