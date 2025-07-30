<template>
  <div class="symbol-selector relative">
    <!-- 触发按钮 -->
    <button
      @click="toggleDropdown"
      class="flex items-center space-x-2 px-3 py-2 rounded hover:bg-trading-border transition-colors duration-200"
    >
      <div class="flex items-center space-x-1">
        <span class="font-medium text-trading-text">{{ formatSymbol(selectedSymbol) }}</span>
      </div>
      <svg 
        class="w-4 h-4 text-trading-text-secondary transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>

    <!-- 下拉菜单 -->
    <div
      v-if="isOpen"
      class="absolute top-full left-0 mt-2 w-64 trading-card border border-trading-border rounded-lg shadow-lg z-50"
    >
      <!-- 搜索框 -->
      <div class="p-3 border-b border-trading-border">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索币对..."
            class="w-full bg-trading-bg border border-trading-border rounded px-3 py-2 text-sm text-trading-text placeholder-trading-text-secondary focus:outline-none focus:border-trading-yellow"
          />
          <svg class="absolute right-3 top-2.5 w-4 h-4 text-trading-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      </div>

      <!-- 币对列表 -->
      <div class="max-h-64 overflow-y-auto">
        <div
          v-for="symbol in filteredSymbols"
          :key="symbol.symbol"
          @click="selectSymbol(symbol.symbol)"
          class="flex items-center justify-between px-3 py-2 hover:bg-trading-border cursor-pointer transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <div>
              <div class="font-medium text-trading-text">{{ formatSymbol(symbol.symbol) }}</div>
              <div class="text-xs text-trading-text-secondary">{{ symbol.name }}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-mono text-trading-text">{{ formatPrice(symbol.price) }}</div>
            <div class="text-xs font-mono" :class="symbol.change >= 0 ? 'text-trading-green' : 'text-trading-red'">
              {{ formatPercent(symbol.change) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 热门币对 -->
      <div class="p-3 border-t border-trading-border">
        <div class="text-xs text-trading-text-secondary mb-2">热门币对</div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="popular in popularSymbols"
            :key="popular"
            @click="selectSymbol(popular)"
            class="px-2 py-1 text-xs rounded bg-trading-border text-trading-text hover:bg-trading-yellow hover:text-black transition-colors duration-200"
          >
            {{ formatSymbol(popular) }}
          </button>
        </div>
      </div>
    </div>

    <!-- 遮罩层 -->
    <div
      v-if="isOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'

export default {
  name: 'SymbolSelector',
  props: {
    modelValue: {
      type: String,
      default: 'BTCUSDT'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const searchQuery = ref('')
    const selectedSymbol = ref(props.modelValue)

    // 支持的币对数据
    const symbols = ref([
      { symbol: 'BTCUSDT', name: 'Bitcoin', price: 118859.99, change: 0.47 },
      { symbol: 'ETHUSDT', name: 'Ethereum', price: 3245.67, change: -1.23 },
      { symbol: 'BNBUSDT', name: 'BNB', price: 692.45, change: 2.15 },
      { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.3847, change: 5.67 },
      { symbol: 'SOLUSDT', name: 'Solana', price: 189.23, change: -0.89 }
    ])

    const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']

    const filteredSymbols = computed(() => {
      if (!searchQuery.value) return symbols.value
      
      const query = searchQuery.value.toLowerCase()
      return symbols.value.filter(symbol => 
        symbol.symbol.toLowerCase().includes(query) ||
        symbol.name.toLowerCase().includes(query)
      )
    })

    const toggleDropdown = () => {
      isOpen.value = !isOpen.value
    }

    const closeDropdown = () => {
      isOpen.value = false
      searchQuery.value = ''
    }

    const selectSymbol = (symbol) => {
      selectedSymbol.value = symbol
      emit('update:modelValue', symbol)
      closeDropdown()
    }

    const formatSymbol = (symbol) => {
      return symbol.replace('USDT', '/USDT')
    }

    const formatPrice = (price) => {
      if (price < 1) {
        return price.toFixed(4)
      }
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const formatPercent = (percent) => {
      const sign = percent >= 0 ? '+' : ''
      return sign + percent.toFixed(2) + '%'
    }

    // 点击外部关闭下拉菜单
    const handleClickOutside = (event) => {
      if (!event.target.closest('.symbol-selector')) {
        closeDropdown()
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      isOpen,
      searchQuery,
      selectedSymbol,
      symbols,
      popularSymbols,
      filteredSymbols,
      toggleDropdown,
      closeDropdown,
      selectSymbol,
      formatSymbol,
      formatPrice,
      formatPercent
    }
  }
}
</script>

<style scoped>
.symbol-selector {
  position: relative;
}
</style>
