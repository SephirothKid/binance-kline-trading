<template>
  <div class="timeframe-selector">
    <!-- 时间周期选择 -->
    <div class="flex items-center space-x-1 mb-4 relative">
      <!-- 基础时间周期（除了"更多"） -->
      <button
        v-for="timeframe in baseTimeframes"
        :key="timeframe.value"
        @click="selectTimeframe(timeframe.value)"
        :class="[
          'px-3 py-1 text-sm rounded transition-colors duration-200',
          selectedTimeframe === timeframe.value
            ? 'bg-trading-yellow text-black font-medium'
            : 'text-trading-text-secondary hover:text-trading-text hover:bg-trading-border'
        ]"
      >
        {{ timeframe.label }}
      </button>

      <!-- 更多时间周期 -->
      <button
        v-if="selectedMoreTimeframe"
        @click="selectTimeframe(selectedMoreTimeframe)"
        :class="[
          'px-3 py-1 text-sm rounded transition-colors duration-200',
          selectedTimeframe === selectedMoreTimeframe
            ? 'bg-trading-yellow text-black font-medium'
            : 'text-trading-text-secondary hover:text-trading-text hover:bg-trading-border'
        ]"
      >
        {{ moreTimeframes.find(t => t.value === selectedMoreTimeframe)?.label }}
      </button>

      <!-- 更多按钮 -->
      <button
        @click="selectTimeframe('more')"
        class="px-3 py-1 text-sm rounded transition-colors duration-200 text-trading-text-secondary hover:text-trading-text hover:bg-trading-border"
      >
        更多
        <svg class="w-3 h-3 ml-1 inline" :class="{ 'rotate-180': showMoreTimeframes }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <!-- 更多时间周期下拉菜单 -->
      <div
        v-if="showMoreTimeframes"
        class="absolute top-full left-0 mt-2 w-64 bg-trading-card border border-trading-border rounded-lg shadow-lg z-50"
      >
        <div class="p-3">
          <div class="text-xs text-trading-text-secondary mb-2">更多时间周期</div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="timeframe in moreTimeframes"
              :key="timeframe.value"
              @click="selectMoreTimeframe(timeframe)"
              class="px-2 py-1 text-xs rounded transition-colors duration-200 text-center text-trading-text-secondary hover:text-trading-text hover:bg-trading-border"
            >
              {{ timeframe.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 技术指标选择 -->
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center space-x-2">
        <button
          v-for="indicator in mainIndicators"
          :key="indicator.key"
          @click="toggleIndicator(indicator.key)"
          :class="[
            'px-3 py-1 rounded text-xs transition-colors duration-200 border',
            activeIndicators.includes(indicator.key)
              ? 'bg-trading-yellow text-black border-trading-yellow'
              : 'text-trading-text-secondary hover:text-trading-text hover:bg-trading-border border-trading-border'
          ]"
        >
          {{ indicator.label }}
        </button>

        <!-- 更多指标下拉 - 暂时注释掉 -->
        <!--
        <div class="relative">
          <button
            @click="showMoreIndicators = !showMoreIndicators"
            class="px-3 py-1 rounded text-xs transition-colors duration-200 border border-trading-border text-trading-text-secondary hover:text-trading-text hover:bg-trading-border flex items-center"
          >
            更多
            <svg class="w-3 h-3 ml-1" :class="{ 'rotate-180': showMoreIndicators }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <div
            v-if="showMoreIndicators"
            class="absolute top-full left-0 mt-2 w-64 bg-trading-card border border-trading-border rounded-lg shadow-lg z-50"
          >
            <div class="p-3">
              <div class="text-xs text-trading-text-secondary mb-2">技术指标</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="indicator in moreIndicators"
                  :key="indicator.key"
                  @click="toggleIndicator(indicator.key)"
                  :class="[
                    'px-2 py-1 text-xs rounded transition-colors duration-200 text-center',
                    activeIndicators.includes(indicator.key)
                      ? 'bg-trading-yellow text-black'
                      : 'text-trading-text-secondary hover:text-trading-text hover:bg-trading-border'
                  ]"
                >
                  {{ indicator.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
        -->
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { chartEventBus } from '@/utils/chartEventBus'

export default {
  name: 'TimeframeSelector',
  props: {
    modelValue: {
      type: String,
      default: '1m'
    }
  },
  emits: ['update:modelValue', 'indicatorChange'],
  setup(props, { emit }) {
    const selectedTimeframe = ref(props.modelValue)
    const activeIndicators = computed(() => chartEventBus.state.activeIndicators)
    const showMoreIndicators = ref(false)

    // 基础时间周期（不包含"更多"）
    const baseTimeframes = [
      { label: '分时', value: 'time' },
      { label: '1分', value: '1m' },
      { label: '3分', value: '3m' },
      { label: '5分', value: '5m' },
      { label: '15分', value: '15m' },
      { label: '1小时', value: '1h' },
      { label: '日线', value: '1d' }
    ]

    // 更多时间周期选项
    const moreTimeframes = [
      { label: '2小时', value: '2h' },
      { label: '4小时', value: '4h' },
      { label: '6小时', value: '6h' },
      { label: '12小时', value: '12h' },
      { label: '周线', value: '1w' },
      { label: '月线', value: '1M' }
    ]

    const showMoreTimeframes = ref(false)
    const selectedMoreTimeframe = ref(null) // 只保存一个选中的更多时间周期

    // 主要指标（显示在顶部）
    const mainIndicators = [
      { key: 'MA', label: 'MA' },
      { key: 'EMA', label: 'EMA' },
      { key: 'WMA', label: 'WMA' },
      { key: 'BOLL', label: 'BOLL' },
      { key: 'VWAP', label: 'VWAP' },
      { key: 'AVL', label: 'AVL' },
      { key: 'TRIX', label: 'TRIX' },
      { key: 'SAR', label: 'SAR' }
    ]

    // 更多指标（在下拉菜单中）
    const moreIndicators = [
      { key: 'MACD', label: 'MACD' },
      { key: 'RSI', label: 'RSI' },
      { key: 'KDJ', label: 'KDJ' },
      { key: 'VOL', label: 'VOL' },
      { key: 'OBV', label: 'OBV' },
      { key: 'CCI', label: 'CCI' },
      { key: 'WR', label: 'WR' },
      { key: 'MTM', label: 'MTM' },
      { key: 'PSY', label: 'PSY' }
    ]

    const selectTimeframe = (timeframe) => {
      if (timeframe === 'more') {
        // 显示更多时间周期选项
        showMoreTimeframes.value = !showMoreTimeframes.value
        return
      }

      selectedTimeframe.value = timeframe
      emit('update:modelValue', timeframe)
    }

    const selectMoreTimeframe = (timeframe) => {
      // 替换当前选择的更多时间周期（始终只保持一个）
      selectedMoreTimeframe.value = timeframe.value

      selectedTimeframe.value = timeframe.value
      emit('update:modelValue', timeframe.value)
      showMoreTimeframes.value = false
    }

    const toggleIndicator = (indicator) => {
      // 使用EventBus切换指标
      chartEventBus.toggleIndicator(indicator)

      // 关闭下拉菜单
      showMoreIndicators.value = false

      // 发送事件给父组件
      emit('indicatorChange', chartEventBus.state.activeIndicators)
    }

    return {
      selectedTimeframe,
      activeIndicators,
      showMoreIndicators,
      baseTimeframes,
      moreTimeframes,
      showMoreTimeframes,
      selectedMoreTimeframe,
      mainIndicators,
      moreIndicators,
      selectTimeframe,
      selectMoreTimeframe,
      toggleIndicator
    }
  }
}
</script>
