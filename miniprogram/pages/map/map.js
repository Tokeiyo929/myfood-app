import * as echarts from '../../ec-canvas/echarts';
import china from '../../mapdata/china';
const api = require('../../utils/api');
const { CUISINE_TO_PROVINCES } = require('../../utils/regionMap');

let chart = null;

Page({
  data: {
    ec: { onInit: initChart },
    selectedProvince: '',
    provinceFoods: [],
  },

  onReady() {
    this.loadFoods();
  },

  onShow() {
    this.setTab();
  },

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  async loadFoods() {
    try {
      const config = await api.getConfig();
      const limit = config.pagination.max_page_size;
      const first = await api.getFoods(1, limit, '');
      const pages = Math.ceil(first.total / limit);
      const results = [first];
      for (let page = 2; page <= pages; page += 1) {
        results.push(await api.getFoods(page, limit, ''));
      }
      const byProvince = {};
      results.forEach(result => (result.items || []).forEach(food => {
        (food.categories || []).forEach(cat => {
          this.mapRegionToProvinces(cat).forEach(province => {
            (byProvince[province] = byProvince[province] || []).push(food);
          });
        });
      }));
      this.byProvince = byProvince;
      this.renderMap(byProvince);
      this.bindClick();
    } catch (e) {
      wx.showToast({ title: '地图数据加载失败', icon: 'none' });
    }
  },

  mapRegionToProvinces(cat) {
    return CUISINE_TO_PROVINCES[String(cat || '').trim()] || [];
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
      this.setData({ selectedProvince: params.name, provinceFoods: this.byProvince[params.name] || [] });
    });
  },
});

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  return chart;
}
