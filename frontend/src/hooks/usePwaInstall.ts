import { useCallback, useEffect, useState } from 'react'
import { isStandalonePwa } from '@/pwa/registerServiceWorker'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|MicroMessenger|QQ\//.test(ua)
  return isIOS && isSafari
}

function isAndroidChrome(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/.test(navigator.userAgent) && /Chrome\//.test(navigator.userAgent)
}

export type PwaInstallPlatform = 'ios' | 'android' | 'other'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState<PwaInstallPlatform>(() => {
    if (isIosSafari()) return 'ios'
    if (isAndroidChrome()) return 'android'
    return 'other'
  })

  useEffect(() => {
    if (isStandalonePwa()) return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canNativeInstall = Boolean(deferredPrompt)

  const triggerNativeInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome
  }, [deferredPrompt])

  return {
    platform,
    canNativeInstall,
    triggerNativeInstall,
    isIos: platform === 'ios',
    isAndroid: platform === 'android',
  }
}
