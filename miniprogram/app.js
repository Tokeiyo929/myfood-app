const offline = require('./utils/offline');

App({
  globalData: {
    selectedRecordId: null,
  },
  onLaunch() {
    // 断网期间积累的离线操作，恢复联网后自动补传
    wx.onNetworkStatusChange(res => {
      if (res.isConnected) offline.sync();
    });
  },
  onShow() {
    offline.sync();
  },
});
