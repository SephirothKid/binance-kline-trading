import { ref, reactive } from 'vue'

// 创建全局的图表状态管理
class ChartEventBus {
  constructor() {
    // 图表实例
    this.mainChart = null
    this.volumeChart = null
    
    // 系列实例
    this.candlestickSeries = null
    this.volumeSeries = null
    this.indicatorSeries = {}
    
    // 响应式状态
    this.state = reactive({
      // 价格信息
      priceInfo: {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        change: 0,        // 涨跌额
        changePercent: 0, // 涨跌幅
        amplitude: 0      // 振幅
      },
      
      // 指标信息
      indicatorInfo: {
        ma7: 0,
        ma25: 0,
        ma99: 0,
        ema12: 0,
        ema26: 0,
        bollUpper: 0,
        bollMiddle: 0,
        bollLower: 0,
        sar: 0,
        rsi: 0,
        macdMacd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        kdjK: 0,
        kdjD: 0,
        kdjJ: 0
      },
      
      // 当前激活的指标
      activeIndicators: ['MA'],
      
      // 数据
      klineData: [],
      volumeData: [],
      
      // 十字线位置
      crosshairPosition: null
    })
  }
  
  // 根据时间获取当前数据
  getCurrentData(time) {
    if (!time || !this.state.klineData.length || !this.state.volumeData.length) {
      return null
    }

    // 查找对应时间的K线数据
    const klineItem = this.state.klineData.find(item => item.time === time)
    const volumeItem = this.state.volumeData.find(item => item.time === time)

    if (klineItem && volumeItem) {
      // 判断是否为分时图数据（只有value，没有OHLC）
      const isTimeSeries = klineItem.value !== undefined && klineItem.open === undefined

      if (isTimeSeries) {
        // 分时图数据：使用value作为所有价格
        const price = klineItem.value
        return {
          time: time,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volumeItem.value,
          buyVolume: volumeItem.buyVolume || 0,
          sellVolume: volumeItem.sellVolume || 0,
          quoteVolume: volumeItem.quoteVolume || 0
        }
      } else {
        // K线图数据：使用OHLC
        return {
          time: time,
          open: klineItem.open,
          high: klineItem.high,
          low: klineItem.low,
          close: klineItem.close,
          volume: volumeItem.value,
          buyVolume: volumeItem.buyVolume || 0,
          sellVolume: volumeItem.sellVolume || 0,
          quoteVolume: volumeItem.quoteVolume || 0
        }
      }
    }

    return null
  }

  // 设置图表实例
  setCharts(mainChart, volumeChart) {
    this.mainChart = mainChart
    this.volumeChart = volumeChart
    this.setupCrosshairSync()
  }
  
  // 设置系列实例
  setSeries(candlestickSeries, volumeSeries) {
    this.candlestickSeries = candlestickSeries
    this.volumeSeries = volumeSeries
  }
  
  // 设置数据
  setData(klineData, volumeData) {
    this.state.klineData = klineData
    this.state.volumeData = volumeData

    // 清除旧的指标数据，重新计算
    this.clearIndicatorData()

    // 重新计算所有活跃指标
    this.state.activeIndicators.forEach(indicator => {
      this.calculateIndicator(indicator)
    })

    // 初始化显示最新数据
    if (klineData.length > 0) {
      const latest = klineData[klineData.length - 1]
      this.updatePriceInfo(latest, klineData.length - 1)
    }
  }

  // 清除指标数据
  clearIndicatorData() {
    this.state.maData = { ma7: [], ma25: [], ma99: [] }
    this.state.emaData = { ema12: [], ema26: [] }
    this.state.bollData = { upper: [], middle: [], lower: [] }
    this.state.sarData = []
    this.state.rsiData = []
    this.state.macdData = { macd: [], signal: [], histogram: [] }
    this.state.kdjData = { k: [], d: [], j: [] }
  }

  // 计算指标
  calculateIndicator(indicator) {
    switch (indicator) {
      case 'MA':
        this.addMAIndicator()
        break
      case 'EMA':
        this.addEMAIndicator()
        break
      case 'BOLL':
        this.addBOLLIndicator()
        break
      case 'SAR':
        this.addSARIndicator()
        break
    }
  }

  // 更新实时数据
  updateRealtimeData(newKlineData, newVolumeData) {
    if (!this.state.klineData.length || !this.state.volumeData.length) {
      return
    }

    // 查找是否已存在相同时间的数据
    const klineIndex = this.state.klineData.findIndex(item => item.time === newKlineData.time)
    const volumeIndex = this.state.volumeData.findIndex(item => item.time === newVolumeData.time)

    if (klineIndex >= 0) {
      // 更新现有数据
      this.state.klineData[klineIndex] = newKlineData
    } else {
      // 添加新数据
      this.state.klineData.push(newKlineData)
    }

    if (volumeIndex >= 0) {
      // 更新现有数据
      this.state.volumeData[volumeIndex] = newVolumeData
    } else {
      // 添加新数据
      this.state.volumeData.push(newVolumeData)
    }

    // 保持数据长度不超过1000条
    if (this.state.klineData.length > 1000) {
      this.state.klineData.shift()
    }
    if (this.state.volumeData.length > 1000) {
      this.state.volumeData.shift()
    }
  }
  
