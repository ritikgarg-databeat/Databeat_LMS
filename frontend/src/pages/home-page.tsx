import {
  LandingAiSection,
  LandingAnalyticsSection,
  LandingCta,
  LandingFeatures,
  LandingHero,
  LandingHowItWorks,
} from '@/features/landing/components';

/** Public marketing landing page — hero, feature highlights, AI showcase, and closing CTA. */
function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingAiSection />
      <LandingAnalyticsSection />
      <LandingCta />
    </div>
  );
}

export { HomePage };
