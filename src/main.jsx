import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.jsx'
import WebApp from './web.jsx'

// 环境检测：如果是 Electron 环境使用 App，否则使用 WebApp
const isElectron = typeof window !== 'undefined' && window.electron;
const AppComponent = isElectron ? App : WebApp;

console.log('=== 环境检测 ===');
console.log('isElectron:', isElectron);
console.log('使用组件:', isElectron ? 'App (Electron)' : 'WebApp (Web)');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#e91e63',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <AppComponent />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
