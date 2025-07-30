import React from 'react';

export function LangGraphLogoSVG({
  className,
  width = 256,
  height = 256,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Chat bubble background */}
      <rect x="30" y="30" width="196" height="150" rx="30" fill="#3478FF" />
      {/* Bubble tail */}
      <polygon points="90,180 130,180 110,220" fill="#3478FF" />

      {/* Data bars inside bubble */}
      <rect x="80"  y="100" width="10" height="60" fill="#FFFFFF" />
      <rect x="110" y="80"  width="10" height="80" fill="#FFFFFF" />
      <rect x="140" y="60"  width="10" height="100" fill="#FFFFFF" />
    </svg>
  );
}
