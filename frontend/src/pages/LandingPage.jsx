import { GrainOverlay } from '../components/layout/GrainOverlay'
import { LandingFooter } from '../components/landing/LandingFooter'
import { LandingHero } from '../components/landing/LandingHero'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { LandingStats } from '../components/landing/LandingStats'
import { RoleCards } from '../components/landing/RoleCards'
import { SectionDivider } from '../components/landing/SectionDivider'
import { Testimonials } from '../components/landing/Testimonials'
import { useIntersectionFadeIn } from '../hooks/useIntersectionFadeIn'
import '../styles/landing.css'

export function LandingPage() {
  useIntersectionFadeIn()

  return (
    <>
      <GrainOverlay />
      <LandingNavbar />
      <LandingHero />
      <RoleCards />
      <SectionDivider />
      <LandingStats />
      <Testimonials />
      <LandingFooter />
    </>
  )
}
