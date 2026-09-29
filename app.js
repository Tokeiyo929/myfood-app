const records = [];
const ingredients = [];
const availableIngredients = [];
let ingredientSearchRequest = 0;
let ingredientPage = 0;
let ingredientTotal = 0;
let loadingIngredients = false;
const categories = [];
const availableCategories = [];
let expandedCategoryParent = null;
const categoryFoods = {};
const flavorLevels = {};
let settings;
let currentPreference;
let draggingFlavor;

const FLAVOR_WHEEL = {size: 240, center: 120, radius: 83, labelRadius: 99, handleRadius: 7};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => value.replace(/[&<>\'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "\'": '&#39;',
}[char]));
const preferences = () => Object.values(settings.preferences).sort((a, b) => a.level - b.level);
const preferenceAt = level => preferences().find(item => item.level === level);
const formatFlavorName = (name, level) => {
    const {low_threshold, mid_threshold, high_threshold} = settings.flavor_scale;
    return level < low_threshold ? `不${name}` : level < mid_threshold ? `微${name}` : level < high_threshold ? name : `太${name}`;
};

// 兼容旧字符串与新的 {name, amount} 对象两种原料元素，返回统一的 {name, amount} 对象
const normalizeIngredient = item => typeof item === 'string' ? {name: item, amount: null} : {name: item.name, amount: item.amount || null};
// amount 是数字（如50表示50%）则在显示时补%，字符串则原样
const ingredientLabel = item => {
    const {name, amount} = normalizeIngredient(item);
    if (!amount && amount !== 0) return name;
    const suffix = typeof amount === 'number' ? `${amount}%` : amount;
    return `${name}(${suffix})`;
};

function renderOptions() {
    settings.flavors.forEach(flavor => { flavorLevels[flavor] = settings.flavor_scale.default_level; });
    renderFlavorWheel();
    const preferenceLevels = preferences();
    const min = preferenceLevels[0].level;
    const max = preferenceLevels[preferenceLevels.length - 1].level;
    const step = preferenceLevels[1].level - min;
    $('#preference').innerHTML = `<span id="preferenceFace" aria-hidden="true"></span><input id="preferenceSlider" type="range" min="${min}" max="${max}" step="${step}" value="${settings.preferences.good.level}" aria-label="偏好程度" /><span id="preferenceLabel"></span>`;
    updatePreference(settings.preferences.good.value);
    updatePreferenceSlider();
}

function renderFlavorWheel() {
    const wheel = FLAVOR_WHEEL;
    const scale = settings.flavor_scale;
    const points = settings.flavors.map((value, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / settings.flavors.length;
        return {value, angle, x: wheel.center + Math.cos(angle) * wheel.radius, y: wheel.center + Math.sin(angle) * wheel.radius};
    });
    const pointString = levels => points.map(point => {
        const distance = wheel.radius * levels[point.value] / scale.max_level;
        return `${wheel.center + Math.cos(point.angle) * distance},${wheel.center + Math.sin(point.angle) * distance}`;
    }).join(' ');
    const outline = points.map(point => `${point.x},${point.y}`).join(' ');
    $('#flavors').innerHTML = `<svg class="flavor-radar" viewBox="0 0 ${wheel.size} ${wheel.size}" role="img" aria-label="五维味道转盘"><polygon class="flavor-grid" points="${outline}" />${points.map(point => `<line class="flavor-axis-line" x1="${wheel.center}" y1="${wheel.center}" x2="${point.x}" y2="${point.y}" /><text x="${wheel.center + Math.cos(point.angle) * wheel.labelRadius}" y="${wheel.center + Math.sin(point.angle) * wheel.labelRadius}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(formatFlavorName(point.value, flavorLevels[point.value]))}</text>`).join('')}<polygon class="flavor-value" points="${pointString(flavorLevels)}" />${points.map(point => { const x = wheel.center + Math.cos(point.angle) * wheel.radius * flavorLevels[point.value] / scale.max_level; const y = wheel.center + Math.sin(point.angle) * wheel.radius * flavorLevels[point.value] / scale.max_level; return `<line class="flavor-slider-hit" data-flavor="${escapeHtml(point.value)}" x1="${wheel.center}" y1="${wheel.center}" x2="${point.x}" y2="${point.y}" /><circle class="flavor-handle" cx="${x}" cy="${y}" r="${wheel.handleRadius}" />`; }).join('')}</svg><button type="button" class="flavor-reset" id="resetFlavors" aria-label="重置味道默认值" title="重置默认"><span aria-hidden="true">↻</span></button>`;
    $('#flavors').querySelectorAll('.flavor-slider-hit').forEach(handle => handle.addEventListener('pointerdown', startFlavorDrag));
    $('#resetFlavors').addEventListener('click', () => {
        settings.flavors.forEach(flavor => { flavorLevels[flavor] = settings.flavor_scale.default_level; });
        renderFlavorWheel();
    });
}

