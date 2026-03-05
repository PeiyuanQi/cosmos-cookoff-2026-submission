import { useState, useRef, useEffect, useCallback } from 'react'

const SYSTEM_PROMPT = [
  'You are an experienced photographer.',
  'Please give a brief review of the photos from the user, including a review score, a few sentences of ',
  'comments, and suggest practical small changes if score is below 95 ',
  '(e.g. tilt up the camera, lower the light, zoom in a bit, suggest a new posture) ',
  'to improve the photo quality. ',
  'The review score is a number ',
  'from 0 - 100. ',
  'If the score is above 95, just say "Good photo" and congratulate the user.\n',
].join(' ')
const MODEL_ID = 'nvidia/Cosmos-Reason2-8B'
const MIN_ZOOM = 1
const MAX_ZOOM = 3

function ensureScheme(url) {
  const s = (url || '').trim()
  if (!s) return ''
  return s.startsWith('http://') || s.startsWith('https://') ? s : `http://${s}`
}

export default function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const dragStartRef = useRef({ y: 0, exposure: 0 })
  const didDragRef = useRef(false)
  const cameraEffectCancelledRef = useRef(false)

  const [serverUrl, setServerUrl] = useState('')
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [exposureComp, setExposureComp] = useState(0)
  const [capturedImage, setCapturedImage] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Load server URL from public file
  useEffect(() => {
    fetch('/server-url.txt')
      .then((r) => r.text())
      .then((text) => setServerUrl(text.trim()))
      .catch(() => setServerUrl(''))
  }, [])

  // Request camera and start preview
  useEffect(() => {
    let stream = null
    cameraEffectCancelledRef.current = false
    setError(null)
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cameraEffectCancelledRef.current) setError('Camera API not available in this browser.')
        return
      }
      if (!window.isSecureContext) {
        if (!cameraEffectCancelledRef.current) {
          setError('Camera requires a secure context: use https:// or open the app from http://localhost (not your IP address).')
        }
        return
      }
      try {
        try {
          let streamOpts = {
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          }
          stream = await navigator.mediaDevices.getUserMedia(streamOpts)
        } catch (first) {
          if (first?.name === 'OverconstrainedError' || first?.name === 'NotFoundError') {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            } catch {
              throw first
            }
          } else {
            throw first
          }
        }
        if (cameraEffectCancelledRef.current) return
        streamRef.current = stream
        video.srcObject = stream
        await video.play()
        if (cameraEffectCancelledRef.current) return
        setCameraReady(true)
      } catch (e) {
        if (cameraEffectCancelledRef.current) return
        const name = e?.name || 'Error'
        const msg = e?.message || ''
        if (name === 'AbortError') {
          setCameraReady(false)
          return
        }
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Camera permission denied. Allow camera access in your browser (or system settings) and refresh.')
        } else if (name === 'NotFoundError') {
          setError('No camera found. Connect a camera or try another browser.')
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError('Camera in use by another app. Close other apps using the camera and refresh.')
        } else if (name === 'OverconstrainedError') {
          setError('Camera does not support requested settings. Try another browser or device.')
        } else {
          setError(`Camera error: ${name}${msg ? ` — ${msg}` : ''}`)
        }
        setCameraReady(false)
      }
    }
    start()
    return () => {
      cameraEffectCancelledRef.current = true
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      streamRef.current = null
      if (video?.srcObject) {
        video.srcObject = null
      }
      setCameraReady(false)
    }
  }, [])

  // Draw video to canvas with zoom (centered crop)
  const drawPreview = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !streamRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawPreview)
      return
    }
    const w = canvas.width
    const h = canvas.height
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      rafRef.current = requestAnimationFrame(drawPreview)
      return
    }
    const ctx = canvas.getContext('2d')
    const baseScale = Math.max(w / vw, h / vh)
    const scale = baseScale * zoom
    const drawW = vw * scale
    const drawH = vh * scale
    const sx = 0
    const sy = 0
    const dx = (w - drawW) / 2
    const dy = (h - drawH) / 2
    ctx.drawImage(video, sx, sy, vw, vh, dx, dy, drawW, drawH)
    rafRef.current = requestAnimationFrame(drawPreview)
  }, [zoom])

  useEffect(() => {
    if (!cameraReady) return
    rafRef.current = requestAnimationFrame(drawPreview)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cameraReady, drawPreview])

  // Resize canvas to match container at native pixel density
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const onResize = () => {
      const container = canvas.parentElement
      if (!container) return
      const dpr = window.devicePixelRatio || 1
      const cssW = container.clientWidth
      const cssH = container.clientHeight
      const bufW = Math.round(cssW * dpr)
      const bufH = Math.round(cssH * dpr)
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW
        canvas.height = bufH
      }
    }
    onResize()
    video.addEventListener('loadedmetadata', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(canvas.parentElement)
    return () => {
      video.removeEventListener('loadedmetadata', onResize)
      ro.disconnect()
    }
  }, [cameraReady])

  // Click to focus (best-effort; many devices don't support)
  const handleFocusTap = useCallback(
    (e) => {
      const stream = streamRef.current
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!stream || !video || !canvas) return
      const track = stream.getVideoTracks()[0]
      if (!track) return
      const caps = track.getCapabilities?.()
      if (!caps || !('focusMode' in caps)) return
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      const focusDistance = 1 - Math.max(0, Math.min(1, (x + y) / 2))
      track
        .applyConstraints({
          advanced: [{ focusMode: 'manual', focusDistance }],
        })
        .catch(() => {})
    },
    []
  )

  // Touch/mouse drag for exposure
  const handleExposureStart = useCallback((clientY) => {
    dragStartRef.current = { y: clientY, exposure: exposureComp }
  }, [exposureComp])

  const handleExposureMove = useCallback(
    (clientY) => {
      const stream = streamRef.current
      const track = stream?.getVideoTracks()?.[0]
      const caps = track?.getCapabilities?.()
      if (!caps || !('exposureCompensation' in caps)) return
      const { min, max } = caps.exposureCompensation
      const delta = (dragStartRef.current.y - clientY) * 0.02
      let next = dragStartRef.current.exposure + delta
      next = Math.max(min, Math.min(max, next))
      setExposureComp(next)
      track
        ?.applyConstraints({
          advanced: [{ exposureCompensation: next }],
        })
        .catch(() => {})
    },
    []
  )

  const onPointerDown = useCallback(
    (e) => {
      didDragRef.current = false
      handleExposureStart(e.clientY)
    },
    [handleExposureStart]
  )
  const onPointerMove = useCallback(
    (e) => {
      if (e.buttons !== 1 && e.pointerType !== 'touch') return
      didDragRef.current = true
      handleExposureMove(e.clientY)
    },
    [handleExposureMove]
  )
  const onPointerUp = useCallback(() => {}, [])
  const onClickCanvas = useCallback(
    (e) => {
      if (!didDragRef.current) handleFocusTap(e)
    },
    [handleFocusTap]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerDown, onPointerMove, onPointerUp])

  // Capture and send to backend
  const capture = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    setResponseText('')
    const base64 = dataUrl.split(',')[1]
    if (!base64) return

    const base = ensureScheme(serverUrl)
    if (!base) {
      setResponseText('Error: No server URL in server-url.txt')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_ID,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: SYSTEM_PROMPT +'Answer the question using the following format:\n<think>\nYour reasoning.\n</think>\nWrite your final answer immediately after the </think> tag.\n',},
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content ?? ''
      setResponseText(content || 'No response.')
    } catch (e) {
      const msg = e?.message || 'Unknown error'
      if (msg === 'failed to fetch' || (e?.name === 'TypeError' && msg.includes('fetch'))) {
        setResponseText(
          `Error: Could not reach the server at ${base}. Check: (1) Server is running, (2) URL in public/server-url.txt is correct (e.g. localhost:8000 or IP:8000), (3) If the app is on another origin, the server must allow CORS (e.g. vLLM with --allowed-origins '*').`
        )
      } else {
        setResponseText(`Error: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }, [serverUrl])

  const resetCapture = useCallback(() => {
    setCapturedImage(null)
    setResponseText('')
  }, [])

  const savePhoto = useCallback(() => {
    if (!capturedImage) return
    const a = document.createElement('a')
    a.href = capturedImage
    a.download = `photo-${Date.now()}.jpg`
    a.click()
  }, [capturedImage])

  if (error) {
    return (
      <div style={styles.fullScreen}>
        <p style={styles.error}>{error}</p>
      </div>
    )
  }

  return (
    <div style={styles.fullScreen}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={styles.hiddenVideo}
      />
      <div style={{ ...styles.cameraWrap, display: capturedImage ? 'none' : undefined }}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          onClick={onClickCanvas}
        />
      </div>
      {!capturedImage ? (
        <div style={styles.controls}>
          <div style={styles.zoomRow}>
            <span style={styles.zoomLabel}>Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={styles.zoomSlider}
            />
            <span style={styles.zoomValue}>{zoom.toFixed(1)}×</span>
          </div>
          <button style={styles.captureBtn} onClick={capture} disabled={!cameraReady || loading}>
            {loading ? 'Sending…' : 'Capture'}
          </button>
        </div>
      ) : (
        <div style={styles.resultWrap}>
          {/* Upper part: preview + actions */}
          <section style={styles.upperPart}>
            <div style={styles.previewBox}>
              <img src={capturedImage} alt="Captured" style={styles.capturedImg} />
            </div>
            <div style={styles.resultButtons}>
              <button style={styles.backBtn} onClick={resetCapture} type="button">
                Back
              </button>
              <button style={styles.saveBtn} onClick={savePhoto} type="button">
                Save
              </button>
            </div>
          </section>
          {/* Lower part: scrollable message area */}
          <section style={styles.lowerPart}>
            <div style={styles.responseLabel}>
              {responseText.startsWith('Error:') ? 'Error' : 'Photo review'}
            </div>
            <div
              style={{
                ...styles.responseScroll,
                ...(responseText.startsWith('Error:') ? styles.responseScrollError : {}),
              }}
            >
              {loading ? 'Loading…' : responseText || '—'}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

const styles = {
  fullScreen: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    overflow: 'hidden',
  },
  hiddenVideo: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#111',
  },
  controls: {
    padding: 12,
    paddingBottom: 12,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  zoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  zoomLabel: {
    fontSize: 12,
    color: '#999',
  },
  zoomSlider: {
    width: 120,
    accentColor: '#fff',
  },
  zoomValue: {
    fontSize: 12,
    color: '#ccc',
    minWidth: 32,
  },
  captureBtn: {
    padding: '12px 32px',
    fontSize: 16,
    fontWeight: 600,
    color: '#000',
    background: '#fff',
    border: 'none',
    borderRadius: 24,
    cursor: 'pointer',
  },
  resultWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  upperPart: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
    paddingTop: 12,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  previewBox: {
    width: '100%',
    maxHeight: '45vh',
    minHeight: 120,
    overflow: 'hidden',
    borderRadius: 12,
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturedImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  resultButtons: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  backBtn: {
    minHeight: 44,
    minWidth: 100,
    padding: '12px 20px',
    fontSize: 16,
    color: '#fff',
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    minHeight: 44,
    minWidth: 100,
    padding: '12px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#0a0a0a',
    background: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  lowerPart: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    paddingTop: 12,
    overflow: 'hidden',
  },
  responseLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    flexShrink: 0,
  },
  responseScroll: {
    flex: 1,
    minHeight: 80,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    fontSize: 15,
    lineHeight: 1.5,
    color: '#e5e5e5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: 14,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  responseScrollError: {
    color: '#f88',
    backgroundColor: 'rgba(200, 60, 60, 0.12)',
    borderColor: 'rgba(220, 80, 80, 0.4)',
  },
  error: {
    padding: 24,
    color: '#e55',
    textAlign: 'center',
  },
}
