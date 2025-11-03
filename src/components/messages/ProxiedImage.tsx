import { useState, useEffect } from 'react'
import { Loader2, ImageOff } from 'lucide-react'

interface ProxiedImageProps {
  src: string
  alt: string
  className?: string
  mimeType?: string
}

/**
 * Image component that resolves MXC URLs to local file:// paths
 * 
 * Flow:
 * 1. For mxc:// or localmxc:// URLs, call Beeper's /v1/assets/download API
 * 2. Get the local file:// path from the response
 * 3. Use the file:// URL directly (requires local file permissions in browser)
 * 
 * Browser local file permissions must be enabled:
 * 1. Navigate to the site
 * 2. Click the padlock/info icon in address bar
 * 3. Site settings → File access → Allow
 */
export function ProxiedImage({ src, alt, className }: ProxiedImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      // Check if we need to resolve the URL via Beeper API
      const needsDownload = src.startsWith('mxc://') || src.startsWith('localmxc://')
      
      if (!needsDownload) {
        // Regular HTTP or file:// URL - use directly
        if (isMounted) {
          setImageUrl(src)
          setLoading(false)
        }
        return
      }

      // Call Beeper API to get local file path
      setLoading(true)
      setError(null)

      try {
        // Use localhost:23373 for local Beeper Desktop API
        const beeperApiUrl = 'http://localhost:23373'
        
        const response = await fetch(`${beeperApiUrl}/v1/assets/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Note: localhost API typically doesn't require authentication
          },
          body: JSON.stringify({ url: src }),
        })

        if (!response.ok) {
          throw new Error(`Beeper API error: ${response.status}`)
        }

        const data = await response.json() as { srcURL?: string; error?: string }
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        if (!data.srcURL) {
          throw new Error('No srcURL returned from Beeper API')
        }

        if (isMounted) {
          setImageUrl(data.srcURL)
          setLoading(false)
        }

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

