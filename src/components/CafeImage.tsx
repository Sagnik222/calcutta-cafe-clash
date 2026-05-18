import { useState } from "react";
import type { Cafe } from "@/lib/cafes";

export function CafeImage({ cafe, size = 56 }: { cafe: Cafe; size?: number }) {
  const [err, setErr] = useState(false);
  if (err || !cafe.image_url) {
    return (
      <div
        className="flex items-center justify-center rounded-[4px] shrink-0"
        style={{ width: size, height: size, background: "#6B4423" }}
      >
        <span
          className="font-display italic text-cream"
          style={{ fontSize: size * 0.5, color: "#FBF6E9" }}
        >
          {cafe.name[0]}
        </span>
      </div>
    );
  }
  return (
    <img
      src={cafe.image_url}
      onError={() => setErr(true)}
      alt={cafe.name}
      className="object-cover rounded-[4px] shrink-0"
      style={{ width: size, height: size, filter: "saturate(0.75) sepia(0.08)" }}
    />
  );
}
