<template>
  <div class="kline-chart-container">
    <!-- 主图表区域 -->
    <div ref="mainChartContainer" class="main-chart-container">
      <!-- 主图表指标信息面板 -->
      <div class="main-indicators-panel" v-show="showIndicators">
        <div class="indicator-group">
          <span class="indicator-time">{{ currentData.time || '' }}</span>
          <span class="indicator-value">开: {{ currentData.open }}</span>
          <span class="indicator-value">高: {{ currentData.high }}</span>
          <span class="indicator-value">低: {{ currentData.low }}</span>
          <span class="indicator-value">收: {{ currentData.close }}</span>
        </div>
        <div class="indicator-group" v-if="activeIndicators.includes('MA')">
          <span class="indicator-label">MA(7): {{ maData.ma7 }}</span>
          <span class="indicator-label">MA(25): {{ maData.ma25 }}</span>
          <span class="indicator-label">MA(99): {{ maData.ma99 }}</span>
        </div>
        <div class="indicator-group" v-if="activeIndicators.includes('EMA')">
          <span class="indicator-label">EMA(7): {{ emaData.ema7 }}</span>
          <span class="indicator-label">EMA(25): {{ emaData.ema25 }}</span>
          <span class="indicator-label">EMA(99): {{ emaData.ema99 }}</span>
        </div>
        <div class="indicator-group" v-if="activeIndicators.includes('BOLL')">
          <span class="indicator-label">BOLL(20): UP {{ bollData.upper }}</span>
          <span class="indicator-label">MB {{ bollData.middle }}</span>
          <span class="indicator-label">DN {{ bollData.lower }}</span>
        </div>
      </div>
    </div>

    <!-- 分界线 -->
    <div class="chart-divider">
      <div class="divider-line"></div>
    </div>

    <!-- Vol图表区域 -->
    <div ref="volumeChartContainer" class="volume-chart-container">
      <!-- Vol指标信息面板 -->
      <div class="volume-indicators-panel" v-show="showIndicators">
        <div class="indicator-group">
          <span class="indicator-label">Vol</span>
          <span class="indicator-value">{{ volumeData.current }}</span>
          <span class="indicator-label">Vol(BTC):</span>
          <span class="indicator-value">{{ volumeData.btc }}</span>
          <span class="indicator-label">Vol(USDT):</span>
          <span class="indicator-value">{{ volumeData.usdt }}</span>
          <span class="indicator-label">买入量:</span>
          <span class="indicator-value">{{ volumeData.buyVolume }}</span>
          <span class="indicator-label">卖出量:</span>
          <span class="indicator-value">{{ volumeData.sellVolume }}</span>
        </div>
      </div>

      <!-- 时间显示面板 -->
      <div class="time-display-panel" v-show="timeDisplay.visible">
        <span class="time-text">{{ timeDisplay.value }}</span>
      </div>
    </div>

    <!-- 十字线价格显示 -->
    <div class="crosshair-price" v-show="crosshairPrice.visible" :style="crosshairPrice.style">
      {{ crosshairPrice.value }}
    </div>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">加载中...</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart } from 'lightweight-charts'

