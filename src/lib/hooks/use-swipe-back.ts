import { useEffect, useRef } from 'react'

interface UseSwipeBackOptions {
  onSwipeBack: () => void
  enabled?: boolean
  /** Threshold in pixels to trigger swipe (default: 100) */
  threshold?: number
  /** Edge zone width in pixels where swipe must start (default: 30) */
  edgeWidth?: number
}

/**
 * Hook to detect iOS-style swipe-from-left-edge to go back
 */
export function useSwipeBack({
  onSwipeBack,
  enabled = true,
  threshold = 100,
  edgeWidth = 30,
}: UseSwipeBackOptions) {
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isEdgeSwipe = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      // Only start tracking if touch begins near left edge
      if (touch.clientX <= edgeWidth) {
        touchStartX.current = touch.clientX
        touchStartY.current = touch.clientY
        isEdgeSwipe.current = true
      } else {
        isEdgeSwipe.current = false
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // Could add visual feedback here if desired
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe.current || touchStartX.current === null || touchStartY.current === null) {
        return
      }

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = Math.abs(touch.clientY - touchStartY.current)

      // Swipe must be mostly horizontal (deltaX > deltaY) and exceed threshold
      if (deltaX > threshold && deltaX > deltaY * 1.5) {
        onSwipeBack()
      }

      // Reset
      touchStartX.current = null
      touchStartY.current = null
      isEdgeSwipe.current = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeBack, threshold, edgeWidth])
}
