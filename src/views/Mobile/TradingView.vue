<template>
  <div class="mobile-trading-view min-h-screen bg-trading-bg">
    <!-- 顶部导航栏 -->
    <div class="fixed top-0 left-0 right-0 z-50 trading-card p-4 flex items-center justify-between bg-trading-bg">
      <!-- <button class="text-trading-text">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button> -->
      
      <SymbolSelector v-model="currentSymbol" @update:modelValue="handleSymbolChange" />

      
    </div>

    <!-- 内容区域 -->
    <div class="pt-20">
      <!-- 价格信息和统计信息 -->
      <div class="px-4 py-2 flex">
        
        <div class="flex-1">
          <div class="text-2xl font-bold font-mono mb-1" :class="priceChangeClass">
            {{ formatPrice(stats.lastPrice) }}
          </div>
          <div class="text-xs text-trading-text-secondary mb-1">
            ¥{{ formatPrice(stats.lastPrice * 7.2) }}
            <span :class="priceChangeClass">{{ formatPercent(stats.priceChangePercent) }}</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="grid grid-cols-2 gap-x-1 gap-y-1">
            <div>
              <div class="text-trading-text-secondary" style="font-size: 10px;">24h高</div>
              <div class="font-mono text-trading-text" style="font-size: 10px;">{{ formatPrice(stats.highPrice) }}</div>
            </div>
            <div>
              <div class="text-trading-text-secondary" style="font-size: 10px;">成交量(ETH)</div>
              <div class="font-mono text-trading-text" style="font-size: 10px;">{{ formatVolume(stats.volume) }}</div>
            </div>
            <div>
              <div class="text-trading-text-secondary" style="font-size: 10px;">24h低</div>
              <div class="font-mono text-trading-text" style="font-size: 10px;">{{ formatPrice(stats.lowPrice) }}</div>
            </div>
            <div>
              <div class="text-trading-text-secondary" style="font-size: 10px;">成交额(USDT)</div>
              <div class="font-mono text-trading-text" style="font-size: 10px;">{{ formatVolume(stats.quoteVolume) }}</div>
            </div>
          </div>
        </div>
      </div>

    <!-- 时间周期选择 -->
    <div class="px-2 py-2">
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
    <div class="mx-2 mb-4 trading-card" style="height: 400px;">
      <KLineChart
        :symbol="currentSymbol"
        :interval="selectedInterval"
        :height="400"
      />
    </div>

    <!-- 技术指标快速选择 -->
    <div class="px-4 py-2 overflow-x-auto">
      <div class="flex items-center space-x-2 text-xs">
        <span class="text-trading-text-secondary whitespace-nowrap">指标:</span>
        <button
          v-for="indicator in quickIndicators"
          :key="indicator"
          :class="[
            'px-2 py-1 rounded transition-colors duration-200',
            activeIndicators.includes(indicator)
              ? 'text-trading-text'
              : 'text-trading-text-secondary'
          ]"
          @click="toggleIndicator(indicator)"
        >
          {{ indicator }}
        </button>
      </div>
    </div>

    <!-- 底部操作区域 -->
    <div class="fixed bottom-0 left-0 right-0 bg-trading-card border-t border-trading-border p-4 z-50">
      <div class="flex items-center space-x-3">
        <button class="trading-button trading-button-success flex-1 py-3 text-base font-medium">
          买入
        </button>
        <button class="trading-button trading-button-danger flex-1 py-3 text-base font-medium">
          卖出
        </button>
      </div>
    </div>
    </div> <!-- 内容区域结束 -->
  </div>
</template>

<script>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import KLineChart from '@/components/KLineChart.vue'
import { chartEventBus } from '@/utils/chartEventBus'
import SymbolSelector from '@/components/SymbolSelector.vue'
import binanceApi from '@/utils/binanceApi'
import { formatPrice, formatPercent, formatVolume, getPriceChangeClass } from '@/utils/formatters'

export default {
  name: 'MobileTradingView',
  components: {
    KLineChart,
    SymbolSelector
  },
  setup() {
    const router = useRouter()
    const currentSymbol = ref('BTCUSDT')
    const selectedInterval = ref('3m')
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
      return getPriceChangeClass(stats.value.priceChange)
    })

    const mobileTimeframes = [
      // { label: '分时', value: '1m' },
      { label: '3分', value: '3m' },
      { label: '5分', value: '5m' },
      { label: '15分', value: '15m' },
      { label: '30分', value: '30m' },
      { label: '1小时', value: '1h' },
      { label: '日线', value: '1d' }
    ]

    const quickIndicators = ['MA', 'EMA', 'WMA', 'BOLL', 'VWAP', 'AVL', 'TRIX', 'SAR']

    const selectTimeframe = (timeframe) => {
      selectedInterval.value = timeframe
    }

    const toggleIndicator = (indicator) => {
      chartEventBus.toggleIndicator(indicator)
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

    // 检查是否应该重定向到桌面端
    const checkForDesktopRedirect = () => {
      const screenWidth = window.innerWidth
      const userAgent = navigator.userAgent.toLowerCase()

      // 检查屏幕宽度（大于768px认为是桌面端）
      const isDesktopWidth = screenWidth > 768

      // 检查UA（不是移动设备）
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)

      // 如果屏幕宽度大于768px或者不是移动设备UA，重定向到桌面端
      if (isDesktopWidth || !isMobileUA) {
        router.push('/desktop')
      }
    }

    // 窗口大小变化监听
    const handleResize = () => {
      checkForDesktopRedirect()
    }

    onMounted(() => {
      // 初始检查是否需要重定向
      checkForDesktopRedirect()

      // 添加窗口大小变化监听
      window.addEventListener('resize', handleResize)

      load24hrStats()
      setInterval(load24hrStats, 60000)
    })

    onUnmounted(() => {
      // 清理事件监听
      window.removeEventListener('resize', handleResize)
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
      formatPercent,
      formatVolume,
      selectTimeframe,
      toggleIndicator,
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