export default {
  name: 'KLineChart',
  props: {
    symbol: {
      type: String,
      default: 'BTCUSDT'
    },
    interval: {
      type: String,
      default: '1m'
    },
    height: {
      type: Number,
      default: 500
    },
    showPriceScale: {
      type: Boolean,
      default: true
    },
    activeIndicators: {
      type: Array,
      default: () => ['MA']
    }
  },
  emits: ['priceUpdate'],
  setup(props, { emit }) {
    const mainChartContainer = ref(null)
    const volumeChartContainer = ref(null)
    const loading = ref(true)
    const showIndicators = ref(true)

    // 图表实例
    let mainChart = null
    let volumeChart = null
    let candlestickSeries = null
    let volumeSeries = null
    let maSeries = {}
    let emaSeries = {}
    let bollSeries = {}

    // 当前数据状态
    const currentData = ref({
      open: '0.00',
      high: '0.00',
      low: '0.00',
      close: '0.00'
    })

    // 指标数据
    const maData = ref({
      ma7: '0.00',
      ma25: '0.00',
      ma99: '0.00'
    })

    const emaData = ref({
      ema7: '0.00',
      ema25: '0.00',
      ema99: '0.00'
    })

    const bollData = ref({
      upper: '0.00',
      middle: '0.00',
      lower: '0.00'
    })

    const volumeData = ref({
      current: '0.00',
      btc: '0.000K',
      usdt: '0.000M',
      buyVolume: '0.000K',
      sellVolume: '0.000K'
    })

    // 时间显示
    const timeDisplay = ref({
      visible: false,
      value: ''
    })

    // 十字线价格显示
    const crosshairPrice = ref({
      visible: false,
      value: '0.00',
      style: {
        left: '0px',
        top: '0px'
      }
    })

    // 激活的指标（使用props）
    const activeIndicators = ref(props.activeIndicators)

    // 固定的测试数据（只生成一次）
    let fixedTestData = []
    let fixedVolumeData = []

    // 图表配置
    const chartOptions = {
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#DDD',
      },
      grid: {
        vertLines: { color: '#2B3139' },
        horzLines: { color: '#2B3139' },
      },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: '#758696', style: 0 },
        horzLine: { width: 1, color: '#758696', style: 0 },
      },
      rightPriceScale: {
        borderColor: '#2B3139',
        visible: props.showPriceScale,
      },
      timeScale: {
        borderColor: '#2B3139',
        timeVisible: true,
        secondsVisible: false,
      },
    }

    // 获取时间框架标签
    const getTimeframeLabel = (interval) => {
      const labels = {
        '1m': '1分钟', '3m': '3分钟', '5m': '5分钟', '15m': '15分钟',
        '30m': '30分钟', '1h': '1小时', '2h': '2小时', '4h': '4小时',
        '6h': '6小时', '8h': '8小时', '12h': '12小时', '1d': '1天',
        '3d': '3天', '1w': '1周', '1M': '1月'
      }
      return labels[interval] || interval
    }

    // 计算技术指标
    const calculateMA = (data, period) => {
      const result = []
      for (let i = period - 1; i < data.length; i++) {
        let sum = 0
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close
        }
        result.push({
          time: data[i].time,
          value: sum / period
        })
      }
      return result
    }

    const calculateEMA = (data, period) => {
      const result = []
      const multiplier = 2 / (period + 1)
      let ema = data[0].close

      result.push({ time: data[0].time, value: ema })

      for (let i = 1; i < data.length; i++) {
        ema = (data[i].close - ema) * multiplier + ema
        result.push({ time: data[i].time, value: ema })
      }
      return result
    }

    const calculateBOLL = (data, period = 20, stdDev = 2) => {
      const result = { upper: [], middle: [], lower: [] }

      for (let i = period - 1; i < data.length; i++) {
        let sum = 0
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close
        }
        const middle = sum / period

        let variance = 0
        for (let j = 0; j < period; j++) {
          variance += Math.pow(data[i - j].close - middle, 2)
        }
        const std = Math.sqrt(variance / period)

        result.middle.push({ time: data[i].time, value: middle })
        result.upper.push({ time: data[i].time, value: middle + std * stdDev })
        result.lower.push({ time: data[i].time, value: middle - std * stdDev })
      }
      return result
    }

    // 计算单个指标值的辅助函数
    const calculateMAValue = (data, index, period) => {
      if (index < period - 1) return 0
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[index - j].close
      }
      return parseFloat((sum / period).toFixed(2))
    }

    const calculateEMAValue = (data, index, period) => {
      if (index < 0) return 0
      const multiplier = 2 / (period + 1)
      let ema = data[0].close
      for (let i = 1; i <= index; i++) {
        ema = (data[i].close - ema) * multiplier + ema
      }
      return parseFloat(ema.toFixed(2))
    }

    const calculateBOLLValue = (data, index, period = 20, stdDev = 2) => {
      if (index < period - 1) return { upper: 0, middle: 0, lower: 0 }

      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[index - j].close
      }
      const middle = sum / period

      let variance = 0
      for (let j = 0; j < period; j++) {
        variance += Math.pow(data[index - j].close - middle, 2)
      }
      const std = Math.sqrt(variance / period)

      return {
        upper: parseFloat((middle + std * stdDev).toFixed(2)),
        middle: parseFloat(middle.toFixed(2)),
        lower: parseFloat((middle - std * stdDev).toFixed(2))
      }
    }

    // 初始化主图表
    const initMainChart = () => {
      if (!mainChartContainer.value) {
        console.error('主图表容器未找到')
        return
      }

      const mainHeight = Math.floor(props.height * 0.7)
      console.log('初始化主图表，高度:', mainHeight, '宽度:', mainChartContainer.value.clientWidth)

      mainChart = createChart(mainChartContainer.value, {
        ...chartOptions,
        width: mainChartContainer.value.clientWidth,
        height: mainHeight,
      })

      // 创建K线系列
      candlestickSeries = mainChart.addCandlestickSeries({
        upColor: '#0ECB81',
        downColor: '#F6465D',
        borderDownColor: '#F6465D',
        borderUpColor: '#0ECB81',
        wickDownColor: '#F6465D',
        wickUpColor: '#0ECB81',
        priceScaleId: 'right',
      })
      console.log('K线系列创建成功')

      // 创建MA系列
      maSeries.ma7 = mainChart.addLineSeries({
        color: '#FF6B35',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      maSeries.ma25 = mainChart.addLineSeries({
        color: '#4ECDC4',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      maSeries.ma99 = mainChart.addLineSeries({
        color: '#45B7D1',
        lineWidth: 1,
        priceScaleId: 'right',
      })

      // 创建EMA系列
      emaSeries.ema7 = mainChart.addLineSeries({
        color: '#FFA500',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      emaSeries.ema25 = mainChart.addLineSeries({
        color: '#32CD32',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      emaSeries.ema99 = mainChart.addLineSeries({
        color: '#9370DB',
        lineWidth: 1,
        priceScaleId: 'right',
      })

      // 创建BOLL系列
      bollSeries.upper = mainChart.addLineSeries({
        color: '#FF69B4',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      bollSeries.middle = mainChart.addLineSeries({
        color: '#FFD700',
        lineWidth: 1,
        priceScaleId: 'right',
      })
      bollSeries.lower = mainChart.addLineSeries({
        color: '#FF69B4',
        lineWidth: 1,
        priceScaleId: 'right',
      })

      // 监听十字线移动
      mainChart.subscribeCrosshairMove((param) => {
        handleCrosshairMove(param, 'main')
      })
    }

    // 十字线移动处理
    const handleCrosshairMove = (param, source) => {
      if (param.time && param.seriesPrices) {
        // 更新当前数据显示
        const candleData = param.seriesPrices.get(candlestickSeries)
        if (candleData) {
          const timeStr = new Date(param.time * 1000).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })

          currentData.value = {
            open: candleData.open?.toFixed(2) || '0.00',
            high: candleData.high?.toFixed(2) || '0.00',
            low: candleData.low?.toFixed(2) || '0.00',
            close: candleData.close?.toFixed(2) || '0.00',
            time: timeStr
          }

          // 更新MA数据显示
          if (activeIndicators.value.includes('MA') && maSeries.ma7) {
            const ma7Data = param.seriesPrices.get(maSeries.ma7)
            const ma25Data = param.seriesPrices.get(maSeries.ma25)
            const ma99Data = param.seriesPrices.get(maSeries.ma99)

            maData.value = {
              ma7: ma7Data?.toFixed(2) || '0.00',
              ma25: ma25Data?.toFixed(2) || '0.00',
              ma99: ma99Data?.toFixed(2) || '0.00'
            }
          }

          // 更新EMA数据显示
          if (activeIndicators.value.includes('EMA') && emaSeries.ema7) {
            const ema7Data = param.seriesPrices.get(emaSeries.ema7)
            const ema25Data = param.seriesPrices.get(emaSeries.ema25)
            const ema99Data = param.seriesPrices.get(emaSeries.ema99)

            emaData.value = {
              ema7: ema7Data?.toFixed(2) || '0.00',
              ema25: ema25Data?.toFixed(2) || '0.00',
              ema99: ema99Data?.toFixed(2) || '0.00'
            }
          }

          // 更新BOLL数据显示
          if (activeIndicators.value.includes('BOLL') && bollSeries.upper) {
            const upperData = param.seriesPrices.get(bollSeries.upper)
            const middleData = param.seriesPrices.get(bollSeries.middle)
            const lowerData = param.seriesPrices.get(bollSeries.lower)

            bollData.value = {
              upper: upperData?.toFixed(2) || '0.00',
              middle: middleData?.toFixed(2) || '0.00',
              lower: lowerData?.toFixed(2) || '0.00'
            }
          }

          // 发送价格更新事件
          emit('priceUpdate', {
            time: param.time,
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close
          })
        }

        // 显示十字线价格（显示鼠标位置对应的价格，而不是K线价格）
        if (param.point && source === 'main' && mainChart) {
          try {
            // 将鼠标Y坐标转换为价格
            const price = mainChart.priceScale('right').coordinateToPrice(param.point.y)
            crosshairPrice.value = {
              visible: true,
              value: price?.toFixed(2) || '0.00',
              style: {
                left: `${param.point.x + 10}px`,
                top: `${param.point.y - 20}px`
              }
            }
          } catch (error) {
            console.warn('获取十字线价格失败:', error)
          }
        }

        // 同步另一个图表的十字线
        if (source === 'main' && volumeChart) {
          volumeChart.setCrosshairPosition(param.point?.x || 0, param.time)
        } else if (source === 'volume' && mainChart) {
          mainChart.setCrosshairPosition(param.point?.x || 0, param.time)
        }
      } else {
        // 隐藏十字线价格
        crosshairPrice.value.visible = false
      }
    }

    // 初始化Vol图表
    const initVolumeChart = () => {
      if (!volumeChartContainer.value) {
        console.error('Vol图表容器未找到')
        return
      }

      const volumeHeight = Math.floor(props.height * 0.3)
      console.log('初始化Vol图表，高度:', volumeHeight, '宽度:', volumeChartContainer.value.clientWidth)

      volumeChart = createChart(volumeChartContainer.value, {
        ...chartOptions,
        width: volumeChartContainer.value.clientWidth,
        height: volumeHeight,
        rightPriceScale: {
          borderColor: '#2B3139',
          visible: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
      })

      // 创建成交量系列
      volumeSeries = volumeChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'right',
      })
      console.log('成交量系列创建成功')

      // 监听Vol图表的十字线移动
      volumeChart.subscribeCrosshairMove((param) => {
        handleCrosshairMove(param, 'volume')

        // 更新成交量数据显示
        if (param.time && param.seriesPrices) {
          const volData = param.seriesPrices.get(volumeSeries)
          if (volData) {
            const volume = volData.value
            const price = parseFloat(currentData.value.close) || 119000

            // 格式化成交量显示
            const formatVolume = (vol) => {
              if (vol >= 1000000) return (vol / 1000000).toFixed(3) + 'M'
              if (vol >= 1000) return (vol / 1000).toFixed(3) + 'K'
              return vol.toFixed(3)
            }

            volumeData.value = {
              current: formatVolume(volume),
              btc: formatVolume(volume),
              usdt: formatVolume(volume * price),
              buyVolume: formatVolume(volume * 0.6), // 模拟买入量
              sellVolume: formatVolume(volume * 0.4)  // 模拟卖出量
            }
          }

          // 显示时间
          if (param.time) {
            const date = new Date(param.time * 1000)
            timeDisplay.value = {
              visible: true,
              value: date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          }
        } else {
          // 隐藏时间显示
          timeDisplay.value.visible = false
        }
      })
    }

    // 统一初始化图表
    const initChart = () => {
      initMainChart()
      initVolumeChart()

      // 同步时间轴
      if (mainChart && volumeChart) {
        mainChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          volumeChart.timeScale().setVisibleRange(timeRange)
        })

        volumeChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          mainChart.timeScale().setVisibleRange(timeRange)
        })
      }
    }

    // 生成可靠的K线测试数据
    const generateFixedTestData = () => {
      if (fixedTestData.length > 0) return

      // 使用简单可靠的数据格式
      const baseDate = new Date('2024-01-01')
      let price = 119000

      for (let i = 0; i < 50; i++) {
        const date = new Date(baseDate)
        date.setDate(baseDate.getDate() + i)
        const timeStr = date.toISOString().split('T')[0] // '2024-01-01' 格式

        const open = price
        const change = (Math.sin(i * 0.1) * 100) + (Math.cos(i * 0.05) * 50)
        const close = open + change
        const high = Math.max(open, close) + Math.abs(Math.sin(i * 0.2)) * 50
        const low = Math.min(open, close) - Math.abs(Math.cos(i * 0.2)) * 50
        const volume = 50 + Math.abs(Math.sin(i * 0.3)) * 50

        fixedTestData.push({
          time: timeStr,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2))
        })

        fixedVolumeData.push({
          time: timeStr,
          value: Number(volume.toFixed(2)),
          color: close >= open ? '#0ECB81' : '#F6465D'
        })

        price = close
      }

      console.log('生成K线数据成功，条数:', fixedTestData.length)
      console.log('数据示例:', fixedTestData[0])
    }

    // 加载测试数据
    const loadTestData = () => {
      try {
        loading.value = true

        // 确保固定数据已生成
        generateFixedTestData()

        // 设置K线数据
        if (candlestickSeries && fixedTestData.length > 0) {
          try {
            console.log('准备设置K线数据，系列状态:', !!candlestickSeries, '数据条数:', fixedTestData.length)
            console.log('数据格式检查:', fixedTestData.slice(0, 2))

            // 验证数据格式
            const validData = fixedTestData.filter(item => {
              return item &&
                     item.time &&
                     typeof item.open === 'number' && !isNaN(item.open) &&
                     typeof item.high === 'number' && !isNaN(item.high) &&
                     typeof item.low === 'number' && !isNaN(item.low) &&
                     typeof item.close === 'number' && !isNaN(item.close)
            })

            console.log('有效数据条数:', validData.length)

            if (validData.length > 0) {
              candlestickSeries.setData(validData)
              console.log('✅ K线数据设置成功！')
            } else {
              console.error('❌ 没有有效的K线数据')
            }

            // 计算并设置技术指标
            if (activeIndicators.value.includes('MA')) {
              const ma7Data = calculateMA(fixedTestData, 7)
              const ma25Data = calculateMA(fixedTestData, 25)
              const ma99Data = calculateMA(fixedTestData, 99)

              maSeries.ma7.setData(ma7Data)
              maSeries.ma25.setData(ma25Data)
              maSeries.ma99.setData(ma99Data)
              console.log('MA指标设置成功')
            }

            if (activeIndicators.value.includes('EMA')) {
              const ema7Data = calculateEMA(fixedTestData, 7)
              const ema25Data = calculateEMA(fixedTestData, 25)
              const ema99Data = calculateEMA(fixedTestData, 99)

              emaSeries.ema7.setData(ema7Data)
              emaSeries.ema25.setData(ema25Data)
              emaSeries.ema99.setData(ema99Data)
              console.log('EMA指标设置成功')
            }

            if (activeIndicators.value.includes('BOLL')) {
              const bollData = calculateBOLL(fixedTestData, 20, 2)

              bollSeries.upper.setData(bollData.upper)
              bollSeries.middle.setData(bollData.middle)
              bollSeries.lower.setData(bollData.lower)
              console.log('BOLL指标设置成功')
            }

            // 设置当前数据显示
            const lastData = validData[validData.length - 1]
            currentData.value = {
              open: lastData.open.toFixed(2),
              high: lastData.high.toFixed(2),
              low: lastData.low.toFixed(2),
              close: lastData.close.toFixed(2)
            }

          } catch (error) {
            console.error('设置K线数据失败:', error)
          }
        }

        // 设置成交量数据
        if (volumeSeries && fixedVolumeData.length > 0) {
          try {
            volumeSeries.setData(fixedVolumeData)
            console.log('成交量数据设置成功，数据条数:', fixedVolumeData.length)
          } catch (error) {
            console.error('设置成交量数据失败:', error)
          }
        }

        // 设置十字线事件处理
        if (mainChart) {
          mainChart.subscribeCrosshairMove(param => {
            if (param.point && param.time) {
              // 查找对应时间的K线数据
              const klineData = fixedTestData.find(item => item.time === param.time)
              if (klineData) {
                updateIndicatorPanel(klineData)
              }
            } else {
              // 鼠标离开时显示最新数据
              if (fixedTestData.length > 0) {
                const latestData = fixedTestData[fixedTestData.length - 1]
                updateIndicatorPanel(latestData)
              }
            }
          })

          // 初始化显示最新数据
          if (fixedTestData.length > 0) {
            const latestData = fixedTestData[fixedTestData.length - 1]
            updateIndicatorPanel(latestData)
          }
        }

      } catch (error) {
        console.error('加载测试数据失败:', error)
      } finally {
        loading.value = false
      }
    }

    // 更新指标面板显示
    const updateIndicatorPanel = (klineData) => {
      if (!klineData) return

      // 更新K线基础数据显示
      emit('updatePriceInfo', {
        open: klineData.open,
        high: klineData.high,
        low: klineData.low,
        close: klineData.close
      })

      // 计算并更新指标数据
      const dataIndex = fixedTestData.findIndex(item => item.time === klineData.time)
      if (dataIndex >= 0) {
        const indicatorValues = {}

        // 计算MA值
        if (activeIndicators.value.includes('MA')) {
          indicatorValues.ma7 = calculateMAValue(fixedTestData, dataIndex, 7)
          indicatorValues.ma25 = calculateMAValue(fixedTestData, dataIndex, 25)
          indicatorValues.ma99 = calculateMAValue(fixedTestData, dataIndex, 99)
        }

        // 计算EMA值
        if (activeIndicators.value.includes('EMA')) {
          indicatorValues.ema7 = calculateEMAValue(fixedTestData, dataIndex, 7)
          indicatorValues.ema25 = calculateEMAValue(fixedTestData, dataIndex, 25)
          indicatorValues.ema99 = calculateEMAValue(fixedTestData, dataIndex, 99)
        }

        // 计算BOLL值
        if (activeIndicators.value.includes('BOLL')) {
          const bollValues = calculateBOLLValue(fixedTestData, dataIndex, 20)
          indicatorValues.bollUpper = bollValues.upper
          indicatorValues.bollMiddle = bollValues.middle
          indicatorValues.bollLower = bollValues.lower
        }

        emit('updateIndicatorInfo', indicatorValues)
      }
    }

    // 响应式调整图表大小
    const handleResize = () => {
      if (mainChart && mainChartContainer.value) {
        mainChart.resize(mainChartContainer.value.clientWidth, Math.floor(props.height * 0.7))
      }
      if (volumeChart && volumeChartContainer.value) {
        volumeChart.resize(volumeChartContainer.value.clientWidth, Math.floor(props.height * 0.3))
      }
    }

    // 监听指标变化
    watch(() => props.activeIndicators, (newIndicators) => {
      activeIndicators.value = newIndicators
      console.log('指标变化:', newIndicators)
      // 只重新计算和设置指标，不重新生成基础数据
      if (mainChart && candlestickSeries && fixedTestData.length > 0) {
        updateIndicators()
      }
    }, { deep: true })

    // 更新指标显示
    const updateIndicators = () => {
      try {
        // 清除所有指标数据
        maSeries.ma7?.setData([])
        maSeries.ma25?.setData([])
        maSeries.ma99?.setData([])
        emaSeries.ema7?.setData([])
        emaSeries.ema25?.setData([])
        emaSeries.ema99?.setData([])
        bollSeries.upper?.setData([])
        bollSeries.middle?.setData([])
        bollSeries.lower?.setData([])

        // 根据激活的指标重新计算和设置数据
        if (activeIndicators.value.includes('MA')) {
          const ma7Data = calculateMA(fixedTestData, 7)
          const ma25Data = calculateMA(fixedTestData, 25)
          const ma99Data = calculateMA(fixedTestData, 99)

          maSeries.ma7.setData(ma7Data)
          maSeries.ma25.setData(ma25Data)
          maSeries.ma99.setData(ma99Data)
          console.log('MA指标更新成功')
        }

        if (activeIndicators.value.includes('EMA')) {
          const ema7Data = calculateEMA(fixedTestData, 7)
          const ema25Data = calculateEMA(fixedTestData, 25)
          const ema99Data = calculateEMA(fixedTestData, 99)

          emaSeries.ema7.setData(ema7Data)
          emaSeries.ema25.setData(ema25Data)
          emaSeries.ema99.setData(ema99Data)
          console.log('EMA指标更新成功')
        }

        if (activeIndicators.value.includes('BOLL')) {
          const bollData = calculateBOLL(fixedTestData, 20, 2)

          bollSeries.upper.setData(bollData.upper)
          bollSeries.middle.setData(bollData.middle)
          bollSeries.lower.setData(bollData.lower)
          console.log('BOLL指标更新成功')
        }
      } catch (error) {
        console.error('更新指标失败:', error)
      }
    }

    // 生命周期管理
    onMounted(async () => {
      // 确保DOM已经渲染
      await new Promise(resolve => setTimeout(resolve, 100))
      initChart()
      loadTestData()
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      if (mainChart) mainChart.remove()
      if (volumeChart) volumeChart.remove()
    })

    return {
      mainChartContainer,
      volumeChartContainer,
      loading,
      showIndicators,
      currentData,
      maData,
      emaData,
      bollData,
      volumeData,
      timeDisplay,
      crosshairPrice,
      activeIndicators,
      getTimeframeLabel
    }
  }
}
</script>