function startFlavorDrag(event) {
    event.preventDefault();
    draggingFlavor = event.currentTarget.dataset.flavor;
    event.currentTarget.setPointerCapture(event.pointerId);
}

window.addEventListener('pointermove', event => {
    if (!draggingFlavor) return;
    event.preventDefault();
    const wheel = FLAVOR_WHEEL;
    const scale = settings.flavor_scale;
    const svg = $('#flavors svg');
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) * wheel.size / rect.width - wheel.center;
    const y = (event.clientY - rect.top) * wheel.size / rect.height - wheel.center;
    const index = settings.flavors.indexOf(draggingFlavor);
    const angle = -Math.PI / 2 + index * Math.PI * 2 / settings.flavors.length;
    const level = Math.max(scale.min_level, Math.min(scale.max_level, Math.round((x * Math.cos(angle) + y * Math.sin(angle)) / wheel.radius * scale.max_level)));
    flavorLevels[draggingFlavor] = level;
    renderFlavorWheel();
});
window.addEventListener('pointerup', () => { draggingFlavor = null; });

function updatePreference(value) {
    const preference = preferences().find(item => item.value === value);
    currentPreference = preference.value;
    $('#preferenceFace').textContent = preference.face;
    $('#preferenceLabel').textContent = preference.label;
    const bad = preference.value === settings.preferences.bad.value;
    const excellent = preference.value === settings.preferences.excellent.value;
    $('#dislikeReasonField').hidden = !bad;
    $('#dislikeReason').required = bad;
    $('#goodReasonField').hidden = !excellent;
    $('#goodReason').required = excellent;
    if (!bad) $('#dislikeReason').value = '';
    if (!excellent) $('#goodReason').value = '';
}

function updatePreferenceSlider() {
    const slider = $('#preferenceSlider');
    const preferenceLevels = preferences();
    const min = preferenceLevels[0].level;
    const max = preferenceLevels[preferenceLevels.length - 1].level;
    slider.style.setProperty('--preference-progress', `${(slider.value - min) / (max - min) * 100}%`);
}

function renderIngredients() {
    $('#ingredientChips').innerHTML = ingredients.slice().reverse().map((item, index) =>
        `<span class="chip">${escapeHtml(ingredientLabel(item))}<button type="button" data-index="${ingredients.length - 1 - index}" aria-label="删除${escapeHtml(ingredientLabel(item))}">×</button></span>`
    ).join('');
}

function renderIngredientSuggestions(source = availableIngredients) {
    const query = $('#ingredientInput').value.trim().toLowerCase();
    $('#ingredientSuggestions').innerHTML = query
        ? source.filter(item => !ingredients.some(selected => normalizeIngredient(selected).name === item.name) && item.name.toLowerCase().includes(query)).map(item =>
            `<button type="button" class="quick-ingredient" data-id="${item.id}" data-name="${escapeHtml(item.name)}">${escapeHtml(ingredientLabel(item))}</button>`
        ).join('')
        : '';
}

function renderCategories() {
    $('#tagChips').innerHTML = categories.slice().reverse().map((item, index) =>
        `<span class="chip">${escapeHtml(item)}<button type="button" data-category-index="${categories.length - 1 - index}" aria-label="删除${escapeHtml(item)}">×</button></span>`
    ).join('');
}

function renderCategorySuggestions() {
    const query = $('#tagInput').value.trim().toLowerCase();
    $('#tagSuggestions').innerHTML = query
        ? availableCategories.filter(item => !categories.includes(item.name) && item.name.toLowerCase().includes(query)).map(item =>
            `<button type="button" class="quick-ingredient" data-category="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`
        ).join('')
        : '';
}

