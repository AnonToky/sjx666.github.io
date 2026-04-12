/**
 * 费城餐饮美食分布交互地图逻辑
 * 核心库：Leaflet.js, D3.js
 */

// --- 1. 全局变量声明 ---
let map;
let markerLayer; // 用于存放地图上的圆点，方便清除和重绘
let allData = []; // 存储从 CSV 加载的所有原始数据

// --- 新增：类别与图标的映射字典 ---
function getCategoryIcon(categories) {
    if (!categories) return 'fa-utensils'; // 默认刀叉图标
    
    const cat = categories.toLowerCase();
    if (cat.includes('coffee') || cat.includes('tea')) return 'fa-mug-hot';
    if (cat.includes('pizza')) return 'fa-pizza-slice';
    if (cat.includes('burger') || cat.includes('fast food')) return 'fa-burger';
    if (cat.includes('chinese') || cat.includes('asian') || cat.includes('sushi')) return 'fa-utensils';
    if (cat.includes('bar') || cat.includes('nightlife') || cat.includes('wine')) return 'fa-wine-glass';
    if (cat.includes('dessert') || cat.includes('ice cream') || cat.includes('bakery')) return 'fa-ice-cream';
    if (cat.includes('mexican') || cat.includes('tacos')) return 'fa-pepper-hot';
    if (cat.includes('breakfast') || cat.includes('brunch')) return 'fa-egg';
    if (cat.includes('seafood')) return 'fa-fish';
    
    return 'fa-utensils'; // 其他所有餐饮默认用刀叉
}

// 价格区间映射表：将数字转为友好的描述
const priceMap = {
    "1": "人均 $10 以下 (平价)",
    "2": "人均 $11-30 (中端)",
    "3": "人均 $31-60 (高端)",
    "4": "人均 $61 以上 (奢华)"
};

// --- 2. 初始化地图 ---
function initMap() {
    // 设置中心点为费城市中心 [纬度, 经度]
    map = L.map('map', {
        zoomControl: false // 关闭默认缩放按钮，稍后手动添加或根据需要调整
    }).setView([39.9526, -75.1652], 13);

    // 柔和彩色底图
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors | © CARTO'
    }).addTo(map);

    // 手动添加缩放控制到右下角，避免遮挡筛选器
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 初始化图层组
    markerLayer = L.markerClusterGroup({
        maxClusterRadius: 40, // 聚合半径（像素），数值越小聚合越不容易发生
        disableClusteringAtZoom: 16 // 放大到16级时完全散开
    });
    
    // 必须把聚合组加到地图上！
    map.addLayer(markerLayer);
}

// --- 3. 加载数据 ---
function loadData() {
    d3.csv("data/philadelphia_restaurants.csv").then(data => {
        // 数据类型转换
        data.forEach(d => {
            d.latitude = +d.latitude;
            d.longitude = +d.longitude;
            d.stars = +d.stars;
            d.review_count = +d.review_count;
            d.checkin_count = +d.checkin_count;
            // price_range 保持字符串形式以便匹配筛选器
        });

        allData = data;
        renderMarkers(allData); // 首次进入渲染全部数据
    }).catch(error => {
        console.error("加载数据出错:", error);
        document.getElementById('info-content').innerHTML = "数据加载失败，请检查路径。";
    });
}

// --- 4. 渲染地图打点 ---
// --- 修改：渲染地图打点 (支持自定义图标) ---
function renderMarkers(data) {
    // 清除当前图层中的所有点
    markerLayer.clearLayers();

    data.forEach(d => {
        // 1. 根据星级计算连续色：1星=红色，5星=绿色
        const ratingScale = Math.max(0, Math.min((d.stars - 1) / 4, 1));
        const iconBgColor = d3.interpolateRdYlGn(ratingScale);
        const iconTextColor = ratingScale > 0.35 && ratingScale < 0.75 ? '#2f2f2f' : '#ffffff';

        // 2. 决定图标形状 (根据类别)
        const iconClass = getCategoryIcon(d.categories);

        // 3. 决定图标大小 (根据评论数热度)
        // 使用一个更温和的缩放比例，限制图标的最小和最大像素
        const baseSize = 20; 
        const extraSize = Math.min(Math.sqrt(d.review_count) * 0.4+2, 25); 
        const totalSize = baseSize + extraSize;

        // 4. 创建自定义 HTML 图标
        const customIcon = L.divIcon({
            className: 'custom-div-icon', // 基础样式类
            html: `<div class="icon-wrapper" style="width: ${totalSize}px; height: ${totalSize}px; font-size: ${totalSize * 0.5}px; background-color: ${iconBgColor}; color: ${iconTextColor};">
                       <i class="fa-solid ${iconClass}"></i>
                   </div>`,
            iconSize: [totalSize, totalSize],
            iconAnchor: [totalSize / 2, totalSize / 2] // 确保图标中心对准坐标点
        });

        // 5. 将点加到地图上
        const marker = L.marker([d.latitude, d.longitude], { icon: customIcon });

        // 交互：点击显示详情
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            showDetails(d);
        });

        // 交互：悬浮提示
        marker.bindTooltip(d.name);

        markerLayer.addLayer(marker);
    });
}

