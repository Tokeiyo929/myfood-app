module.exports = function setCurrentTab(page) {
  const tabBar = page.getTabBar && page.getTabBar();
  if (!tabBar || !page.route) return;
  const selected = tabBar.data.list.findIndex(item => item.pagePath === `/${page.route}`);
  if (selected >= 0) tabBar.setData({ selected });
};
