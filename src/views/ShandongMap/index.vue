<template>
  <div class="shandong-map-container">
    <div class="map-header">
      <h2>山东省地图</h2>
      <span class="map-subtitle">点击市区查看详情</span>
    </div>

    <div class="map-content">
      <div ref="chartRef" class="chart-container"></div>

      <!-- 详情面板 -->
      <transition name="slide">
        <div v-if="selectedCity" class="detail-panel">
          <div class="panel-header">
            <h3>{{ selectedCity.name }}</h3>
            <el-icon class="close-btn" @click="selectedCity = null">
              <Close />
            </el-icon>
          </div>

          <div class="panel-body">
            <div class="data-item">
              <span class="label">GDP</span>
              <span class="value">{{ selectedCity.data.gdp }} 亿元</span>
            </div>
            <div class="data-item">
              <span class="label">常住人口</span>
              <span class="value">{{ selectedCity.data.population }} 万人</span>
            </div>
            <div class="data-item">
              <span class="label">面积</span>
              <span class="value">{{ selectedCity.data.area }} 平方公里</span>
            </div>
            <div class="data-item">
              <span class="label">行政区划</span>
              <span class="value">{{ selectedCity.data.districts }} 个</span>
            </div>
            <div class="data-item">
              <span class="label">人均GDP</span>
              <span class="value">{{ selectedCity.data.perGdp }} 万元</span>
            </div>
            <div class="data-item">
              <span class="label">GDP增速</span>
              <span class="value growth">{{ selectedCity.data.growth }}%</span>
            </div>
          </div>

          <div class="panel-footer">
            <el-button type="primary" size="small" @click="handleMore">
              查看更多
            </el-button>
          </div>
        </div>
      </transition>
    </div>

    <!-- 加载提示 -->
    <div v-if="loading" class="loading-overlay">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <span>地图加载中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Close, Loading } from "@element-plus/icons-vue";
import axios from "axios";
import * as echarts from "echarts";
import { ElMessage } from "element-plus";
import { nextTick, onMounted, onUnmounted, ref } from "vue";

const chartRef = ref<HTMLElement | null>(null);
const selectedCity = ref<{ name: string; data: CityData } | null>(null);
const loading = ref(true);

let chartInstance: echarts.ECharts | null = null;

// 城市数据接口
interface CityData {
  gdp: number;
  population: number;
  area: number;
  districts: number;
  perGdp: number;
  growth: number;
}

// 山东省各市模拟数据
const cityDataMap: Record<string, CityData> = {
  济南市: {
    gdp: 12027,
    population: 941,
    area: 10244,
    districts: 10,
    perGdp: 12.78,
    growth: 5.2,
  },
  青岛市: {
    gdp: 14920,
    population: 1034,
    area: 11293,
    districts: 7,
    perGdp: 14.43,
    growth: 4.8,
  },
  淄博市: {
    gdp: 4561,
    population: 470,
    area: 5965,
    districts: 5,
    perGdp: 9.7,
    growth: 5.5,
  },
  枣庄市: {
    gdp: 2039,
    population: 385,
    area: 4564,
    districts: 6,
    perGdp: 5.3,
    growth: 4.9,
  },
  东营市: {
    gdp: 3620,
    population: 219,
    area: 8243,
    districts: 5,
    perGdp: 16.53,
    growth: 5.8,
  },
  烟台市: {
    gdp: 9515,
    population: 710,
    area: 13864,
    districts: 5,
    perGdp: 13.4,
    growth: 5.0,
  },
  潍坊市: {
    gdp: 7010,
    population: 938,
    area: 16143,
    districts: 4,
    perGdp: 7.47,
    growth: 5.1,
  },
  济宁市: {
    gdp: 5069,
    population: 836,
    area: 11187,
    districts: 2,
    perGdp: 6.06,
    growth: 5.3,
  },
  泰安市: {
    gdp: 2996,
    population: 547,
    area: 7762,
    districts: 2,
    perGdp: 5.48,
    growth: 4.7,
  },
  威海市: {
    gdp: 3463,
    population: 290,
    area: 5797,
    districts: 4,
    perGdp: 11.94,
    growth: 5.4,
  },
  日照市: {
    gdp: 2214,
    population: 296,
    area: 5359,
    districts: 2,
    perGdp: 7.48,
    growth: 5.6,
  },
  临沂市: {
    gdp: 5883,
    population: 1101,
    area: 17192,
    districts: 3,
    perGdp: 5.34,
    growth: 5.2,
  },
  德州市: {
    gdp: 3599,
    population: 561,
    area: 10356,
    districts: 2,
    perGdp: 6.42,
    growth: 5.0,
  },
  聊城市: {
    gdp: 2859,
    population: 595,
    area: 8715,
    districts: 8,
    perGdp: 4.81,
    growth: 4.8,
  },
  滨州市: {
    gdp: 2872,
    population: 392,
    area: 9453,
    districts: 6,
    perGdp: 7.33,
    growth: 5.1,
  },
  菏泽市: {
    gdp: 4210,
    population: 879,
    area: 12239,
    districts: 2,
    perGdp: 4.79,
    growth: 5.5,
  },
};

