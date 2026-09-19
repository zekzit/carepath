"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { RulerIcon, UploadIcon } from "@/components/icons";
import {
  EDGE_TYPES,
  edgesApi,
  floorsApi,
  nodesApi,
  uploadFloorPlanImage,
  type Building,
  type EdgeType,
  type FacilityEdge,
  type FacilityEdgeInput,
  type FacilityNode,
  type FacilityNodeInput,
  type Floor,
  type FloorInput,
} from "@/lib/api/facility";

// ---- pure helpers -----------------------------------------------------

/** Natural (original image resolution) pixel coordinate -> displayed (on-screen, scaled-down) pixel coordinate. */
function naturalToDisplayed(natural: number, scale: number): number {
  return natural * scale;
}

/** Displayed pixel coordinate -> natural (original image resolution) pixel coordinate. */
function displayedToNatural(displayed: number, scale: number): number {
  return displayed / scale;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Strips `id` (and anything else not part of the PATCH payload) so a dragged node's full record can be resent with just pos_x/pos_y overridden. */
function toNodeInput(node: FacilityNode): FacilityNodeInput {
  return {
    floor: node.floor,
    node_type: node.node_type,
    name_th: node.name_th,
    name_en: node.name_en,
    pos_x: node.pos_x,
    pos_y: node.pos_y,
    vertical_group: node.vertical_group,
    location_qr_code: node.location_qr_code,
    service_point_code: node.service_point_code,
    department_th: node.department_th,
    department_en: node.department_en,
    is_active: node.is_active,
    device_code: node.device_code,
  };
}

/** Same idea for Floor: `floorsApi.update` needs the full `FloorInput` shape, not a partial. */
function toFloorInput(floor: Floor): FloorInput {
  return {
    building: floor.building,
    level_no: floor.level_no,
    name_th: floor.name_th,
    name_en: floor.name_en,
    plan_scale_m_per_px: floor.plan_scale_m_per_px,
  };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const messages = Object.values(err.body as Record<string, unknown>).flatMap((v) =>
      Array.isArray(v) ? v.map(String) : [String(v)],
    );
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

/** Maps a DRF `{"field": ["msg"]}` / `{"non_field_errors": [...]}` error body the same way RecordFormSheet does, for the small inline edge-creation form below (which doesn't use RecordFormSheet itself). */
function splitFieldErrors(
  err: unknown,
  knownFields: Set<string>,
): { fieldErrors: Record<string, string[]>; generalError: string | null } {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>;
    const fieldErrors: Record<string, string[]> = {};
    const general: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      const messages = Array.isArray(value) ? value.map(String) : [String(value)];
      if (knownFields.has(key)) fieldErrors[key] = messages;
      else general.push(...messages);
    }
    return { fieldErrors, generalError: general.length > 0 ? general.join(" ") : null };
  }
  return { fieldErrors: {}, generalError: null };
}

const MARKER_SIZE = 16;
const EDGE_FIELD_NAMES = new Set([
  "from_node",
  "to_node",
  "distance_m",
  "edge_type",
  "walk_time_sec",
  "is_bidirectional",
  "wheelchair_accessible",
]);

type DragState = {
  nodeId: number;
  startClientX: number;
  startClientY: number;
  startDisplayedX: number;
  startDisplayedY: number;
  currentDisplayedX: number;
  currentDisplayedY: number;
  moved: boolean;
};

type CalibratePoint = { x: number; y: number }; // natural (original image) coordinates

type EdgeFormState = {
  edge_type: EdgeType;
  walk_time_sec: string;
  distance_m: string;
  is_bidirectional: boolean;
  wheelchair_accessible: boolean;
};

const DEFAULT_EDGE_FORM: EdgeFormState = {
  edge_type: "CORRIDOR",
  walk_time_sec: "",
  distance_m: "",
  is_bidirectional: true,
  wheelchair_accessible: true,
};

/**
 * Phase 5 — visual floor map editor: upload/replace a Floor's plan image,
 * drag Node markers to reposition them, click two Nodes to create an Edge,
 * and calibrate the floor's pixel->meter scale. See IMPLEMENT_PLAN.md Phase 5
 * and MODELS.md § 1 for the coordinate-system and auto-distance contract.
 */
