import { useState, useEffect } from 'react'
import { Loader2, ImageOff } from 'lucide-react'

interface ProxiedImageProps {
  src: string
  alt: string
  className?: string
  mimeType?: string
}

/**
 * Image component that proxies MXC and file:// URLs through Convex HTTP endpoint
 * 
 * Flow:
 * 1. Browser requests image from Convex: GET /image-proxy?url=mxc://...
 * 2. Convex HTTP endpoint calls Beeper's /v1/assets/download (via beeper.bywave.com.au)
 * 3. Convex extracts media ID and fetches from Matrix endpoints
 * 4. Convex returns image data to browser
 * 
 * This works because:
 * - Convex can call beeper.bywave.com.au (which proxies to localhost:23373)
 * - beeper.bywave.com.au supports Matrix media endpoints
 * - Image data flows: Beeper → Convex → Browser
 */
export function ProxiedImage({ src, alt, className }: ProxiedImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      // Check if image needs proxying
      const needsProxy = src.startsWith('mxc://') || src.startsWith('file://') || src.startsWith('localmxc://')
      
      if (!needsProxy) {
        // Regular HTTP URL - use directly
        if (isMounted) {
          setImageUrl(src)
          setLoading(false)
        }
        return
      }

      // Use Convex HTTP endpoint to proxy the image
      setLoading(true)
      setError(null)

      try {
        // Get Convex deployment URL from environment
        const convexUrl = import.meta.env.VITE_CONVEX_URL
        if (!convexUrl) {
          throw new Error('VITE_CONVEX_URL not configured')
        }

        // Build proxy URL
        // Convex HTTP endpoints are at: https://<deployment>.convex.cloud/image-proxy
        const baseUrl = convexUrl.replace('/api', '') // Remove /api suffix
        const proxyUrl = `${baseUrl}/image-proxy?url=${encodeURIComponent(src)}`
        
        console.log(`[ProxiedImage] Fetching via Convex proxy...`)
        setImageUrl(proxyUrl)
        setLoading(false)

      } catch (err) {
        if (!isMounted) return
        const errorMsg = err instanceof Error ? err.message : 'Failed to load image'
        console.error('[ProxiedImage] Error:', errorMsg)
        setError(errorMsg)
        setImageUrl(null)
        setLoading(false)
      }
    }

    loadImage()

    return () => {
      isMounted = false
    }
  }, [src])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className || 'h-48'}`}>
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4 ${className || 'h-48'}`}>
        <ImageOff className="w-8 h-8 text-gray-400 mb-2" />
        <p className="text-xs text-gray-500 text-center">
          {error || 'Image unavailable'}
        </p>
        <p className="text-xs text-gray-400 text-center mt-1">
          {src.substring(0, 40)}...
        </p>
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        // Fallback if the proxied URL also fails
        const target = e.currentTarget
        target.style.display = 'none'
        const fallback = document.createElement('div')
        fallback.className = 'flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4 h-48'
        fallback.innerHTML = `
          <div class="text-gray-400 text-center">
            <p class="text-sm font-medium mb-1">Image failed to load</p>
            <p class="text-xs">${alt}</p>
          </div>
        `
        target.parentElement?.appendChild(fallback)
      }}
    />
  )
}

