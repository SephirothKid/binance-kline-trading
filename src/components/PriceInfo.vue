<template>
  <div class="price-info trading-card p-4">
    <!-- 交易对和操作按钮 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <h1 class="text-xl font-bold text-trading-text">{{ symbol }}</h1>
        <button class="text-trading-yellow hover:text-yellow-400">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        </button>
        <button class="text-trading-text-secondary hover:text-trading-text">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
          </svg>
        </button>
      </div>
      <button class="text-trading-text-secondary hover:text-trading-text">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
        </svg>
      </button>
    </div>

    <!-- 价格信息 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- 当前价格 -->
      <div>
        <div class="text-2xl font-bold font-mono" :class="priceChangeClass">
          {{ formatPrice(currentPrice) }}
        </div>
        <div class="text-sm text-trading-text-secondary">
          ¥{{ formatPrice(currentPrice * 7.2) }}
        </div>
      </div>

      <!-- 24h变化 -->
      <div>
        <div class="text-sm text-trading-text-secondary">24h变化</div>
        <div class="font-mono" :class="priceChangeClass">
          {{ formatChange(priceChange) }}
        </div>
        <div class="font-mono" :class="priceChangeClass">
          {{ formatPercent(priceChangePercent) }}
        </div>
      </div>

      <!-- 24h最高 -->
      <div>
        <div class="text-sm text-trading-text-secondary">24h最高</div>
        <div class="font-mono text-trading-text">
          {{ formatPrice(highPrice) }}
        </div>
      </div>

      <!-- 24h最低 -->
      <div>
        <div class="text-sm text-trading-text-secondary">24h最低</div>
        <div class="font-mono text-trading-text">
          {{ formatPrice(lowPrice) }}
        </div>
      </div>

      <!-- 24h成交量(BTC) -->
      <div>
        <div class="text-sm text-trading-text-secondary">24h成交量({{ baseCurrency }})</div>
        <div class="font-mono text-trading-text">
          {{ formatVolume(volume) }}
        </div>
      </div>

      <!-- 24h成交额(USDT) -->
      <div>
        <div class="text-sm text-trading-text-secondary">24h成交额({{ quoteCurrency }})</div>
        <div class="font-mono text-trading-text">
          {{ formatVolume(quoteVolume) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'PriceInfo',
  props: {
    symbol: {
      type: String,
      default: 'BTC/USDT'
    },
    currentPrice: {
      type: Number,
      default: 0
    },
    priceChange: {
      type: Number,
      default: 0
    },
    priceChangePercent: {
      type: Number,
      default: 0
    },
    highPrice: {
      type: Number,
      default: 0
    },
    lowPrice: {
      type: Number,
      default: 0
    },
    volume: {
      type: Number,
      default: 0
    },
    quoteVolume: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    const baseCurrency = computed(() => {
      return props.symbol.split('/')[0] || 'BTC'
    })

    const quoteCurrency = computed(() => {
      return props.symbol.split('/')[1] || 'USDT'
    })

    const priceChangeClass = computed(() => {
      if (props.priceChange > 0) return 'text-trading-green'
      if (props.priceChange < 0) return 'text-trading-red'
      return 'text-trading-text'
    })

    const formatPrice = (price) => {
      if (!price) return '0.00'
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const formatChange = (change) => {
      if (!change) return '0.00'
      const sign = change > 0 ? '+' : ''
      return sign + change.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const formatPercent = (percent) => {
      if (!percent) return '0.00%'
      const sign = percent > 0 ? '+' : ''
      return sign + percent.toFixed(2) + '%'
    }

    const formatVolume = (volume) => {
      if (!volume) return '0'
      if (volume >= 1000000) {
        return (volume / 1000000).toFixed(2) + 'M'
      }
      if (volume >= 1000) {
        return (volume / 1000).toFixed(2) + 'K'
      }
      return volume.toFixed(2)
    }

    return {
      baseCurrency,
      quoteCurrency,
      priceChangeClass,
      formatPrice,
      formatChange,
      formatPercent,
      formatVolume
    }
  }
}
</script>
