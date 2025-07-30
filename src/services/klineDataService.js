/**
 * K线数据服务 - 统一管理数据获取、缓存和WebSocket连接
 */

import persistentStorage from '@/utils/persistentStorage'

class KlineDataService {
  constructor() {
    this.websocket = null
    this.cache = new Map() // 内存缓存
    this.subscribers = new Map() // WebSocket订阅者
    this.currentSymbol = null
    this.currentInterval = null
    this.cacheExpiry = 5 * 60 * 1000 // 缓存过期时间：5分钟
    this.maxCacheSize = 50 // 最大缓存条目数
    this.isReconnecting = false // 重连状态标志
    this.reconnectAttempts = 0 // 重连尝试次数
    this.maxReconnectAttempts = 5 // 最大重连次数
    this.reconnectDelay = 3000 // 重连延迟

    // 异步初始化持久化缓存
    this.initPersistentCache().catch(error => {
      console.warn('⚠️ 持久化缓存初始化失败:', error)
    })
  }

  /**
   * 初始化持久化缓存
   */
  async initPersistentCache() {
    try {
      const savedCache = await persistentStorage.getAll()
      let loadedCount = 0

      // 检查缓存是否过期
      Object.entries(savedCache).forEach(([key, item]) => {
        if (this.isCacheValid(item)) {
          this.cache.set(key, item)
          loadedCount++
        }
      })

      if (loadedCount > 0) {
        console.log(`📦 从持久化存储加载了 ${loadedCount} 个缓存项`)
      }
    } catch (error) {
      console.warn('⚠️ 加载持久化缓存失败:', error)
    }
  }

  /**
   * 保存缓存到持久化存储
   */
  async saveCacheToStorage() {
    try {
      const cacheObj = {}
      this.cache.forEach((value, key) => {
        cacheObj[key] = value
      })

      // 批量保存到持久化存储
      const savePromises = Object.entries(cacheObj).map(([key, value]) =>
        persistentStorage.save(key, value)
      )

      await Promise.all(savePromises)
    } catch (error) {
      console.warn('⚠️ 保存缓存到持久化存储失败:', error)
      // 如果存储空间不足，清理一些缓存
      if (error.name === 'QuotaExceededError') {
        this.cleanExpiredCache()
        this.limitCacheSize()
      }
    }
  }

  /**
   * 生成缓存键
   */
  getCacheKey(symbol, interval, limit = 1000) {
    return `${symbol}_${interval}_${limit}`
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid(cacheItem) {
    if (!cacheItem) return false
    return Date.now() - cacheItem.timestamp < this.cacheExpiry
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp >= this.cacheExpiry) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 限制缓存大小
   */
  limitCacheSize() {
    if (this.cache.size > this.maxCacheSize) {
      // 删除最旧的缓存项
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toDelete = entries.slice(0, this.cache.size - this.maxCacheSize)
      toDelete.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * 设置缓存
   */
  setCache(key, data) {
    this.cleanExpiredCache()
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    this.limitCacheSize()
    // 异步保存到持久化存储
    this.saveCacheToStorage().catch(error => {
      console.warn('⚠️ 缓存保存失败:', error)
    })
  }

  /**
   * 获取缓存
   */
  getCache(key) {
    const cacheItem = this.cache.get(key)
    if (this.isCacheValid(cacheItem)) {
      console.log(`📦 使用缓存数据: ${key}`)
      return cacheItem.data
    }
    return null
  }

  /**
   * 从交易对中提取base和quote资产
   */
  getAssetFromSymbol(symbol) {
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB']
    
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length)
        return { base, quote }
      }
    }
    
    return { base: symbol.slice(0, -4), quote: symbol.slice(-4) }
  }

  /**
   * 处理K线数据
   */
  processKlineData(rawData, symbol, interval) {
    const klineData = []
    const volumeData = []

    rawData.forEach(item => {
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

      const time = Math.floor(openTime / 1000)

      // K线数据
      if (interval === 'time') {
        // 分时图使用线图数据格式
        klineData.push({
          time: time,
          value: Number(close)
        })
      } else {
        // K线图使用蜡烛图数据格式
        klineData.push({
          time: time,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close)
        })
      }

      // 成交量数据
      const totalVolume = Number(volume)
      const buyVolume = Number(takerBuyBaseAssetVolume)
      const sellVolume = totalVolume - buyVolume

      volumeData.push({
        time: time,
        value: totalVolume,
        buyVolume: buyVolume,
        sellVolume: sellVolume,
        quoteVolume: Number(quoteAssetVolume),
        color: Number(close) >= Number(open) ? '#0ECB81' : '#F6465D'
      })
    })

