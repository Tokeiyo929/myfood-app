const BASE_URL = "https://myfood-worker.keiyokaze.workers.dev";
function request(path, method = "GET", data = null) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: { "Content-Type": "application/json" },
      timeout: 20000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error((res.data && res.data.error) || "请求失败 HTTP " + res.statusCode));
      },
      fail: (err) => reject(new Error(err.errMsg || "网络错误")),
    });
  });
}

function uploadImage(filePath, timeout) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + "/api/upload",
      filePath,
      name: "image",
      timeout,
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(data.error || "上传失败"));
            return;
          }
          if (!data.path) reject(new Error("上传失败：服务器未返回图片路径"));
          else resolve(data);
        } catch (e) { reject(new Error("上传失败：无法解析响应")); }
      },
      fail: (err) => reject(new Error(err.errMsg || "上传失败")),
    });
  });
}

function removeTempFile(filePath) {
  if (!filePath) return;
  try { wx.getFileSystemManager().unlink({ filePath, fail() {} }); } catch (e) {}
}

function formatTakenAt(value) {
  var date = new Date(value);
  var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  return date.getFullYear() + ":" + pad(date.getMonth() + 1) + ":" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

function compressAndUpload(filePath, imageConfig, takenAt) {
  return new Promise(function (resolve, reject) {
    function finishUpload(resPath) {
      uploadImage(resPath, Number(imageConfig.client_upload_timeout || imageConfig.upload_timeout)).then(function (r) {
        removeTempFile(resPath === filePath ? null : resPath);
        var meta = r.metadata || {};
        if (takenAt && !meta.taken_at) meta.taken_at = formatTakenAt(takenAt);
        wx.getLocation({
          type: "gcj02",
          success: function (loc) {
            if (loc && loc.latitude) meta.latitude = loc.latitude;
            if (loc && loc.longitude) meta.longitude = loc.longitude;
            r.metadata = meta;
            resolve(r);
          },
          fail: function () {
            r.metadata = meta;
            resolve(r);
          }
        });
      }).catch(function (err) { removeTempFile(resPath === filePath ? null : resPath); reject(err); });
    }
    wx.getImageInfo({ src: filePath, success: function (info) {
      var maxDimension = Number(imageConfig.max_dimension);
      var quality = imageConfig.quality <= 1 ? imageConfig.quality * 100 : imageConfig.quality;
      var w = info.width, h = info.height;
      if (w > maxDimension || h > maxDimension) {
        var ratio = maxDimension / Math.max(w, h);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
      }
      wx.compressImage({ src: filePath, quality: quality, compressedWidth: w, compressedHeight: h, success: function (res) { finishUpload(res.tempFilePath || filePath); }, fail: function () { finishUpload(filePath); } });
    }, fail: function () { finishUpload(filePath); } });
  });
}

function getConfig() { return request("/api/config"); }
function getStats() { return request("/api/stats"); }
function deleteFood(id) { return request("/api/foods/" + id, "DELETE"); }
function getFoods(page, limit, search, today) {
  let qs = `page=${page}&limit=${limit}`;
  if (search) qs += `&search=${encodeURIComponent(search)}`;
  if (today) qs += `&today=1`;
  return request(`/api/foods?${qs}`);
}
function getFoodsByCategory(parentName, limit) { return request(`/api/foods?category=${encodeURIComponent(parentName)}&limit=${limit}`); }
function submitFood(record) { return request("/api/foods", "POST", record); }
function updateFoodDetails(id, fields) { return request(`/api/foods/${id}`, "PATCH", { fields }); }
function addComment(id, comment) { return request(`/api/foods/${id}`, "PATCH", { comment }); }
function getFoodById(id) { return request(`/api/foods/${id}`); }
function searchIngredients(q, limit) { return request(`/api/ingredients?search=${encodeURIComponent(q)}&limit=${limit}`); }
function addIngredient(name) { return request("/api/ingredients", "POST", { name }); }
function getCategories() { return request("/api/categories"); }

module.exports = {
  BASE_URL, getConfig, getStats, getFoods, getFoodById, deleteFood, getFoodsByCategory, submitFood, updateFoodDetails, addComment,
  removeTempFile,
  searchIngredients, addIngredient, getCategories, compressAndUpload,
};
