import * as echarts from '../../ec-canvas/echarts';
import china from '../../mapdata/china';
import api from '../../utils/api';

let chart = null;
let clickBound = false;

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

  loadFoods() {
    api.getFoods(1, 200, '').then(result => {
      const byProvince = {};
      (result.items || []).forEach(food => {
        (food.categories || []).forEach(cat => {
          const province = this.mapRegionToProvince(cat);
          if (province) {
            (byProvince[province] = byProvince[province] || []).push(food);
          }
        });
      });
      this.byProvince = byProvince;
      this.renderMap(byProvince);
      this.bindClick();
    }).catch(() => {});
  },

  mapRegionToProvince(cat) {
    return String(cat || '') || null;
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
    if (!chart || clickBound) return;
    clickBound = true;
    const that = this;
    chart.on('click', function(params) {
      if (!params || !params.name) return;
      that.setData({ selectedProvince: params.name, provinceFoods: that.byProvince[params.name] || [] });
    });
  },
});

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  return chart;
}