function addCategory(value) {
    value = value.trim();
    if (!value || categories.includes(value)) return;
    categories.unshift(value);
    renderCategories();
    renderCategorySuggestions();
}

function renderCatalogs() {
    const groupedCategories = availableCategories.reduce((groups, item) => {
        (groups[item.parentcategories] ||= []).push(item);
        return groups;
    }, {});
    $('#allTags').innerHTML = Object.entries(groupedCategories).map(([parent, items]) =>
        `<section class="catalog-group${expandedCategoryParent === parent ? ' expanded' : ''}">
            <h2 class="catalog-group-title" data-parent-category="${escapeHtml(parent)}" tabindex="0" role="button" aria-expanded="${expandedCategoryParent === parent}">${escapeHtml(parent)}</h2>
            <div class="catalog-group-items">${items.map(item => {
                const food = categoryFoods[parent]?.find(value => value.categories.includes(item.name));
                return `<div class="catalog-item" data-category-name="${escapeHtml(item.name)}" data-parent-category="${escapeHtml(parent)}">${escapeHtml(item.name)}${food?.image_path ? `<img src="${food.image_path}" alt="${escapeHtml(food.name)}" loading="lazy" />` : ''}</div>`;
            }).join('')}</div>
        </section>`
    ).join('');
    const query = $('#catalogIngredientInput').value.trim();
    const queryLower = query.toLowerCase();
    $('#allIngredients').innerHTML = availableIngredients
        .filter(item => !query || item.name.toLowerCase().includes(queryLower))
        .map(item => `<span class="catalog-item">${escapeHtml(ingredientLabel(item))}</span>`)
        .join('');
}

async function addCatalogIngredient() {
    const input = $('#catalogIngredientInput');
    const name = input.value.trim();
    if (!name) return;
    const result = await (await fetch('/api/ingredients', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name}),
    })).json();
    if (!availableIngredients.some(item => item.id === result.id)) availableIngredients.push(result);
    input.value = '';
    renderCatalogs();
    renderIngredientSuggestions();
    const toast = $('#toast');
    toast.textContent = '添加成功';
    toast.classList.add('show');
    clearTimeout(window.catalogIngredientToastTimer);
    window.catalogIngredientToastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
    input.focus();
}

function switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(view => { view.hidden = view.id !== viewId; });
    document.querySelectorAll('.tabs-bar button').forEach(button => button.classList.toggle('active', button.dataset.view === viewId));
    if (viewId === 'recordsView') window.scrollTo(0, 0);
}

function renderRecords() {
    const {good, bad, excellent} = settings.preferences;
    const defaultLevel = settings.flavor_scale.default_level;
    $('#emptyState').hidden = records.length > 0;
    $('#records').innerHTML = records.map(record => {
        const visibleFlavors = record.flavors.filter(flavor => flavor.level !== defaultLevel);
        const actions = record.preference === bad.value
            ? `<div class="dislike-reason-display">难吃理由：${escapeHtml(record.reason)}</div>`
            : record.preference === excellent.value
            ? `<div class="good-reason-display">推荐理由：${escapeHtml(record.reason)}</div>`
            : `<span class="repurchase-count">已复购 ${record.repurchase_count} 次</span>
                        <button class="repurchase-choice" data-value="${good.value}" type="button">${good.label}</button>
                        <button class="repurchase-choice" data-value="${bad.value}" type="button">${bad.label}</button>`;
        return `<article class="record ${record.preference === excellent.value ? 'preference-excellent-card' : record.preference === bad.value ? 'preference-bad-card' : 'preference-good-card'}" data-id="${record.id}">
        <div class="record-content">
            <div class="record-image-box">${record.image_path ? `<img class="record-image" src="${record.image_path}" alt="${escapeHtml(record.name)}" />` : ''}</div>
            <div class="record-info">
                <div class="record-top">
                    <div class="record-title"><span class="record-name">${escapeHtml(record.name)}</span></div>
                    <div class="record-side"><div class="record-summary">
                        ${record.brand_name ? `<span class="record-brand">${escapeHtml(record.brand_name)}</span>` : ''}
                        ${visibleFlavors.length ? `<div class="record-tags">${visibleFlavors.map(flavor => `<span class="record-tag">${escapeHtml(formatFlavorName(flavor.name, flavor.level))}</span>`).join('')}</div>` : ''}
                    </div></div>
                    <div class="repurchase-actions">${actions}</div>
                    <div class="record-meta">${record.ingredients.map(item => escapeHtml(ingredientLabel(item))).join('、')}</div>
                </div>
            </div>
        </div>
    </article>`;
    }).join('');
}

