<template>
  <div class="mobile-kline-container">
    <!-- MA指标面板 - 固定在左上角 -->
    <div class="indicator-panel">
      <div class="indicator-info">
        <div v-if="showMA" class="indicator-group">
          <span style="color: #FF6B6B;">MA(7): {{ indicatorInfo.ma7 }}</span>
          <span style="color: #4ECDC4;">MA(25): {{ indicatorInfo.ma25 }}</span>
          <span style="color: #45B7D1;">MA(99): {{ indicatorInfo.ma99 }}</span>
        </div>
        <div v-if="showEMA" class="indicator-group">
          <span style="color: #FFA500;">EMA(12): {{ indicatorInfo.ema12 }}</span>
          <span style="color: #9370DB;">EMA(26): {{ indicatorInfo.ema26 }}</span>
        </div>
        <div v-if="showBOLL" class="indicator-group">
          <span style="color: #FF69B4;">BOLL上: {{ indicatorInfo.bollUpper }}</span>
          <span style="color: #FFD700;">BOLL中: {{ indicatorInfo.bollMiddle }}</span>
          <span style="color: #FF69B4;">BOLL下: {{ indicatorInfo.bollLower }}</span>
        </div>
      </div>
    </div>

    <!-- 价格信息面板 - 跟随十字线位置 -->
    <div
      v-if="showPriceInfo"
      class="price-info-panel"
      :class="{ 'panel-left': panelPosition === 'left', 'panel-right': panelPosition === 'right' }"
      :style="panelStyle"
    >
      <div class="price-info">
        <div class="time-info">{{ currentTime }}</div>
        <div class="price-row">
          <span>开:</span>
          <span :class="['change-info', priceInfo.change >= 0 ? 'positive' : 'negative']">{{ priceInfo.open }}</span>
        </div>
        <div class="price-row">
          <span>高:</span>
          <span :class="['change-info', priceInfo.change >= 0 ? 'positive' : 'negative']">{{ priceInfo.high }}</span>
        </div>
        <div class="price-row">
          <span>低:</span>
          <span :class="['change-info', priceInfo.change >= 0 ? 'positive' : 'negative']">{{ priceInfo.low }}</span>
        </div>
        <div class="price-row">
          <span>收:</span>
          <span :class="['change-info', priceInfo.change >= 0 ? 'positive' : 'negative']">{{ priceInfo.close }}</span>
        </div>
        <div class="price-row">
          <span>涨跌幅:</span>
          <span :class="['change-info', priceInfo.change >= 0 ? 'positive' : 'negative']">{{ priceInfo.change >= 0 ? '+' : '' }}{{ priceInfo.changePercent }}%</span>
        </div>
      </div>
    </div>

    <!-- 主K线图 -->
    <div ref="mainChartContainer" class="main-chart-container"></div>

    <!-- 成交量图 -->
    <div ref="volumeChartContainer" class="volume-chart-container">
      <!-- 成交量信息面板 -->
      <div class="volume-info-panel">
        <div class="volume-info">
          <span class="volume-label">Vol(BTC):</span>
          <span class="volume-btc">{{ volumeInfo.btc }}</span>
          <span class="volume-label">Vol(USDT):</span>
          <span class="volume-usdt">{{ volumeInfo.usdt }}</span>
          <span class="volume-label">买:</span>
          <span class="volume-buy">{{ volumeInfo.buyVolume }}</span>
          <span class="volume-label">卖:</span>
          <span class="volume-sell">{{ volumeInfo.sellVolume }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { chartEventBus } from '@/utils/chartEventBus'
import moment from 'moment'

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
    }
  },
  setup(props) {
    const mainChartContainer = ref(null)
    const volumeChartContainer = ref(null)
    let mainChart = null
    let volumeChart = null
    let candlestickSeries = null
    let volumeSeries = null

    // 成交量信息
    const volumeInfo = ref({
      current: '0',
      btc: '0.000K',
      usdt: '0.000M',
      buyVolume: '0.000K',
      sellVolume: '0.000K'
    })

    // 当前时间
    const currentTime = ref(moment().format('YYYY/MM/DD HH:mm'))

    // 价格面板位置状态
    const panelPosition = ref('right') // 'left' 或 'right'
    const panelStyle = ref({})
    const showPriceInfo = ref(false) // 控制价格信息面板显示

    // 计算面板位置
    const calculatePanelPosition = (crosshairX, chartWidth) => {
      if (!crosshairX || !chartWidth) return

      const threshold = chartWidth * 0.5 // 以图表中点为分界线
      const newPosition = crosshairX < threshold ? 'right' : 'left'

      if (panelPosition.value !== newPosition) {
        panelPosition.value = newPosition

        // 设置面板样式
        if (newPosition === 'left') {
          panelStyle.value = {
            left: '8px',
            right: 'auto'
          }
        } else {
          panelStyle.value = {
            left: 'auto',
            right: '8px'
          }
        }
      }
    }

    // WebSocket连接
    let websocket = null

    // 计算成交量移动平均线
    const calculateVolumeMA = (volumeData, period) => {
      if (volumeData.length < period) return 0
      const sum = volumeData.slice(-period).reduce((acc, item) => acc + item.value, 0)
      return sum / period
    }

    // 格式化成交量显示
    const formatVolume = (volume) => {
      if (volume >= 1000000) {
        return (volume / 1000000).toFixed(2) + 'M'
      } else if (volume >= 1000) {
        return (volume / 1000).toFixed(2) + 'K'
      }
      return volume.toFixed(2)
    }

    // 从交易对中提取base和quote资产
    const getAssetFromSymbol = (symbol) => {
      // 常见的quote资产
      const quoteAssets = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB']

      for (const quote of quoteAssets) {
        if (symbol.endsWith(quote)) {
          const base = symbol.slice(0, -quote.length)
          return { base, quote }
        }
      }

      // 默认情况
      return { base: symbol.slice(0, -4), quote: symbol.slice(-4) }
    }

    // 更新成交量信息
    const updateVolumeInfo = (volumeData, currentPrice = 0) => {
      if (volumeData.length === 0) return

      const lastVolumeData = volumeData[volumeData.length - 1]
      const currentVolume = lastVolumeData.value
      const buyVolume = lastVolumeData.buyVolume || 0
      const sellVolume = lastVolumeData.sellVolume || 0
      const quoteVolume = lastVolumeData.quoteVolume || (currentVolume * currentPrice)

      const { base, quote } = getAssetFromSymbol(props.symbol)

      volumeInfo.value = {
        current: `${formatVolume(currentVolume)} ${base}`, // 显示base资产单位
        btc: `${formatVolume(currentVolume)}`, // base资产成交量
        usdt: `${formatVolume(quoteVolume)}`, // quote资产成交额
        buyVolume: `${formatVolume(buyVolume * currentPrice)}`, // 买入量(USDT计价)
        sellVolume: `${formatVolume(sellVolume * currentPrice)}`  // 卖出量(USDT计价)
      }
    }

    // 使用EventBus的响应式状态
    const priceInfo = computed(() => chartEventBus.state.priceInfo)
    const indicatorInfo = computed(() => chartEventBus.state.indicatorInfo)
    const activeIndicatorsList = computed(() => chartEventBus.state.activeIndicators)
    const showMA = computed(() => activeIndicatorsList.value.includes('MA'))
    const showEMA = computed(() => activeIndicatorsList.value.includes('EMA'))
    const showBOLL = computed(() => activeIndicatorsList.value.includes('BOLL'))
    const showSAR = computed(() => activeIndicatorsList.value.includes('SAR'))

    // 请求真实的币安K线数据
    const fetchBinanceKlineData = async (symbol = 'BTCUSDT', interval = '1m', limit = 1000) => {
      try {
        console.log(`🔄 正在获取 ${symbol} ${interval} 数据...`)

        // 分时图使用1分钟数据，但显示为连续线图
        const actualInterval = interval === 'time' ? '1m' : interval
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${actualInterval}&limit=${limit}`)
        const data = await response.json()

        const klineData = []
        const volumeData = []

        data.forEach(item => {
          const [
            openTime,
            open,
            high,
            low,
            close,
            volume,
            closeTime,
            quoteAssetVolume,
            count,
            takerBuyBaseAssetVolume,
            takerBuyQuoteAssetVolume
          ] = item

          const time = Math.floor(openTime / 1000) // 转换为秒级时间戳

          // 如果是分时图，转换为线图数据
          if (interval === 'time') {
            klineData.push({
              time: time,
              value: Number(close) // 分时图只需要价格
            })
          } else {
            klineData.push({
              time: time,
              open: Number(open),
              high: Number(high),
              low: Number(low),
              close: Number(close)
            })
          }

          // 计算真实的买入/卖出量 (单位: base asset，如BTCUSDT中的BTC)
          const totalVolume = Number(volume)
          const buyVolume = Number(takerBuyBaseAssetVolume) // 主动买入量 (base asset)
          const sellVolume = totalVolume - buyVolume // 卖出量 = 总量 - 买入量 (base asset)

          volumeData.push({
            time: time,
            value: totalVolume,
            buyVolume: buyVolume,
            sellVolume: sellVolume,
            quoteVolume: Number(quoteAssetVolume), // 成交额
            color: Number(close) >= Number(open) ? '#0ECB81' : '#F6465D'
          })
        })

        console.log(`${symbol} ${interval} 数据获取成功:`, klineData.length, '条')
        return { klineData, volumeData, isTimeSeries: interval === 'time' }
      } catch (error) {
        console.error('❌ 币安数据获取失败:', error)
        // 如果API失败，返回备用测试数据
        return createFallbackData(interval)
      }
    }

    // 备用测试数据（API失败时使用）
    const createFallbackData = (interval = '1m') => {
      const klineData = []
      const volumeData = []
      let price = 119000
      const isTimeSeries = interval === 'time'

      for (let i = 0; i < 50; i++) {
        const time = Math.floor(Date.now() / 1000) - (50 - i) * 60 // 每分钟一个数据点

        const open = price
        const change = (Math.sin(i * 0.1) * 200) + (Math.random() - 0.5) * 100
        const close = open + change
        const high = Math.max(open, close) + Math.random() * 100
        const low = Math.min(open, close) - Math.random() * 100
        const volume = 1000 + Math.random() * 5000

        if (isTimeSeries) {
          klineData.push({
            time: time,
            value: Number(close.toFixed(2))
          })
        } else {
          klineData.push({
            time: time,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2))
          })
        }

        volumeData.push({
          time: time,
          value: Number(volume.toFixed(2)),
          color: close >= open ? '#0ECB81' : '#F6465D'
        })

        price = close
      }

      console.log('⚠️ 使用备用测试数据')
      return { klineData, volumeData, isTimeSeries }
    }

    // 防止十字线同步死循环的标志
    let isSyncing = false

    // 图表点击处理（移动端）- 用于显示十字线和价格面板
    const handleChartClick = (param, source) => {
      if (param.time && param.seriesData) {
        // 显示价格信息面板
        showPriceInfo.value = true

        // 更新时间显示
        const date = new Date(param.time * 1000)
        currentTime.value = moment(date).format('YYYY/MM/DD HH:mm')

        // 计算价格面板位置（只在主图点击时计算）
        if (source === 'main' && param.point && mainChartContainer.value) {
          const chartWidth = mainChartContainer.value.clientWidth
          calculatePanelPosition(param.point.x, chartWidth)
        }

        // 在点击位置显示十字线（包含Y轴）
        if (source === 'main' && mainChart && param.point) {
          // 设置主图十字线，包含Y轴价格线
          mainChart.setCrosshairPosition(param.point.y, param.time, candlestickSeries)
        } else if (source === 'volume' && volumeChart && param.point) {
          // 设置成交量图十字线，包含Y轴成交量线
          volumeChart.setCrosshairPosition(param.point.y, param.time, volumeSeries)
        }

        // 获取主图数据（K线或分时线）
        const mainSeriesData = param.seriesData.get(candlestickSeries)

        // 判断是否为分时图
        const isTimeSeries = props.interval === 'time'

        if (mainSeriesData) {
          let open, high, low, close

          if (isTimeSeries) {
            // 分时图：只有价格值，需要构造OHLC显示
            const price = mainSeriesData.value || 0
            open = high = low = close = price
          } else {
            // K线图：有完整的OHLC数据
            open = mainSeriesData.open || 0
            high = mainSeriesData.high || 0
            low = mainSeriesData.low || 0
            close = mainSeriesData.close || 0
          }

          // 计算涨跌额和涨跌幅
          const change = close - open
          const changePercent = open !== 0 ? (change / open) * 100 : 0

          // 计算振幅
          const amplitude = open !== 0 ? ((high - low) / open) * 100 : 0

          chartEventBus.state.priceInfo = {
            open,
            high,
            low,
            close,
            change: Number(change.toFixed(4)),
            changePercent: Number(changePercent.toFixed(2)),
            amplitude: Number(amplitude.toFixed(2))
          }
        }

        // 更新成交量数据显示
        if (param.time) {
          // 从chartEventBus获取当前数据
          const currentData = chartEventBus.getCurrentData(param.time)

          if (currentData && currentData.volume !== undefined) {
            const volume = currentData.volume
            const buyVolume = currentData.buyVolume || 0
            const sellVolume = currentData.sellVolume || 0
            let currentPrice = 0

            // 获取当前价格
            if (isTimeSeries) {
              currentPrice = mainSeriesData?.value || 0
            } else {
              currentPrice = currentData.close || mainSeriesData?.close || 0
            }

            // 更新Vol指标显示 - 使用真实买入/卖出量，带单位
            const { base, quote } = getAssetFromSymbol(props.symbol)
            const quoteVolume = currentData.quoteVolume || (volume * currentPrice)

            volumeInfo.value = {
              current: `${formatVolume(volume)} ${base}`, // 显示base资产单位
              btc: `${formatVolume(volume)} ${base}`, // base资产成交量
              usdt: `${formatVolume(quoteVolume)} ${quote}`, // quote资产成交额
              buyVolume: `${formatVolume(buyVolume * currentPrice)} ${quote}`, // 买入量(USDT计价)
              sellVolume: `${formatVolume(sellVolume * currentPrice)} ${quote}`  // 卖出量(USDT计价)
            }

          } else {
            // 没有找到对应时间的数据，保持当前显示
          }
        }

        // 十字线同步逻辑 - 防止死循环
        if (!isSyncing && param.time !== undefined && param.point) {
          isSyncing = true

          if (source === 'main' && volumeChart) {
            // 同步主图到成交量图 - 同步时间轴虚线
            volumeChart.setCrosshairPosition(undefined, param.time, volumeSeries)
          } else if (source === 'volume' && mainChart) {
            // 同步成交量图到主图 - 同步时间轴虚线
            mainChart.setCrosshairPosition(undefined, param.time, candlestickSeries)
          }

          // 使用 setTimeout 重置标志，避免阻塞后续正常的十字线移动
          setTimeout(() => {
            isSyncing = false
          }, 10)
        }
      } else {
        currentTime.value = moment().format('YYYY/MM/DD HH:mm')
        // 隐藏价格信息面板
        showPriceInfo.value = false
      }
    }



    // 隐藏价格信息面板和十字线
    const hidePriceInfo = () => {
      showPriceInfo.value = false
      // 清除十字线
      if (mainChart) {
        mainChart.clearCrosshairPosition()
      }
      if (volumeChart) {
        volumeChart.clearCrosshairPosition()
      }
    }

    // 建立WebSocket连接获取实时数据
    const connectWebSocket = (symbol = 'BTCUSDT', interval = '1m') => {
      if (websocket) {
        websocket.close()
      }

      const wsSymbol = symbol.toLowerCase()
      // 分时图使用1分钟WebSocket数据
      const actualInterval = interval === 'time' ? '1m' : interval
      const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${actualInterval}`

      console.log('连接WebSocket:', wsUrl)

      websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        console.log('WebSocket连接成功')
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const kline = data.k

          if (kline && candlestickSeries && volumeSeries) {
            const isTimeSeries = props.interval === 'time'

            // 根据图表类型更新数据
            let newKlineData
            if (isTimeSeries) {
              // 分时图：只需要价格值
              newKlineData = {
                time: Math.floor(kline.t / 1000), // 转换为秒
                value: parseFloat(kline.c) // 分时图使用收盘价作为当前价格
              }
            } else {
              // K线图：需要OHLC数据
              newKlineData = {
                time: Math.floor(kline.t / 1000), // 转换为秒
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c)
              }
            }

            // 更新成交量数据 - 使用真实买入/卖出量 (单位: base asset)
            const totalVolume = parseFloat(kline.v)
            const buyVolume = parseFloat(kline.V) // 主动买入量 (base asset)
            const sellVolume = totalVolume - buyVolume // 卖出量 (base asset)

            const newVolumeData = {
              time: Math.floor(kline.t / 1000),
              value: totalVolume,
              buyVolume: buyVolume,
              sellVolume: sellVolume,
              quoteVolume: parseFloat(kline.q), // 成交额
              color: parseFloat(kline.c) >= parseFloat(kline.o) ? '#0ECB81' : '#F6465D'
            }

            // 更新图表数据
            candlestickSeries.update(newKlineData)
            volumeSeries.update(newVolumeData)

            // 更新chartEventBus数据
            chartEventBus.updateRealtimeData(newKlineData, newVolumeData)
          }
        } catch (error) {
          console.error('WebSocket数据解析错误:', error)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket连接错误:', error)
      }

      websocket.onclose = () => {
        console.log('WebSocket连接关闭')
      }
    }

    // 断开WebSocket连接
    const disconnectWebSocket = () => {
      if (websocket) {
        websocket.close()
        websocket = null
        console.log('🔌 WebSocket连接已断开')
      }
    }

    const initChart = async () => {
      if (!mainChartContainer.value || !volumeChartContainer.value) return

      // 检查chartEventBus状态
      if (!chartEventBus || !chartEventBus.state) {
        console.error('❌ chartEventBus未正确初始化')
        return
      }

      // 清理旧图表
      if (mainChart) {
        mainChart.remove()
        mainChart = null
      }
      if (volumeChart) {
        volumeChart.remove()
        volumeChart = null
      }

      // 获取数据
      const { klineData, volumeData, isTimeSeries } = await fetchBinanceKlineData(props.symbol, props.interval)

      if (!klineData || !volumeData || klineData.length === 0) {
        console.error('❌ 获取的数据为空')
        return
      }

      console.log('✅ 数据获取成功:', { klineData: klineData.length, volumeData: volumeData.length, isTimeSeries })

      // 创建主图表
      mainChart = createChart(mainChartContainer.value, {
        width: mainChartContainer.value.clientWidth,
        height: Math.floor(props.height * 0.7), // 70%给主图
        layout: {
          background: { color: '#1a1a1a' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#2B2B43' },
          horzLines: { color: '#2B2B43' },
        },
        crosshair: {
          mode: 0, // 正常十字线模式
          vertLine: {
            width: 1,
            color: 'rgba(255, 255, 255, 0.5)',
            style: 0, // 实线
          },
          horzLine: {
            width: 1,
            color: 'rgba(255, 255, 255, 0.5)',
            style: 0, // 实线
          },
        },
        rightPriceScale: {
          borderColor: '#485c7b',
          minimumWidth: 30,
          fontSize: 8,
        },
        timeScale: {
          borderColor: '#485c7b',
          visible: false, // 主图不显示时间轴
        },
        handleScroll: {
          mouseWheel: false, // 禁用鼠标滚轮滚动
          pressedMouseMove: true, // 允许按住鼠标拖拽
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: false, // 禁用坐标轴拖拽缩放
          mouseWheel: true, // 启用鼠标滚轮缩放
          pinch: true, // 启用触摸缩放（移动端）
        },
        leftPriceScale: {
          visible: false, // 左侧价格刻度默认隐藏
        },
      })

      // 创建成交量图表
      volumeChart = createChart(volumeChartContainer.value, {
        width: volumeChartContainer.value.clientWidth,
        height: Math.floor(props.height * 0.3), // 30%给成交量图
        layout: {
          background: { color: '#1a1a1a' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: {
            color: '#2B2B43',
            style: 0, // 实线
            visible: true
          },
          horzLines: {
            color: '#2B2B43',
            style: 0, // 实线
            visible: true
          },
        },
        crosshair: {
          mode: 0, // 正常十字线模式
          vertLine: {
            width: 1,
            color: 'rgba(255, 255, 255, 0.5)',
            style: 0, // 实线
          },
          horzLine: {
            width: 1,
            color: 'rgba(255, 255, 255, 0.5)',
            style: 0, // 实线
          },
        },
        rightPriceScale: {
          borderColor: '#485c7b',
          visible: true,
          minimumWidth: 30,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          textColor: '#d1d4dc',
          fontSize: 8,
        },
        timeScale: {
          borderColor: '#485c7b',
          visible: true, // 显示时间轴
          timeVisible: true,
          secondsVisible: false,
        },
        // 修复时间格式显示
        localization: {
          timeFormatter: (time) => {
            const date = new Date(time * 1000)
            return moment(date).format('YYYY/MM/DD HH:mm')
          },
        },
        handleScroll: {
          mouseWheel: true, // 允许鼠标滚轮滚动
          pressedMouseMove: true, // 允许按住鼠标拖拽
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: false, // 禁用坐标轴拖拽缩放
          mouseWheel: false, // 禁用鼠标滚轮缩放
          pinch: true, // 启用触摸缩放（移动端）
        },
      })

      // 根据图表类型创建系列
      if (isTimeSeries) {
        // 分时图使用线图
        candlestickSeries = mainChart.addLineSeries({
          color: '#2196F3',
          lineWidth: 2,
        })
      } else {
        // K线图使用蜡烛图
        candlestickSeries = mainChart.addCandlestickSeries({
          upColor: '#0ECB81',
          downColor: '#F6465D',
          borderDownColor: '#F6465D',
          borderUpColor: '#0ECB81',
          wickDownColor: '#F6465D',
          wickUpColor: '#0ECB81',
        })
      }

      // 创建成交量系列
      volumeSeries = volumeChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'custom',
          formatter: (price) => formatVolumeValue(price),
          minMove: 0.01,
        },
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.1,
          bottom: 0,
        },
      })

      try {
        // 动态配置价格格式
        if (klineData.length > 0) {
          const samplePrice = klineData[klineData.length - 1].close || klineData[klineData.length - 1].value
          const priceFormat = calculatePriceFormat(samplePrice)

          // 更新K线系列的价格格式
          candlestickSeries.applyOptions({
            priceFormat: priceFormat
          })

          // 更新主图价格刻度的格式
          mainChart.priceScale('right').applyOptions({
            minimumWidth: 30, // 保持最小宽度
          })

          console.log(`动态价格格式配置: 价格=${samplePrice}, precision=${priceFormat.precision}, minMove=${priceFormat.minMove}`)
        }

        // 设置K线数据
        candlestickSeries.setData(klineData)
        console.log('K线数据设置成功！')

        // 设置成交量数据
        volumeSeries.setData(volumeData)
        console.log('成交量数据设置成功！')

        // 为成交量图表右侧价格刻度应用格式化函数
        volumeChart.priceScale('right').applyOptions({
          formatter: (price) => formatVolumeValue(price),
        })
        console.log('成交量Y轴格式化函数设置成功！')

        // 更新成交量信息和价格信息
        const lastKlineData = klineData[klineData.length - 1]
        const currentPrice = lastKlineData ? (lastKlineData.close || lastKlineData.value || 0) : 0
        updateVolumeInfo(volumeData, currentPrice)

        // 初始化价格信息显示
        if (lastKlineData) {
          const isTimeSeries = props.interval === 'time'
          let open, high, low, close

          if (isTimeSeries) {
            // 分时图：只有价格值，构造OHLC显示
            const price = lastKlineData.value || 0
            open = high = low = close = price
          } else {
            // K线图：有完整的OHLC数据
            open = lastKlineData.open || 0
            high = lastKlineData.high || 0
            low = lastKlineData.low || 0
            close = lastKlineData.close || 0
          }

          // 计算涨跌额和涨跌幅
          const change = close - open
          const changePercent = open !== 0 ? (change / open) * 100 : 0

          // 计算振幅
          const amplitude = open !== 0 ? ((high - low) / open) * 100 : 0

          chartEventBus.state.priceInfo = {
            open,
            high,
            low,
            close,
            change: Number(change.toFixed(4)),
            changePercent: Number(changePercent.toFixed(2)),
            amplitude: Number(amplitude.toFixed(2))
          }
        }

        // 同步时间轴
        mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
          const timeRange = mainChart.timeScale().getVisibleRange()
          if (timeRange) {
            volumeChart.timeScale().setVisibleRange(timeRange)
          }
        })

        volumeChart.timeScale().subscribeVisibleTimeRangeChange(() => {
          const timeRange = volumeChart.timeScale().getVisibleRange()
          if (timeRange) {
            mainChart.timeScale().setVisibleRange(timeRange)
          }
        })

        // 添加图表点击监听（移动端）- 用于显示十字线和价格面板
        mainChart.subscribeClick((param) => {
          handleChartClick(param, 'main')
        })

        volumeChart.subscribeClick((param) => {
          handleChartClick(param, 'volume')
        })

        // 添加图表外部点击监听，用于隐藏价格面板
        document.addEventListener('click', (event) => {
          const chartContainer = mainChartContainer.value
          if (chartContainer && !chartContainer.contains(event.target)) {
            hidePriceInfo()
          }
        })

        // 设置EventBus - 确保在数据设置后再设置EventBus
        chartEventBus.setCharts(mainChart, volumeChart)
        chartEventBus.setSeries(candlestickSeries, volumeSeries)
        chartEventBus.setData(klineData, volumeData)

        // 等待一个tick确保图表完全初始化
        await nextTick()

        // 重新添加之前激活的所有指标
        const activeIndicators = chartEventBus.state?.activeIndicators ? [...chartEventBus.state.activeIndicators] : ['MA']
        console.log('🔄 重新添加激活的指标:', activeIndicators)

        // 如果没有激活的指标，添加默认MA指标
        if (activeIndicators.length === 0) {
          activeIndicators.push('MA')
        }

        // 先清空指标系列和状态
        try {
          Object.keys(chartEventBus.indicatorSeries || {}).forEach(key => {
            const series = chartEventBus.indicatorSeries[key]
            if (series && mainChart) {
              try {
                if (typeof series.removeSeries === 'function' || series.setData) {
                  // 单个series
                  mainChart.removeSeries(series)
                } else if (typeof series === 'object') {
                  // 多个series
                  Object.values(series).forEach(s => {
                    if (s && typeof s === 'object') {
                      mainChart.removeSeries(s)
                    }
                  })
                }
              } catch (error) {
                console.warn(`移除指标系列失败 ${key}:`, error)
              }
            }
          })
          chartEventBus.indicatorSeries = {}
        } catch (error) {
          console.warn('清空指标系列失败:', error)
          chartEventBus.indicatorSeries = {}
        }

        // 清空activeIndicators状态
        if (chartEventBus.state?.activeIndicators) {
          chartEventBus.state.activeIndicators.length = 0
        }

        // 重新添加所有指标（这会自动更新activeIndicators状态）
        activeIndicators.forEach(indicator => {
          try {
            if (chartEventBus.state?.activeIndicators) {
              chartEventBus.state.activeIndicators.push(indicator)
            }
            chartEventBus.addIndicator(indicator)
          } catch (error) {
            console.error(`添加指标失败 ${indicator}:`, error)
          }
        })

        // 启动WebSocket实时数据连接
        connectWebSocket(props.symbol, props.interval)

        // 设置价格刻度宽度同步
        setupPriceScaleWidthSync()

        console.log('移动端图表初始化完成！')
      } catch (error) {
        console.error('❌ 移动端图表创建失败:', error)
      }
    }

    // 成交量格式化函数
    const formatVolumeValue = (value) => {
      if (value === 0) return '0'

      const absValue = Math.abs(value)

      if (absValue >= 1000000000) {
        // 十亿以上显示为 B
        return (value / 1000000000).toFixed(2) + 'B'
      } else if (absValue >= 1000000) {
        // 百万以上显示为 M
        return (value / 1000000).toFixed(2) + 'M'
      } else if (absValue >= 1000) {
        // 千以上显示为 K
        return (value / 1000).toFixed(2) + 'K'
      } else {
        // 小于1000直接显示
        return value.toFixed(2)
      }
    }

    // 根据价格范围动态计算价格格式
    const calculatePriceFormat = (samplePrice) => {
      if (samplePrice >= 10000) {
        // 高价币种 (BTC等): 价格 >= 10000
        return {
          type: 'price',
          precision: 2,
          minMove: 0.01
        }
      } else if (samplePrice >= 1) {
        // 中价币种 (ETH, BNB等): 1 <= 价格 < 10000
        return {
          type: 'price',
          precision: 2,
          minMove: 0.01
        }
      } else if (samplePrice >= 0.1) {
        // 低价币种: 0.1 <= 价格 < 1
        return {
          type: 'price',
          precision: 4,
          minMove: 0.0001
        }
      } else if (samplePrice >= 0.01) {
        // 极低价币种: 0.01 <= 价格 < 0.1
        return {
          type: 'price',
          precision: 5,
          minMove: 0.00001
        }
      } else {
        // 超低价币种: 价格 < 0.01
        return {
          type: 'price',
          precision: 6,
          minMove: 0.000001
        }
      }
    }

    // ResizeObserver实例，需要在组件卸载时清理
    let priceScaleResizeObserver = null

    // 设置价格刻度宽度同步
    const setupPriceScaleWidthSync = () => {
      if (!mainChart || !volumeChart) {
        console.warn('图表未初始化，跳过价格刻度宽度同步')
        return
      }

      try {
        // 强制设置两个图表的价格刻度为相同宽度
        const targetWidth = 50 // 统一宽度

        // 同时设置主图和成交量图的价格刻度宽度
        mainChart.priceScale('right').applyOptions({
          minimumWidth: targetWidth,
          fontSize: 8
        })

        volumeChart.priceScale('right').applyOptions({
          minimumWidth: targetWidth,
          fontSize: 8
        })

        console.log('✅ 价格刻度宽度同步完成:', targetWidth)

        // 延迟再次同步，确保宽度一致
        setTimeout(() => {
          try {
            const mainWidth = mainChart.priceScale('right').width()
            const volumeWidth = volumeChart.priceScale('right').width()

            if (mainWidth !== volumeWidth) {
              const maxWidth = Math.max(mainWidth, volumeWidth)
              mainChart.priceScale('right').applyOptions({ minimumWidth: maxWidth })
              volumeChart.priceScale('right').applyOptions({ minimumWidth: maxWidth })
              console.log('✅ 二次同步价格刻度宽度:', maxWidth)
            }
          } catch (error) {
            console.warn('二次同步失败:', error)
          }
        }, 100)

      } catch (error) {
        console.warn('价格刻度宽度同步失败:', error)
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

      // 重新同步价格刻度宽度
      setTimeout(() => {
        setupPriceScaleWidthSync()
      }, 100)
    }

    // 监听props变化
    watch(() => props.symbol, (newSymbol) => {
      console.log('交易对变化:', newSymbol)
      disconnectWebSocket()
      initChart()
    })

    watch(() => props.interval, (newInterval) => {
      console.log('时间周期变化:', newInterval)
      disconnectWebSocket()
      initChart()
    })

    // 生命周期管理
    onMounted(async () => {
      console.log('移动端K线图组件挂载')
      await nextTick()
      initChart()
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      console.log('移动端K线图组件卸载')

      // 断开WebSocket连接
      disconnectWebSocket()

      // 清理ResizeObserver
      if (priceScaleResizeObserver) {
        priceScaleResizeObserver.disconnect()
        priceScaleResizeObserver = null
      }

      // 移除事件监听器
      window.removeEventListener('resize', handleResize)

      // 清理图表实例
      if (mainChart) {
        mainChart.remove()
        mainChart = null
      }
      if (volumeChart) {
        volumeChart.remove()
        volumeChart = null
      }

      console.log('移动端K线图清理完成')
    })

    return {
      mainChartContainer,
      volumeChartContainer,
      volumeInfo,
      currentTime,
      priceInfo,
      indicatorInfo,
      showMA,
      showEMA,
      showBOLL,
      showSAR,
      showPriceInfo,
      panelPosition,
      panelStyle
    }
  }
}

