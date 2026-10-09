import * as echarts from '../../ec-canvas/echarts';
import china from '../../mapdata/china';
const api = require('../../utils/api');

let chart = null;

const PROVINCE_MAP = {
  '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
  '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区', '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
  '香港': '香港特别行政区', '澳门': '澳门特别行政区',
};
function toFullName(name) {
  if (PROVINCE_MAP[name]) return PROVINCE_MAP[name];
  return name + '省';
}
function toRegionName(full) {
  for (const k of Object.keys(PROVINCE_MAP)) {
    if (PROVINCE_MAP[k] === full) return k;
  }
  if (full.endsWith('省')) return full.slice(0, -1);
  return full;
}

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
    const data = [];
    for (const key of Object.keys(byProvince)) {
      if (byProvince[key].length) {
        data.push({ name: toRegionName(key), value: byProvince[key].length, itemStyle: { areaColor: '#b39ddb' } });
      }
    }
    chart.setOption({
      // 去掉白色 tooltip 弹窗
      tooltip: { show: false },
      series: [{
        type: 'map',
        map: 'china',
        roam: true,
        scaleLimit: { min: 0.5, max: 10 },
        selectedMode: false,
        itemStyle: { areaColor: '#f0f0f0', borderColor: '#ccc' },
        emphasis: { itemStyle: { areaColor: '#b39ddb' }, label: { show: false } },
        select: { itemStyle: { areaColor: '#66508f' }, label: { show: false } },
        data,
      }],
    }, true);
  },

  bindClick() {
    if (!chart) return;
    chart.off('click');
    chart.on('click', params => {
      if (!params || !params.name) return;
      const province = toFullName(params.name);
      this.setData({ selectedProvince: province, provinceDishes: this.byProvince[province] || [] });
    });
  },
});

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  return chart;
}
