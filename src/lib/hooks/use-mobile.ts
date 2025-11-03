import { useEffect, useState } from 'react'

/**
 * Custom hook to detect if the screen is mobile size
 * @param breakpoint - The max-width breakpoint in pixels (default: 768px for md breakpoint)
 * @returns boolean indicating if the screen is mobile size
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Create media query
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    
    // Set initial value
    setIsMobile(mediaQuery.matches)

    // Define callback for when media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    // Add listener for changes
    mediaQuery.addEventListener('change', handleChange)

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [breakpoint])

  return isMobile
}

