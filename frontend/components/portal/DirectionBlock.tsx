"use client";

import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import { computeDirection, formatDistance, type NodePosition } from "@/lib/direction";

// Phase 7 — Kiosk compass guidance. Renders an SVG compass dial with an
// arrow rotated to point from the kiosk toward the patient's next service
// point. The patient is assumed to be facing north (-Y in image coords).
//
// Pure presentation: takes a precomputed `direction` result from
// `computeDirection()` so the caller controls when (and whether) to render
// — e.g. when both nodes are on the same floor and have a calibrated
// scale. Callers should pass the full `direction` object rather than
// recomputing it here, so the same result drives any other UI (e.g. an
// accessibility label) consistently.

type DirectionBlockProps = {
  direction: ReturnType<typeof computeDirection>;
  destination: NodePosition;
  locale: AppLocale;
  scale?: "default" | "kiosk";
};

const SIZE = 168;
const CENTER = SIZE / 2;
const OUTER_R = 74;
const TICK_OUTER = OUTER_R;
const TICK_INNER = OUTER_R - 8;
const ARROW_LENGTH = 48;

// 8 tick positions (degrees, clockwise from north). 0=N, 90=E, ...
const TICK_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315];

// The 4 main cardinals get a label rendered at the outer ring; the 4
// intercardinals only get a tick.
const LABEL_DEGREES: Record<number, "N" | "E" | "S" | "W"> = {
  0: "N",
  90: "E",
  180: "S",
  270: "W",
};

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(a), y: CENTER - radius * Math.cos(a) };
}

export function DirectionBlock({ direction, destination, locale, scale = "kiosk" }: DirectionBlockProps) {
  const t = useTranslations("kiosk.direction");
  const isKiosk = scale === "kiosk";
  const longNames = t.raw("cardinalLong") as Record<string, string>;
  const destinationFloorName = locale === "th" ? destination.floor_name_th : destination.floor_name_en;

  const containerPadding = isKiosk ? "p-[18px]" : "p-4";
  const containerText = isKiosk ? "text-[15px]" : "text-[14px]";
  const cardinalFontSize = isKiosk ? "text-[17px]" : "text-[15.5px]";

  // Different floor → can't give a meaningful straight-line direction
  // (the destination's x/y live on a different image). Just tell the
  // patient which floor to go to.
  if (!direction.same_floor) {
    return (
      <div className={`flex flex-col items-center gap-2 rounded-2xl bg-[var(--brand-ink)] text-white ${containerPadding}`}>
        <div className="text-[12px] text-[#9fc4be]">{t("title")}</div>
        <div className={`font-bold ${cardinalFontSize}`}>
          {t("floorChange", { floor: destinationFloorName })}
        </div>
      </div>
    );
  }

  if (direction.at_point) {
    return (
      <div className={`flex flex-col items-center gap-2 rounded-2xl bg-[var(--brand-ink)] text-white ${containerPadding}`}>
        <div className="text-[12px] text-[#9fc4be]">{t("title")}</div>
        <div className={`font-bold ${cardinalFontSize}`}>{t("arrived")}</div>
      </div>
    );
  }

  const cardinalLabel = longNames[direction.cardinal_index] ?? direction.cardinal_short;
  const bearingText = `${Math.round(direction.bearing_deg)}°`;
  const distanceText = direction.distance_m != null ? t("distanceMeters", { value: formatDistance(direction.distance_m) }) : t("distanceUnknown");

  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl bg-[var(--brand-ink)] text-white ${containerPadding}`}>
      <div className="self-start text-[12px] text-[#9fc4be]">{t("title")}</div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={isKiosk ? 160 : 132}
        height={isKiosk ? 160 : 132}
        role="img"
        aria-label={t("ariaCompass", { cardinal: cardinalLabel, bearing: bearingText })}
        className="overflow-visible"
      >
        {/* Outer ring */}
        <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="#0f2522" stroke="#3c625c" strokeWidth={1.5} />

        {/* Tick marks */}
        {TICK_DEGREES.map((deg) => {
          const outer = polar(deg, TICK_OUTER);
          const inner = polar(deg, TICK_INNER);
          const isMain = deg in LABEL_DEGREES;
          return (
            <line
              key={deg}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={isMain ? "#bfe0da" : "#6c9892"}
              strokeWidth={isMain ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* N / E / S / W labels */}
        {Object.entries(LABEL_DEGREES).map(([deg, label]) => {
          const pos = polar(Number(deg), OUTER_R + 12);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={700}
              fill={label === "N" ? "#ffd57a" : "#bfe0da"}
              style={{ fontFamily: "inherit" }}
            >
              {label}
            </text>
          );
        })}

        {/* Bearing arrow — points "north" (straight up) by default, rotated
            around the center by the bearing so it points toward the
            destination in the patient's local frame. */}
        <g transform={`rotate(${direction.bearing_deg} ${CENTER} ${CENTER})`}>
          <path
            d={`M ${CENTER} ${CENTER - ARROW_LENGTH} L ${CENTER - 11} ${CENTER - 8} L ${CENTER + 11} ${CENTER - 8} Z`}
            fill="#ffba5e"
            stroke="#a36c10"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <circle cx={CENTER} cy={CENTER} r={4.5} fill="#fff" />
        </g>
      </svg>

      <div className="text-center">
        <div className={`font-bold ${cardinalFontSize}`}>
          {cardinalLabel} <span className="font-normal text-[#9fc4be]">· {bearingText}</span>
        </div>
        <div className={`${containerText} mt-0.5 text-[#9fc4be]`}>{distanceText}</div>
      </div>
    </div>
  );
}