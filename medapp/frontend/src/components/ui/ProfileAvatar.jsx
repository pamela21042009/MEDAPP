import { useEffect, useState } from "react";
import { toBackendUrl } from "../../lib/api";

function getInitials(name = "", fallback = "US") {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || fallback;
}

export default function ProfileAvatar({
  src = "",
  name = "",
  fallback = "US",
  className = "",
  textClassName = "",
  backgroundClassName = "bg-[rgba(94,96,206,0.14)] text-med-violet",
  alt = "",
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (src && !broken) {
    const resolvedSrc = String(src).startsWith("/uploads/") ? toBackendUrl(src) : src;
    return (
      <img
        src={resolvedSrc}
        alt={alt || name || "Foto de perfil"}
        className={`object-cover ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center font-bold ${backgroundClassName} ${className} ${textClassName}`}>
      {getInitials(name, fallback)}
    </div>
  );
}
