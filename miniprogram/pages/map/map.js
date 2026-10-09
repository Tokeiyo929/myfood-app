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
  for (const k of Object.keys(PROVINCE_MAP)) { if (PROVINCE_MAP[k] === full) return k; }
  if (full.endsWith('省')) return full.slice(0, -1);
  return full;
}

const VISITED_COLOR = '#b39ddb';
const SELECT_COLOR = '#66508f';

Page({
  data: {
    ec: { onInit: initChart },
    selectedProvince: '',
    dishList: [], // {name, visited}
  },

  onReady() {
    this.loadData();
  },

  onShow() {
    this.setTab();
  },

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  async loadData() {
    try {
      const config = await api.getConfig();
      const limit = config.pagination.max_page_size;
      const first = await api.getFoods(1, limit, '');
      const pages = Math.ceil(first.total / limit);
      const all = [first];
      for (let page = 2; page <= pages; page += 1) { all.push(await api.getFoods(page, limit, '')); }
      // 吃过的菜名集合
      const visitedDishes = new Set();
      all.forEach(r => (r.items || []).forEach(food => {
        (food.categories || []).forEach(cat => { if (cat) visitedDishes.add(cat); });
      }));
      this.visitedDishes = visitedDishes;

      const catResult = await api.getCategories();
      const byProvince = {};
      (catResult.items || []).forEach(item => {
        const province = (item.parentcategories || '').trim();
        if (province) { (byProvince[province] = byProvince[province] || []).push(item.name); }
      });
      this.byProvince = byProvince;

      // 各省是否有吃过的菜（visited）
      this.visitedProvinces = {};
      Object.keys(byProvince).forEach(prov => {
        this.visitedProvinces[prov] = byProvince[prov].some(dish => visitedDishes.has(dish));
      });

      this.renderMap();
      this.bindClick();
    } catch (e) {
      wx.showToast({ title: '地图数据加载失败', icon: 'none' });
    }
  },

  renderMap() {
    if (!chart) return;
    const data = [];
    Object.keys(this.byProvince).forEach(prov => {
      if (this.visitedProvinces[prov]) {
        data.push({ name: toRegionName(prov), value: 1, itemStyle: { areaColor: VISITED_COLOR } });
      }
    });
    chart.setOption({
      tooltip: { show: false },
      series: [{
        type: 'map',
        map: 'china',
        roam: true,
        scaleLimit: { min: 0.5, max: 10 },
        selectedMode: false,
        itemStyle: { areaColor: '#f0f0f0', borderColor: '#ccc' },
        emphasis: { itemStyle: { areaColor: SELECT_COLOR }, label: { show: false } },
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
      const dishes = (this.byProvince[province] || []).map(name => ({ name, visited: this.visitedDishes.has(name) }));
      // visited 置顶
      dishes.sort((a, b) => (b.visited ? 1 : 0) - (a.visited ? 1 : 0));
      this.setData({ selectedProvince: province, dishList: dishes });
      // 选中该省：设置单独高亮(用dispatch select 或重新强调)
    });
  },
});

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  return chart;
}
