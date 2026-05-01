import { useState } from "react";

import Icon from "./Icon";

const BRAND_LOGO_SOURCES = ["/brand-logo.png", "/brand-logo.jpg", "/brand-logo.jpeg", "/brand-logo.svg"];

export default function BrandLogo({
  name = "MedApp",
  subtitle = "",
  containerClassName = "",
  imageClassName = "h-10 w-10 rounded-xl",
  nameClassName = "font-display text-xl font-bold tracking-[-0.02em] text-med-ink",
  subtitleClassName = "text-xs font-medium uppercase tracking-[0.08em] text-med-ink-muted",
  fallbackClassName = "flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#5E60CE,#4EA8DE)] text-white",
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasImageError, setHasImageError] = useState(false);
  const logoSrc = BRAND_LOGO_SOURCES[sourceIndex];

  function handleImageError() {
    if (sourceIndex < BRAND_LOGO_SOURCES.length - 1) {
      setSourceIndex((current) => current + 1);
      return;
    }
    setHasImageError(true);
  }

  return (
    <div className={`flex items-center gap-3 ${containerClassName}`.trim()}>
      {hasImageError ? (
        <div className={fallbackClassName}>
          <Icon className="h-5 w-5">
            <rect x="10.5" y="3" width="3" height="18" rx="1.5" fill="currentColor" stroke="none" />
            <rect x="3" y="10.5" width="18" height="3" rx="1.5" fill="currentColor" stroke="none" />
          </Icon>
        </div>
      ) : (
        <img
          src={logoSrc}
          alt={`${name} logo`}
          className={imageClassName}
          onError={handleImageError}
        />
      )}
      <div>
        <div className={nameClassName}>{name}</div>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