<style scoped>
.kline-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.main-chart-container {
  flex: 7;
  min-height: 200px;
  background: #1a1a1a;
  position: relative;
}

.volume-chart-container {
  flex: 3;
  min-height: 100px;
  background: #1a1a1a;
  position: relative;
}

.chart-divider {
  height: 2px;
  background: #2B3139;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.divider-line {
  width: 100%;
  height: 1px;
  background: #333;
}

/* 指标面板样式 */
.main-indicators-panel,
.volume-indicators-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.8);
  border-radius: 4px;
  padding: 8px 12px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.time-display-panel {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.8);
  border-radius: 4px;
  padding: 4px 8px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.time-text {
  color: #fff;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-weight: 500;
}

.indicator-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.indicator-group:last-child {
  margin-bottom: 0;
}

.indicator-time {
  color: #FFF;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-weight: 600;
  margin-right: 8px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.indicator-label {
  color: #888;
  font-size: 12px;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif;
}

.indicator-value {
  color: #fff;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-weight: 500;
}

/* 十字线价格显示 */
.crosshair-price {
  position: absolute;
  z-index: 20;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-weight: 500;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.indicators-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  pointer-events: none;
}

.timeframe-display {
  margin-bottom: 8px;
}

.timeframe-label {
  background: rgba(42, 46, 57, 0.8);
  color: #FFA500;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 26, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.loading-spinner {
  color: #FFA500;
  font-size: 14px;
}
</style>
