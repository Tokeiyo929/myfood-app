Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/categories/categories', text: '地图', icon: '/images/category.png', selectedIcon: '/images/category-active.png' },
      { pagePath: '/map-package/pages/map/map', text: '世界地图', icon: '/images/history.png', selectedIcon: '/images/history-active.png' },
      { pagePath: '/pages/history/history', text: '历史记录', icon: '/images/history.png', selectedIcon: '/images/history-active.png' },
      { pagePath: '/pages/records/records', text: '记录', icon: '/images/record.png', selectedIcon: '/images/record-active.png' },
      { pagePath: '/pages/detail/detail', text: '详情', icon: '/images/detail.png', selectedIcon: '/images/detail-active.png' },
    ],
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      if (path.indexOf('/pages/') === 0) {
        wx.switchTab({ url: path });
      } else {
        wx.navigateTo({ url: path });
      }
    },
  },
});
