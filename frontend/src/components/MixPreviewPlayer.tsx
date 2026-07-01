import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Slider } from 'antd'
import { CaretRightOutlined, LoadingOutlined, PauseOutlined, SoundOutlined } from '@ant-design/icons'
import { MOBILE_AUDIO_ATTRS } from '@/hooks/useMediaSession'
import './MixPreviewPlayer.css'

interface MixPreviewPlayerProps {
  podcastId: string
  bgmId: string
  /** 解析得到的播客总时长（秒），用于流式音频 metadata 不完整时的显示 */
  podcastDurationSec: number
  podcastVolume: number
  podcastPlaybackRate: number
  bgmVolume: number
  bgmPlaybackRate: number
  bgmLoop: boolean
  masterVolume: number
  onMasterVolumeChange: (value: number) => void
  playToken: number
  onError?: (message: string) => void
}

const podcastStreamUrl = (id: string) => `/api/podcasts/${id}/stream`
const bgmStreamUrl = (id: string) => `/api/bgm/${id}/stream`

function clampRate(rate: number): number {
  return Math.min(2, Math.max(0.6, rate))
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function syncBgmTime(bgm: HTMLAudioElement, podcastTime: number) {
  if (!Number.isFinite(bgm.duration) || bgm.duration <= 0) {
    bgm.currentTime = podcastTime
    return
  }
  bgm.currentTime = podcastTime % bgm.duration
}

function isTouchPreviewDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(max-width: 1024px)').matches)
  )
}

function waitForCanPlay(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('audio load failed'))
    }
    const cleanup = () => {
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onError)
    }
    audio.addEventListener('canplay', onReady, { once: true })
    audio.addEventListener('error', onError, { once: true })
  })
}

