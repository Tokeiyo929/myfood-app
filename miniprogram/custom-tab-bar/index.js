Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/categories/categories', action: 'switchTab', text: '地图', icon: '/images/category.png', selectedIcon: '/images/category-active.png' },
      { pagePath: '/map-package/pages/map/map', action: 'navigateTo', text: '世界地图', icon: '/images/history.png', selectedIcon: '/images/history-active.png' },
      { pagePath: '/pages/history/history', action: 'switchTab', text: '历史记录', icon: '/images/history.png', selectedIcon: '/images/history-active.png' },
      { pagePath: '/pages/records/records', action: 'switchTab', text: '记录', icon: '/images/record.png', selectedIcon: '/images/record-active.png' },
      { pagePath: '/pages/detail/detail', action: 'switchTab', text: '详情', icon: '/images/detail.png', selectedIcon: '/images/detail-active.png' },
    ],
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx[e.currentTarget.dataset.action]({ url: path });
    },
  },
});
