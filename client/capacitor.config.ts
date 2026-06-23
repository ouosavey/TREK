import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.trek.app',
  appName: 'TREK',
  webDir: 'dist',
  // 移动端不使用 PWA service worker（Capacitor 直接加载本地文件）
  server: {
    androidScheme: 'https',
    // 清除缓存，确保加载最新版本
    clearText: true,
  },
  android: {
    // 允许混合内容（HTTP API 请求）
    allowMixedContent: true,
    // 启用 WebView 调试（发布时可关闭）
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#09090b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'LARGE',
      spinnerColor: '#6366f1',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#111827',
    },
  },
}

export default config