  // 设置十字线同步
  setupCrosshairSync() {
    if (!this.mainChart || !this.volumeChart) {
      console.warn('图表未初始化，跳过十字线同步设置')
      return
    }

    try {
      // 主图十字线事件
      this.mainChart.subscribeCrosshairMove(param => {
        this.handleCrosshairMove(param)

        // 同步成交量图的十字线
        if (param.point && this.volumeChart) {
          try {
            this.volumeChart.setCrosshairPosition(param.point.x, param.point.y)
          } catch (error) {
            console.warn('成交量图十字线同步失败:', error)
          }
        }
      })

      // 时间轴同步
      this.mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!this.volumeChart) return
        try {
          const range = this.mainChart.timeScale().getVisibleRange()
          if (range) {
            this.volumeChart.timeScale().setVisibleRange(range)
          }
        } catch (error) {
          console.warn('主图到成交量图时间轴同步失败:', error)
        }
      })

      this.volumeChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!this.mainChart) return
        try {
          const range = this.volumeChart.timeScale().getVisibleRange()
          if (range) {
            this.mainChart.timeScale().setVisibleRange(range)
          }
        } catch (error) {
          console.warn('成交量图到主图时间轴同步失败:', error)
        }
      })

      console.log('✅ 十字线同步设置完成')
    } catch (error) {
      console.error('❌ 十字线同步设置失败:', error)
    }
  }
  
  // 处理十字线移动
  handleCrosshairMove(param) {
    this.state.crosshairPosition = param
    
    if (param.point && param.time) {
      const klineItem = this.state.klineData.find(item => item.time === param.time)
      if (klineItem) {
        const dataIndex = this.state.klineData.findIndex(item => item.time === param.time)
        this.updatePriceInfo(klineItem, dataIndex)
      }
    } else {
      // 显示最新数据
      if (this.state.klineData.length > 0) {
        const latest = this.state.klineData[this.state.klineData.length - 1]
        this.updatePriceInfo(latest, this.state.klineData.length - 1)
      }
    }
  }
  
  // 更新价格信息
  updatePriceInfo(klineItem, dataIndex) {
    // 判断是否为分时图数据
    const isTimeSeries = klineItem.value !== undefined && klineItem.open === undefined

    let open, high, low, close

    if (isTimeSeries) {
      // 分时图：使用value作为所有价格
      const price = klineItem.value
      open = high = low = close = price
    } else {
      // K线图：使用OHLC
      open = klineItem.open
      high = klineItem.high
      low = klineItem.low
      close = klineItem.close
    }

    // 计算涨跌额和涨跌幅
    const change = close - open
    const changePercent = open !== 0 ? (change / open) * 100 : 0

    // 计算振幅
    const amplitude = open !== 0 ? ((high - low) / open) * 100 : 0

    this.state.priceInfo = {
      open,
      high,
      low,
      close,
      change: Number(change.toFixed(4)),
      changePercent: Number(changePercent.toFixed(2)),
      amplitude: Number(amplitude.toFixed(2))
    }

    // 更新指标信息
    this.updateIndicatorInfo(dataIndex)
  }
  
  // 更新指标信息
  updateIndicatorInfo(dataIndex) {
    const data = this.state.klineData
    if (dataIndex < 0 || dataIndex >= data.length) return
    
    this.state.indicatorInfo = {
      ma7: this.calculateMAValue(data, dataIndex, 7),
      ma25: this.calculateMAValue(data, dataIndex, 25),
      ma99: this.calculateMAValue(data, dataIndex, 99),
      ema12: this.calculateEMAValue(data, dataIndex, 12),
      ema26: this.calculateEMAValue(data, dataIndex, 26),
      // BOLL指标计算
      ...this.calculateBOLLValue(data, dataIndex, 20, 2)
    }
  }
  
  // 计算MA值
  calculateMAValue(data, index, period) {
    if (index < period - 1) return 0
    let sum = 0
    for (let j = 0; j < period; j++) {
      const item = data[index - j]
      // 判断是分时图还是K线图数据
      const price = item.close !== undefined ? item.close : item.value
      sum += price
    }
    const result = sum / period
    // 根据价格范围决定精度
    if (result < 1) {
      return Number(result.toFixed(8))
    } else if (result < 100) {
      return Number(result.toFixed(4))
    } else {
      return Number(result.toFixed(4))
    }
  }
  
  // 计算EMA值
  calculateEMAValue(data, index, period) {
    if (index < period - 1) return 0

    const multiplier = 2 / (period + 1)
    // 判断是分时图还是K线图数据
    const firstPrice = data[period - 1].close !== undefined ? data[period - 1].close : data[period - 1].value
    let ema = firstPrice

    for (let i = period; i <= index; i++) {
      const price = data[i].close !== undefined ? data[i].close : data[i].value
      ema = (price * multiplier) + (ema * (1 - multiplier))
    }

    // 根据价格范围决定精度
    if (ema < 1) {
      return Number(ema.toFixed(8))
    } else if (ema < 100) {
      return Number(ema.toFixed(4))
    } else {
      return Number(ema.toFixed(4))
    }
  }
  
  // 计算BOLL值
  calculateBOLLValue(data, index, period, multiplier) {
    if (index < period - 1) {
      return { bollUpper: 0, bollMiddle: 0, bollLower: 0 }
    }

    // 计算中轨（MA）
    let sum = 0
    for (let j = 0; j < period; j++) {
      const item = data[index - j]
      // 判断是分时图还是K线图数据
      const price = item.close !== undefined ? item.close : item.value
      sum += price
    }
    const middle = sum / period

    // 计算标准差
    let variance = 0
    for (let j = 0; j < period; j++) {
      const item = data[index - j]
      const price = item.close !== undefined ? item.close : item.value
      variance += Math.pow(price - middle, 2)
    }
    const stdDev = Math.sqrt(variance / period)

    return {
      bollUpper: Number((middle + multiplier * stdDev).toFixed(4)),
      bollMiddle: Number(middle.toFixed(4)),
      bollLower: Number((middle - multiplier * stdDev).toFixed(4))
    }
  }
  
  // 切换指标
  toggleIndicator(indicator) {
    const index = this.state.activeIndicators.indexOf(indicator)
    if (index > -1) {
      this.state.activeIndicators.splice(index, 1)
      this.removeIndicator(indicator)
    } else {
      this.state.activeIndicators.push(indicator)
      this.addIndicator(indicator)
    }
  }
  
  // 添加指标
  addIndicator(indicator) {
    if (!this.mainChart || !this.state.klineData.length) {
      console.warn(`无法添加指标 ${indicator}: 图表未初始化或数据为空`)
      return
    }

    try {
      console.log(`🔄 添加指标: ${indicator}`)
      switch (indicator) {
        case 'MA':
          this.addMAIndicator()
          break
        case 'EMA':
          this.addEMAIndicator()
          break
        case 'BOLL':
          this.addBOLLIndicator()
          break
        case 'SAR':
          this.addSARIndicator()
          break
        case 'RSI':
          this.addRSIIndicator()
          break
        case 'MACD':
          this.addMACDIndicator()
          break
        case 'KDJ':
          this.addKDJIndicator()
          break
        case 'VOL':
          this.addVOLIndicator()
          break
        case 'OBV':
          this.addOBVIndicator()
          break
        case 'CCI':
          this.addCCIIndicator()
          break
        case 'WMA':
          this.addWMAIndicator()
          break
        case 'VWAP':
          this.addVWAPIndicator()
          break
        case 'AVL':
          this.addAVLIndicator()
          break
        case 'TRIX':
          this.addTRIXIndicator()
          break
        default:
          console.warn(`未知指标: ${indicator}`)
      }
      console.log(`✅ 指标 ${indicator} 添加成功`)
    } catch (error) {
      console.error(`❌ 添加指标 ${indicator} 失败:`, error)
    }
  }
  
  // 移除指标
  removeIndicator(indicator) {
    if (!this.mainChart) {
      console.warn(`无法移除指标 ${indicator}: 图表未初始化`)
      return
    }

    try {
      const seriesKey = indicator.toLowerCase()
      if (this.indicatorSeries[seriesKey]) {
        // 检查是否是单个series（如SAR、RSI、OBV、CCI）还是多个series（如MA、EMA、BOLL）
        if (typeof this.indicatorSeries[seriesKey].removeSeries === 'function' ||
            this.indicatorSeries[seriesKey].setData) {
          // 单个series
          this.mainChart.removeSeries(this.indicatorSeries[seriesKey])
        } else {
          // 多个series
          Object.values(this.indicatorSeries[seriesKey]).forEach(series => {
            if (series) {
              this.mainChart.removeSeries(series)
            }
          })
        }
        delete this.indicatorSeries[seriesKey]
        console.log(`✅ 指标 ${indicator} 移除成功`)
      }
    } catch (error) {
      console.error(`❌ 移除指标 ${indicator} 失败:`, error)
    }
  }
  
  // 添加MA指标
  addMAIndicator() {
    try {
      const ma7Data = this.calculateMA(this.state.klineData, 7)
      const ma25Data = this.calculateMA(this.state.klineData, 25)
      const ma99Data = this.calculateMA(this.state.klineData, 99)

      this.indicatorSeries.ma = {
        ma7: this.mainChart.addLineSeries({
          color: '#FF6B6B',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        ma25: this.mainChart.addLineSeries({
          color: '#4ECDC4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        ma99: this.mainChart.addLineSeries({
          color: '#45B7D1',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        })
      }

      this.indicatorSeries.ma.ma7.setData(ma7Data)
      this.indicatorSeries.ma.ma25.setData(ma25Data)
      this.indicatorSeries.ma.ma99.setData(ma99Data)

      console.log('✅ MA指标添加成功')
    } catch (error) {
      console.error('❌ MA指标添加失败:', error)
    }
  }
  
  // 添加EMA指标
  addEMAIndicator() {
    try {
      const ema12Data = this.calculateEMA(this.state.klineData, 12)
      const ema26Data = this.calculateEMA(this.state.klineData, 26)

      this.indicatorSeries.ema = {
        ema12: this.mainChart.addLineSeries({
          color: '#FFA500',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        ema26: this.mainChart.addLineSeries({
          color: '#9370DB',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        })
      }

      this.indicatorSeries.ema.ema12.setData(ema12Data)
      this.indicatorSeries.ema.ema26.setData(ema26Data)

      console.log('✅ EMA指标添加成功')
    } catch (error) {
      console.error('❌ EMA指标添加失败:', error)
    }
  }

  // 添加BOLL指标
  addBOLLIndicator() {
    try {
      const bollData = this.calculateBOLL(this.state.klineData, 20, 2)

      this.indicatorSeries.boll = {
        upper: this.mainChart.addLineSeries({
          color: '#FF69B4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        middle: this.mainChart.addLineSeries({
          color: '#FFD700',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        lower: this.mainChart.addLineSeries({
          color: '#FF69B4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        })
      }

      this.indicatorSeries.boll.upper.setData(bollData.upper)
      this.indicatorSeries.boll.middle.setData(bollData.middle)
      this.indicatorSeries.boll.lower.setData(bollData.lower)

      console.log('✅ BOLL指标添加成功')
    } catch (error) {
      console.error('❌ BOLL指标添加失败:', error)
    }
  }
  
  // 计算MA数据
  calculateMA(data, period) {
    const result = []
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        const item = data[i - j]
        // 判断是分时图还是K线图数据
        const price = item.close !== undefined ? item.close : item.value
        sum += price
      }
      const maValue = sum / period
      // 根据价格范围决定精度
      let formattedValue
      if (maValue < 1) {
        formattedValue = Number(maValue.toFixed(4))
      } else if (maValue < 100) {
        formattedValue = Number(maValue.toFixed(2))
      } else {
        formattedValue = Number(maValue.toFixed(2))
      }

      result.push({
        time: data[i].time,
        value: formattedValue
      })
    }
    return result
  }
  
  // 计算EMA数据
  calculateEMA(data, period) {
    const result = []
    const multiplier = 2 / (period + 1)
    // 判断是分时图还是K线图数据
    const firstPrice = data[period - 1].close !== undefined ? data[period - 1].close : data[period - 1].value
    let ema = firstPrice

    // 根据价格范围决定精度
    let formattedValue
    if (ema < 1) {
      formattedValue = Number(ema.toFixed(4))
    } else if (ema < 100) {
      formattedValue = Number(ema.toFixed(2))
    } else {
      formattedValue = Number(ema.toFixed(2))
    }
    result.push({ time: data[period - 1].time, value: formattedValue })

    for (let i = period; i < data.length; i++) {
      const price = data[i].close !== undefined ? data[i].close : data[i].value
      ema = (price * multiplier) + (ema * (1 - multiplier))

      // 根据价格范围决定精度
      if (ema < 1) {
        formattedValue = Number(ema.toFixed(4))
      } else if (ema < 100) {
        formattedValue = Number(ema.toFixed(2))
      } else {
        formattedValue = Number(ema.toFixed(2))
      }
      result.push({ time: data[i].time, value: formattedValue })
    }

    return result
  }
  
  // 计算BOLL数据
  calculateBOLL(data, period, multiplier) {
    const upper = []
    const middle = []
    const lower = []

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        const item = data[i - j]
        // 判断是分时图还是K线图数据
        const price = item.close !== undefined ? item.close : item.value
        sum += price
      }
      const ma = sum / period

      let variance = 0
      for (let j = 0; j < period; j++) {
        const item = data[i - j]
        const price = item.close !== undefined ? item.close : item.value
        variance += Math.pow(price - ma, 2)
      }
      const stdDev = Math.sqrt(variance / period)

      const time = data[i].time
      upper.push({ time, value: Number((ma + multiplier * stdDev).toFixed(2)) })
      middle.push({ time, value: Number(ma.toFixed(2)) })
      lower.push({ time, value: Number((ma - multiplier * stdDev).toFixed(2)) })
    }
    
    return { upper, middle, lower }
  }

  // 添加SAR指标
  addSARIndicator() {
    try {
      const sarData = this.calculateSAR(this.state.klineData, 0.02, 0.2)

      console.log('SAR数据长度:', sarData.length)
      console.log('SAR数据前5个:', sarData.slice(0, 5))

      // 使用LineSeries，设置很细的线条和明显的点标记
      this.indicatorSeries.sar = this.mainChart.addLineSeries({
        color: '#FF6B35',
        lineWidth: 1, // 很细的线条
        lineStyle: 3, // 点线样式
        priceLineVisible: false,
        lastValueVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5, // 较大的点
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 6
      })

      this.indicatorSeries.sar.setData(sarData)
      this.state.sarData = sarData

      console.log('✅ SAR指标添加成功，数据点数:', sarData.length)
    } catch (error) {
      console.error('❌ SAR指标添加失败:', error)
    }
  }

  // 计算SAR (Parabolic SAR)
  calculateSAR(data, step = 0.02, maxStep = 0.2) {
    if (data.length < 2) return []

    const result = []
    let isUpTrend = true
    let sar = data[0].low
    let ep = data[0].high // Extreme Point
    let af = step // Acceleration Factor

    result.push({ time: data[0].time, value: Number(sar.toFixed(4)) })

    for (let i = 1; i < data.length; i++) {
      const current = data[i]
      const previous = data[i - 1]

      if (isUpTrend) {
        // 上升趋势
        sar = sar + af * (ep - sar)

        // 确保SAR不高于前两个周期的最低价
        if (i >= 2) {
          sar = Math.min(sar, previous.low, data[i - 2].low)
        } else {
          sar = Math.min(sar, previous.low)
        }

        if (current.high > ep) {
          ep = current.high
          af = Math.min(af + step, maxStep)
        }

        // 检查趋势反转
        if (current.low <= sar) {
          isUpTrend = false
          sar = ep
          ep = current.low
          af = step
        }
      } else {
        // 下降趋势
        sar = sar + af * (ep - sar)

        // 确保SAR不低于前两个周期的最高价
        if (i >= 2) {
          sar = Math.max(sar, previous.high, data[i - 2].high)
        } else {
          sar = Math.max(sar, previous.high)
        }

        if (current.low < ep) {
          ep = current.low
          af = Math.min(af + step, maxStep)
        }

        // 检查趋势反转
        if (current.high >= sar) {
          isUpTrend = true
          sar = ep
          ep = current.high
          af = step
        }
      }

      result.push({ time: current.time, value: Number(sar.toFixed(4)) })
    }

    return result
  }

  // 添加RSI指标
  addRSIIndicator() {
    try {
      const rsiData = this.calculateRSI(this.state.klineData, 14)

      // 先添加series，这会创建价格刻度
      this.indicatorSeries.rsi = this.mainChart.addLineSeries({
        color: '#9C27B0',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'rsi', // 使用独立的价格刻度
      })

      // 现在配置RSI价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('rsi').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      this.indicatorSeries.rsi.setData(rsiData)
      this.state.rsiData = rsiData

      console.log('✅ RSI指标添加成功')
    } catch (error) {
      console.error('❌ RSI指标添加失败:', error)
    }
  }

  // 计算RSI (Relative Strength Index)
  calculateRSI(data, period = 14) {
    if (data.length < period + 1) return []

    const result = []
    const gains = []
    const losses = []

    // 计算价格变化
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }

    // 计算初始平均收益和损失
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period

    // 计算第一个RSI值
    let rs = avgGain / (avgLoss || 1)
    let rsi = 100 - (100 / (1 + rs))
    result.push({ time: data[period].time, value: Number(rsi.toFixed(2)) })

    // 计算后续RSI值
    for (let i = period + 1; i < data.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period

      rs = avgGain / (avgLoss || 1)
      rsi = 100 - (100 / (1 + rs))
      result.push({ time: data[i].time, value: Number(rsi.toFixed(2)) })
    }

    return result
  }

  // 添加MACD指标
  addMACDIndicator() {
    try {
      const macdData = this.calculateMACD(this.state.klineData, 12, 26, 9)

      // 先添加第一个series，这会创建价格刻度
      this.indicatorSeries.macd = {
        macd: this.mainChart.addLineSeries({
          color: '#2196F3',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: 'macd', // 使用独立的价格刻度
        })
      }

      // 现在配置MACD价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('macd').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      // 添加其他series
      this.indicatorSeries.macd.signal = this.mainChart.addLineSeries({
        color: '#FF9800',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'macd' // 使用相同的价格刻度
      })

      this.indicatorSeries.macd.histogram = this.mainChart.addHistogramSeries({
        color: '#4CAF50',
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'macd' // 使用相同的价格刻度
      })

      this.indicatorSeries.macd.macd.setData(macdData.macd)
      this.indicatorSeries.macd.signal.setData(macdData.signal)
      this.indicatorSeries.macd.histogram.setData(macdData.histogram)

      this.state.macdData = macdData

      console.log('✅ MACD指标添加成功')
    } catch (error) {
      console.error('❌ MACD指标添加失败:', error)
    }
  }

  // 计算MACD
  calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (data.length < slowPeriod + signalPeriod) return { macd: [], signal: [], histogram: [] }

    // 计算快速和慢速EMA
    const fastEMA = this.calculateEMAValues(data, fastPeriod)
    const slowEMA = this.calculateEMAValues(data, slowPeriod)

    // 计算MACD线
    const macdLine = []
    for (let i = slowPeriod - 1; i < data.length; i++) {
      const macdValue = fastEMA[i] - slowEMA[i]
      macdLine.push({
        time: data[i].time,
        value: Number(macdValue.toFixed(4))
      })
    }

    // 计算信号线（MACD的EMA）
    const signalLine = this.calculateEMAFromValues(macdLine, signalPeriod)

    // 计算柱状图（MACD - Signal）
    const histogram = []
    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
      const histValue = macdLine[i].value - signalLine[i - signalPeriod + 1].value
      histogram.push({
        time: macdLine[i].time,
        value: Number(histValue.toFixed(4)),
        color: histValue >= 0 ? '#4CAF50' : '#F44336'
      })
    }

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    }
  }

  // 辅助函数：计算EMA数值数组
  calculateEMAValues(data, period) {
    const result = []
    const multiplier = 2 / (period + 1)

    // 第一个值使用SMA
    let ema = data.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period
    result.push(ema)

    // 后续值使用EMA公式
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema
      result.push(ema)
    }

    return result
  }

  // 辅助函数：从数值数组计算EMA
  calculateEMAFromValues(values, period) {
    const result = []
    const multiplier = 2 / (period + 1)

    // 第一个值使用SMA
    let ema = values.slice(0, period).reduce((sum, item) => sum + item.value, 0) / period
    result.push({ time: values[period - 1].time, value: Number(ema.toFixed(4)) })

    // 后续值使用EMA公式
    for (let i = period; i < values.length; i++) {
      ema = (values[i].value - ema) * multiplier + ema
      result.push({ time: values[i].time, value: Number(ema.toFixed(4)) })
    }

    return result
  }

  // 添加KDJ指标
  addKDJIndicator() {
    try {
      const kdjData = this.calculateKDJ(this.state.klineData, 9, 3, 3)

      // 先添加第一个series，这会创建价格刻度
      this.indicatorSeries.kdj = {
        k: this.mainChart.addLineSeries({
          color: '#FF5722',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: 'kdj', // 使用独立的价格刻度
        })
      }

      // 现在配置KDJ价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('kdj').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      // 添加其他series
      this.indicatorSeries.kdj.d = this.mainChart.addLineSeries({
        color: '#3F51B5',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'kdj' // 使用相同的价格刻度
      })

      this.indicatorSeries.kdj.j = this.mainChart.addLineSeries({
        color: '#9C27B0',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'kdj' // 使用相同的价格刻度
      })

      this.indicatorSeries.kdj.k.setData(kdjData.k)
      this.indicatorSeries.kdj.d.setData(kdjData.d)
      this.indicatorSeries.kdj.j.setData(kdjData.j)

      this.state.kdjData = kdjData

      console.log('✅ KDJ指标添加成功')
    } catch (error) {
      console.error('❌ KDJ指标添加失败:', error)
    }
  }

  // 计算KDJ
  calculateKDJ(data, period = 9, kPeriod = 3, dPeriod = 3) {
    if (data.length < period) return { k: [], d: [], j: [] }

    const result = { k: [], d: [], j: [] }
    const rsvValues = []

    // 计算RSV
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1)
      const highest = Math.max(...slice.map(item => item.high))
      const lowest = Math.min(...slice.map(item => item.low))
      const close = data[i].close

      const rsv = ((close - lowest) / (highest - lowest)) * 100
      rsvValues.push(rsv)
    }

    // 计算K、D、J值
    let k = 50, d = 50 // 初始值

    for (let i = 0; i < rsvValues.length; i++) {
      k = (2 * k + rsvValues[i]) / 3
      d = (2 * d + k) / 3
      const j = 3 * k - 2 * d

      const time = data[i + period - 1].time
      result.k.push({ time, value: Number(k.toFixed(2)) })
      result.d.push({ time, value: Number(d.toFixed(2)) })
      result.j.push({ time, value: Number(j.toFixed(2)) })
    }

    return result
  }

  // 添加VOL指标（成交量）
  addVOLIndicator() {
    try {
      // VOL指标通常显示在副图，但这里我们简单地在主图显示成交量移动平均
      const vol5Data = this.calculateVolumeMA(this.state.klineData, 5)
      const vol10Data = this.calculateVolumeMA(this.state.klineData, 10)

      // 先添加第一个series，这会创建价格刻度
      this.indicatorSeries.vol = {
        vol5: this.mainChart.addLineSeries({
          color: '#FF6B6B',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: 'vol', // 使用独立的价格刻度
        })
      }

      // 现在配置VOL价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('vol').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      // 添加第二个series
      this.indicatorSeries.vol.vol10 = this.mainChart.addLineSeries({
        color: '#4ECDC4',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'vol' // 使用相同的价格刻度
      })

      this.indicatorSeries.vol.vol5.setData(vol5Data)
      this.indicatorSeries.vol.vol10.setData(vol10Data)

      console.log('✅ VOL指标添加成功')
    } catch (error) {
      console.error('❌ VOL指标添加失败:', error)
    }
  }

  // 计算成交量移动平均
  calculateVolumeMA(data, period) {
    const result = []
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        // 从volumeData获取成交量，如果没有则使用默认值
        const volumeItem = this.state.volumeData[i - j]
        sum += volumeItem ? volumeItem.value : 0
      }
      const avgVolume = sum / period
      result.push({
        time: data[i].time,
        value: Number(avgVolume.toFixed(2))
      })
    }
    return result
  }

  // 添加OBV指标（能量潮）
  addOBVIndicator() {
    try {
      const obvData = this.calculateOBV(this.state.klineData)

      // 先添加series，这会创建价格刻度
      this.indicatorSeries.obv = this.mainChart.addLineSeries({
        color: '#9C27B0',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'obv', // 使用独立的价格刻度
      })

      // 现在配置OBV价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('obv').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      this.indicatorSeries.obv.setData(obvData)

      console.log('✅ OBV指标添加成功')
    } catch (error) {
      console.error('❌ OBV指标添加失败:', error)
    }
  }

  // 计算OBV (On Balance Volume)
  calculateOBV(data) {
    if (data.length < 2) return []

    const result = []
    let obv = 0

    // 第一个点
    result.push({ time: data[0].time, value: 0 })

    for (let i = 1; i < data.length; i++) {
      const volumeItem = this.state.volumeData[i]
      const volume = volumeItem ? volumeItem.value : 0

      if (data[i].close > data[i - 1].close) {
        obv += volume
      } else if (data[i].close < data[i - 1].close) {
        obv -= volume
      }
      // 如果价格相等，OBV不变

      result.push({
        time: data[i].time,
        value: Number(obv.toFixed(2))
      })
    }

    return result
  }

  // 添加CCI指标（顺势指标）
  addCCIIndicator() {
    try {
      const cciData = this.calculateCCI(this.state.klineData, 14)

      // 先添加series，这会创建价格刻度
      this.indicatorSeries.cci = this.mainChart.addLineSeries({
        color: '#FF9800',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'cci', // 使用独立的价格刻度
      })

      // 现在配置CCI价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('cci').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0.2,
        },
        borderVisible: false,
      })

      this.indicatorSeries.cci.setData(cciData)

      console.log('✅ CCI指标添加成功')
    } catch (error) {
      console.error('❌ CCI指标添加失败:', error)
    }
  }

  // 添加WMA指标（加权移动平均）
  addWMAIndicator() {
    try {
      const wma7Data = this.calculateWMA(this.state.klineData, 7)
      const wma25Data = this.calculateWMA(this.state.klineData, 25)
      const wma99Data = this.calculateWMA(this.state.klineData, 99)

      this.indicatorSeries.wma = {
        wma7: this.mainChart.addLineSeries({
          color: '#FF6B6B',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        wma25: this.mainChart.addLineSeries({
          color: '#4ECDC4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        }),
        wma99: this.mainChart.addLineSeries({
          color: '#45B7D1',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false
        })
      }

      this.indicatorSeries.wma.wma7.setData(wma7Data)
      this.indicatorSeries.wma.wma25.setData(wma25Data)
      this.indicatorSeries.wma.wma99.setData(wma99Data)

      this.state.wmaData = { wma7: wma7Data, wma25: wma25Data, wma99: wma99Data }

      console.log('✅ WMA指标添加成功')
    } catch (error) {
      console.error('❌ WMA指标添加失败:', error)
    }
  }

  // 计算CCI (Commodity Channel Index)
  calculateCCI(data, period = 14) {
    if (data.length < period) return []

    const result = []

    for (let i = period - 1; i < data.length; i++) {
      // 计算典型价格 (TP = (H + L + C) / 3)
      const typicalPrices = []
      for (let j = i - period + 1; j <= i; j++) {
        const tp = (data[j].high + data[j].low + data[j].close) / 3
        typicalPrices.push(tp)
      }

      // 计算典型价格的移动平均
      const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period

      // 计算平均绝对偏差
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period

      // 计算CCI
      const currentTP = (data[i].high + data[i].low + data[i].close) / 3
      const cci = (currentTP - smaTP) / (0.015 * meanDeviation)

      result.push({
        time: data[i].time,
        value: Number(cci.toFixed(2))
      })
    }

    return result
  }

  // 计算WMA指标（加权移动平均）
  calculateWMA(data, period) {
    if (data.length < period) return []

    const result = []

    for (let i = period - 1; i < data.length; i++) {
      let weightedSum = 0
      let weightSum = 0

      for (let j = 0; j < period; j++) {
        const weight = j + 1 // 权重从1开始递增
        const price = data[i - period + 1 + j].close
        weightedSum += price * weight
        weightSum += weight
      }

      const wma = weightedSum / weightSum

      result.push({
        time: data[i].time,
        value: Number(wma.toFixed(4))
      })
    }

    return result
  }

  // 添加VWAP指标（成交量加权平均价格）
  addVWAPIndicator() {
    try {
      const vwapData = this.calculateVWAP(this.state.klineData)

      this.indicatorSeries.vwap = this.mainChart.addLineSeries({
        color: '#FF9800',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      })

      this.indicatorSeries.vwap.setData(vwapData)

      console.log('✅ VWAP指标添加成功')
    } catch (error) {
      console.error('❌ VWAP指标添加失败:', error)
    }
  }

  // 计算VWAP (Volume Weighted Average Price)
  calculateVWAP(data) {
    if (data.length === 0) return []

    const result = []

    // 使用滑动窗口计算VWAP，而不是累计计算
    const windowSize = 50 // 50个周期的滑动窗口

    for (let i = 0; i < data.length; i++) {
      let cumulativeTPV = 0 // 累计典型价格*成交量
      let cumulativeVolume = 0 // 累计成交量

      // 计算滑动窗口的起始位置
      const startIndex = Math.max(0, i - windowSize + 1)

      // 在滑动窗口内计算VWAP
      for (let j = startIndex; j <= i; j++) {
        const volumeItem = this.state.volumeData[j]
        const volume = volumeItem ? volumeItem.value : 1 // 如果没有成交量数据，使用1作为默认值
        const typicalPrice = (data[j].high + data[j].low + data[j].close) / 3

        cumulativeTPV += typicalPrice * volume
        cumulativeVolume += volume
      }

      const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : data[i].close

      result.push({
        time: data[i].time,
        value: Number(vwap.toFixed(4))
      })
    }

    return result
  }

  // 添加AVL指标（平均成交量线）
  addAVLIndicator() {
    try {
      const avlData = this.calculateAVL(this.state.klineData, 20)

      // 先添加series，这会创建价格刻度
      this.indicatorSeries.avl = this.mainChart.addLineSeries({
        color: '#9C27B0',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'avl', // 使用独立的价格刻度
      })

      // 现在配置AVL价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('avl').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.8,
        },
        borderVisible: false,
        visible: true,
        autoScale: true,
      })

      this.indicatorSeries.avl.setData(avlData)

      console.log('✅ AVL指标添加成功')
    } catch (error) {
      console.error('❌ AVL指标添加失败:', error)
    }
  }

  // 计算AVL (Average Volume Line)
  calculateAVL(data, period = 20) {
    if (data.length < period) return []

    const result = []

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        const volumeItem = this.state.volumeData[i - j]
        sum += volumeItem ? volumeItem.value : 0
      }
      const avgVolume = sum / period

      result.push({
        time: data[i].time,
        value: Number(avgVolume.toFixed(2))
      })
    }

    return result
  }

  // 添加TRIX指标（三重指数平滑移动平均）
  addTRIXIndicator() {
    try {
      const trixData = this.calculateTRIX(this.state.klineData, 14)

      // 先添加series，这会创建价格刻度
      this.indicatorSeries.trix = this.mainChart.addLineSeries({
        color: '#FF5722',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'trix', // 使用独立的价格刻度
      })

      // 现在配置TRIX价格刻度（价格刻度已经被创建）
      this.mainChart.priceScale('trix').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.8,
        },
        borderVisible: false,
        visible: true,
        autoScale: true,
      })

      this.indicatorSeries.trix.setData(trixData)

      console.log('✅ TRIX指标添加成功')
    } catch (error) {
      console.error('❌ TRIX指标添加失败:', error)
    }
  }

  // 计算TRIX (Triple Exponentially Smoothed Moving Average)
  calculateTRIX(data, period = 14) {
    if (data.length < period * 3) return []

    // 第一次EMA
    const ema1 = this.calculateEMAValues(data, period)

    // 第二次EMA
    const ema2Data = ema1.map((value, index) => ({ close: value, time: data[index].time }))
    const ema2 = this.calculateEMAValues(ema2Data, period)

    // 第三次EMA
    const ema3Data = ema2.map((value, index) => ({ close: value, time: data[index].time }))
    const ema3 = this.calculateEMAValues(ema3Data, period)

    // 计算TRIX（三重EMA的变化率）
    const result = []
    for (let i = 1; i < ema3.length; i++) {
      const trix = ((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 10000 // 乘以10000转换为基点
      result.push({
        time: data[i + period * 2].time,
        value: Number(trix.toFixed(4))
      })
    }

    return result
  }
}

// 创建全局实例
export const chartEventBus = new ChartEventBus()
