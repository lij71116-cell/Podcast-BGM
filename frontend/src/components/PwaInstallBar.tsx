import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { isStandalonePwa } from '@/pwa/registerServiceWorker'
import { usePlayerStore } from '@/stores/playerStore'
import './PwaInstallBar.css'

const PWA_DISMISS_KEY = 'pwa_dismissed'

function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 1023px)').matches
}

export function PwaInstallBar() {
  const playerVisible = usePlayerStore((s) => s.visible)
  const { platform, canNativeInstall, triggerNativeInstall, isIos } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const syncVisibility = () => {
      const dismissed = sessionStorage.getItem(PWA_DISMISS_KEY) === '1'
      setVisible(isMobileViewport() && !dismissed && !isStandalonePwa())
    }

    syncVisibility()
    const media = window.matchMedia('(max-width: 1023px)')
    media.addEventListener('change', syncVisibility)
    return () => media.removeEventListener('change', syncVisibility)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('has-pwa-bar', visible)
    return () => document.body.classList.remove('has-pwa-bar')
  }, [visible])

  const dismiss = () => {
    sessionStorage.setItem(PWA_DISMISS_KEY, '1')
    setVisible(false)
    setGuideOpen(false)
  }

  const handleInstallClick = async () => {
    if (canNativeInstall) {
      setInstalling(true)
      try {
        const outcome = await triggerNativeInstall()
        if (outcome === 'accepted') {
          dismiss()
        }
      } finally {
        setInstalling(false)
      }
      return
    }

    setGuideOpen(true)
  }

  if (!visible) return null

  const installLabel = canNativeInstall ? '安装' : isIos ? '如何添加' : '查看步骤'

  return (
    <>
      <div
        className={`pwa-bar visible${playerVisible ? ' pwa-bar--above-player' : ''}`}
        role="note"
        aria-label="添加到主屏幕引导"
      >
        <button type="button" className="pwa-bar-text" onClick={() => void handleInstallClick()}>
          添加到主屏幕，像 App 一样打开 Podcast Flow
        </button>
        <div className="pwa-bar-actions">
          <button
            type="button"
            className="pwa-install"
            disabled={installing}
            onClick={() => void handleInstallClick()}
          >
            {installing ? '安装中…' : installLabel}
          </button>
          <button type="button" className="pwa-dismiss" onClick={dismiss}>
            关闭
          </button>
        </div>
      </div>

      <Modal
        open={guideOpen}
        title="添加到主屏幕"
        footer={null}
        onCancel={() => setGuideOpen(false)}
        className="pwa-guide-modal"
        centered
      >
        {platform === 'ios' ? (
          <ol className="pwa-guide-steps">
            <li>
              请使用 <strong>Safari</strong> 打开本站（微信 / 其他 App 内浏览器不支持添加桌面图标）
            </li>
            <li>
              点击底部工具栏的 <strong>分享</strong> 按钮
              <span className="pwa-guide-icon" aria-hidden="true">
                ⎋
              </span>
            </li>
            <li>
              向下滑动，选择 <strong>「添加到主屏幕」</strong>
            </li>
            <li>
              确认名称后点击右上角 <strong>「添加」</strong>，即可在桌面看到 Podcast Flow 图标
            </li>
          </ol>
        ) : platform === 'android' ? (
          <ol className="pwa-guide-steps">
            <li>
              请使用 <strong>Chrome</strong> 打开本站
            </li>
            <li>
              点击右上角 <strong>⋮</strong> 菜单
            </li>
            <li>
              选择 <strong>「安装应用」</strong> 或 <strong>「添加到主屏幕」</strong>
            </li>
            <li>确认后，桌面会出现 Podcast Flow 图标</li>
          </ol>
        ) : (
          <ol className="pwa-guide-steps">
            <li>在浏览器菜单中找到「安装应用」或「添加到主屏幕」</li>
            <li>确认添加后，桌面会出现 Podcast Flow 图标</li>
          </ol>
        )}
        <p className="pwa-guide-note">若已添加过，请到桌面查找图标；旧图标可删除后重新添加以更新。</p>
      </Modal>
    </>
  )
}
