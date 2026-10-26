import * as echarts from '../../ec-canvas/echarts';
import china from '../../mapdata/china';
import europe from '../../mapdata/europe';
const api = require('../../../utils/api');

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
const ZOOM_STEP = 1.4;
const MIN_ZOOM = 1; // 默认倍率即铺满视窗（echarts 自带留白），不允许更小
const MAX_ZOOM = 10;

Page({
  data: {
    ec: { onInit: initChart },
    selectedProvince: '',
    dishList: [], // {name, visited}
    region: 'china', // 'china' | 'europe'
  },

  noop() {},

  onReady() {
    this.loadData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (this.loaded) this.loadData();
  },

  switchRegion(e) {
    const r = e.currentTarget.dataset.region;
    if (r === this.data.region) return;
    this.setData({ region: r, selectedProvince: '', dishList: [] }, () => this.renderMap());
  },

  zoomIn() {
    this.zoomBy(ZOOM_STEP);
  },

  zoomOut() {
    this.zoomBy(1 / ZOOM_STEP);
  },

  zoomBy(factor) {
    if (!chart) return;
    const option = chart.getOption();
    const series = option.series && option.series[0];
    if (!series) return;
    const current = series.zoom || MIN_ZOOM;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor));
    if (next === current) return;
    // 不传 center：以当前视口中心缩放
    chart.setOption({ series: [{ zoom: next }] });
  },

  async loadData() {
    try {
      const config = await api.getConfig();
      const limit = config.pagination.max_page_size;
      const first = await api.getFoods(1, limit, '');
      const pages = Math.ceil(first.total / limit);
      const requests = [first];
      for (let page = 2; page <= pages; page += 1) requests.push(api.getFoods(page, limit, ''));
      const all = await Promise.all(requests);
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

      this.renderMap();
      this.loaded = true;
    } catch (e) {
      wx.showToast({ title: '地图数据加载失败', icon: 'none' });
    }
  },

  renderRegionMap() {
    if (!chart) return;
    const isEurope = this.data.region === 'europe';
    const data = [];
    Object.keys(this.byProvince).forEach(prov => {
      if (!this.byProvince[prov].some(dish => this.visitedDishes.has(dish))) return;
      const name = isEurope ? prov : toRegionName(prov);
      data.push({ name, value: 1, itemStyle: { areaColor: VISITED_COLOR } });
    });
    chart.setOption({
      tooltip: { show: false },
      series: [{
        type: 'map',
        map: isEurope ? 'europe' : 'china',
        roam: 'move', // 只允许拖动平移，禁用双指/滚轮缩放
        scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
        selectedMode: 'single', // 原生选中态：点击高亮，与 emphasis 无关
        itemStyle: { areaColor: '#f0f0f0', borderColor: '#ccc' },
        // 禁用 hover 高亮：拖动经过区域时不再触发整画布重绘（拖动卡顿主因）
        emphasis: { disabled: true },
        // 选中态着色：选中区域染深紫
        select: {
          itemStyle: { areaColor: SELECT_COLOR },
          label: { show: false },
        },
        data,
      }],
    }, true);
    this.bindClick();
  },


  bindClick() {
    if (!chart) return;
    chart.off('click');
    chart.on('click', params => {
      if (!params || !params.name) return;
      let province;
      if (this.data.region === 'europe') {
        province = params.name; // 已是中文国家名
      } else {
        province = toFullName(params.name);
      }
      const dishes = (this.byProvince[province] || []).map(name => ({ name, visited: this.visitedDishes.has(name) }));
      // visited 置顶
      dishes.sort((a, b) => (b.visited ? 1 : 0) - (a.visited ? 1 : 0));
      this.setData({ selectedProvince: province, dishList: dishes });
    });
  },
});

function initChart(canvas, width, height, dpr) {
  // dpr 上限 2：iPhone dpr=3 时画布像素量翻倍以上，拖动每帧重绘明显卡顿
  const safeDpr = Math.min(dpr, 2);
  chart = echarts.init(canvas, null, { width, height, devicePixelRatio: safeDpr });
  canvas.setChart(chart);
  echarts.registerMap('china', china);
  echarts.registerMap('europe', europe);
  return chart;
}
