"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { RouteLeg, RouteResult } from "@/lib/api/facility";
import type { PublicVisitNextStepOption } from "@/lib/api/public-visit";
import { serviceStepLocationName } from "@/lib/api/public-visit";
import { computeDirection, type NodePosition } from "@/lib/direction";
import { DirectionBlock } from "./DirectionBlock";
import { NextStepCard } from "./NextStepCard";
import { QueueWidget } from "./QueueWidget";
import { RouteInstructions } from "./RouteInstructions";

// The compass now points at the *next node* to walk to (the first leg of
// the routed path) rather than the final service point — matches the
// turn-by-turn instructions above it instead of a straight line clean
// across the building. Falls back to the final destination when no route
// data is available yet (or the graph has no path), same as before.
function nextNodePosition(route: RouteResult | null): NodePosition | null {
  if (!route || !route.reachable || route.legs.length === 0) return null;
  const leg: RouteLeg = route.legs[0];
  return {
    pos_x: leg.to_pos_x,
    pos_y: leg.to_pos_y,
    floor_id: leg.to_floor_id,
    floor_scale_m_per_px: null,
    floor_name_th: leg.to_floor_name_th,
    floor_name_en: leg.to_floor_name_en,
  };
}

// Renders the patient's eligible next-step options for both the Patient
// Portal and the Kiosk Portal. Two layouts:
//
//   - 1 option  → the original "big" single-step view (DirectionBlock +
//     NextStepCard + QueueWidget), keeping the patient/kiosk layout
//     identical to before for the common case.
//
//   - N options → a compact per-option card list under a "you have N
//     choices" header. Each card carries its own bearing + queue info, so
//     the patient sees every fan-out option side-by-side without the
//     screen blowing up. Used when several VisitSteps share a
//     sequence_order (parallel branches — see backend/visits/views.py
//     ::serialize_public_visit's "fan-out" comment).
//
// `origin` is the source of the bearing: the kiosk node for the Kiosk
// Portal (always set), or the patient's scanned junction for the
// Patient Portal (nullable until they scan a sticker). When null, we
// still show the location/queue but skip the compass block.

type Variant = "patient" | "kiosk";

// `origin` needs a Node id (not just floor-plan position) to call the
// routing endpoint — both LocationNodeInfo (patient's scanned location) and
// KioskInfo (the kiosk's own node) carry one, so this narrows NodePosition
// with that requirement rather than introducing a whole new shape.
type RouteOrigin = NodePosition & { id: number };

export function NextStepOptionsList({
  options,
  origin,
  variant,
  wheelchair,
}: {
  options: PublicVisitNextStepOption[];
  origin: RouteOrigin | null;
  variant: Variant;
  /** From `visit.uses_wheelchair` — passed through to the routing engine so
   * wheelchair patients automatically get a stairs-avoiding route (FR-17). */
  wheelchair: boolean;
}) {
  if (options.length === 0) return null;

  // Single-option case: keep the original layout so neither portal
  // visually regresses for the >99% of visits where the path is linear.
  if (options.length === 1) {
    return <SingleOption option={options[0]} origin={origin} variant={variant} wheelchair={wheelchair} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ParallelHeader count={options.length} />
      {options.map((option) => (
        <ParallelOptionCard key={option.id} option={option} origin={origin} variant={variant} wheelchair={wheelchair} />
      ))}
    </div>
  );
}

function SingleOption({
  option,
  origin,
  variant,
  wheelchair,
}: {
  option: PublicVisitNextStepOption;
  origin: RouteOrigin | null;
  variant: Variant;
  wheelchair: boolean;
}) {
  const scale: "default" | "kiosk" = variant === "kiosk" ? "kiosk" : "default";
  const locale = useLocale() as AppLocale;
  // Shown whenever `origin` is known — for the Patient Portal that's right
  // after scanning a location QR (null beforehand), for the Kiosk it's
  // always known (fixed device position).
  const [route, setRoute] = useState<RouteResult | null>(null);
  const compassTarget = nextNodePosition(route) ?? option.service_point;
  const direction = origin ? computeDirection(origin, compassTarget) : null;
  // DirectionBlock's default title is kiosk copy ("Direction from kiosk") —
  // the Patient Portal overrides it with patient-specific copy ("Direction
  // from where you stand") since the origin is the patient's scanned
  // junction, not a kiosk node.
  const directionTitle = useTranslations(variant === "kiosk" ? "kiosk.direction" : "patient")(
    variant === "kiosk" ? "title" : "directionTitle",
  );
  const directionRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {origin && (
        <RouteInstructions
          originNodeId={origin.id}
          destinationNodeId={option.service_point.id}
          wheelchair={wheelchair}
          scale={scale}
          onRouteResult={setRoute}
        />
      )}
      {direction && (
        <div ref={directionRef}>
          <DirectionBlock
            direction={direction}
            destination={compassTarget}
            locale={locale}
            scale={scale}
            title={directionTitle}
          />
        </div>
      )}
      <NextStepCard
        nextStep={option}
        scale={scale}
        onNavigate={
          direction ? () => directionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined
        }
      />
      <QueueWidget
        ticket={option.queue_ticket}
        locationName={serviceStepLocationName(option, locale)}
        scale={scale}
      />
    </>
  );
}