// --- 5. 更新详情面板 ---
function showDetails(d) {
    const detailsDiv = document.getElementById('info-content');
    const priceText = priceMap[d.price_range] || "暂无价格信息";

    // 将 categories 字符串转为可点击的标签块
    const tagsHtml = d.categories.split(',').map(tag => 
        `<span class="tag-block" onclick="searchByTag('${tag.trim()}')">${tag.trim()}</span>`
    ).join('');

    detailsDiv.innerHTML = `
        <div class="biz-card">
            <h2>${d.name}</h2>
            <p><strong>📍 地址:</strong> ${d.address}</p>
            <p><strong>⭐ 评分:</strong> ${d.stars} / 5.0</p>
            <p><strong>💰 消费:</strong> ${priceText}</p>
            <div class="tag-container">${tagsHtml}</div>
        </div>
    `;
    
    // 如果侧边栏关着，就打开它
    toggleSidebar(true);
}

// --- 6. 交互组件控制 ---

// 侧边栏开关切换
function toggleSidebar(shouldOpen) {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    
    if (shouldOpen) {
        sidebar.classList.remove('collapsed');
        openBtn.classList.add('hidden');
    } else {
        sidebar.classList.add('collapsed');
        openBtn.classList.remove('hidden');
    }
}

// 初始化所有 UI 事件
function initUIEvents() {
    // 监听搜索框输入
    document.getElementById('search-input').oninput = updateFilters;
    
    // 修改原有的价格筛选监听
    document.getElementById('price-filter').onchange = updateFilters;

    // 侧边栏关闭按钮
    document.getElementById('close-sidebar').onclick = () => toggleSidebar(false);
    
    // 侧边栏打开按钮 (菜单图标)
    document.getElementById('open-sidebar').onclick = () => toggleSidebar(true);

    // 图例弹窗控制
    const legendModal = document.getElementById('map-legend');
    document.getElementById('legend-toggle').onclick = () => legendModal.classList.remove('hidden');
    document.getElementById('close-legend').onclick = () => legendModal.classList.add('hidden');

    // 价格筛选器逻辑
    document.getElementById('price-filter').onchange = function(e) {
        const val = e.target.value;
        const filtered = val === 'all' ? 
            allData : 
            allData.filter(d => d.price_range === val);
        
        renderMarkers(filtered);
    };

    // 点击地图空白处关闭说明弹窗 (可选增强体验)
    map.on('click', () => {
        legendModal.classList.add('hidden');
    });

    initTagCloud(); // 初始化侧边栏标签云
}

// --- 7. 启动程序 ---
window.onload = () => {
    initMap();
    initUIEvents();
    loadData();
};

// --- 1. 新增：组合过滤逻辑 ---
function updateFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const priceVal = document.getElementById('price-filter').value;

    const filtered = allData.filter(d => {
        // 条件A：价格匹配
        const matchesPrice = (priceVal === 'all' || d.price_range === priceVal);
        
        // 条件B：名字或标签匹配
        const matchesSearch = (
            d.name.toLowerCase().includes(searchTerm) || 
            d.categories.toLowerCase().includes(searchTerm)
        );

        return matchesPrice && matchesSearch;
    });

    renderMarkers(filtered);
}

// --- 2. 新增：标签云初始化逻辑 ---
function initTagCloud() {
    // 定义一些想要展示的热门分类（你可以根据 CSV 里的实际情况调整）
    const hotTags = ['Pizza', 'Chinese', 'Bars', 'Coffee', 'Mexican', 'Sandwiches', 'Seafood', 'Italian'];
    const cloudContainer = document.getElementById('tag-cloud');
    
    hotTags.forEach(tag => {
        const btn = document.createElement('div');
        btn.className = 'tag-block';
        btn.innerText = tag;
        
        // 点击标签逻辑：填入搜索框并触发过滤
        btn.onclick = () => {
            const input = document.getElementById('search-input');
            input.value = tag;
            updateFilters(); // 立即执行过滤
        };
        
        cloudContainer.appendChild(btn);
    });
}

// 提供给详情页标签使用的全局函数
window.searchByTag = function(tag) {
    const input = document.getElementById('search-input');
    input.value = tag;
    updateFilters();
};