let page = 1;
let hasMoreRecords = true;
let loadingRecords = false;
let recordsRequest = 0;

async function loadRecords(reset = true) {
    // 搜索（reset）永远不能被丢弃，否则最新一次输入会查不到；只有翻页需要防重复。
    if (!reset && (loadingRecords || !hasMoreRecords)) return;
    const nextPage = reset ? 1 : page + 1;
    const requestId = ++recordsRequest;
    loadingRecords = true;
    try {
        const params = new URLSearchParams({page: nextPage, limit: settings.pagination.page_size, search: $('#recordSearch').value.replace(/\\s+/g, ' ').trim()});
        const result = await (await fetch(`/api/foods?${params}`)).json();
        // 期间又发起了更新的请求，本次结果已过期，丢弃以免覆盖新结果。
        if (requestId !== recordsRequest) return;
        if (reset) records.length = 0;
        records.push(...result.items);
        page = nextPage;
        hasMoreRecords = records.length < result.total;
        renderRecords();
    } catch (error) {
        // 失败时保留上一次的结果即可，关键是 finally 复位 loadingRecords，
        // 否则一次请求失败会让之后的搜索和翻页永久失效。
    } finally {
        if (requestId === recordsRequest) loadingRecords = false;
    }
}

$('#ingredientInput').addEventListener('input', async event => {
    const query = event.target.value.trim();
    const requestId = ++ingredientSearchRequest;
    if (!query) {
        renderIngredientSuggestions();
        return;
    }
    const result = await (await fetch(`/api/ingredients?search=${encodeURIComponent(query)}&limit=${settings.pagination.ingredient_page_size}`)).json();
    if (requestId !== ingredientSearchRequest) return;
    renderIngredientSuggestions(result.items);
});
$('#ingredientSuggestions').addEventListener('click', event => {
    const button = event.target.closest('[data-id]');
    if (!button) return;
    const name = button.dataset.name || availableIngredients.find(item => String(item.id) === String(button.dataset.id))?.name;
    if (!name || ingredients.some(item => normalizeIngredient(item).name === name)) return;
    const amountInput = $('#ingredientAmountInput');
    const amountText = amountInput ? amountInput.value.trim() : '';
    // 含量可选：填了数字则存数字，空则不存
    const amountNum = amountText === '' ? null : (Number(amountText) || null);
    ingredients.unshift({name, amount: amountNum});
    $('#ingredientInput').value = '';
    if (amountInput) amountInput.value = '';
    $('#formError').textContent = '';
    renderIngredients();
    renderIngredientSuggestions();
    $('#ingredientInput').focus();
});
$('#ingredientAmountInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('#ingredientInput').focus(); }
});
$('#ingredientChips').addEventListener('click', event => {
    const index = event.target.dataset.index;
    if (index === undefined) return;
    ingredients.splice(Number(index), 1);
    renderIngredients();
    renderIngredientSuggestions();
});
$('#tagInput').addEventListener('input', renderCategorySuggestions);
$('#tagChips').addEventListener('click', event => {
    const index = event.target.dataset.categoryIndex;
    if (index === undefined) return;
    categories.splice(Number(index), 1);
    renderCategories();
    renderCategorySuggestions();
});
$('#tagSuggestions').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    addCategory(button.dataset.category);
    $('#tagInput').value = '';
    renderCategorySuggestions();
    $('#tagInput').focus();
});
document.querySelector('.tabs-bar').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) switchView(button.dataset.view);
});
$('#addCatalogIngredient').addEventListener('click', addCatalogIngredient);
$('#catalogIngredientInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); addCatalogIngredient(); }
});