</script>

<style scoped>
.mobile-kline-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  overflow: hidden;
}

/* MA指标面板 - 固定在左上角 */
.indicator-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.8);
  border-radius: 4px;
  padding: 6px 10px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 价格信息面板 - 跟随十字线位置 */
.price-info-panel {
  position: absolute;
  top: 8px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.9);
  border-radius: 6px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  width: 140px; /* 固定宽度，形成方形布局 */
  transition: all 0.2s ease; /* 平滑过渡动画 */
}

.price-info-panel.panel-left {
  left: 8px;
  right: auto;
}

.price-info-panel.panel-right {
  left: auto;
  right: 8px;
}

.price-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-info {
  color: #FFF;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.change-info {
  font-weight: 500;
}

.positive {
  color: #0ECB81;
}

.negative {
  color: #F6465D;
}

.indicator-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.indicator-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* 主图表容器 */
.main-chart-container {
  flex: 7;
  min-height: 200px;
  background: #1a1a1a;
  position: relative;
  margin-top: 40px; /* 为MA指标面板留出空间 */
}

/* 成交量图表容器 */
.volume-chart-container {
  flex: 3;
  min-height: 100px;
  background: #1a1a1a;
  position: relative;
}

/* 成交量信息面板 */
.volume-info-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.8);
  border-radius: 4px;
  padding: 6px 10px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.volume-info {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 10px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.volume-label {
  color: #888;
}

.volume-btc,
.volume-usdt,
.volume-buy,
.volume-sell {
  color: #fff;
  font-weight: 500;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .price-info {
    font-size: 10px;
    gap: 6px 8px;
  }

  .time-info {
    font-size: 9px;
  }

  .indicator-group {
    font-size: 9px;
    gap: 6px;
  }

  .volume-info {
    font-size: 9px;
    gap: 4px 8px;
  }

  .main-chart-container {
    margin-top: 70px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .price-info-panel {
    padding: 6px 8px;
  }

  .price-info {
    font-size: 9px;
    gap: 4px 6px;
  }

  .time-info {
    font-size: 8px;
    padding: 1px 4px;
  }

  .indicator-group {
    font-size: 8px;
    gap: 4px;
  }

  .volume-info-panel {
    padding: 4px 6px;
  }

  .volume-info {
    font-size: 8px;
    gap: 3px 6px;
  }

  .main-chart-container {
    margin-top: 60px;
  }
}
</style>