    return { klineData, volumeData, isTimeSeries: interval === 'time' }
  }

  /**
   * 获取币安K线数据（带缓存）
   */
  async fetchBinanceKlineData(symbol = 'BTCUSDT', interval = '1m', limit = 1000) {
    const cacheKey = this.getCacheKey(symbol, interval, limit)
    
    // 先检查缓存
    const cachedData = this.getCache(cacheKey)
    if (cachedData) {
      return cachedData
    }

    try {
      console.log(`🔄 正在获取 ${symbol} ${interval} 数据...`)
      
      const actualInterval = interval === 'time' ? '1m' : interval
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${actualInterval}&limit=${limit}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const rawData = await response.json()
      const processedData = this.processKlineData(rawData, symbol, interval)
      
      // 缓存数据
      this.setCache(cacheKey, processedData)
      
      console.log(`✅ ${symbol} ${interval} 数据获取成功:`, processedData.klineData.length, '条')
      return processedData
      
    } catch (error) {
      console.error('❌ 币安数据获取失败:', error)
      // 返回空数据而不是fallback数据，让调用方处理
      return { klineData: [], volumeData: [], isTimeSeries: interval === 'time' }
    }
  }

  /**
   * 建立WebSocket连接
   */
  connectWebSocket(symbol = 'BTCUSDT', interval = '1m', callback) {
    // 如果已有相同的连接，直接添加订阅者
    if (this.websocket && this.currentSymbol === symbol && this.currentInterval === interval) {
      this.subscribers.set(callback, callback)
      return
    }

    // 断开旧连接
    this.disconnectWebSocket()

    this.currentSymbol = symbol
    this.currentInterval = interval
    
    const wsSymbol = symbol.toLowerCase()
    const actualInterval = interval === 'time' ? '1m' : interval
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${actualInterval}`

    console.log('🔌 连接WebSocket:', wsUrl)

    this.websocket = new WebSocket(wsUrl)

    this.websocket.onopen = () => {
      console.log('✅ WebSocket连接成功')
      // 重置重连计数
      this.reconnectAttempts = 0
      this.isReconnecting = false
    }

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const kline = data.k

        if (kline) { // 处理所有K线数据，包括未完成的（实时更新）
          const processedData = this.processWebSocketData(kline, interval)

          // console.log('🔄 WebSocket原始数据处理:', {
          //   symbol: this.currentSymbol,
          //   interval: this.currentInterval,
          //   time: new Date(kline.t).toLocaleTimeString(),
          //   price: kline.c,
          //   volume: kline.v,
          //   isComplete: kline.x,
          //   subscribersCount: this.subscribers.size
          // })

          // 通知所有订阅者
          this.subscribers.forEach(callback => {
            try {
              callback(processedData)
            } catch (error) {
              console.error('WebSocket回调执行错误:', error)
            }
          })
        }
      } catch (error) {
        console.error('WebSocket数据解析错误:', error)
      }
    }

    this.websocket.onerror = (error) => {
      console.error('❌ WebSocket连接错误:', error)
    }

    this.websocket.onclose = (event) => {
      console.log('🔌 WebSocket连接关闭', event.code, event.reason)
      this.websocket = null

      // 只有在非正常关闭且有订阅者的情况下才重连
      const shouldReconnect = event.code !== 1000 && // 1000是正常关闭
                             this.subscribers.size > 0 &&
                             !this.isReconnecting &&
                             this.reconnectAttempts < this.maxReconnectAttempts

      if (shouldReconnect) {
        this.isReconnecting = true
        this.reconnectAttempts++

        console.log(`🔄 尝试重新连接WebSocket... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

        setTimeout(() => {
          if (this.subscribers.size > 0) { // 再次检查是否还有订阅者
            this.connectWebSocket(symbol, interval, Array.from(this.subscribers.keys())[0])
          }
          this.isReconnecting = false
        }, this.reconnectDelay * this.reconnectAttempts) // 递增延迟
      }
    }

    // 添加订阅者
    this.subscribers.set(callback, callback)
  }

  /**
   * 处理WebSocket数据
   */
  processWebSocketData(kline, interval) {
    const time = Math.floor(kline.t / 1000)
    
    // K线数据
    let newKlineData
    if (interval === 'time') {
      newKlineData = {
        time: time,
        value: parseFloat(kline.c)
      }
    } else {
      newKlineData = {
        time: time,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c)
      }
    }

    // 成交量数据
    const totalVolume = parseFloat(kline.v)
    const buyVolume = parseFloat(kline.V)
    const sellVolume = totalVolume - buyVolume

    const newVolumeData = {
      time: time,
      value: totalVolume,
      buyVolume: buyVolume,
      sellVolume: sellVolume,
      quoteVolume: parseFloat(kline.q),
      color: parseFloat(kline.c) >= parseFloat(kline.o) ? '#0ECB81' : '#F6465D'
    }

    return { klineData: newKlineData, volumeData: newVolumeData }
  }

  /**
   * 移除订阅者
   */
  unsubscribe(callback) {
    this.subscribers.delete(callback)
    
    // 如果没有订阅者了，断开连接
    if (this.subscribers.size === 0) {
      this.disconnectWebSocket()
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnectWebSocket() {
    if (this.websocket) {
      // 使用正常关闭码，避免触发重连
      this.websocket.close(1000, 'Normal closure')
      this.websocket = null
      this.currentSymbol = null
      this.currentInterval = null
      console.log('🔌 WebSocket连接已断开')
    }
    this.subscribers.clear()
    // 重置重连状态
    this.isReconnecting = false
    this.reconnectAttempts = 0
  }

  /**
   * 清理所有缓存
   */
  async clearCache() {
    this.cache.clear()
    await persistentStorage.clear()
    console.log('🗑️ 缓存已清理（包括持久化存储）')
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    const persistentStats = await persistentStorage.getStats()

    return {
      memory: {
        size: this.cache.size,
        maxSize: this.maxCacheSize,
        expiry: this.cacheExpiry,
        keys: Array.from(this.cache.keys())
      },
      persistent: persistentStats,
      reconnect: {
        isReconnecting: this.isReconnecting,
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      }
    }
  }
}

// 导出单例
export default new KlineDataService()
