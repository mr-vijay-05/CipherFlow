import React from 'react';
import { BRAND } from '../../constants/brand';

export const HeroBanner: React.FC = () => {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-card border border-slate-800/10 min-h-[160px] flex items-center justify-between p-6 sm:p-8 select-none text-white">
      {/* Background Graphic: Mountains & Night Sky gradient */}
      <div className="absolute inset-0 bg-[#0d1527] z-0">
        <svg
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          preserveAspectRatio="none"
          viewBox="0 0 1000 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle starry dots */}
          <circle cx="150" cy="50" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="320" cy="30" r="1.2" fill="#ffffff" opacity="0.4" />
          <circle cx="480" cy="70" r="1.8" fill="#ffffff" opacity="0.7" />
          <circle cx="650" cy="40" r="1.3" fill="#ffffff" opacity="0.5" />
          <circle cx="820" cy="65" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="910" cy="25" r="1.2" fill="#ffffff" opacity="0.3" />

          {/* Mountains Silhouettes */}
          <path
            d="M0 300L180 180L340 250L520 150L680 230L850 120L1000 240V300H0Z"
            fill="#162238"
            opacity="0.8"
          />
          <path
            d="M0 300L220 220L410 270L610 180L770 260L920 190L1000 260V300H0Z"
            fill="#0b1120"
          />
        </svg>

        {/* Deep blue accent atmospheric glow */}
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Hero Left Content */}
      <div className="relative z-10 space-y-1.5 max-w-xl">
        <p className="text-xs sm:text-sm font-medium text-slate-300 tracking-wide">
          Good Evening,
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          {BRAND.defaultUser.name}
          <span className="text-2xl inline-block animate-pulse">👋</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-300/90 italic font-normal pt-1">
          &ldquo;{BRAND.quotes.hero}&rdquo;
        </p>
      </div>

      {/* Hero Right Tagline / Pillars (Requirement 9) */}
      <div className="relative z-10 hidden md:flex flex-col items-end justify-center text-right border-l border-white/10 pl-6 my-auto">
        <div className="text-[11px] font-bold tracking-[0.2em] text-slate-300/80 space-y-1">
          {BRAND.pillars.map((pillar) => (
            <div key={pillar} className="hover:text-white transition-colors">
              {pillar}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
