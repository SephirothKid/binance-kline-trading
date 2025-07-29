/**
 * 设备检测工具
 */

export const isMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // 检测移动设备
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileDevice = mobileRegex.test(userAgent);
  
  // 检测屏幕尺寸
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobileDevice || isSmallScreen;
};

export const getDeviceType = () => {
  if (isMobile()) {
    return 'mobile';
  }
  return 'desktop';
};

export const redirectToMobileIfNeeded = (router) => {
  if (isMobile() && router.currentRoute.value.path.startsWith('/desktop')) {
    router.push('/mobile');
  }
};
