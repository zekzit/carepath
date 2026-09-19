"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { staffUsersApi, servicePointStaffApi, type ServicePointStaff, type StaffUser } from "@/lib/api/accounts";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import { StaffUsersSection } from "./StaffUsersSection";
import { ServicePointStaffSection } from "./ServicePointStaffSection";

async function fetchStaffData() {
  const [staffUsers, assignments, nodes] = await Promise.all([
    staffUsersApi.list(),
    servicePointStaffApi.list(),
    nodesApi.list(),
  ]);
  return { staffUsers, assignments, nodes };
}

export function StaffAdminPage() {
  const t = useTranslations("admin");

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<ServicePointStaff[]>([]);
  const [nodes, setNodes] = useState<FacilityNode[]>([]);
  const [loading, setLoading] = useState(true);

  async function refetchAll() {
    setLoading(true);
    try {
      const data = await fetchStaffData();
      setStaffUsers(data.staffUsers);
      setAssignments(data.assignments);
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
        const data = await fetchStaffData();
        if (cancelled) return;
        setStaffUsers(data.staffUsers);
        setAssignments(data.assignments);
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

  return (
    <div className="flex flex-1 flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--ink)]">{t("staffUsersSectionTitle")}</div>
          <div className="text-[12.5px] text-[var(--ink-muted)]">{t("staffUsersSectionDescription")}</div>
        </div>
        <StaffUsersSection staffUsers={staffUsers} loading={loading} refetch={refetchAll} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--ink)]">{t("servicePointStaffSectionTitle")}</div>
          <div className="text-[12.5px] text-[var(--ink-muted)]">{t("servicePointStaffSectionDescription")}</div>
        </div>
        <ServicePointStaffSection
          assignments={assignments}
          staffUsers={staffUsers}
          servicePointNodes={servicePointNodes}
          loading={loading}
          refetch={refetchAll}
        />
      </section>
    </div>
  );
}