// 初始化地图
const initMap = async () => {
  try {
    loading.value = true;

    // 获取 GeoJSON 数据
    const response = await axios.get(
      "https://geo.datav.aliyun.com/areas_v3/bound/370000_full.json",
    );
    const geoJson = response.data;

    // 注册地图
    echarts.registerMap("shandong", geoJson);

    await nextTick();

    // 初始化图表
    chartInstance = echarts.init(chartRef.value);

    // 准备地图数据
    const mapData = geoJson.features.map((feature: any) => {
      const name = feature.properties.name;
      return {
        name,
        value: cityDataMap[name]?.gdp || 0,
      };
    });

    // 配置项
    const option: echarts.EChartsOption = {
      title: {
        text: "山东省各市GDP分布",
        left: "center",
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: "normal",
        },
      },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const data = cityDataMap[params.name];
          if (!data) return params.name;
          return `
            <div style="padding: 8px;">
              <strong>${params.name}</strong><br/>
              GDP: ${data.gdp} 亿元<br/>
              人口: ${data.population} 万人<br/>
              人均GDP: ${data.perGdp} 万元
            </div>
          `;
        },
      },
      visualMap: {
        min: 2000,
        max: 15000,
        left: "left",
        top: "bottom",
        text: ["高", "低"],
        calculable: true,
        inRange: {
          color: ["#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"],
        },
      },
      series: [
        {
          name: "山东省",
          type: "map",
          map: "shandong",
          roam: true,
          label: {
            show: true,
            fontSize: 11,
          },
          emphasis: {
            label: {
              show: true,
              color: "#fff",
              fontSize: 14,
              fontWeight: "bold",
            },
            itemStyle: {
              areaColor: "#2a9d8f",
              shadowColor: "rgba(0, 0, 0, 0.5)",
              shadowBlur: 10,
            },
          },
          data: mapData,
          nameProperty: "name",
        },
      ],
    };

    chartInstance.setOption(option);

    // 点击事件
    chartInstance.on("click", (params: any) => {
      const cityData = cityDataMap[params.name];
      if (cityData) {
        selectedCity.value = {
          name: params.name,
          data: cityData,
        };
      }
    });

    // 窗口大小变化时重绘
    window.addEventListener("resize", handleResize);

    loading.value = false;
  } catch (error) {
    ElMessage.error("地图加载失败");
    loading.value = false;
    console.error("地图加载错误:", error);
  }
};

const handleResize = () => {
  chartInstance?.resize();
};

const handleMore = () => {
  ElMessage.info("查看更多功能开发中...");
};

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  chartInstance?.dispose();
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.shandong-map-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 4px;
}

.map-header {
  padding: 20px 24px;
  border-bottom: 1px solid #ebeef5;
}

.map-header h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #303133;
}

.map-subtitle {
  color: #909399;
  font-size: 14px;
}

.map-content {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.chart-container {
  flex: 1;
  min-height: 600px;
}

/* 详情面板 */
.detail-panel {
  width: 280px;
  background: #fff;
  border-left: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.close-btn {
  cursor: pointer;
  color: #909399;
  font-size: 16px;
}

.close-btn:hover {
  color: #409eff;
}

.panel-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dashed #ebeef5;
}

.data-item:last-child {
  border-bottom: none;
}

.data-item .label {
  color: #606266;
  font-size: 14px;
}

.data-item .value {
  color: #303133;
  font-weight: 500;
  font-size: 14px;
}

.data-item .value.growth {
  color: #67c23a;
}

.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-icon {
  font-size: 32px;
  color: #409eff;
  animation: rotate 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 面板滑入动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
