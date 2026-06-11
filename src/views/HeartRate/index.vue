<template>
  <div class="heart-rate-container">
    <div class="header">
      <h2>
        <span class="heart-icon">❤️</span>
        心率实时监测
      </h2>
      <div class="status-bar">
        <span class="status-dot" :class="{ active: isMonitoring }"></span>
        <span>{{ isMonitoring ? "监测中" : "已暂停" }}</span>
        <el-button
          :type="isMonitoring ? 'danger' : 'success'"
          size="small"
          @click="toggleMonitoring"
        >
          {{ isMonitoring ? "暂停" : "开始" }}
        </el-button>
      </div>
    </div>

    <div class="charts-wrapper">
      <!-- 左侧：实时心电波形图 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>实时心电波形</h3>
          <div
            class="bpm-display"
            :class="{ warning: currentBPM > 100 || currentBPM < 60 }"
          >
            <span class="bpm-value">{{ currentBPM }}</span>
            <span class="bpm-label">BPM</span>
          </div>
        </div>
        <div ref="waveformChartRef" class="chart-body"></div>
      </div>

      <!-- 右侧：心率趋势图 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>心率趋势</h3>
          <div class="trend-info">
            <span
              >最高: <b>{{ maxBPM }}</b></span
            >
            <span
              >最低: <b>{{ minBPM }}</b></span
            >
            <span
              >平均: <b>{{ avgBPM }}</b></span
            >
          </div>
        </div>
        <div ref="trendChartRef" class="chart-body"></div>
      </div>
    </div>

    <!-- 底部统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">当前状态</span>
        <span class="stat-value" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">监测时长</span>
        <span class="stat-value">{{ monitorDuration }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">数据点数</span>
        <span class="stat-value">{{ waveformData.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">心率区间</span>
        <span class="stat-value">{{ minBPM }} ~ {{ maxBPM }} BPM</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

// 图表 DOM 引用
const waveformChartRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLElement>();

// 图表实例
let waveformChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

// 定时器
let waveformTimer: ReturnType<typeof setInterval> | null = null;
let trendTimer: ReturnType<typeof setInterval> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;

// 状态
const isMonitoring = ref(true);
const currentBPM = ref(72);
const monitorSeconds = ref(0);

// 波形数据（左侧心电图）
const waveformData = ref<number[]>([]);
const WAVEFORM_MAX_POINTS = 200;

// 趋势数据（右侧心率趋势）
const trendTimeLabels = ref<string[]>([]);
const trendBPMData = ref<number[]>([]);
const TREND_MAX_POINTS = 60;

// 心电波形模拟函数 - 模拟真实 PQRST 波形
function generateECGPoint(phase: number): number {
  // 归一化相位到 0-1 范围
  const p = phase % 1;

  // P 波（心房去极化）
  if (p >= 0.0 && p < 0.08) {
    const x = (p - 0.04) / 0.04;
    return 0.15 * Math.exp(-x * x * 4);
  }
  // PR 段
  if (p >= 0.08 && p < 0.12) {
    return 0;
  }
  // Q 波
  if (p >= 0.12 && p < 0.15) {
    return -0.1 * Math.sin(((p - 0.12) / 0.03) * Math.PI);
  }
  // R 波（心室去极化，最高峰）
  if (p >= 0.15 && p < 0.22) {
    const x = (p - 0.185) / 0.025;
    return 1.0 * Math.exp(-x * x * 6);
  }
  // S 波
  if (p >= 0.22 && p < 0.27) {
    return -0.2 * Math.sin(((p - 0.22) / 0.05) * Math.PI);
  }
  // ST 段
  if (p >= 0.27 && p < 0.35) {
    return 0.02;
  }
  // T 波（心室复极化）
  if (p >= 0.35 && p < 0.52) {
    const x = (p - 0.435) / 0.06;
    return 0.25 * Math.exp(-x * x * 3);
  }
  // 基线
  return 0;
}

// 相位追踪
let currentPhase = 0;
// 每个采样点的相位增量，决定心率快慢
function getPhaseIncrement(bpm: number): number {
  // 假设采样率 50Hz，一个完整心跳周期 = 60/bpm 秒
  // 每秒 50 个点，一个周期有 50 * 60 / bpm 个点
  // 相位增量 = 1 / (50 * 60 / bpm) = bpm / 3000
  return bpm / 3000;
}

// 初始化波形数据
function initWaveformData() {
  waveformData.value = [];
  for (let i = 0; i < WAVEFORM_MAX_POINTS; i++) {
    const phaseInc = getPhaseIncrement(72);
    currentPhase += phaseInc;
    const noise = (Math.random() - 0.5) * 0.03;
    waveformData.value.push(
      +(generateECGPoint(currentPhase) + noise).toFixed(3),
    );
  }
}

// 更新波形数据
function updateWaveform() {
  // 模拟心率微调
  const bpmVariation = (Math.random() - 0.5) * 2;
  currentBPM.value = Math.round(
    Math.max(55, Math.min(120, currentBPM.value + bpmVariation)),
  );

  // 每次添加多个点让波形滚动更快
  for (let i = 0; i < 3; i++) {
    const phaseInc = getPhaseIncrement(currentBPM.value);
    currentPhase += phaseInc;
    const noise = (Math.random() - 0.5) * 0.03;
    waveformData.value.push(
      +(generateECGPoint(currentPhase) + noise).toFixed(3),
    );
  }

  // 保持固定长度
  while (waveformData.value.length > WAVEFORM_MAX_POINTS) {
    waveformData.value.shift();
  }

  updateWaveformChart();
}

// 更新趋势数据
function updateTrend() {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

  trendTimeLabels.value.push(timeStr);
  trendBPMData.value.push(currentBPM.value);

  if (trendTimeLabels.value.length > TREND_MAX_POINTS) {
    trendTimeLabels.value.shift();
    trendBPMData.value.shift();
  }

  updateTrendChart();
}

// 计算统计数据
const maxBPM = computed(() => {
  if (trendBPMData.value.length === 0) return currentBPM.value;
  return Math.max(...trendBPMData.value);
});

const minBPM = computed(() => {
  if (trendBPMData.value.length === 0) return currentBPM.value;
  return Math.min(...trendBPMData.value);
});

const avgBPM = computed(() => {
  if (trendBPMData.value.length === 0) return currentBPM.value;
  const sum = trendBPMData.value.reduce((a, b) => a + b, 0);
  return Math.round(sum / trendBPMData.value.length);
});

const statusText = computed(() => {
  if (!isMonitoring.value) return "已暂停";
  if (currentBPM.value < 60) return "心动过缓";
  if (currentBPM.value > 100) return "心动过速";
  return "正常";
});

const statusClass = computed(() => {
  if (!isMonitoring.value) return "paused";
  if (currentBPM.value < 60 || currentBPM.value > 100) return "abnormal";
  return "normal";
});

const monitorDuration = computed(() => {
  const min = Math.floor(monitorSeconds.value / 60);
  const sec = monitorSeconds.value % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
});

// 波形图表配置
function updateWaveformChart() {
  if (!waveformChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: "transparent",
    grid: {
      top: 10,
      right: 15,
      bottom: 25,
      left: 45,
    },
    xAxis: {
      type: "category",
      data: waveformData.value.map((_, i) => i),
      show: false,
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      min: -0.5,
      max: 1.5,
      splitLine: {
        lineStyle: {
          color: "rgba(0, 255, 100, 0.08)",
        },
      },
      axisLine: { show: false },
      axisLabel: {
        color: "#6b7280",
        fontSize: 10,
      },
    },
    series: [
      {
        name: "心电波形",
        type: "line",
        data: waveformData.value,
        smooth: false,
        showSymbol: false,
        lineStyle: {
          color: "#00ff66",
          width: 2,
          shadowColor: "rgba(0, 255, 102, 0.5)",
          shadowBlur: 8,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(0, 255, 102, 0.15)" },
            { offset: 1, color: "rgba(0, 255, 102, 0)" },
          ]),
        },
        animation: false,
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderColor: "#00ff66",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any) => {
        const val = params[0]?.value ?? 0;
        return `振幅: ${val.toFixed(3)} mV`;
      },
    },
  };

  waveformChart.setOption(option);
}

// 趋势图表配置
function updateTrendChart() {
  if (!trendChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: "transparent",
    grid: {
      top: 30,
      right: 20,
      bottom: 35,
      left: 50,
    },
    xAxis: {
      type: "category",
      data: trendTimeLabels.value,
      axisLine: { lineStyle: { color: "#374151" } },
      axisLabel: {
        color: "#6b7280",
        fontSize: 10,
        interval: Math.floor(trendTimeLabels.value.length / 6),
      },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      name: "BPM",
      nameTextStyle: { color: "#6b7280", fontSize: 11 },
      min: (value: any) => Math.floor(value.min - 10),
      max: (value: any) => Math.ceil(value.max + 10),
      splitLine: {
        lineStyle: { color: "rgba(59, 130, 246, 0.1)" },
      },
      axisLine: { show: false },
      axisLabel: { color: "#6b7280", fontSize: 10 },
    },
    visualMap: {
      show: false,
      pieces: [
        { gt: 0, lte: 60, color: "#f59e0b" },
        { gt: 60, lte: 100, color: "#3b82f6" },
        { gt: 100, color: "#ef4444" },
      ],
    },
    series: [
      {
        name: "心率",
        type: "line",
        data: trendBPMData.value,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2.5,
          shadowColor: "rgba(59, 130, 246, 0.4)",
          shadowBlur: 10,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(59, 130, 246, 0.2)" },
            { offset: 1, color: "rgba(59, 130, 246, 0)" },
          ]),
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", width: 1 },
          data: [
            {
              yAxis: 60,
              lineStyle: { color: "rgba(245, 158, 11, 0.5)" },
              label: {
                formatter: "低限 60",
                color: "#f59e0b",
                fontSize: 10,
              },
            },
            {
              yAxis: 100,
              lineStyle: { color: "rgba(239, 68, 68, 0.5)" },
              label: {
                formatter: "高限 100",
                color: "#ef4444",
                fontSize: 10,
              },
            },
          ],
        },
        animation: false,
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderColor: "#3b82f6",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        const bpm = p?.value ?? 0;
        let status = "正常";
        let color = "#22c55e";
        if (bpm < 60) {
          status = "偏低";
          color = "#f59e0b";
        } else if (bpm > 100) {
          status = "偏高";
          color = "#ef4444";
        }
        return `时间: ${p?.axisValue}<br/>心率: <span style="color:${color}">${bpm} BPM</span><br/>状态: ${status}`;
      },
    },
  };

  trendChart.setOption(option);
}

