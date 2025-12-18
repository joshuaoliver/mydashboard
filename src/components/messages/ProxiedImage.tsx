import { useState, useEffect } from 'react'
import { Loader2, ImageOff } from 'lucide-react'

interface ProxiedImageProps {
  src: string
  alt: string
  className?: string
  mimeType?: string
}

// Beeper Media Server Configuration (for file:// URLs)
const BEEPER_MEDIA_SERVER = import.meta.env.VITE_BEEPER_MEDIA_SERVER || 'https://beeperimage.bywave.com.au'
const BEEPER_MEDIA_TOKEN = import.meta.env.VITE_BEEPER_MEDIA_TOKEN || '1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9'

// Convex configuration (for mxc:// URLs via /image-proxy endpoint)
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || ''

/**
 * Get the Convex site URL for HTTP endpoints
 * Converts: https://abc123.convex.cloud/api → https://abc123.convex.site
 */
function getConvexSiteUrl(): string {
  if (!CONVEX_URL) return ''
  // Convert .convex.cloud/api to .convex.site
  return CONVEX_URL.replace('.convex.cloud/api', '.convex.site')
}

/**
 * Image component that handles different image URL types:
 * 
 * 1. Convex storage URLs (profile pictures - cached by backend)
 *    - https://*.convex.cloud/api/storage/...
 *    - Used as-is (fast, reliable)
 * 
 * 2. file:// URLs (message attachments - from Beeper local cache)
 *    - file:///Users/.../BeeperTexts/media/local.beeper.com/HASH
 *    - Proxied through local media server with auth token
 * 
 * 3. mxc:// URLs (Matrix Content URIs - Beeper encrypted media)
 *    - mxc://local.beeper.com/joshuaoliver_HASH?encryptedFileInfoJSON=...
 *    - Proxied through Convex HTTP endpoint (/image-proxy)
 *    - Uses Beeper's /v1/assets/download API to resolve
 * 
 * 4. Regular HTTP/HTTPS URLs
 *    - Used as-is
 * 
 * Note: Profile pictures are cached to Convex at the backend level (imageCache.ts)
 * This component just displays whatever URL it receives.
 */
export function ProxiedImage({ src, alt, className }: ProxiedImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = () => {
      try {
        // Handle different URL types
        
        // 1. Convex storage URLs - use as-is (profile pictures cached by backend)
        if (src.includes('.convex.cloud/api/storage/')) {
          if (isMounted) {
            setImageUrl(src)
            setLoading(false)
          }
          return
        }
        
        // 2. Regular HTTP/HTTPS URLs - use as-is
        if (src.startsWith('http://') || src.startsWith('https://')) {
          if (isMounted) {
            setImageUrl(src)
            setLoading(false)
          }
          return
        }

        // 3. file:// URLs - proxy through media server (message attachments)
        if (src.startsWith('file://')) {
          // Convert file:// URL to media server URL
          // Example: file:///Users/.../media/local.beeper.com/joshuaoliver_HASH
          // Extract the path after "/media/"
          
          // Decode URL-encoded spaces and special chars
          const decodedSrc = decodeURIComponent(src)
          
          // Find the media path
          const mediaMatch = decodedSrc.match(/\/media\/(.+)$/)
          
          if (!mediaMatch) {
            throw new Error('Invalid file:// URL format - missing /media/ path')
          }
          
          const mediaPath = mediaMatch[1]
          // mediaPath will be like: "local.beeper.com/joshuaoliver_HASH" or "beeper.com/HASH"
          
          // Construct the proxied URL with query string auth
          const proxiedUrl = `${BEEPER_MEDIA_SERVER}/${mediaPath}?token=${BEEPER_MEDIA_TOKEN}`
          
          if (isMounted) {
            setImageUrl(proxiedUrl)
            setLoading(false)
          }
          return
        }

        // 4. mxc:// or localmxc:// URLs - Matrix Content URIs (Beeper encrypted media)
        // Format: mxc://local.beeper.com/joshuaoliver_HASH?encryptedFileInfoJSON=...
        // These need to go through Convex's /image-proxy endpoint which calls Beeper's
        // /v1/assets/download API to convert mxc:// → file:// and fetch the image
        if (src.startsWith('mxc://') || src.startsWith('localmxc://')) {
          const convexSiteUrl = getConvexSiteUrl()
          
          if (!convexSiteUrl) {
            throw new Error('Convex URL not configured - cannot proxy mxc:// URLs')
          }
          
          // Route through Convex HTTP endpoint: /image-proxy?url=mxc://...
          const proxiedUrl = `${convexSiteUrl}/image-proxy?url=${encodeURIComponent(src)}`
          
          console.log(`[ProxiedImage] Routing mxc:// through Convex proxy: ${proxiedUrl.substring(0, 80)}...`)
          
          if (isMounted) {
            setImageUrl(proxiedUrl)
            setLoading(false)
          }
          return
        }

        // Unsupported URL scheme
        throw new Error(`Unsupported URL scheme: ${src.substring(0, 20)}...`)

      } catch (err) {
        if (!isMounted) return
        const errorMsg = err instanceof Error ? err.message : 'Failed to load image'
        console.error('[ProxiedImage] Error:', errorMsg, 'Source:', src)
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

