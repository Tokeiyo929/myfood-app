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

// 按服务端配置压缩后上传，避免大图超时
function compressAndUpload(filePath, imageConfig) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        const maxDimension = Number(imageConfig.max_dimension);
        const quality = imageConfig.quality <= 1 ? imageConfig.quality * 100 : imageConfig.quality;
        let w = info.width;
        let h = info.height;
        if (w > maxDimension || h > maxDimension) {
          const ratio = maxDimension / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        wx.compressImage({
          src: filePath,
          quality,
          compressedWidth: w,
          compressedHeight: h,
          success: (res) => {
            uploadImage(res.tempFilePath).then(resolve).catch(reject);
          },
          fail: reject,
        });
      },
      fail: reject,
    });
  });
}

function getConfig() { return request("/api/config"); }
function getFoods(page, limit, search) {
  let qs = `page=${page}&limit=${limit}`;
  if (search) qs += `&search=${encodeURIComponent(search)}`;
  return request(`/api/foods?${qs}`);
}
function getFoodsByCategory(parentName, limit) { return request(`/api/foods?category=${encodeURIComponent(parentName)}&limit=${limit}`); }
function submitFood(record) { return request("/api/foods", "POST", record); }
function updateFoodDetails(id, fields) { return request(`/api/foods/${id}`, "PATCH", { fields }); }
function searchIngredients(search, limit) {
  let qs = search ? `?search=${encodeURIComponent(search)}&limit=${limit}` : ``;
  return request(`/api/ingredients${qs}`);
}
function addIngredient(name) { return request("/api/ingredients", "POST", { name }); }
function getCategories() { return request("/api/categories"); }

module.exports = { BASE_URL, getConfig, getFoods, getFoodsByCategory, submitFood, updateFoodDetails, searchIngredients, addIngredient, getCategories, uploadImage, compressAndUpload };
