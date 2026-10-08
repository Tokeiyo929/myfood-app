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

  onShow() {
    this.loadIngredients();
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

  pickIngredient(e) {
    const name = e.currentTarget.dataset.name;
    if (!name) return;
    this.setData({ search: '', suggestions: [] });
    this.loadIngredients();
  },
});
