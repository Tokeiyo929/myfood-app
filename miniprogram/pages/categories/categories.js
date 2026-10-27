const setCurrentTab = require('../../utils/tab');

Page({
  data: {},

  onShow() { setCurrentTab(this); },
});
