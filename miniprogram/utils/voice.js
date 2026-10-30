// 统一语音识别封装：WechatSI 插件管理器全局只创建一次，回调只注册一次。
// 所有页面共享同一个管理器，通过 attach/detach 切换"当前接收者"，
// 避免多页面各自注册回调互相覆盖（这是详情页/记录页语音互相干扰、结果不显示的根源）。

let plugin;        // undefined = 尚未加载
let manager = null;
let current = null; // 当前页面的回调集合 { onStart, onRecognize, onStop, onError }
let recording = false; // 真实录音状态（onStart 触发后为 true，onStop/onError/stop 复位）
let started = false;   // 是否已调用 start 且尚未 stop/出错，用于决定 stop 是否真正调用 manager.stop

function loadPlugin() {
  if (plugin !== undefined) return plugin;
  try {
    plugin = requirePlugin('WechatSI');
  } catch (e) {
    plugin = null;
  }
  return plugin;
}

// 获取（并初始化）管理器，只在第一次调用时创建、注册回调
function getManager() {
  if (manager) return manager;
  const p = loadPlugin();
  if (!p) return null;
  try {
    manager = p.getRecordRecognitionManager();
  } catch (e) {
    manager = null;
    return null;
  }
  manager.onStart = function () {
    recording = true;
    if (current && current.onStart) current.onStart();
  };
  manager.onRecognize = function (res) {
    if (current && current.onRecognize) current.onRecognize(res);
  };
  manager.onStop = function (res) {
    recording = false;
    started = false;
    if (current && current.onStop) current.onStop(res);
  };
  manager.onError = function (res) {
    recording = false;
    started = false;
    if (current && current.onError) current.onError(res);
  };
  return manager;
}

function isAvailable() {
  return !!getManager();
}

// 提前申请录音权限：页面 onLoad/onShow 调用，把权限弹窗移出"按下"的临界路径，
// 避免用户长按后才弹权限、等 5-6 秒才开始录音
function ensurePermission() {
  return new Promise(function (resolve) {
    wx.getSetting({
      success(res) {
        if (res.authSetting && res.authSetting['scope.record']) {
          resolve(true);
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success() { resolve(true); },
          fail() { resolve(false); },
        });
      },
      fail() { resolve(false); },
    });
  });
}

function attach(handlers) {
  current = handlers || null;
}

function detach(handlers) {
  if (current === handlers) current = null;
}

function start(options) {
  if (!getManager()) return false;
  try {
    manager.start(Object.assign({ duration: 30000, lang: 'zh_CN' }, options || {}));
    started = true;
    return true;
  } catch (e) {
    return false;
  }
}

// 停止：无论 onStart 是否已触发、插件回调是否到达，都复位状态；
// 只有确实 start 过才调用 manager.stop，避免未录音时切页误触发 stop/onError
function stop() {
  if (manager && started) {
    try { manager.stop(); } catch (e) {}
  }
  started = false;
  recording = false;
}

function isRecording() {
  return recording;
}

module.exports = {
  attach: attach,
  detach: detach,
  start: start,
  stop: stop,
  isRecording: isRecording,
  isAvailable: isAvailable,
  ensurePermission: ensurePermission,
};
