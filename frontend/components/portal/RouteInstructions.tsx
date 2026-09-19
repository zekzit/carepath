"use client";

// FR-13/FR-12/FR-17 — real turn-by-turn navigation, replacing the
// straight-line-only compass (DirectionBlock/computeDirection). Fetches a
// real shortest path (Dijkstra over the facility graph, walk-time weighted,
// wheelchair-aware) from the backend and renders it as a numbered list of
// plain-language steps.
//
// Graceful degradation: when the backend has no route data for this pair
// (network hiccup, or the graph genuinely has no path — `reachable: false`),
// this component renders nothing and reports `available: false` via
// `onRouteAvailable`, so the caller (NextStepOptionsList.tsx / KioskView.tsx)
// keeps showing the existing DirectionBlock compass as the fallback. When a
// real route comes back, it reports `available: true` so the caller can
// stop rendering the compass and let these turn-by-turn steps be primary.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import { fetchRouteClient, type RouteLeg, type RouteResult } from "@/lib/api/facility";
import { formatDistance } from "@/lib/direction";

type RouteInstructionsProps = {
  /** The patient's scanned location id, or the kiosk's own node id. */
  originNodeId: number;
  /** A next-step option's service_point.id. */
  destinationNodeId: number;
  /** From `visit.uses_wheelchair` — excludes non-wheelchair-accessible edges server-side. */
  wheelchair: boolean;
  scale?: "default" | "kiosk";
  /**
   * Called every time a fetch resolves: `true` once a usable route
   * (reachable, with at least one leg) is available, `false` otherwise
   * (still loading, unreachable, same-point, or the request failed). Lets
   * the caller decide whether to keep the DirectionBlock compass fallback
   * visible alongside/instead of this component.
   */
  onRouteAvailable?: (available: boolean) => void;
};

export function RouteInstructions({
  originNodeId,
  destinationNodeId,
  wheelchair,
  scale = "default",
  onRouteAvailable,
}: RouteInstructionsProps) {
  const t = useTranslations("patient.route");
  const locale = useLocale() as AppLocale;
  const [result, setResult] = useState<RouteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRouteClient(originNodeId, destinationNodeId, wheelchair).then((res) => {
      if (cancelled) return;
      setResult(res);
      onRouteAvailable?.(Boolean(res && res.reachable && res.legs.length > 0));
    });
    return () => {
      cancelled = true;
    };
    // onRouteAvailable is expected to be a stable callback from the caller;
    // only re-fetch when the actual route inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originNodeId, destinationNodeId, wheelchair]);

  if (!result || !result.reachable || result.legs.length === 0) return null;

  const isKiosk = scale === "kiosk";
  const containerPadding = isKiosk ? "p-[18px]" : "p-4";
  const textSize = isKiosk ? "text-[14.5px]" : "text-[13.5px]";

  const totalMinutes = Math.round(result.total_time_sec / 60);
  const timeLabel =
    result.total_time_sec < 60
      ? t("timeSeconds", { value: result.total_time_sec })
      : t("timeMinutes", { value: totalMinutes });

  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl bg-[var(--brand-ink)] text-white ${containerPadding}`}>
      <div className="text-[12px] text-[#9fc4be]">{t("title")}</div>
      <ol className={`flex flex-col gap-2 ${textSize}`}>
        {result.legs.map((leg, index) => (
          <li key={`${leg.from_node_id}-${leg.to_node_id}-${index}`} className="flex gap-2.5">
            <span className="shrink-0 font-bold text-[#ffd57a]">{index + 1}.</span>
            <span>{legInstruction(leg, locale, t)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-1 border-t border-white/10 pt-2 text-[12px] text-[#9fc4be]">
        {t("summary", { distance: formatDistance(result.total_distance_m), time: timeLabel })}
      </div>
    </div>
  );
}

function legInstruction(
  leg: RouteLeg,
  locale: AppLocale,
  t: ReturnType<typeof useTranslations<"patient.route">>,
): string {
  const floorName = locale === "th" ? leg.to_floor_name_th : leg.to_floor_name_en;

  if (leg.edge_type === "ELEVATOR") {
    return t("elevator", { floor: floorName });
  }
  if (leg.edge_type === "STAIRS") {
    return t("stairs", { floor: floorName });
  }

  // CORRIDOR / RAMP — the plain walking legs.
  const distance = formatDistance(leg.distance_m);
  if (leg.turn === "LEFT") return t("turnLeft", { distance });
  if (leg.turn === "RIGHT") return t("turnRight", { distance });
  return t("straight", { distance });
}
