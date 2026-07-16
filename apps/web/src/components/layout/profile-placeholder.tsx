'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function ProfilePlaceholder({
  className,
  title = 'Profile placeholder',
}: {
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const bgGradientId = `profile-bg-${uid}`;
  const shoulderGradientId = `profile-shoulder-${uid}`;
  const headShadowId = `profile-head-shadow-${uid}`;

  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 overflow-hidden rounded-full', className)}
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient
          id={bgGradientId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(48 40) rotate(90) scale(52)"
        >
          <stop stopColor="#F7F8FA" />
          <stop offset="1" stopColor="#E3E7EC" />
        </radialGradient>
        <radialGradient
          id={shoulderGradientId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(48 82) rotate(90) scale(30 26)"
        >
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEF1F4" />
        </radialGradient>
        <filter
          id={headShadowId}
          x="24"
          y="16"
          width="48"
          height="48"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2.5" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.67 0 0 0 0 0.71 0 0 0 0 0.76 0 0 0 0.28 0"
          />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
      </defs>

      <circle cx="48" cy="48" r="48" fill={`url(#${bgGradientId})`} />

      <clipPath id={`profile-clip-${uid}`}>
        <circle cx="48" cy="48" r="48" />
      </clipPath>

      <g clipPath={`url(#profile-clip-${uid})`}>
        <circle cx="48" cy="86" r="28" fill={`url(#${shoulderGradientId})`} />
        <circle cx="48" cy="36" r="17" fill="#FFFFFF" filter={`url(#${headShadowId})`} />
      </g>
    </svg>
  );
}