export function MixPreviewPlayer({
  podcastId,
  bgmId,
  podcastDurationSec,
  podcastVolume,
  podcastPlaybackRate,
  bgmVolume,
  bgmPlaybackRate,
  bgmLoop,
  masterVolume,
  onMasterVolumeChange,
  playToken,
  onError,
}: MixPreviewPlayerProps) {
  const podcastRef = useRef<HTMLAudioElement>(null)
  const bgmRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [streamDuration, setStreamDuration] = useState(0)
  const [streamsReady, setStreamsReady] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const totalDuration = Math.max(
    podcastDurationSec,
    Number.isFinite(streamDuration) && streamDuration > 0 ? streamDuration : 0,
  )

  const pauseAudioElements = useCallback(() => {
    podcastRef.current?.pause()
    bgmRef.current?.pause()
  }, [])

  const startBoth = useCallback(async () => {
    const podcast = podcastRef.current
    const bgm = bgmRef.current
    if (!podcast || !bgm) return

    syncBgmTime(bgm, podcast.currentTime)

    // iOS / 移动端：必须在同一同步调用栈内触发两路 play()，不能 await 完播客再播 BGM
    const podcastPlay = podcast.play()
    const bgmPlay = bgm.play()
    const [podcastResult, bgmResult] = await Promise.allSettled([podcastPlay, bgmPlay])

    const podcastOk = podcastResult.status === 'fulfilled'
    const bgmOk = bgmResult.status === 'fulfilled'

    if (podcastOk && bgmOk) {
      setPlaying(true)
      return
    }

    if (podcastOk && !bgmOk) {
      onError?.('BGM 未能同步播放，请再次点击播放按钮')
      setPlaying(true)
      return
    }

    if (!podcastOk && bgmOk) {
      bgm.pause()
    }

    onError?.('无法播放试听，请检查网络后点击播放按钮')
    setPlaying(false)
  }, [onError])

  useEffect(() => {
    const podcast = podcastRef.current
    const bgm = bgmRef.current
    const masterScale = Math.min(1, Math.max(0, masterVolume / 100))
    if (podcast) {
      podcast.volume = Math.min(1, Math.max(0, (podcastVolume / 100) * masterScale))
    }
    if (bgm) {
      bgm.volume = Math.min(1, Math.max(0, (bgmVolume / 100) * masterScale))
    }
  }, [podcastVolume, bgmVolume, masterVolume])

  useEffect(() => {
    const podcast = podcastRef.current
    if (podcast) {
      podcast.playbackRate = clampRate(podcastPlaybackRate)
    }
  }, [podcastPlaybackRate])

  useEffect(() => {
    const bgm = bgmRef.current
    if (bgm) {
      bgm.playbackRate = clampRate(bgmPlaybackRate)
    }
  }, [bgmPlaybackRate])

  useEffect(() => {
    const bgm = bgmRef.current
    if (bgm) {
      bgm.loop = bgmLoop
    }
  }, [bgmLoop])

  useEffect(() => {
    const podcast = podcastRef.current
    const bgm = bgmRef.current
    if (!podcast || !bgm) return

    const syncStreamDuration = () => {
      if (Number.isFinite(podcast.duration) && podcast.duration > 0) {
        setStreamDuration(Math.floor(podcast.duration))
      }
    }
    const onTimeUpdate = () => {
      setProgress(Math.floor(podcast.currentTime))
      if (playing) {
        syncBgmTime(bgm, podcast.currentTime)
      }
    }
    const onLoadedMetadata = syncStreamDuration
    const onDurationChange = syncStreamDuration
    const onEnded = () => {
      bgm.pause()
      setPlaying(false)
    }
    const onPodcastError = () => {
      onError?.('播客音频加载失败，请重新解析播客后再试')
      bgm.pause()
      setPlaying(false)
      setStreamsReady(false)
    }
    const onBgmError = () => {
      onError?.('BGM 加载失败，请重新上传或选择 BGM 后再试')
      if (!podcast.paused) {
        podcast.pause()
      }
      setPlaying(false)
    }

    podcast.addEventListener('timeupdate', onTimeUpdate)
    podcast.addEventListener('loadedmetadata', onLoadedMetadata)
    podcast.addEventListener('durationchange', onDurationChange)
    podcast.addEventListener('ended', onEnded)
    podcast.addEventListener('error', onPodcastError)
    bgm.addEventListener('error', onBgmError)

    return () => {
      podcast.removeEventListener('timeupdate', onTimeUpdate)
      podcast.removeEventListener('loadedmetadata', onLoadedMetadata)
      podcast.removeEventListener('durationchange', onDurationChange)
      podcast.removeEventListener('ended', onEnded)
      podcast.removeEventListener('error', onPodcastError)
      bgm.removeEventListener('error', onBgmError)
    }
  }, [playing, onError])

  useEffect(() => {
    const podcast = podcastRef.current
    const bgm = bgmRef.current
    if (!podcast || !bgm) return

    let cancelled = false
    setPreparing(true)
    setStreamsReady(false)
    setPlaying(false)
    setProgress(0)
    podcast.currentTime = 0
    bgm.currentTime = 0
    podcast.load()
    bgm.load()

    void (async () => {
      try {
        await Promise.all([waitForCanPlay(podcast), waitForCanPlay(bgm)])
        if (cancelled) return
        setStreamsReady(true)
        setPreparing(false)
        if (!isTouchPreviewDevice()) {
          await startBoth()
        }
      } catch {
        if (cancelled) return
        setPreparing(false)
        onError?.('试听音频加载失败，请稍后重试')
      }
    })()

    return () => {
      cancelled = true
      pauseAudioElements()
    }
  }, [playToken, pauseAudioElements, startBoth, onError])

  const handleToggle = () => {
    if (preparing || !streamsReady) return
    if (playing) {
      pauseAudioElements()
      setPlaying(false)
    } else {
      void startBoth()
    }
  }

  const handleSeek = (value: number) => {
    const podcast = podcastRef.current
    const bgm = bgmRef.current
    if (!podcast) return
    podcast.currentTime = value
    if (bgm) syncBgmTime(bgm, value)
    setProgress(value)
  }

  if (playToken <= 0) {
    return null
  }

  const sliderMax = totalDuration > 0 ? totalDuration : Math.max(progress, 1)
  const playDisabled = preparing || !streamsReady

  return (
    <div className="mix-preview-player">
      <audio
        key={`podcast-${podcastId}-${playToken}`}
        ref={podcastRef}
        {...MOBILE_AUDIO_ATTRS}
        src={podcastStreamUrl(podcastId)}
        style={{ display: 'none' }}
        aria-hidden
      />
      <audio
        key={`bgm-${bgmId}-${playToken}`}
        ref={bgmRef}
        {...MOBILE_AUDIO_ATTRS}
        src={bgmStreamUrl(bgmId)}
        style={{ display: 'none' }}
        aria-hidden
      />
      <div className="mix-preview-player-head">
        <div className="mix-preview-player-head-left">
          <Button
            type="primary"
            shape="circle"
            className="mix-preview-player-play-btn"
            icon={
              preparing ? (
                <LoadingOutlined spin />
              ) : playing ? (
                <PauseOutlined />
              ) : (
                <CaretRightOutlined />
              )
            }
            onClick={handleToggle}
            disabled={playDisabled}
            aria-label={
              preparing ? '试听加载中' : playing ? '暂停试听' : '播放试听'
            }
          />
          <div className="mix-preview-player-meta">
            <p className="mix-preview-player-title">
              {preparing ? '正在加载试听…' : playing ? '试听播放中' : '试听已就绪'}
            </p>
            <p className="mix-preview-player-subtitle">
              {preparing
                ? '正在缓冲播客与 BGM，请稍候'
                : streamsReady && !playing && isTouchPreviewDevice()
                  ? '请点击播放按钮开始混音试听'
                  : '完整混音试听 · 音量与倍速可在左侧调整'}
            </p>
          </div>
        </div>
        <span className="mix-preview-player-time">
          {formatTime(progress)} / {formatTime(sliderMax)}
        </span>
      </div>
      <div className={`preview-wave-bars${playing ? '' : ' paused'}`} aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="preview-controls-row">
        <span className="mix-preview-control-label">进度</span>
        <Slider
          className="mix-preview-player-progress"
          min={0}
          max={sliderMax}
          value={Math.min(progress, sliderMax)}
          onChange={handleSeek}
          disabled={playDisabled}
          tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
        />
      </div>
      <div className="preview-controls-row">
        <SoundOutlined className="mix-preview-volume-icon" aria-hidden />
        <Slider
          className="mix-preview-player-volume"
          min={0}
          max={100}
          value={masterVolume}
          onChange={onMasterVolumeChange}
          disabled={playDisabled}
          tooltip={{ formatter: (v) => `${v ?? 0}%` }}
        />
        <span className="mix-preview-control-value">{masterVolume}%</span>
      </div>
    </div>
  )
}
