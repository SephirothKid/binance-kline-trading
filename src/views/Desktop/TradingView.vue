<template>
  <div class="trading-view min-h-screen bg-trading-bg flex">
    <!-- 左侧交易对列表 -->
    <div class="w-80 bg-trading-card border-r border-trading-border">
      <!-- 搜索和筛选 -->
      <div class="p-4 border-b border-trading-border">
        <div class="flex items-center space-x-2 mb-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索"
            class="flex-1 bg-trading-bg border border-trading-border rounded px-3 py-2 text-sm text-trading-text placeholder-trading-text-secondary focus:outline-none focus:border-trading-yellow"
          />
          <button class="p-2 text-trading-text-secondary hover:text-trading-text">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </button>
        </div>

        <!-- 筛选标签 -->
        <!-- <div class="flex items-center space-x-2 text-xs">
          <button
            v-for="filter in filters"
            :key="filter"
            :class="[
              'px-2 py-1 rounded transition-colors duration-200',
              selectedFilter === filter
                ? 'bg-trading-yellow text-black'
                : 'text-trading-text-secondary hover:text-trading-text'
            ]"
            @click="selectedFilter = filter"
          >
            {{ filter }}
          </button>
        </div> -->
      </div>

      <!-- 交易对列表 -->
      <div class="overflow-y-auto" style="height: calc(100vh - 120px);">
        <div
          v-for="symbol in filteredSymbols"
          :key="symbol.symbol"
          @click="selectSymbol(symbol.symbol)"
          :class="[
            'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-200 border-b border-trading-border',
            currentSymbol === symbol.symbol ? 'bg-trading-border' : 'hover:bg-trading-border'
          ]"
        >
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <div class="font-medium text-trading-text">{{ formatSymbol(symbol.symbol) }}</div>
              <div class="text-xs text-trading-text-secondary">{{ symbol.volume24h }}</div>
            </div>
            <div class="text-xs text-trading-text-secondary">{{ symbol.name }}</div>
          </div>
          <div class="text-right">
            <div class="font-mono text-sm text-trading-text">{{ formatPrice(symbol.price) }}</div>
            <div class="font-mono text-xs" :class="symbol.change >= 0 ? 'text-trading-green' : 'text-trading-red'">
              {{ formatPercent(symbol.change) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧主要内容区域 -->
    <div class="flex-1 flex flex-col">
      <!-- 顶部价格信息 -->
      <div class="bg-trading-card border-b border-trading-border p-4">
        <div class="flex items-center justify-between">
          <!-- 左侧：币对信息 -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div>
                <div class="font-bold text-lg text-trading-text">{{ displaySymbol }}</div>
                <div class="text-xs text-trading-text-secondary">{{ getSymbolName(currentSymbol) }}</div>
              </div>
            </div>

            <!-- 价格信息 -->
            <div class="flex items-center space-x-6">
              <div>
                <div class="text-2xl font-bold font-mono" :class="priceChangeClass">
                  {{ formatPrice(stats.lastPrice) }}
                </div>
                <div class="text-sm text-trading-text-secondary">
                  ¥{{ formatPrice(stats.lastPrice * 7.2) }}
                </div>
              </div>

              <div class="grid grid-cols-4 gap-6 text-sm">
                <div>
                  <div class="text-trading-text-secondary">24h变化</div>
                  <div class="font-mono" :class="priceChangeClass">
                    {{ formatChange(stats.priceChange) }}
                  </div>
                  <div class="font-mono" :class="priceChangeClass">
                    {{ formatPercent(stats.priceChangePercent) }}
                  </div>
                </div>
                <div>
                  <div class="text-trading-text-secondary">24h最高</div>
                  <div class="font-mono text-trading-text">{{ formatPrice(stats.highPrice) }}</div>
                </div>
                <div>
                  <div class="text-trading-text-secondary">24h最低</div>
                  <div class="font-mono text-trading-text">{{ formatPrice(stats.lowPrice) }}</div>
                </div>
                <div>
                  <div class="text-trading-text-secondary">24h成交量</div>
                  <div class="font-mono text-trading-text">{{ formatVolume(stats.volume) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：操作按钮 -->
          <!-- <div class="flex items-center space-x-2">
            <button class="p-2 text-trading-text-secondary hover:text-trading-text">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
              </svg>
            </button>
            <button class="p-2 text-trading-text-secondary hover:text-trading-text">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
            </button>
          </div> -->
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="flex-1 bg-trading-card m-4 rounded-lg border border-trading-border">
        <!-- 时间周期和指标选择 -->
        <div class="p-4 border-b border-trading-border">
          <div class="flex justify-between items-center">
            <TimeframeSelector
              v-model="selectedInterval"
              @indicator-change="handleIndicatorChange"
            />
          </div>
        </div>

        <!-- K线图 -->
        <div class="p-4" style="height: 500px;">
          <DesktopKLineChart
            :symbol="currentSymbol"
            :interval="selectedInterval"
            :height="500"
            @price-update="handlePriceUpdate"
          />
        </div>
      </div>
    </div>

    <!-- 底部操作区域 -->
    <div class="fixed bottom-0 left-0 right-0 bg-trading-card border-t border-trading-border p-4">
      <div class="flex items-center justify-center space-x-4 max-w-md mx-auto">
        <button class="trading-button trading-button-success flex-1 py-3 text-lg font-medium">
          买入
        </button>
        <button class="trading-button trading-button-danger flex-1 py-3 text-lg font-medium">
          卖出
        </button>
      </div>
    </div>

    <!-- 当前价格悬浮显示 -->
    <div 
      v-if="currentPrice"
      class="fixed top-4 right-4 trading-card p-3 text-sm font-mono"
    >
      <div class="text-trading-text-secondary">当前价格</div>
      <div class="text-lg font-bold" :class="priceChangeClass">
        {{ formatPrice(currentPrice.close) }}
      </div>
      <div class="text-xs text-trading-text-secondary">
        {{ formatTime(currentPrice.time) }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PriceInfo from '@/components/PriceInfo.vue'
// import KLineChart from '@/components/KLineChart.vue'
import DesktopKLineChart from '@/components/DesktopKLineChart.vue'
import TimeframeSelector from '@/components/TimeframeSelector.vue'
import binanceApi from '@/utils/binanceApi'
import { chartEventBus } from '@/utils/chartEventBus'
import { formatPrice, formatChange, formatPercent, formatVolume, formatSymbol, formatTime, getPriceChangeClass } from '@/utils/formatters'

export default {
  name: 'DesktopTradingView',
  components: {
    PriceInfo,
    // KLineChart,
    DesktopKLineChart,
    TimeframeSelector
  },
  setup() {
    const router = useRouter()
    const currentSymbol = ref('BTCUSDT')
    const selectedInterval = ref('3m')
    const searchQuery = ref('')
    const selectedFilter = ref('收藏')
    const stats = ref({
      lastPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      highPrice: 0,
      lowPrice: 0,
      volume: 0,
      quoteVolume: 0
    })
    const currentPrice = ref(null)
    const activeIndicators = ref(['MA'])

    // WebSocket连接管理
    let tickerWebSocket = null

    // 筛选选项
    const filters = ['收藏', '现货', '合约', '期权', '杠杆']

    // 交易对数据
    const symbols = ref([
      { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0, change: 0, volume24h: '0.00' },
      { symbol: 'ETHUSDT', name: 'Ethereum', price: 0, change: 0, volume24h: '0.00' },
      { symbol: 'BNBUSDT', name: 'BNB', price: 0, change: 0, volume24h: '0.00' },
      { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0, change: 0, volume24h: '0.00' },
      { symbol: 'SOLUSDT', name: 'Solana', price: 0, change: 0, volume24h: '0.00' }
    ])

    const displaySymbol = computed(() => {
      return currentSymbol.value.replace('USDT', '/USDT')
    })

    const priceChangeClass = computed(() => {
      return getPriceChangeClass(stats.value.priceChange)
    })

    const filteredSymbols = computed(() => {
      if (!searchQuery.value) return symbols.value

      const query = searchQuery.value.toLowerCase()
      return symbols.value.filter(symbol =>
        symbol.symbol.toLowerCase().includes(query) ||
        symbol.name.toLowerCase().includes(query)
      )
    })

    const getSymbolName = (symbol) => {
      const symbolData = symbols.value.find(s => s.symbol === symbol)
      return symbolData ? symbolData.name : ''
    }

    const selectSymbol = (symbol) => {
      currentSymbol.value = symbol
      load24hrStats()
    }

    // 建立币对列表的WebSocket连接
    const connectTickerWebSocket = () => {
      if (tickerWebSocket) {
        tickerWebSocket.close()
      }

      // 获取所有币对的ticker数据
      const symbolList = symbols.value.map(s => s.symbol.toLowerCase()).join('/')
      const wsUrl = `wss://stream.binance.com:9443/ws/!ticker@arr`

      console.log('🔗 连接币对列表WebSocket:', wsUrl)

      tickerWebSocket = new WebSocket(wsUrl)

      tickerWebSocket.onopen = () => {
        console.log('✅ 币对列表WebSocket连接成功')
      }

      tickerWebSocket.onmessage = (event) => {
        try {
          const tickerArray = JSON.parse(event.data)

          // 更新symbols数据
          tickerArray.forEach(ticker => {
            const symbolIndex = symbols.value.findIndex(s => s.symbol === ticker.s)
            if (symbolIndex >= 0) {
              symbols.value[symbolIndex] = {
                ...symbols.value[symbolIndex],
                price: parseFloat(ticker.c),
                change: parseFloat(ticker.P),
                volume24h: parseFloat(ticker.v).toLocaleString()
              }
            }
          })

          // 更新当前选中币种的统计数据
          const currentTicker = tickerArray.find(t => t.s === currentSymbol.value)
          if (currentTicker) {
            stats.value = {
              lastPrice: parseFloat(currentTicker.c),
              priceChange: parseFloat(currentTicker.p),
              priceChangePercent: parseFloat(currentTicker.P),
              highPrice: parseFloat(currentTicker.h),
              lowPrice: parseFloat(currentTicker.l),
              volume: parseFloat(currentTicker.v),
              quoteVolume: parseFloat(currentTicker.q)
            }
          }
        } catch (error) {
          console.error('❌ 币对列表WebSocket数据解析错误:', error)
        }
      }

      tickerWebSocket.onerror = (error) => {
        console.error('❌ 币对列表WebSocket连接错误:', error)
      }

      tickerWebSocket.onclose = () => {
        console.log('🔌 币对列表WebSocket连接关闭')
      }
    }

    // 断开币对列表WebSocket连接
    const disconnectTickerWebSocket = () => {
      if (tickerWebSocket) {
        tickerWebSocket.close()
        tickerWebSocket = null
        console.log('🔌 币对列表WebSocket连接已断开')
      }
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
      currentPrice.value = priceData

      // 更新当前价格到统计数据
      if (priceData.close) {
        stats.value.lastPrice = priceData.close

        // 如果有开盘价，计算涨跌幅
        if (priceData.open) {
          const priceChange = priceData.close - priceData.open
          const priceChangePercent = ((priceChange / priceData.open) * 100)

          stats.value.priceChange = priceChange
          stats.value.priceChangePercent = priceChangePercent
        }

        // 更新左侧列表中对应币对的价格
        const symbolIndex = symbols.value.findIndex(s => s.symbol === currentSymbol.value)
        if (symbolIndex !== -1) {
          symbols.value[symbolIndex].price = priceData.close
          // 使用与stats相同的计算逻辑
          if (priceData.open) {
            const change = ((priceData.close - priceData.open) / priceData.open) * 100
            symbols.value[symbolIndex].change = change
          }
        }
      }
    }

    const handleIndicatorChange = (indicators) => {
      activeIndicators.value = indicators
      console.log('活跃指标:', indicators)

      // 使用EventBus更新指标
      indicators.forEach(indicator => {
        if (!chartEventBus.state.activeIndicators.includes(indicator)) {
          chartEventBus.toggleIndicator(indicator)
        }
      })

      // 移除不在新列表中的指标
      chartEventBus.state.activeIndicators.forEach(indicator => {
        if (!indicators.includes(indicator)) {
          chartEventBus.toggleIndicator(indicator)
        }
      })
    }

    // 检查是否应该重定向到移动端
    const checkForMobileRedirect = () => {
      const screenWidth = window.innerWidth
      const userAgent = navigator.userAgent.toLowerCase()

      // 检查屏幕宽度（小于等于768px认为是移动端）
      const isMobileWidth = screenWidth <= 768

      // 检查UA（是移动设备）
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)

      // 如果屏幕宽度小于等于768px或者是移动设备UA，重定向到移动端
      if (isMobileWidth || isMobileUA) {
        router.push('/mobile')
      }
    }

    // 窗口大小变化监听
    const handleResize = () => {
      checkForMobileRedirect()
    }

    onMounted(() => {
      // 初始检查是否需要重定向
      checkForMobileRedirect()

      // 添加窗口大小变化监听
      window.addEventListener('resize', handleResize)
      load24hrStats()

      // 启动币对列表WebSocket连接
      connectTickerWebSocket()

      // 定期更新24小时统计
      setInterval(load24hrStats, 60000) // 每分钟更新一次
    })

    onUnmounted(() => {
      // 清理事件监听
      window.removeEventListener('resize', handleResize)

      // 断开币对列表WebSocket连接
      disconnectTickerWebSocket()
    })

    return {
      currentSymbol,
      selectedInterval,
      searchQuery,
      selectedFilter,
      stats,
      currentPrice,
      activeIndicators,
      filters,
      symbols,
      displaySymbol,
      priceChangeClass,
      filteredSymbols,
      formatPrice,
      formatChange,
      formatPercent,
      formatVolume,
      formatSymbol,
      getSymbolName,
      selectSymbol,
      formatTime,
      handlePriceUpdate,
      handleIndicatorChange
    }
  }
}
</script>

<style scoped>
.trading-view {
  padding-bottom: 80px; /* 为底部操作栏留出空间 */
}

@media (max-width: 768px) {
  .trading-view {
    padding-bottom: 100px;
  }
}
</style>