let catalogIngredientSearchRequest = 0;
$('#catalogIngredientInput').addEventListener('input', async event => {
    const search = event.target.value.trim();
    const requestId = ++catalogIngredientSearchRequest;
    if (!search) {
        renderCatalogs();
        return;
    }
    const result = await (await fetch(`/api/ingredients?search=${encodeURIComponent(search)}&limit=${settings.pagination.ingredient_page_size}`)).json();
    if (requestId !== catalogIngredientSearchRequest) return;
    $('#allIngredients').innerHTML = result.items.map(item => `<span class="catalog-item">${escapeHtml(ingredientLabel(item))}</span>`).join('');
});
$('#allTags').addEventListener('click', event => {
    const item = event.target.closest('[data-category-name]');
    if (item) {
        const foods = (categoryFoods[item.dataset.parentCategory] || []).filter(food => food.categories.includes(item.dataset.categoryName));
        $('#categoryModalTitle').textContent = item.dataset.categoryName;
        $('#categoryModalFoods').innerHTML = foods.length ? foods.map(food => `<article class="category-modal-food">${food.image_path ? `<img src="${food.image_path}" alt="${escapeHtml(food.name)}" loading="lazy" />` : '<span class="category-modal-food-placeholder" aria-hidden="true"></span>'}<strong>${escapeHtml(food.name)}</strong></article>`).join('') : '<p>暂无对应食品</p>';
        $('#categoryModal').hidden = false;
        return;
    }
    const header = event.target.closest('[data-parent-category]');
    if (!header) return;
    const parent = header.dataset.parentCategory;
    expandedCategoryParent = expandedCategoryParent === parent ? null : parent;
    renderCatalogs();
    if (expandedCategoryParent === parent && !categoryFoods[parent]) {
        fetch(`/api/foods?category=${encodeURIComponent(parent)}&limit=${settings.pagination.max_page_size}`).then(response => response.json()).then(result => {
            categoryFoods[parent] = result.items;
            renderCatalogs();
        });
    }
    if (expandedCategoryParent === parent) {
        document.querySelector('.catalog-group.expanded .catalog-group-title').scrollIntoView({behavior: 'smooth', block: 'start'});
    }
});
document.querySelectorAll('[data-close-category-modal]').forEach(element => element.addEventListener('click', () => { $('#categoryModal').hidden = true; }));
$('#preference').addEventListener('input', event => {
    updatePreference(preferenceAt(Number(event.target.value)).value);
    updatePreferenceSlider();
});

document.addEventListener('click', async event => {
    if (event.target.closest('.reason-form')) return;
    const repurchase = event.target.closest('.repurchase-choice');
    if (repurchase) {
        const card = repurchase.closest('.record');
        await fetch(`/api/foods/${card.dataset.id}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({preference: repurchase.dataset.value, reason: ''})});
        await loadRecords();
        return;
    }
    const expanded = document.querySelector('.record.expanded');
    if (expanded) expanded.classList.remove('expanded');
    const card = event.target.closest('.record');
    if (card && card !== expanded) card.classList.add('expanded');
});

document.addEventListener('click', event => {
    const button = event.target.closest(`.repurchase-choice[data-value="${settings.preferences.bad.value}"]`);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const actions = button.closest('.repurchase-actions');
    actions.innerHTML = '<form class="reason-form"><input required placeholder="请输入难吃理由" /><button type="submit">确认</button></form>';
    actions.querySelector('input').focus();
}, true);

document.addEventListener('submit', async event => {
    const form = event.target.closest('.reason-form');
    if (!form) return;
    event.preventDefault();
    const card = form.closest('.record');
    const reason = form.querySelector('input').value.trim();
    if (!reason) return;
    await fetch(`/api/foods/${card.dataset.id}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({preference: settings.preferences.bad.value, reason})});
    await loadRecords();
}, true);

$('#imageInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    $('#imagePreview').src = URL.createObjectURL(file);
    $('#imagePreview').hidden = false;
});

