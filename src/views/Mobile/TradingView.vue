<template>
  <div class="mobile-trading-view min-h-screen bg-trading-bg">
    <!-- 顶部导航栏 -->
    <div class="trading-card p-4 flex items-center justify-between">
      <button class="text-trading-text">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      
      <SymbolSelector v-model="currentSymbol" @update:modelValue="handleSymbolChange" />

      <div class="flex items-center space-x-2">
        <button class="text-trading-text-secondary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
          </svg>
        </button>
        <button class="text-trading-text-secondary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 价格信息 -->
    <div class="px-4 py-2">
      <div class="text-3xl font-bold font-mono mb-1" :class="priceChangeClass">
        {{ formatPrice(stats.lastPrice) }}
      </div>
      <div class="text-sm text-trading-text-secondary mb-2">
        ¥{{ formatPrice(stats.lastPrice * 7.2) }}
      </div>
      
      <div class="flex items-center space-x-4 text-sm">
        <div>
          <span class="text-trading-text-secondary">24h变化</span>
          <div class="font-mono" :class="priceChangeClass">
            {{ formatChange(stats.priceChange) }} ({{ formatPercent(stats.priceChangePercent) }})
          </div>
        </div>
      </div>
    </div>

    <!-- 24小时统计 -->
    <div class="grid grid-cols-2 gap-4 px-4 py-2 text-sm">
      <div>
        <div class="text-trading-text-secondary">24h最高</div>
        <div class="font-mono text-trading-text">{{ formatPrice(stats.highPrice) }}</div>
      </div>
      <div>
        <div class="text-trading-text-secondary">24h最低</div>
        <div class="font-mono text-trading-text">{{ formatPrice(stats.lowPrice) }}</div>
      </div>
      <div>
        <div class="text-trading-text-secondary">24h成交量(BTC)</div>
        <div class="font-mono text-trading-text">{{ formatVolume(stats.volume) }}</div>
      </div>
      <div>
        <div class="text-trading-text-secondary">24h成交额(USDT)</div>
        <div class="font-mono text-trading-text">{{ formatVolume(stats.quoteVolume) }}</div>
      </div>
    </div>

    <!-- 时间周期选择 -->
    <div class="px-4 py-2">
      <div class="flex items-center space-x-1 overflow-x-auto">
        <button
          v-for="timeframe in mobileTimeframes"
          :key="timeframe.value"
          @click="selectTimeframe(timeframe.value)"
          :class="[
            'px-3 py-1 text-sm rounded whitespace-nowrap transition-colors duration-200',
            selectedInterval === timeframe.value
              ? 'bg-trading-yellow text-black font-medium'
              : 'text-trading-text-secondary hover:text-trading-text'
          ]"
        >
          {{ timeframe.label }}
        </button>
      </div>
    </div>

    <!-- K线图 -->
    <!-- <div class="mx-4 mb-4 trading-card">
      <SimpleKLineChart />
    </div> -->

    <!-- 技术指标快速选择 -->
    <div class="px-4 py-2">
      <div class="flex items-center space-x-2 text-xs">
        <span class="text-trading-text-secondary">指标:</span>
        <button
          v-for="indicator in quickIndicators"
          :key="indicator"
          :class="[
            'px-2 py-1 rounded transition-colors duration-200',
            activeIndicators.includes(indicator)
              ? 'bg-trading-border text-trading-text'
              : 'text-trading-text-secondary'
          ]"
          @click="toggleIndicator(indicator)"
        >
          {{ indicator }}
        </button>
      </div>
    </div>

    <!-- 底部操作区域 -->
    <div class="fixed bottom-0 left-0 right-0 bg-trading-card border-t border-trading-border p-4">
      <div class="flex items-center space-x-3">
        <button class="trading-button trading-button-success flex-1 py-3 text-base font-medium">
          买入
        </button>
        <button class="trading-button trading-button-danger flex-1 py-3 text-base font-medium">
          卖出
        </button>
      </div>
    </div>

    <!-- 提示用户切换到PC端 -->
    <div class="px-4 py-2 mb-20">
      <div class="trading-card p-3 text-center">
        <div class="text-sm text-trading-text-secondary mb-2">
          获得更好的交易体验
        </div>
        <button 
          @click="switchToDesktop"
          class="trading-button trading-button-primary text-sm"
        >
          切换到PC端
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
// import SimpleKLineChart from '@/components/SimpleKLineChart.vue'
import KLineChart from '@/components/KLineChart.vue'
import { chartEventBus } from '@/utils/chartEventBus'
import SymbolSelector from '@/components/SymbolSelector.vue'
import binanceApi from '@/utils/binanceApi'

export default {
  name: 'MobileTradingView',
  components: {
    KLineChart,
    SymbolSelector
  },
  setup() {
    const router = useRouter()
    const currentSymbol = ref('BTCUSDT')
    const selectedInterval = ref('1m')
    const stats = ref({
      lastPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      highPrice: 0,
      lowPrice: 0,
      volume: 0,
      quoteVolume: 0
    })
    // 使用EventBus管理指标状态
    const activeIndicators = computed(() => chartEventBus.state.activeIndicators)

    const displaySymbol = computed(() => {
      return currentSymbol.value.replace('USDT', '/USDT')
    })

    const priceChangeClass = computed(() => {
      if (stats.value.priceChange > 0) return 'text-trading-green'
      if (stats.value.priceChange < 0) return 'text-trading-red'
      return 'text-trading-text'
    })

    const mobileTimeframes = [
      { label: '3分', value: '3m' },
      { label: '5分', value: '5m' },
      { label: '15分', value: '15m' },
      { label: '1小时', value: '1h' },
      { label: '日线', value: '1d' }
    ]

    const quickIndicators = ['MA', 'BOLL', 'MACD', 'RSI']

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

    const selectTimeframe = (timeframe) => {
      selectedInterval.value = timeframe
    }

    const toggleIndicator = (indicator) => {
      chartEventBus.toggleIndicator(indicator)
    }

    const switchToDesktop = () => {
      router.push('/desktop')
    }

    const load24hrStats = async () => {
      try {
        const data = await binanceApi.get24hrStats(currentSymbol.value)
        stats.value = data
      } catch (error) {
        console.error('加载24小时统计失败:', error)
      }
    }

    const handlePriceUpdate = (priceData) => {
      if (priceData.close) {
        stats.value.lastPrice = priceData.close
      }
    }

    const handleSymbolChange = (newSymbol) => {
      currentSymbol.value = newSymbol
      load24hrStats()
    }

    onMounted(() => {
      load24hrStats()
      setInterval(load24hrStats, 60000)
    })

    return {
      currentSymbol,
      selectedInterval,
      stats,
      activeIndicators,
      displaySymbol,
      priceChangeClass,
      mobileTimeframes,
      quickIndicators,
      formatPrice,
      formatChange,
      formatPercent,
      formatVolume,
      selectTimeframe,
      toggleIndicator,
      switchToDesktop,
      handlePriceUpdate,
      handleSymbolChange
    }
  }
}
</script>

<style scoped>
.mobile-trading-view {
  padding-bottom: 80px;
}
</style>
