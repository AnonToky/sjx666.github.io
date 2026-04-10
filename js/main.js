/**
 * 费城餐饮美食分布交互地图逻辑
 * 核心库：Leaflet.js, D3.js
 */

// --- 1. 全局变量声明 ---
let map;
let markerLayer; // 用于存放地图上的圆点，方便清除和重绘
let allData = []; // 存储从 CSV 加载的所有原始数据

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

    // 添加暗色系底图 (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors | © CARTO'
    }).addTo(map);

    // 手动添加缩放控制到右下角，避免遮挡筛选器
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 初始化图层组
    markerLayer = L.layerGroup().addTo(map);
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
function renderMarkers(data) {
    // 清除当前图层中的所有点
    markerLayer.clearLayers();

    data.forEach(d => {
        // 计算半径：以评论数的平方根为基准，防止点太大
        const radius = Math.sqrt(d.review_count) * 0.3 + 2;
        
        // 颜色映射：根据星级
        let color = '#e74c3c'; // 默认红色 (<3星)
        if (d.stars >= 4) color = '#2ecc71';      // 绿色 (>=4星)
        else if (d.stars >= 3) color = '#f1c40f'; // 黄色 (3-3.5星)

        // 创建圆点标注
        const marker = L.circleMarker([d.latitude, d.longitude], {
            radius: radius,
            fillColor: color,
            color: "#fff",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0.7
        });

        // 交互：点击显示详情
        marker.on('click', (e) => {
            // 停止冒泡，防止触发地图点击事件
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
    
    // 处理价格描述
    const priceText = priceMap[d.price_range] || "暂无价格信息";

    detailsDiv.innerHTML = `
        <div class="biz-card">
            <h2>${d.name}</h2>
            <p><strong>📍 地址:</strong> ${d.address}</p>
            <p><strong>⭐ 评分:</strong> ${d.stars} / 5.0</p>
            <p><strong>💬 评论数:</strong> ${d.review_count} 条</p>
            <p><strong>🔥 累计签到:</strong> ${d.checkin_count}</p>
            <p><strong>💰 消费水平:</strong> ${priceText}</p>
            <div class="tag">标签: ${d.categories}</div>
        </div>
    `;

    // 如果侧边栏是关闭状态，点击点时自动打开（可选）
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) {
        toggleSidebar(true);
    }
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
}

// --- 7. 启动程序 ---
window.onload = () => {
    initMap();
    initUIEvents();
    loadData();
};