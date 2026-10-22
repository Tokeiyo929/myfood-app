const api = require('../../utils/api');

const WEATHER_CODES = {
  0: '晴', 1: '多云', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛雨', 53: '毛雨', 55: '大毛雨',
  56: '冻毛雨', 57: '冻毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '阵雨', 81: '阵雨', 82: '强阵雨',
  85: '阵雪', 86: '阵雪',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷阵雨伴冰雹',
};

Page({
  data: {
    stats: null,
    days: null,
    weather: null, // {temp, text}
    weatherLoading: false,
  },

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onShow() { this.setTab(); this.loadStats(); this.loadWeather(); },

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
      this.setData({ stats: s, days });
    } catch (e) {
      this.setData({ stats: null, days: null });
    }
  },

  loadWeather() {
    if (this.data.weather || this.data.weatherLoading) return;
    this.setData({ weatherLoading: true });
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        wx.request({
          url: `https://api.open-meteo.com/v1/forecast?latitude=${res.latitude}&longitude=${res.longitude}&current=temperature_2m,weather_code`,
          success: (r) => {
            const c = r.data && r.data.current;
            if (c) {
              this.setData({
                weather: {
                  temp: Math.round(c.temperature_2m),
                  text: WEATHER_CODES[c.weather_code] || '—',
                },
              });
            }
          },
          complete: () => this.setData({ weatherLoading: false }),
        });
      },
      fail: () => {
        this.setData({ weatherLoading: false });
      },
    });
  },
});
