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

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + "/api/upload",
      filePath,
      name: "image",
      timeout: 60000,
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

function compressAndUpload(filePath, imageConfig, takenAt) {
  return new Promise((resolve, reject) => {
    var quality = imageConfig.quality <= 1 ? imageConfig.quality * 100 : imageConfig.quality;
    // 质量压缩(不指定宽高,尽量保留EXIF), 节省COS流量
    wx.compressImage({
      src: filePath,
      quality: quality,
      success: function (res) {
        uploadImage(res.tempFilePath).then(resolve).catch(reject);
      },
      fail: reject
    });
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
  searchIngredients, addIngredient, getCategories, uploadImage, compressAndUpload,
};