function ParallelHeader({ count }: { count: number }) {
  const t = useTranslations("patient");
  return (
    <div className="rounded-2xl bg-[var(--brand-ink)] px-4 py-3 text-white">
      <div className="text-[14.5px] font-bold">{t("nextStepsTitle", { count })}</div>
      <div className="mt-0.5 text-[12px] text-[#9fc4be]">{t("nextStepSubtitle")}</div>
    </div>
  );
}

function ParallelOptionCard({
  option,
  origin,
  variant,
  wheelchair,
}: {
  option: PublicVisitNextStepOption;
  origin: RouteOrigin | null;
  variant: Variant;
  wheelchair: boolean;
}) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;
  const isKiosk = variant === "kiosk";
  const location = serviceStepLocationName(option, locale);
  const floorName = locale === "th" ? option.service_point.floor_name_th : option.service_point.floor_name_en;
  const [route, setRoute] = useState<RouteResult | null>(null);
  const compassTarget = nextNodePosition(route) ?? option.service_point;
  const direction = origin ? computeDirection(origin, compassTarget) : null;
  const compassFloorName = locale === "th" ? compassTarget.floor_name_th : compassTarget.floor_name_en;

  const containerPadding = isKiosk ? "p-[18px]" : "p-4";
  const titleSize = isKiosk ? "text-[16px]" : "text-[15px]";
  const metaSize = isKiosk ? "text-[13px]" : "text-[12px]";

  // Bearing text — mirrors DirectionBlock's three states (different floor,
  // at point, normal), pointed at the next node in the routed path (falling
  // back to the final destination when no route data is available yet).
  const bearingText = (() => {
    if (!direction) return null;
    if (!direction.same_floor) {
      return { label: `→ ${compassFloorName}`, color: "text-[#9fc4be]" };
    }
    if (direction.at_point) {
      return { label: t("scanLocationCta"), color: "text-[#9fc4be]" };
    }
    return {
      label: `${direction.cardinal_short} · ${Math.round(direction.bearing_deg)}°`,
      color: "text-[#ffd57a]",
    };
  })();

  const ticket = option.queue_ticket;
  const remaining = ticket ? Math.max(ticket.ticket_number - ticket.current_number, 0) : null;

  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl bg-[var(--brand-ink)] text-white ${containerPadding}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className={`${metaSize} text-[#9fc4be]`}>{t("nextStepTitle")}</div>
          <div className={`${titleSize} font-bold`}>{location}</div>
          <div className={`${metaSize} text-[#9fc4be]`}>{floorName}</div>
        </div>
        {bearingText && <div className={`shrink-0 ${titleSize} font-bold ${bearingText.color}`}>{bearingText.label}</div>}
      </div>
      {origin && (
        <RouteInstructions
          originNodeId={origin.id}
          destinationNodeId={option.service_point.id}
          wheelchair={wheelchair}
          scale={isKiosk ? "kiosk" : "default"}
          onRouteResult={setRoute}
        />
      )}
      {ticket ? (
        <div className={`flex items-center justify-between ${metaSize}`}>
          <div className="text-[#9fc4be]">{t("queueTitleAt", { location })}</div>
          <div className="font-bold text-white">#{ticket.ticket_number}</div>
          <div className="text-[#9fc4be]">
            {t("queueCalling")} <span className="font-bold text-[var(--brand-teal)]">{ticket.current_number}</span>
          </div>
          <div className="text-[#9fc4be]">{t("queueRemaining", { count: remaining ?? 0 })}</div>
        </div>
      ) : (
        <div className={`${metaSize} text-[#9fc4be]`}>{t("noQueueYet")}</div>
      )}
    </div>
  );
}
