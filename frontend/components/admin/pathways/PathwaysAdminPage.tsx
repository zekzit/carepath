"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { careCategoriesApi, pathwayTemplatesApi, type CareCategory, type PathwayTemplate } from "@/lib/api/pathway";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import { CareCategoriesSection } from "./CareCategoriesSection";
import { PathwayTemplatesSection } from "./PathwayTemplatesSection";
import { TemplateStepsSection } from "./TemplateStepsSection";

type TabId = "categories" | "templates" | "steps";

async function fetchPathwayData() {
  const [careCategories, pathwayTemplates, nodes] = await Promise.all([
    careCategoriesApi.list(),
    pathwayTemplatesApi.list(),
    nodesApi.list(),
  ]);
  return { careCategories, pathwayTemplates, nodes };
}

export function PathwaysAdminPage() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<TabId>("categories");

  const [careCategories, setCareCategories] = useState<CareCategory[]>([]);
  const [pathwayTemplates, setPathwayTemplates] = useState<PathwayTemplate[]>([]);
  const [nodes, setNodes] = useState<FacilityNode[]>([]);
  const [loading, setLoading] = useState(true);

  async function refetchAll() {
    setLoading(true);
    try {
      const data = await fetchPathwayData();
      setCareCategories(data.careCategories);
      setPathwayTemplates(data.pathwayTemplates);
      setNodes(data.nodes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPathwayData();
        if (cancelled) return;
        setCareCategories(data.careCategories);
        setPathwayTemplates(data.pathwayTemplates);
        setNodes(data.nodes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const servicePointNodes = nodes.filter((n) => n.node_type === "SERVICE_POINT");

  const tabs = [
    { id: "categories", label: t("pathwaysTabCategories") },
    { id: "templates", label: t("pathwaysTabTemplates") },
    { id: "steps", label: t("pathwaysTabSteps") },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === "categories" && (
        <CareCategoriesSection careCategories={careCategories} loading={loading} refetch={refetchAll} />
      )}
      {tab === "templates" && (
        <PathwayTemplatesSection
          pathwayTemplates={pathwayTemplates}
          careCategories={careCategories}
          loading={loading}
          refetch={refetchAll}
        />
      )}
      {tab === "steps" && (
        <TemplateStepsSection pathwayTemplates={pathwayTemplates} servicePointNodes={servicePointNodes} />
      )}
    </div>
  );
}
