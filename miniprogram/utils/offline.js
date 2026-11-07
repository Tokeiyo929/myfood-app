// 离线能力中枢：wx storage 缓存（配置/记录/类别）+ 离线写操作队列 + 联网自动同步
// 与 iOS OfflineStore 同一思路：断网可浏览缓存数据；写操作先乐观落本地并入队，
// 恢复联网后按序重放（create 用 client_key 幂等；本地未同步记录用负数 id）。
const api = require('./api');

const KEYS = {
  config: 'mf_cache_config',
  categories: 'mf_cache_categories',
  foods: 'mf_cache_foods',   // 全量记录数组（id < 0 = 本地未同步）
  pending: 'mf_pending_ops',
  imgMap: 'mf_img_map',      // 服务端图片 key → 本地缓存文件路径
};

function setStorage(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) { /* 存储满等异常不阻塞主流程 */ }
}

function getStorage(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return (v === '' || v == null) ? fallback : v;
  } catch (e) { return fallback; }
}

function todayString() {
  const d = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 网络不可达（可离线兜底/入队）还是业务错误（不该被缓存/队列掩盖）
// 服务端已响应的 reject 一律带 "HTTP "（api.request）；请求失败是 request:fail / 网络错误
function isNetworkError(err) {
  const msg = (err && err.message) || String(err || '');
  if (msg.indexOf('HTTP ') >= 0) return false;
  return /:fail|网络错误|timeout|timed out|abort/i.test(msg);
}

// ===== 配置 / 类别缓存 =====

function saveConfig(config) { setStorage(KEYS.config, config); }
function getCachedConfig() { return getStorage(KEYS.config, null); }
function saveCategories(items) { setStorage(KEYS.categories, items || []); }
function getCachedCategories() { return getStorage(KEYS.categories, []); }

// ===== 记录缓存 =====

function sortRecords(a, b) {
  const ia = Number(a.id) || 0;
  const ib = Number(b.id) || 0;
  if ((ia < 0) !== (ib < 0)) return ia < 0 ? -1 : 1; // 本地新档置顶
  const ma = (a.modify_at && a.modify_at[a.modify_at.length - 1]) || '';
  const mb = (b.modify_at && b.modify_at[b.modify_at.length - 1]) || '';
  if (ma !== mb) return ma > mb ? -1 : 1;
  return ib - ia;
}

function getFoodsCache() { return getStorage(KEYS.foods, []); }
function saveFoodsCache(list) { setStorage(KEYS.foods, list || []); }

function mergeFoods(items) {
  if (!Array.isArray(items) || !items.length) return;
  const byId = {};
  getFoodsCache().forEach(r => { if (r && r.id != null) byId[r.id] = r; });
  items.forEach(r => { if (r && r.id != null) byId[r.id] = r; });
  saveFoodsCache(Object.keys(byId).map(k => byId[k]).sort(sortRecords));
}

function upsertFood(record) { if (record && record.id != null) mergeFoods([record]); }

function removeFood(id) {
  saveFoodsCache(getFoodsCache().filter(r => Number(r.id) !== Number(id)));
}

function getFoodById(id) {
  return getFoodsCache().find(r => Number(r.id) === Number(id)) || null;
}

function cachedFoods() { return getFoodsCache().slice().sort(sortRecords); }

// 本地搜索镜像服务端 ILIKE 字段：名称 / 品牌 / 原料名
function searchFoods(query) {
  const q = (query || '').trim().toLowerCase();
  const all = cachedFoods();
  if (!q) return all;
  return all.filter(r => {
    if ((r.name || '').toLowerCase().indexOf(q) >= 0) return true;
    if ((r.brand_name || '').toLowerCase().indexOf(q) >= 0) return true;
    const ings = r.ingredients || [];
    for (let i = 0; i < ings.length; i++) {
      const n = typeof ings[i] === 'string' ? ings[i] : (ings[i] && ings[i].name) || '';
      if ((n || '').toLowerCase().indexOf(q) >= 0) return true;
    }
    return false;
  });
}

function allocateLocalId() {
  let min = 0;
  getFoodsCache().forEach(r => { const id = Number(r.id); if (id < min) min = id; });
  return min - 1;
}

// 乐观更新：镜像服务端 PATCH 行为（追加 modify_at、复购 = 次数-1；排名不算复购）
function applyLocalPatch(id, fields, rankOnly) {
  const rec = getFoodById(id);
  if (!rec) return;
  const updated = Object.assign({}, rec, fields);
  if (!rankOnly) {
    const dates = (updated.modify_at || []).slice();
    const today = todayString();
    if (dates[dates.length - 1] !== today) dates.push(today);
    updated.modify_at = dates;
    updated.repurchase = Math.max(0, dates.length - 1);
  }
  upsertFood(updated);
}

// ===== 待同步队列 =====

function uuid() { return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
function makeClientKey() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

function getPending() { return getStorage(KEYS.pending, []); }
function savePending(list) { setStorage(KEYS.pending, list || []); }
function pendingCount() { return getPending().length; }
function enqueue(op) {
  if (!op.uuid) op.uuid = uuid();
  const list = getPending();
  list.push(op);
  savePending(list);
}
function removeOp(id) { savePending(getPending().filter(o => o.uuid !== id)); }
// create 成功后：把后续指向该本地记录的 patch 改写为服务端 id
function resolvePending(clientKey, serverId) {
  const list = getPending();
  let changed = false;
  list.forEach(o => {
    if (o.clientKey === clientKey && o.kind === 'patch') {
      o.serverId = serverId;
      delete o.clientKey;
      changed = true;
    }
  });
  if (changed) savePending(list);
}
// 本地未同步记录被离线删除：连同 create 队列项一起撤销
function cancelPendingCreate(clientKey) {
  savePending(getPending().filter(o => !(o.kind === 'create' && o.clientKey === clientKey)));
}

// ===== 图片离线缓存 =====

// 离线建档/换图：临时图持久化到用户目录（<image> 可直接显示），返回本地路径
function persistLocalImage(tempPath) {
  try {
    const fs = wx.getFileSystemManager();
    const dest = wx.env.USER_DATA_PATH + '/mf-local-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.jpg';
    fs.saveFileSync(tempPath, dest);
    return dest;
  } catch (e) { return tempPath; }
}

function removeLocalFile(path) {
  if (!path) return;
  try { wx.getFileSystemManager().unlink({ filePath: path, fail() {} }); } catch (e) {}
}

// 服务端返回的是带签名的完整 URL；缓存 key 用去掉签名参数的稳定部分
function imgKeyOf(serverPath) {
  if (!serverPath) return '';
  const i = serverPath.indexOf('?');
  const base = i >= 0 ? serverPath.slice(0, i) : serverPath;
  return base.slice(0, 300);
}

function localPathFor(serverPath) {
  const key = imgKeyOf(serverPath);
  if (!key) return '';
  return getStorage(KEYS.imgMap, {})[key] || '';
}

function downloadImage(serverPath) {
  return new Promise(resolve => {
    const key = imgKeyOf(serverPath);
    if (!key) { resolve(''); return; }
    const map = getStorage(KEYS.imgMap, {});
    if (map[key]) { resolve(map[key]); return; }
    const url = serverPath.indexOf('http') === 0 ? serverPath : api.BASE_URL + '/' + serverPath.replace(/^\//, '');
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode !== 200 || !res.tempFilePath) { resolve(''); return; }
        try {
          const fs = wx.getFileSystemManager();
          const dest = wx.env.USER_DATA_PATH + '/mf-img-' + key.replace(/[^a-zA-Z0-9]/g, '_').slice(-80) + '.jpg';
          fs.saveFileSync(res.tempFilePath, dest);
          map[key] = dest;
          setStorage(KEYS.imgMap, map);
          resolve(dest);
        } catch (e) { resolve(''); }
      },
      fail() { resolve(''); },
    });
  });
}

