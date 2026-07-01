import {
  CaretRightOutlined,
  CloseOutlined,
  PauseOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { message } from 'antd'
import { useEffect, useRef } from 'react'
import { MOCK_COVER_COLORS } from '@/mocks/data'
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress'
import { MOBILE_AUDIO_ATTRS, useMediaSession } from '@/hooks/useMediaSession'
import { usePlayerStore } from '@/stores/playerStore'
import './GlobalPlayerBar.css'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function GlobalPlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const resumeAppliedRef = useRef<string | null>(null)
  const {
    visible,
    playing,
    current,
    progress,
    duration,
    volume,
    accentColor,
    resumeHint,
    registerAudio,
    toggle,
    close,
    setProgress,
    setVolume,
    syncProgress,
    syncDuration,
    setPlaying,
    setResumeHint,
    clearResumeHint,
  } = usePlayerStore()

  const totalDuration = duration || current?.duration || 0
  const { loadProgress, scheduleSave, flushSave } = usePlaybackProgress(
    current?.id,
    'global',
    totalDuration,
  )

  useMediaSession(
    Boolean(current && visible),
    current
      ? {
          title: current.title,
          artist: current.podcast.podcast_name,
          album: 'Podcast Flow',
          artworkUrl: current.podcast.cover_url || undefined,
        }
      : null,
    {
      playing,
      duration: totalDuration,
      position: progress,
      onPlay: () => {
        if (!playing) toggle()
      },
      onPause: () => {
        if (playing) toggle()
      },
      onSeek: (seconds) => {
        setProgress(seconds)
        if (current) void flushSave(seconds, totalDuration || undefined)
      },
    },
  )

  useEffect(() => {
    registerAudio(audioRef.current)
    return () => registerAudio(null)
  }, [registerAudio])

  useEffect(() => {
    document.body.classList.toggle('has-player', visible)
    return () => document.body.classList.remove('has-player')
  }, [visible])

  useEffect(() => {
    if (!current?.id) return
    let cancelled = false
    void loadProgress().then((resumeAt) => {
      if (cancelled || resumeAt <= 0) return
      // 用户已在详情页拖动进度条时，避免异步续播覆盖手动 seek
      if (usePlayerStore.getState().progress > 0) return
      setProgress(resumeAt)
      setResumeHint(true)
    })
    return () => {
      cancelled = true
    }
  }, [current?.id, loadProgress, setProgress, setResumeHint])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const next = Math.floor(audio.currentTime)
      syncProgress(next)
      scheduleSave(next, totalDuration || undefined)
    }
    const onLoadedMetadata = () => {
      const metaDuration = Math.floor(audio.duration)
      if (metaDuration > 0) syncDuration(metaDuration)
      if (current && resumeAppliedRef.current !== current.id && progress > 0) {
        audio.currentTime = progress
        resumeAppliedRef.current = current.id
      }
    }
    const onEnded = () => {
      setPlaying(false)
      if (current) {
        void flushSave(0, totalDuration || undefined)
      }
    }
    const onError = () => {
      setPlaying(false)
      message.error('播放失败，组合音频可能尚未合成完成或文件不存在')
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [
    current,
    progress,
    flushSave,
    scheduleSave,
    setPlaying,
    syncDuration,
    syncProgress,
    totalDuration,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return

    resumeAppliedRef.current = null
    audio.src = current.play_url
    audio.volume = volume / 100
    audio.load()
    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false)
        message.error('播放失败，请稍后重试')
      })
    }
  }, [current?.id, current?.play_url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return

    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false)
        message.error('播放失败，请稍后重试')
      })
    } else {
      audio.pause()
      void flushSave(Math.floor(audio.currentTime), totalDuration || undefined)
    }
  }, [playing, current?.id, flushSave, setPlaying, totalDuration])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  useEffect(() => {
    if (!resumeHint) return
    const timer = window.setTimeout(() => clearResumeHint(), 5000)
    return () => window.clearTimeout(timer)
  }, [resumeHint, clearResumeHint])

  const handleClose = () => {
    const audio = audioRef.current
    if (current && audio) {
      void flushSave(Math.floor(audio.currentTime), totalDuration || undefined)
    }
    close()
  }

  const handleToggle = () => {
    toggle()
  }

  const handleProgressChange = (value: number) => {
    setProgress(value)
    if (current) {
      void flushSave(value, totalDuration || undefined)
    }
  }

  if (!visible || !current) {
    return (
      <>
        <audio ref={audioRef} {...MOBILE_AUDIO_ATTRS} style={{ display: 'none' }} />
      </>
    )
  }

  const coverColor = MOCK_COVER_COLORS[current.id] ?? accentColor
  const coverInitial = current.podcast.podcast_name.slice(0, 1)
  const progressPercent =
    totalDuration > 0 ? Math.min(100, Math.round((progress / totalDuration) * 100)) : 0

  return (
    <>
      <audio ref={audioRef} {...MOBILE_AUDIO_ATTRS} style={{ display: 'none' }} />
      <div
        className="global-player global-player-bar visible"
        role="region"
        aria-label="全局播放器"
        style={
          {
            '--player-accent': accentColor,
            '--player-progress-pct': `${progressPercent}%`,
            '--player-volume-pct': `${volume}%`,
          } as React.CSSProperties
        }
      >
        <div className="player-info">
          <div className="cover-xs global-player-cover" style={{ background: coverColor }}>
            {current.podcast.cover_url ? (
              <img src={current.podcast.cover_url} alt="" className="cover-img" />
            ) : (
              coverInitial
            )}
          </div>
          <div className="player-info-text">
            <h4 className="player-title">{current.title}</h4>
            <p className="player-podcast">{current.podcast.podcast_name}</p>
            {resumeHint && (
              <span className="global-player-resume-tag">续播进度</span>
            )}
          </div>
        </div>

        <div className="player-center">
          <button
            type="button"
            className="play-btn"
            aria-label={playing ? '暂停' : '播放'}
            onClick={handleToggle}
          >
            {playing ? (
              <PauseOutlined style={{ fontSize: 22, color: '#fff' }} />
            ) : (
              <CaretRightOutlined style={{ fontSize: 22, color: '#fff' }} />
            )}
          </button>
          <div className="player-progress">
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              value={progress}
              aria-label="播放进度"
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              style={
                {
                  '--player-accent': accentColor,
                  '--player-progress-pct': `${progressPercent}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <span className="player-time">
            {formatTime(progress)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="player-right">
          <div className="player-volume">
            <SoundOutlined style={{ fontSize: 18, color: 'var(--text-secondary)' }} />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              aria-label="音量"
              onChange={(e) => setVolume(Number(e.target.value))}
              style={
                {
                  '--player-accent': accentColor,
                  '--player-volume-pct': `${volume}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <button type="button" className="close-player" aria-label="关闭播放器" onClick={handleClose}>
            <CloseOutlined />
          </button>
        </div>
      </div>
    </>
  )
}
