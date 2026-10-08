Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/categories/categories', text: '产品类别', icon: '/images/category.png', selectedIcon: '/images/category-active.png' },
      { pagePath: '/pages/history/history', text: '历史记录', icon: '/images/history.png', selectedIcon: '/images/history-active.png' },
      { pagePath: '/pages/records/records', text: '记录', icon: '/images/record.png', selectedIcon: '/images/record-active.png' },
      { pagePath: '/pages/detail/detail', text: '详情', icon: '/images/detail.png', selectedIcon: '/images/detail-active.png' },
      { pagePath: '/pages/ingredients/ingredients', text: '原料', icon: '/images/ingredient.png', selectedIcon: '/images/ingredient-active.png' },
    ],
  },
  lifetimes: {
    attached() { this.updateSelected(); },
  },
  pageLifetimes: {
    show() { this.updateSelected(); },
  },
  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1].route;
      const selected = this.data.list.findIndex(item => item.pagePath === '/' + route);
      if (selected >= 0) this.setData({ selected });
    },
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    },
  },
});
