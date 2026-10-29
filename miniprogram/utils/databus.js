// 统一缓存失效规则：全局版本号 + 页面按需刷新
// 原理（westore/mobx-miniprogram 的核心思想，精简为 40 行）：
//   - 任何写操作（增/删/改/换图）调用 DataBus.touch(...) 使对应数据版本号 +1
//   - 任何页面在 onShow 调用 DataBus.stale(key, this._rev) 判断数据是否变旧
//   - 版本号永不丢失/不被消费，杜绝"标记被消费后设置"的竞态
// 缓存策略：
//   - stale 为 false 时页面直接用内存数据（省流量）
//   - stale 为 true 时页面重拉数据，拉完记录新版本号
//   - 前台切后台超过 TTL 时视为陈旧（兜底外部数据变化）
const REVS = {};
const LAST_ACTIVE = {};
const SUBSCRIBERS = {};
const TTL_MS = 5 * 60 * 1000; // 5 分钟：后台超时后回前台强制刷新一次

const DataBus = {
  // 写侧：数据变更，使所有订阅该 key 的页面失效
  touch(...keys) {
    keys.forEach(k => {
      REVS[k] = (REVS[k] || 0) + 1;
      const subscribers = SUBSCRIBERS[k];
      if (subscribers) subscribers.forEach(reload => reload());
    });
  },

  subscribe(key, page, reload) {
    (SUBSCRIBERS[key] || (SUBSCRIBERS[key] = new Map())).set(page, reload);
  },

  unsubscribe(key, page) {
    const subscribers = SUBSCRIBERS[key];
    if (!subscribers) return;
    subscribers.delete(page);
    if (!subscribers.size) delete SUBSCRIBERS[key];
  },

  // 读侧：页面判断自己缓存的数据是否陈旧
  // 用法：onShow 里 if (DataBus.stale('records', this)) this.reload()
  stale(key, page) {
    const now = Date.now();
    const bgTimedOut = now - LAST_ACTIVE[key] > TTL_MS;
    LAST_ACTIVE[key] = now;
    if (page._rev == null) return true;          // 首次加载
    if ((REVS[key] || 0) !== page._rev) return true; // 版本落后
    if (bgTimedOut) return true;                 // 后台超时兜底
    return false;
  },

  // 页面加载成功后记下当前版本
  fresh(key, page) {
    page._rev = REVS[key] || 0;
    LAST_ACTIVE[key] = Date.now();
  },

};

module.exports = DataBus;
