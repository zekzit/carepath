"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
      <div className="mb-3.5 border-b border-[var(--border-subtle)] pb-3">
        <div className="text-[14px] font-semibold text-[var(--ink)]">{title}</div>
        <div className="text-[12px] text-[var(--ink-faint)]">{description}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-medium text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
      <span className="text-[12.5px] font-medium text-[var(--ink)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}

/** Mockup only — every field is local component state, nothing here is
 * persisted server-side yet (no Settings model/endpoint exists). Shows the
 * shape of what an admin should eventually be able to configure. */
export function SettingsPage() {
  const t = useTranslations("admin");

  const [hospitalName, setHospitalName] = useState("รพ. ตัวอย่าง");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState<"th" | "en">("th");

  const [smsNotify, setSmsNotify] = useState(true);
  const [lineNotify, setLineNotify] = useState(false);
  const [notifyBeforeTurn, setNotifyBeforeTurn] = useState(3);

  const [autoSkipMinutes, setAutoSkipMinutes] = useState(15);
  const [resetTicketsAt, setResetTicketsAt] = useState("00:00");
  const [maxTicketsPerPoint, setMaxTicketsPerPoint] = useState(200);

  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [minPasswordLength, setMinPasswordLength] = useState(8);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90);

  const [visitRetentionDays, setVisitRetentionDays] = useState(365);
  const [auditRetentionDays, setAuditRetentionDays] = useState(365);

  const [savedToastVisible, setSavedToastVisible] = useState(false);

  function handleSave() {
    setSavedToastVisible(true);
    window.setTimeout(() => setSavedToastVisible(false), 2500);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-lg border border-[var(--border-dashed)] bg-[#fdf6ea] px-3.5 py-2.5 text-[12.5px] text-[#8a6413]">
        {t("settingsMockupNotice")}
      </div>

      <SettingsSection title={t("settingsSectionHospitalTitle")} description={t("settingsSectionHospitalDescription")}>
        <Field label={t("settingsHospitalName")}>
          <input className={inputClass} value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
        </Field>
        <Field label={t("settingsHospitalAddress")}>
          <input className={inputClass} value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} />
        </Field>
        <Field label={t("settingsDefaultLanguage")}>
          <select className={inputClass} value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as "th" | "en")}>
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t("settingsHospitalLogo")}>
          <button type="button" className={`${inputClass} text-left text-[var(--ink-faint)]`} disabled>
            {t("settingsUploadLogo")}
          </button>
        </Field>
      </SettingsSection>

      <SettingsSection title={t("settingsSectionNotificationsTitle")} description={t("settingsSectionNotificationsDescription")}>
        <ToggleField label={t("settingsSmsNotify")} checked={smsNotify} onChange={setSmsNotify} />
        <ToggleField label={t("settingsLineNotify")} checked={lineNotify} onChange={setLineNotify} />
        <Field label={t("settingsNotifyBeforeTurn")}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={notifyBeforeTurn}
            onChange={(e) => setNotifyBeforeTurn(Number(e.target.value))}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title={t("settingsSectionQueueTitle")} description={t("settingsSectionQueueDescription")}>
        <Field label={t("settingsAutoSkipMinutes")}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={autoSkipMinutes}
            onChange={(e) => setAutoSkipMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label={t("settingsResetTicketsAt")}>
          <input type="time" className={inputClass} value={resetTicketsAt} onChange={(e) => setResetTicketsAt(e.target.value)} />
        </Field>
        <Field label={t("settingsMaxTicketsPerPoint")}>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={maxTicketsPerPoint}
            onChange={(e) => setMaxTicketsPerPoint(Number(e.target.value))}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title={t("settingsSectionSecurityTitle")} description={t("settingsSectionSecurityDescription")}>
        <Field label={t("settingsSessionTimeout")}>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Number(e.target.value))}
          />
        </Field>
        <Field label={t("settingsMinPasswordLength")}>
          <input
            type="number"
            min={4}
            className={inputClass}
            value={minPasswordLength}
            onChange={(e) => setMinPasswordLength(Number(e.target.value))}
          />
        </Field>
        <Field label={t("settingsPasswordExpiryDays")}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={passwordExpiryDays}
            onChange={(e) => setPasswordExpiryDays(Number(e.target.value))}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title={t("settingsSectionRetentionTitle")} description={t("settingsSectionRetentionDescription")}>
        <Field label={t("settingsVisitRetentionDays")}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={visitRetentionDays}
            onChange={(e) => setVisitRetentionDays(Number(e.target.value))}
          />
        </Field>
        <Field label={t("settingsAuditRetentionDays")}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={auditRetentionDays}
            onChange={(e) => setAuditRetentionDays(Number(e.target.value))}
          />
        </Field>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="self-start rounded-lg bg-[var(--brand-ink)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t("settingsSaveButton")}
        </button>
        {savedToastVisible && <div className="text-[12.5px] font-medium text-[#1f7a5c]">{t("settingsSavedToast")}</div>}
      </div>
    </div>
  );
}
