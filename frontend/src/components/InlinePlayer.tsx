import { Button, Slider } from 'antd'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useEffect, useState } from 'react'
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress'
import { usePlayerStore } from '@/stores/playerStore'
import type { MixedAudioAssetDTO } from '@/types/api'
import './InlinePlayer.css'

interface InlinePlayerProps {
  asset: MixedAudioAssetDTO
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 详情页播放器 UI，复用底部 GlobalPlayerBar 的同一音频实例与播放记忆。 */
export function InlinePlayer({ asset }: InlinePlayerProps) {
  const playing = usePlayerStore((s) => s.playing)
  const current = usePlayerStore((s) => s.current)
  const progress = usePlayerStore((s) => s.progress)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const resumeHint = usePlayerStore((s) => s.resumeHint)
  const play = usePlayerStore((s) => s.play)
  const toggle = usePlayerStore((s) => s.toggle)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const setVolume = usePlayerStore((s) => s.setVolume)

  const isCurrent = current?.id === asset.id
  const totalDuration = (isCurrent && duration > 0 ? duration : asset.duration) || asset.duration
  const { loadProgress, flushSave } = usePlaybackProgress(asset.id, 'global', totalDuration)

  const [idleProgress, setIdleProgress] = useState(0)
  const [idleResumeHint, setIdleResumeHint] = useState(false)

  useEffect(() => {
    if (isCurrent) return
    let cancelled = false
    void loadProgress().then((resumeAt) => {
      if (cancelled) return
      if (resumeAt > 0) {
        setIdleProgress(resumeAt)
        setIdleResumeHint(true)
      } else {
        setIdleProgress(0)
        setIdleResumeHint(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [asset.id, isCurrent, loadProgress])

  useEffect(() => {
    if (!idleResumeHint || isCurrent) return
    const timer = window.setTimeout(() => setIdleResumeHint(false), 5000)
    return () => window.clearTimeout(timer)
  }, [idleResumeHint, isCurrent])

  const displayProgress = isCurrent ? progress : idleProgress
  const displayPlaying = isCurrent && playing
  const showResumeHint = isCurrent ? resumeHint : idleResumeHint

  const handleToggle = () => {
    if (asset.status !== 'completed') {
      message.warning('组合音频尚未合成完成，暂不可播放')
      return
    }
    if (isCurrent) {
      toggle()
      return
    }
    play(asset)
  }

  const handleProgressChange = (value: number) => {
    if (asset.status !== 'completed') return
    if (isCurrent) {
      setProgress(value)
    } else {
      play(asset)
      setProgress(value)
    }
    void flushSave(value, totalDuration || undefined)
  }

  return (
    <section className="inline-player-card">
      {showResumeHint && <span className="inline-player-resume-tag">续播进度</span>}
      <div className="inline-player-controls">
        <Button
          type="primary"
          shape="circle"
          icon={displayPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={handleToggle}
          disabled={asset.status !== 'completed'}
        />
        <Slider
          className="inline-player-progress"
          min={0}
          max={totalDuration || 1}
          value={displayProgress}
          onChange={handleProgressChange}
          disabled={asset.status !== 'completed'}
          tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
        />
        <span className="inline-player-time">
          {formatTime(displayProgress)} / {formatTime(totalDuration)}
        </span>
      </div>
      <div className="inline-player-volume">
        <span>音量</span>
        <Slider min={0} max={100} value={volume} onChange={setVolume} />
        <span className="inline-player-volume-val">{volume}%</span>
      </div>
    </section>
  )
}