export function FloorMapSection({
  floors,
  buildings,
  nodes,
  edges,
  loading,
  refetch,
}: {
  floors: Floor[];
  buildings: Building[];
  nodes: FacilityNode[];
  edges: FacilityEdge[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);

  // Keep the selection valid as `floors` loads/changes. Adjusted during render
  // (React's documented escape hatch — see RecordFormSheet.tsx's `correctedFor`
  // for the same pattern) rather than in an effect, guarded by a fingerprint so
  // it only runs once per actual `floors` change instead of looping.
  const floorsKey = floors.map((f) => f.id).join(",");
  const [syncedFloorsKey, setSyncedFloorsKey] = useState<string | null>(null);
  if (floorsKey !== syncedFloorsKey) {
    setSyncedFloorsKey(floorsKey);
    if (selectedFloorId == null || !floors.some((f) => f.id === selectedFloorId)) {
      setSelectedFloorId(floors[0]?.id ?? null);
    }
  }

  const floor = floors.find((f) => f.id === selectedFloorId) ?? null;

  const floorNodes = useMemo(() => (floor ? nodes.filter((n) => n.floor === floor.id) : []), [nodes, floor]);
  const floorEdges = useMemo(() => {
    if (!floor) return [];
    const idsOnFloor = new Set(floorNodes.map((n) => n.id));
    return edges.filter((e) => idsOnFloor.has(e.from_node) && idsOnFloor.has(e.to_node));
  }, [edges, floor, floorNodes]);

  function buildingLabel(buildingId: number): string {
    const building = buildings.find((b) => b.id === buildingId);
    return building ? `${building.code} · ${building.name_th}` : `#${buildingId}`;
  }

  // ---- image + coordinate system ----
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(0);

  // Reset the known image size whenever the displayed image itself changes
  // (different floor, or a freshly (re)uploaded plan) — adjusted during render,
  // same pattern as above, rather than in an effect.
  const imageIdentity = `${floor?.id ?? "none"}:${floor?.plan_image ?? ""}`;
  const [syncedImageIdentity, setSyncedImageIdentity] = useState(imageIdentity);
  if (imageIdentity !== syncedImageIdentity) {
    setSyncedImageIdentity(imageIdentity);
    setNaturalSize(null);
    setRenderedWidth(0);
  }

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setRenderedWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [floor?.plan_image]);

  const scale = naturalSize && naturalSize.width > 0 ? renderedWidth / naturalSize.width : 0;
  const renderedHeight = naturalSize && scale > 0 ? naturalSize.height * scale : 0;

  function handleImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setRenderedWidth(img.clientWidth);
  }

  // ---- upload / replace plan image ----
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !floor) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadFloorPlanImage(floor.id, file);
      await refetch();
    } catch (err) {
      setUploadError(extractErrorMessage(err, t("formGenericError")));
    } finally {
      setUploading(false);
    }
  }

  // ---- interaction state (reset whenever the selected floor changes) ----
  const [drag, setDrag] = useState<DragState | null>(null);
  const [savingNodeId, setSavingNodeId] = useState<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [calibrating, setCalibrating] = useState(false);
  const [calibratePoints, setCalibratePoints] = useState<CalibratePoint[]>([]);
  const [calibrateMeters, setCalibrateMeters] = useState("");
  const [calibrateSubmitting, setCalibrateSubmitting] = useState(false);
  const [calibrateError, setCalibrateError] = useState<string | null>(null);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>(DEFAULT_EDGE_FORM);
  const [edgeFieldErrors, setEdgeFieldErrors] = useState<Record<string, string[]>>({});
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edgeSubmitting, setEdgeSubmitting] = useState(false);

  // Reset all transient interaction state whenever the selected floor changes
  // — adjusted during render (same pattern as above) rather than in an effect.
  const [syncedFloorForInteraction, setSyncedFloorForInteraction] = useState(selectedFloorId);
  if (selectedFloorId !== syncedFloorForInteraction) {
    setSyncedFloorForInteraction(selectedFloorId);
    setDrag(null);
    setSelectedNodeIds([]);
    setCalibrating(false);
    setCalibratePoints([]);
    setCalibrateMeters("");
    setCalibrateError(null);
    setMapError(null);
    setUploadError(null);
  }

  // Reset the mini edge-creation form whenever the 2-node selection changes.
  const selectionKey = selectedNodeIds.join(",");
  const [syncedSelectionKey, setSyncedSelectionKey] = useState(selectionKey);
  if (selectionKey !== syncedSelectionKey) {
    setSyncedSelectionKey(selectionKey);
    setEdgeForm(DEFAULT_EDGE_FORM);
    setEdgeFieldErrors({});
    setEdgeError(null);
  }

  function handleNodeClick(node: FacilityNode) {
    setMapError(null);
    setSelectedNodeIds((prev) => {
      if (prev.includes(node.id)) return prev.filter((id) => id !== node.id);
      if (prev.length >= 2) return [node.id];
      return [...prev, node.id];
    });
  }

  // ---- drag to reposition ----
  function handleMarkerPointerDown(e: ReactPointerEvent<HTMLDivElement>, node: FacilityNode) {
    if (calibrating || scale <= 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = naturalToDisplayed(node.pos_x, scale);
    const y = naturalToDisplayed(node.pos_y, scale);
    setDrag({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDisplayedX: x,
      startDisplayedY: y,
      currentDisplayedX: x,
      currentDisplayedY: y,
      moved: false,
    });
  }

  function handleMarkerPointerMove(e: ReactPointerEvent<HTMLDivElement>, node: FacilityNode) {
    if (!drag || drag.nodeId !== node.id) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const moved = drag.moved || Math.hypot(dx, dy) > 4;
    setDrag({
      ...drag,
      currentDisplayedX: clamp(drag.startDisplayedX + dx, 0, renderedWidth),
      currentDisplayedY: clamp(drag.startDisplayedY + dy, 0, renderedHeight),
      moved,
    });
  }

  async function handleMarkerPointerUp(e: ReactPointerEvent<HTMLDivElement>, node: FacilityNode) {
    if (!drag || drag.nodeId !== node.id) return;
    const finished = drag;
    setDrag(null);
    if (!finished.moved) {
      handleNodeClick(node);
      return;
    }
    if (scale <= 0) return;
    const newX = round2(displayedToNatural(finished.currentDisplayedX, scale));
    const newY = round2(displayedToNatural(finished.currentDisplayedY, scale));
    setSavingNodeId(node.id);
    setMapError(null);
    try {
      await nodesApi.update(node.id, { ...toNodeInput(node), pos_x: newX, pos_y: newY });
      await refetch();
    } catch (err) {
      setMapError(extractErrorMessage(err, t("formGenericError")));
    } finally {
      setSavingNodeId(null);
    }
  }

  // ---- scale calibration ----
  function handleCanvasClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!calibrating || scale <= 0 || calibratePoints.length >= 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const displayedX = clamp(e.clientX - rect.left, 0, renderedWidth);
    const displayedY = clamp(e.clientY - rect.top, 0, renderedHeight);
    setCalibratePoints((prev) => [
      ...prev,
      { x: displayedToNatural(displayedX, scale), y: displayedToNatural(displayedY, scale) },
    ]);
  }

  function handleCancelCalibrate() {
    setCalibrating(false);
    setCalibratePoints([]);
    setCalibrateMeters("");
    setCalibrateError(null);
  }

  async function handleCalibrateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!floor || calibratePoints.length !== 2) return;
    const meters = Number(calibrateMeters);
    if (calibrateMeters.trim() === "" || Number.isNaN(meters) || meters <= 0) {
      setCalibrateError(t("floorMapCalibrateInvalidDistance"));
      return;
    }
    const [p1, p2] = calibratePoints;
    const pixelDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (pixelDistance === 0) {
      setCalibrateError(t("floorMapCalibrateInvalidPoints"));
      return;
    }
    setCalibrateSubmitting(true);
    setCalibrateError(null);
    try {
      await floorsApi.update(floor.id, { ...toFloorInput(floor), plan_scale_m_per_px: meters / pixelDistance });
      await refetch();
      handleCancelCalibrate();
    } catch (err) {
      setCalibrateError(extractErrorMessage(err, t("formGenericError")));
    } finally {
      setCalibrateSubmitting(false);
    }
  }

  // ---- edge creation from the 2 selected nodes ----
  async function handleCreateEdge(e: FormEvent) {
    e.preventDefault();
    if (selectedNodeIds.length !== 2) return;
    const [fromId, toId] = selectedNodeIds;

    const walkTime = Number(edgeForm.walk_time_sec);
    if (edgeForm.walk_time_sec.trim() === "" || Number.isNaN(walkTime)) {
      setEdgeFieldErrors({ walk_time_sec: [t("fieldRequired")] });
      return;
    }

    const distanceStr = edgeForm.distance_m.trim();
    const distanceValue = distanceStr === "" ? undefined : Number(distanceStr);

    const payload: FacilityEdgeInput = {
      from_node: fromId,
      to_node: toId,
      edge_type: edgeForm.edge_type,
      walk_time_sec: Math.round(walkTime),
      is_bidirectional: edgeForm.is_bidirectional,
      wheelchair_accessible: edgeForm.wheelchair_accessible,
      // Omit the key entirely for a blank field so the backend's auto-calculate
      // path kicks in (DRF rejects `null`/`""` as invalid floats — see EdgesSection.tsx).
      ...(distanceValue != null && !Number.isNaN(distanceValue) ? { distance_m: distanceValue } : {}),
    };

    setEdgeSubmitting(true);
    setEdgeFieldErrors({});
    setEdgeError(null);
    try {
      await edgesApi.create(payload);
      await refetch();
      setSelectedNodeIds([]);
    } catch (err) {
      const { fieldErrors, generalError } = splitFieldErrors(err, EDGE_FIELD_NAMES);
      setEdgeFieldErrors(fieldErrors);
      setEdgeError(generalError ?? (Object.keys(fieldErrors).length === 0 ? t("formGenericError") : null));
    } finally {
      setEdgeSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12.5px] font-medium text-[var(--ink)]">{t("floorMapSelectFloorLabel")}</label>
        <select
          value={selectedFloorId ?? ""}
          onChange={(e) => setSelectedFloorId(e.target.value ? Number(e.target.value) : null)}
          disabled={floors.length === 0}
          className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)] disabled:opacity-60"
        >
          {floors.length === 0 && <option value="">{t("floorMapNoFloors")}</option>}
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {`${buildingLabel(f.building)} · ${f.name_th} (L${f.level_no})`}
            </option>
          ))}
        </select>
      </div>

      {loading && floors.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[12.5px]">{t("loading")}</div>
        </div>
      ) : !floor ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[14px] font-semibold">{t("floorMapNoFloors")}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-muted)]">
                <RulerIcon width={15} height={15} />
                {floor.plan_scale_m_per_px != null
                  ? t("floorMapScaleCalibrated", { value: round2(floor.plan_scale_m_per_px) })
                  : t("floorMapScaleNotCalibrated")}
              </div>
              {floor.plan_image && (
                <div className="flex gap-2">
                  {calibrating ? (
                    <button
                      type="button"
                      onClick={handleCancelCalibrate}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                    >
                      {t("floorMapCalibrateCancel")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCalibrating(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--surface-app)]"
                    >
                      <RulerIcon width={13} height={13} />
                      {t("floorMapCalibrateStart")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--surface-app)] disabled:opacity-60"
                  >
                    <UploadIcon width={13} height={13} />
                    {uploading ? t("floorMapUploading") : t("floorMapReplaceImageCta")}
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {mapError && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{mapError}</div>}
            {uploadError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{uploadError}</div>
            )}

            {!floor.plan_image ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16">
                <UploadIcon width={26} height={26} strokeWidth={1.6} className="text-[#b7cbc7]" />
                <div className="text-[14px] font-semibold text-[var(--ink)]">{t("floorMapUploadTitle")}</div>
                <div className="max-w-xs text-center text-[12.5px] text-[var(--ink-muted)]">
                  {t("floorMapUploadDescription")}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-ink)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <UploadIcon width={15} height={15} />
                  {uploading ? t("floorMapUploading") : t("floorMapUploadCta")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {calibrating && calibratePoints.length < 2 && (
                  <div className="text-[12px] font-medium text-[var(--brand-ink-soft)]">
                    {calibratePoints.length === 0 ? t("floorMapCalibratePrompt1") : t("floorMapCalibratePrompt2")}
                  </div>
                )}
                {!calibrating && floorNodes.length === 0 && (
                  <div className="text-[12px] text-[var(--ink-muted)]">{t("floorMapEmptyNodes")}</div>
                )}
                {!calibrating && floorNodes.length > 0 && (
                  <div className="text-[12px] text-[var(--ink-muted)]">{t("floorMapDragHint")}</div>
                )}

                <div
                  onClick={handleCanvasClick}
                  className={`relative w-full max-w-[900px] select-none overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[#eef2f1] ${
                    calibrating && calibratePoints.length < 2 ? "cursor-crosshair" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- needs a plain <img> ref for
                      naturalWidth/naturalHeight (see coordinate-system helpers above); the source is an
                      arbitrary Django MEDIA_URL host, not a configured next/image remote pattern. */}
                  <img
                    ref={imgRef}
                    src={floor.plan_image}
                    alt={t("floorMapImageAlt")}
                    draggable={false}
                    onLoad={handleImageLoad}
                    className="block h-auto w-full select-none"
                  />

                  {scale > 0 && (
                    <svg
                      className="pointer-events-none absolute left-0 top-0"
                      width={renderedWidth}
                      height={renderedHeight}
                    >
                      {floorEdges.map((edge) => {
                        const from = floorNodes.find((n) => n.id === edge.from_node);
                        const to = floorNodes.find((n) => n.id === edge.to_node);
                        if (!from || !to) return null;
                        return (
                          <line
                            key={edge.id}
                            x1={naturalToDisplayed(from.pos_x, scale)}
                            y1={naturalToDisplayed(from.pos_y, scale)}
                            x2={naturalToDisplayed(to.pos_x, scale)}
                            y2={naturalToDisplayed(to.pos_y, scale)}
                            stroke="var(--brand-teal)"
                            strokeWidth={2}
                          />
                        );
                      })}
                      {calibratePoints.length === 2 && (
                        <line
                          x1={naturalToDisplayed(calibratePoints[0].x, scale)}
                          y1={naturalToDisplayed(calibratePoints[0].y, scale)}
                          x2={naturalToDisplayed(calibratePoints[1].x, scale)}
                          y2={naturalToDisplayed(calibratePoints[1].y, scale)}
                          stroke="var(--brand-amber)"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                        />
                      )}
                    </svg>
                  )}

                  {scale > 0 &&
                    calibratePoints.map((p, index) => (
                      <div
                        key={index}
                        className="pointer-events-none absolute rounded-full border-2 border-white bg-[var(--brand-amber)] shadow"
                        style={{
                          width: 10,
                          height: 10,
                          left: naturalToDisplayed(p.x, scale) - 5,
                          top: naturalToDisplayed(p.y, scale) - 5,
                        }}
                      />
                    ))}

                  {scale > 0 &&
                    floorNodes.map((node) => {
                      const isDragging = drag?.nodeId === node.id;
                      const displayedX = isDragging ? drag.currentDisplayedX : naturalToDisplayed(node.pos_x, scale);
                      const displayedY = isDragging ? drag.currentDisplayedY : naturalToDisplayed(node.pos_y, scale);
                      const isSelected = selectedNodeIds.includes(node.id);
                      const isSaving = savingNodeId === node.id;
                      return (
                        <div
                          key={node.id}
                          onPointerDown={(e) => handleMarkerPointerDown(e, node)}
                          onPointerMove={(e) => handleMarkerPointerMove(e, node)}
                          onPointerUp={(e) => handleMarkerPointerUp(e, node)}
                          title={node.name_th}
                          className={`absolute rounded-full border-2 border-white shadow-md ${
                            isSelected ? "bg-[var(--brand-amber)]" : "bg-[var(--brand-teal)]"
                          } ${isSaving ? "opacity-60" : ""} ${
                            calibrating ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                          }`}
                          style={{
                            width: MARKER_SIZE,
                            height: MARKER_SIZE,
                            left: displayedX - MARKER_SIZE / 2,
                            top: displayedY - MARKER_SIZE / 2,
                            touchAction: "none",
                          }}
                        />
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-80">
            {calibrating && calibratePoints.length === 2 && (
              <form
                onSubmit={handleCalibrateSubmit}
                className="flex flex-col gap-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
              >
                <div className="text-[12.5px] font-semibold text-[var(--ink)]">
                  {t("floorMapCalibrateDistanceLabel")}
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  autoFocus
                  value={calibrateMeters}
                  onChange={(e) => setCalibrateMeters(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                />
                {calibrateError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{calibrateError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCalibratePoints([])}
                    className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                  >
                    {t("floorMapCalibrateReset")}
                  </button>
                  <button
                    type="submit"
                    disabled={calibrateSubmitting}
                    className="flex-1 rounded-lg bg-[var(--brand-ink)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {t("floorMapCalibrateSubmit")}
                  </button>
                </div>
              </form>
            )}

            {selectedNodeIds.length > 0 && (
              <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-[var(--ink)]">
                  <span>{t("floorMapSelectedCount", { count: selectedNodeIds.length })}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeIds([])}
                    className="text-[11.5px] text-[var(--ink-muted)] hover:underline"
                  >
                    {t("floorMapClearSelection")}
                  </button>
                </div>
                <ul className="mb-3 flex flex-col gap-1 text-[12px] text-[var(--ink-muted)]">
                  {selectedNodeIds.map((nodeId) => {
                    const n = floorNodes.find((x) => x.id === nodeId);
                    return <li key={nodeId}>{n ? n.name_th : `#${nodeId}`}</li>;
                  })}
                </ul>

                {selectedNodeIds.length === 2 && (
                  <form onSubmit={handleCreateEdge} className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-3">
                    <div className="text-[12.5px] font-semibold text-[var(--ink)]">{t("floorMapCreateEdgeTitle")}</div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-[var(--ink)]">{t("colEdgeType")}</label>
                      <select
                        value={edgeForm.edge_type}
                        onChange={(e) => setEdgeForm((prev) => ({ ...prev, edge_type: e.target.value as EdgeType }))}
                        className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      >
                        {EDGE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`edgeType.${type}` as const)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-[var(--ink)]">{t("colWalkTime")}</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={edgeForm.walk_time_sec}
                        onChange={(e) => setEdgeForm((prev) => ({ ...prev, walk_time_sec: e.target.value }))}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                      {edgeFieldErrors.walk_time_sec?.map((m, i) => (
                        <div key={i} className="text-[11.5px] text-red-600">
                          {m}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-[var(--ink)]">{t("colDistance")}</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={edgeForm.distance_m}
                        placeholder={t("floorMapAutoCalcPlaceholder")}
                        onChange={(e) => setEdgeForm((prev) => ({ ...prev, distance_m: e.target.value }))}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                      <div className="text-[11.5px] text-[var(--ink-faint)]">{t("edgeDistanceHelp")}</div>
                      {edgeFieldErrors.distance_m?.map((m, i) => (
                        <div key={i} className="text-[11.5px] text-red-600">
                          {m}
                        </div>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={edgeForm.is_bidirectional}
                        onChange={(e) => setEdgeForm((prev) => ({ ...prev, is_bidirectional: e.target.checked }))}
                      />
                      {t("colBidirectional")}
                    </label>
                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={edgeForm.wheelchair_accessible}
                        onChange={(e) =>
                          setEdgeForm((prev) => ({ ...prev, wheelchair_accessible: e.target.checked }))
                        }
                      />
                      {t("colWheelchair")}
                    </label>

                    {edgeError && (
                      <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{edgeError}</div>
                    )}

                    <button
                      type="submit"
                      disabled={edgeSubmitting}
                      className="rounded-lg bg-[var(--brand-ink)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                    >
                      {t("floorMapCreateEdgeSubmit")}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
