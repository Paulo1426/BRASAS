import { LandingNavbar } from "./LandingNavbar";
import { HeroSection } from "./HeroSection";
import { ProblemSolution } from "./ProblemSolution";
import { FeaturesSection } from "./FeaturesSection";
import { ImpactMetrics } from "./ImpactMetrics";
import { Differentiator } from "./Differentiator";
import { LandingFooter } from "./LandingFooter";

export const LandingPage = () => (
  <div className="min-h-screen bg-[#e6d9bd] overflow-hidden">
    <LandingNavbar />
    <HeroSection />
    <ProblemSolution />
    <FeaturesSection />
    <ImpactMetrics />
    <Differentiator />
    <LandingFooter />
  </div>
);
