import {
  LandingAiSection,
  LandingAnalyticsSection,
  LandingCta,
  LandingFeatures,
  LandingHero,
  LandingHowItWorks,
  LandingRolesSection,
} from '@/features/landing/components';

/**
 * Public marketing landing page. Order: hook (hero) → what it does (features) → how it flows
 * (how-it-works) → the AI story → who it's for (roles) → proof (analytics/reports) → close (CTA).
 */
function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingAiSection />
      <LandingRolesSection />
      <LandingAnalyticsSection />
      <LandingCta />
    </div>
  );
}

export { HomePage };
