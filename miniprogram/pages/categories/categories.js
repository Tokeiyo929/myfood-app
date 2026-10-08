const api = require('../../utils/api');

const MAX_FOODS = 200;

Page({
  data: {
    groups: [],
    expandedParent: null,
    modal: null,
    loading: false,
  },

  onLoad() { this.loadCategories(); },

  async loadCategories() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const result = await api.getCategories();
      const items = result.items || [];
      const foods = await api.getFoods(1, MAX_FOODS, '').then(r => r.items).catch(() => []);
      const map = {};
      items.forEach(item => {
        const parent = item.parentcategories || '未分类';
        const food = foods.find(f => (f.categories || []).includes(item.name) && f.image_path);
        (map[parent] = map[parent] || []).push({
          id: item.id,
          name: item.name,
          img: food ? food.image_path : '',
          hasFood: foods.some(f => (f.categories || []).includes(item.name))
        });
      });
      const groups = Object.keys(map).map(parent => ({ parent, items: map[parent] }));
      this.setData({ groups });
    } finally { this.setData({ loading: false }); }
  },

  toggleGroup(e) {
    const parent = e.currentTarget.dataset.parent;
    this.setData({ expandedParent: this.data.expandedParent === parent ? null : parent });
  },

  async openCategory(e) {
    const name = e.currentTarget.dataset.name;
    const parent = e.currentTarget.dataset.parent;
    try {
      const result = await api.getFoodsByCategory(parent, MAX_FOODS);
      const foods = result.items.filter(f => (f.categories || []).includes(name) || (f.categories || []).includes(parent));
      this.setData({ modal: { name, foods } });
    } catch (err) {
      this.setData({ modal: { name, foods: [] } });
    }
  },

  closeModal() { this.setData({ modal: null }); },
});
