/**
 * 通用格式化工具函数
 * 统一管理所有格式化相关的方法
 */

/**
 * 格式化价格显示
 * @param {number} price - 价格数值
 * @param {number} minFractionDigits - 最小小数位数，默认2
 * @param {number} maxFractionDigits - 最大小数位数，默认2
 * @returns {string} 格式化后的价格字符串
 */
export const formatPrice = (price, minFractionDigits = 2, maxFractionDigits = 2) => {
  if (!price || price === 0) return '0.00'
  
  // 对于小于1的价格，使用更多小数位
  if (price < 1) {
    return price.toFixed(4)
  }
  
  return price.toLocaleString('en-US', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits
  })
}

/**
 * 格式化价格变化（带符号）
 * @param {number} change - 价格变化数值
 * @returns {string} 格式化后的变化字符串
 */
export const formatChange = (change) => {
  if (!change || change === 0) return '0.00'
  
  const sign = change > 0 ? '+' : ''
  return sign + change.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * 格式化百分比（带符号和%）
 * @param {number} percent - 百分比数值
 * @returns {string} 格式化后的百分比字符串
 */
export const formatPercent = (percent) => {
  if (!percent || percent === 0) return '0.00%'
  
  const sign = percent > 0 ? '+' : ''
  return sign + percent.toFixed(2) + '%'
}

/**
 * 格式化成交量（简化显示）
 * @param {number} volume - 成交量数值
 * @returns {string} 格式化后的成交量字符串
 */
export const formatVolume = (volume) => {
  if (!volume || volume === 0) return '0'
  
  const absVolume = Math.abs(volume)
  
  if (absVolume >= 1000000000) {
    // 十亿以上显示为 B
    return (volume / 1000000000).toFixed(2) + 'B'
  } else if (absVolume >= 1000000) {
    // 百万以上显示为 M
    return (volume / 1000000).toFixed(2) + 'M'
  } else if (absVolume >= 1000) {
    // 千以上显示为 K
    return (volume / 1000).toFixed(2) + 'K'
  }
  
  return volume.toFixed(2)
}

/**
 * 格式化成交量数值（用于图表显示）
 * @param {number} value - 成交量数值
 * @returns {string} 格式化后的成交量字符串
 */
export const formatVolumeValue = (value) => {
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

/**
 * 格式化交易对符号
 * @param {string} symbol - 交易对符号，如 'BTCUSDT'
 * @returns {string} 格式化后的符号，如 'BTC/USDT'
 */
export const formatSymbol = (symbol) => {
  if (!symbol) return ''
  return symbol.replace('USDT', '/USDT')
}

/**
 * 格式化时间戳
 * @param {number} timestamp - 时间戳（秒）
 * @param {string} format - 格式类型，'time' | 'datetime' | 'date'
 * @returns {string} 格式化后的时间字符串
 */
export const formatTime = (timestamp, format = 'time') => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp * 1000)
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    case 'datetime':
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    case 'date':
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    default:
      return date.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
  }
}

/**
 * 获取价格变化的CSS类名
 * @param {number} change - 价格变化数值
 * @returns {string} CSS类名
 */
export const getPriceChangeClass = (change) => {
  if (change > 0) return 'text-trading-green'
  if (change < 0) return 'text-trading-red'
  return 'text-trading-text'
}

/**
 * 从交易对符号中提取基础资产和报价资产
 * @param {string} symbol - 交易对符号，如 'BTCUSDT'
 * @returns {object} { base: 'BTC', quote: 'USDT' }
 */
export const parseSymbol = (symbol) => {
  if (!symbol) return { base: '', quote: '' }
  
  // 常见的报价资产
  const quoteAssets = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB']
  
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length)
      return { base, quote }
    }
  }
  
  // 默认情况：假设最后4个字符是报价资产
  return {
    base: symbol.slice(0, -4),
    quote: symbol.slice(-4)
  }
}

/**
 * 格式化数字为紧凑形式（用于小屏幕显示）
 * @param {number} num - 数字
 * @param {number} precision - 精度，默认2
 * @returns {string} 紧凑格式的数字字符串
 */
export const formatCompactNumber = (num, precision = 2) => {
  if (!num || num === 0) return '0'
  
  const absNum = Math.abs(num)
  
  if (absNum >= 1e12) {
    return (num / 1e12).toFixed(precision) + 'T'
  } else if (absNum >= 1e9) {
    return (num / 1e9).toFixed(precision) + 'B'
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(precision) + 'M'
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(precision) + 'K'
  }
  
  return num.toFixed(precision)
}
