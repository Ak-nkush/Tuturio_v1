import { useEffect } from 'react'

export function useIntersectionFadeIn() {
  useEffect(() => {
    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            fadeObserver.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )

    document.querySelectorAll('.fade-up').forEach((el) => fadeObserver.observe(el))

    const dividerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            dividerObserver.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.4 },
    )

    document.querySelectorAll('.divider svg').forEach((el) => dividerObserver.observe(el))

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      document.querySelectorAll('.scene').forEach((svg) => {
        if ('pauseAnimations' in svg && typeof svg.pauseAnimations === 'function') {
          svg.pauseAnimations()
        }
      })
    }

    return () => {
      fadeObserver.disconnect()
      dividerObserver.disconnect()
    }
  }, [])
}