// 联网时后台预热一批图片（每条记录最多处理 N 张，失败静默）
function warmImages(serverPaths, limit) {
  const seen = {};
  const list = [];
  (serverPaths || []).forEach(p => {
    const key = imgKeyOf(p);
    if (!key || seen[key]) return;
    seen[key] = true;
    list.push(p);
  });
  list.slice(0, limit || 12).forEach(p => {
    const map = getStorage(KEYS.imgMap, {});
    if (map[imgKeyOf(p)]) return;
    downloadImage(p);
  });
}

// 展示前重写 image_path：有本地缓存就用本地路径，断网也能显示
function withLocalImages(record) {
  if (!record || !record.image_path) return record;
  const p = record.image_path;
  if (p.indexOf('http') === 0 || p.charAt(0) === '/') {
    const local = localPathFor(p);
    if (local) return Object.assign({}, record, { image_path: local });
  }
  return record;
}

// ===== 同步引擎：恢复联网后按序重放离线队列 =====

let syncing = false;

async function applyOp(op) {
  const cfg = getCachedConfig() || {};
  const imageCfg = cfg.image || { max_dimension: 1600, quality: 0.8, upload_timeout: 90000, client_upload_timeout: 100000 };
  if (op.kind === 'create') {
    const rec = Object.assign({}, op.record);
    delete rec.id;
    let imagePath = rec.image_path || '';
    let meta = rec.image_metadata || {};
    if (op.localImage) {
      const upload = await api.compressAndUpload(op.localImage, imageCfg, null);
      imagePath = upload.path;
      const exif = upload.metadata || {};
      Object.keys(exif).forEach(k => { if (meta[k] == null) meta[k] = exif[k]; });
    }
    rec.image_path = imagePath;
    rec.image_metadata = meta;
    const res = await api.submitFood(rec);
    const serverId = res && res.id;
    if (op.localId != null && serverId != null) {
      const local = getFoodById(op.localId);
      if (local) {
        removeFood(op.localId);
        upsertFood(Object.assign({}, local, { id: serverId, image_path: imagePath }));
      }
      resolvePending(op.clientKey, serverId);
    }
    if (op.localImage) removeLocalFile(op.localImage);
  } else if (op.kind === 'patch') {
    if (op.serverId == null) throw new Error('离线队列目标缺失');
    const fields = Object.assign({}, op.fields);
    if (op.localImage) {
      const upload = await api.compressAndUpload(op.localImage, imageCfg, null);
      fields.image_metadata = Object.assign({}, upload.metadata || {}, fields.image_metadata || {});
      fields.image_path = upload.path;
    }
    await api.updateFoodDetails(op.serverId, fields);
    applyLocalPatch(op.serverId, fields, op.rankOnly);
    if (op.localImage) removeLocalFile(op.localImage);
  } else if (op.kind === 'delete') {
    if (op.serverId == null) throw new Error('离线队列目标缺失');
    await api.deleteFood(op.serverId);
    removeFood(op.serverId);
  } else if (op.kind === 'ingredient') {
    await api.addIngredient(op.name);
  } else {
    throw new Error('未知离线操作 ' + op.kind);
  }
}

async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    for (;;) {
      const list = getPending();
      if (!list.length) return;
      const op = list[0];
      try {
        await applyOp(op);
        removeOp(op.uuid);
      } catch (e) {
        if (isNetworkError(e)) return; // 仍离线：保留队列下次再试
        removeOp(op.uuid);             // 业务错误：丢弃避免堵死队列
        if (op.localImage) removeLocalFile(op.localImage);
      }
    }
  } finally {
    syncing = false;
  }
}

module.exports = {
  isNetworkError, todayString,
  saveConfig, getCachedConfig, saveCategories, getCachedCategories,
  mergeFoods, upsertFood, removeFood, getFoodById, cachedFoods, searchFoods, allocateLocalId, applyLocalPatch,
  uuid, makeClientKey, pendingCount, enqueue, resolvePending, cancelPendingCreate,
  persistLocalImage, removeLocalFile, localPathFor, downloadImage, warmImages, withLocalImages,
  sync,
};
