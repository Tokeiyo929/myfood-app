import * as echarts from '../../ec-canvas/echarts';
import china from '../../mapdata/china';
const api = require('../../utils/api');

let chart = null;

Page({
  data: {
    ec: { onInit: initChart },
    selectedProvince: '',
    provinceDishes: [],
  },

  onReady() {
    this.loadCategories();
  },

  onShow() {
    this.setTab();
  },

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  async loadCategories() {
    try {
      const result = await api.getCategories();
      const byProvince = {};
      (result.items || []).forEach(item => {
        const province = (item.parentcategories || '').trim();
        if (province) {
          (byProvince[province] = byProvince[province] || []).push(item.name);
        }
      });
      this.byProvince = byProvince;
      this.renderMap(byProvince);
      this.bindClick();
    } catch (e) {
      wx.showToast({ title: '地图数据加载失败', icon: 'none' });
    }
  },

  renderMap(byProvince) {
    if (!chart) return;
    const data = Object.keys(byProvince).map(name => ({
      name,
      value: byProvince[name].length,
      itemStyle: { areaColor: '#b39ddb' },
    }));
    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'map',
        map: 'china',
        roam: true,
        scaleLimit: { min: 0.5, max: 10 },
        itemStyle: { areaColor: '#f0f0f0', borderColor: '#ccc' },
        emphasis: { itemStyle: { areaColor: '#66508f' }, label: { show: true } },
        data,
      }],
    }, true);
  },

  bindClick() {
    if (!chart) return;
    chart.off('click');
    chart.on('click', params => {
      if (!params || !params.name) return;
      this.setData({ selectedProvince: params.name, provinceDishes: this.byProvince[params.name] || [] });
    });
  },
});

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  return chart;
}
