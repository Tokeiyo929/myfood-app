const api = require('../../utils/api');

const PAGE_SIZE = 200;

Page({
  data: {
    search: '',
    suggestions: [],
    ingredients: [],
    total: 0,
    loading: false,
  },


  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },
  onShow() {
    this.setTab();    this.loadIngredients();
  },

  async loadIngredients() {
    this.setData({ loading: true });
    try {
      const result = await api.searchIngredients('', PAGE_SIZE);
      this.setData({ ingredients: result.items, total: result.total });
    } catch (e) {} finally { this.setData({ loading: false }); }
  },

  onSearch(e) {
    const q = e.detail;
    this.setData({ search: q });
    if (!q) { this.setData({ suggestions: [] }); return; }
    const that = this;
    api.searchIngredients(q, PAGE_SIZE).then(result => {
      that.setData({ suggestions: result.items || [] });
    }).catch(() => that.setData({ suggestions: [] }));
  },

  async addIngredient() {
    const name = (this.data.search || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入原料名', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '添加中' });
    try {
      await api.addIngredient(name);
      wx.hideLoading();
      wx.showToast({ title: '添加成功', icon: 'success' });
      this.setData({ search: '', suggestions: [] });
      this.loadIngredients();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '添加失败', icon: 'none' });
    }
  },

  pickIngredient(e) {
    this.setData({ search: e.currentTarget.dataset.name, suggestions: [] });
  },
});
