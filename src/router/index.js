import { createRouter, createWebHistory } from 'vue-router'
import { isMobile } from '@/utils/deviceDetection'

const routes = [
  {
    path: '/',
    redirect: () => {
      return isMobile() ? '/mobile' : '/desktop'
    }
  },
  {
    path: '/desktop',
    name: 'DesktopTrading',
    component: () => import('@/views/Desktop/TradingView.vue'),
    meta: { requiresDesktop: true }
  },
  {
    path: '/mobile',
    name: 'MobileTrading', 
    component: () => import('@/views/Mobile/TradingView.vue'),
    meta: { requiresMobile: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 根据设备类型重定向
router.beforeEach((to, from, next) => {
  const mobile = isMobile()
  
  if (to.meta.requiresDesktop && mobile) {
    next('/mobile')
  } else if (to.meta.requiresMobile && !mobile) {
    next('/desktop')
  } else {
    next()
  }
})

export default router