async function compressImage(file) {
    const image = await new Promise((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = reject;
        value.src = URL.createObjectURL(file);
    });
    const imageSettings = settings.image;
    const scale = Math.min(1, imageSettings.max_dimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', imageSettings.quality));
}

let foodSubmitLock = false;
$('#foodForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (foodSubmitLock) return;  // 防止重复提交
    if (!ingredients.length) {
        $('#formError').textContent = '没有添加原料';
        $('#ingredientInput').scrollIntoView({behavior: 'smooth', block: 'center'});
        return;
    }
    foodSubmitLock = true;
    const clientKey = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const saveButton = $('.save-fixed');
    saveButton.disabled = true;
    saveButton.textContent = '保存中';
    try {
        const file = $('#imageInput').files[0];
        let imagePath = '';
        let imageMetadata = {};
        if (file) {
            const form = new FormData();
            form.append('image', await compressImage(file), 'food.jpg');
            form.append('metadata_image', file, file.name);
            const uploadResponse = await fetch('/api/upload', {method: 'POST', body: form});
            if (!uploadResponse.ok) throw new Error('图片上传失败');
            const uploadResult = await uploadResponse.json();
            imagePath = uploadResult.path;
            imageMetadata = uploadResult.metadata;
        }
        const record = {
            name: $('#dishName').value.trim(),
            brand_name: $('#brandName').value.trim(),
            price: $('#price').value === '' ? null : Number($('#price').value),
            categories: [...categories],
            ingredients: [...ingredients],
            flavors: Object.entries(flavorLevels).filter(([, level]) => level > settings.flavor_scale.min_level).map(([name, level]) => ({name, level})),
            preference: currentPreference,
            reason: currentPreference === settings.preferences.bad.value ? $('#dislikeReason').value.trim() : $('#goodReason').value.trim(),
            image_path: imagePath,
            image_metadata: imageMetadata,
            client_key: clientKey,
        };
        const response = await fetch('/api/foods', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(record)});
        if (!response.ok) throw new Error('保存请求失败');
        await loadRecords();
        event.target.reset();
        $('#imagePreview').hidden = true;
        ingredients.length = 0;
        categories.length = 0;
        settings.flavors.forEach(flavor => { flavorLevels[flavor] = settings.flavor_scale.default_level; });
        $('#preferenceSlider').value = settings.preferences.good.level;
        updatePreference(settings.preferences.good.value);
        updatePreferenceSlider();
        renderFlavorWheel();
        renderIngredients();
        renderCategories();
        renderCategorySuggestions();
        $('#formError').textContent = '';
    } catch (error) {
        $('#formError').textContent = `保存失败：${error.message}`;
    } finally {
        foodSubmitLock = false;
        saveButton.disabled = false;
        saveButton.textContent = '保存记录';
    }
});

$('#recordSearch').addEventListener('input', event => {
    // 中文输入法组字期间不搜，否则会把 zhen / zhenxi 这类拼音碎片当关键词发出去。
    if (event.isComposing) return;
    loadRecords(true);
});
$('#recordSearch').addEventListener('compositionend', () => loadRecords(true));
$('#clearSearch').addEventListener('click', () => {
    $('#recordSearch').value = '';
    loadRecords(true);
    $('#recordSearch').focus();
});
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - settings.pagination.scroll_threshold) return;
    if (!$('#recordsView').hidden) loadRecords(false);
    if (!$('#ingredientsView').hidden) loadIngredients(false);
});

async function loadCategories() {
    const result = await (await fetch('/api/categories')).json();
    availableCategories.push(...result.items);
    renderCategorySuggestions();
    renderCatalogs();
}

async function loadIngredients(reset = true) {
    if (loadingIngredients || (!reset && availableIngredients.length >= ingredientTotal)) return;
    loadingIngredients = true;
    if (reset) { availableIngredients.length = 0; ingredientPage = 0; }
    const result = await (await fetch(`/api/ingredients?page=${ingredientPage + 1}&limit=${settings.pagination.ingredient_page_size}`)).json();
    availableIngredients.push(...result.items);
    ingredientPage = result.page;
    ingredientTotal = result.total;
    loadingIngredients = false;
    renderIngredientSuggestions();
    renderCatalogs();
}

async function init() {
    settings = await (await fetch('/api/config')).json();
    renderOptions();
    renderIngredients();
    renderIngredientSuggestions();
    renderCategories();
    await loadRecords();
    await Promise.all([loadCategories(), loadIngredients()]);
}

init();