// 初始化图表
function initCharts() {
  if (waveformChartRef.value) {
    waveformChart = echarts.init(waveformChartRef.value);
  }
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value);
  }
}

// 开始监测
function startMonitoring() {
  // 波形每 50ms 更新一次
  waveformTimer = setInterval(updateWaveform, 50);
  // 趋势每 2s 记录一次
  trendTimer = setInterval(updateTrend, 2000);
  // 计时器
  durationTimer = setInterval(() => {
    monitorSeconds.value++;
  }, 1000);
}

// 停止监测
function stopMonitoring() {
  if (waveformTimer) {
    clearInterval(waveformTimer);
    waveformTimer = null;
  }
  if (trendTimer) {
    clearInterval(trendTimer);
    trendTimer = null;
  }
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

// 切换监测状态
function toggleMonitoring() {
  isMonitoring.value = !isMonitoring.value;
}

// 监听状态变化
watch(isMonitoring, (val) => {
  if (val) {
    startMonitoring();
  } else {
    stopMonitoring();
  }
});

// 窗口大小自适应
function handleResize() {
  waveformChart?.resize();
  trendChart?.resize();
}

onMounted(() => {
  initWaveformData();
  initCharts();
  updateWaveformChart();
  updateTrendChart();
  startMonitoring();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  stopMonitoring();
  waveformChart?.dispose();
  trendChart?.dispose();
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.heart-rate-container {
  padding: 20px;
  min-height: calc(100vh - 120px);
  background: #0f172a;
  color: #e2e8f0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  font-size: 22px;
  font-weight: 600;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.heart-icon {
  font-size: 24px;
  animation: heartbeat 1s ease-in-out infinite;
}

@keyframes heartbeat {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #94a3b8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.status-dot.active {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.charts-wrapper {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .charts-wrapper {
    flex-direction: column;
  }
}

.chart-card {
  flex: 1;
  background: #1e293b;
  border-radius: 12px;
  border: 1px solid #334155;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #334155;
}

.chart-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #cbd5e1;
}

.bpm-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  transition: all 0.3s;
}

.bpm-display.warning {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.bpm-value {
  font-size: 24px;
  font-weight: 700;
  color: #22c55e;
  font-variant-numeric: tabular-nums;
}

.bpm-display.warning .bpm-value {
  color: #ef4444;
}

.bpm-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.chart-body {
  height: 320px;
  padding: 8px;
}

.trend-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
}

.trend-info b {
  color: #94a3b8;
}

.stats-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 140px;
  background: #1e293b;
  border-radius: 10px;
  border: 1px solid #334155;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
}

.stat-value.normal {
  color: #22c55e;
}

.stat-value.abnormal {
  color: #ef4444;
}

.stat-value.paused {
  color: #f59e0b;
}
</style>
