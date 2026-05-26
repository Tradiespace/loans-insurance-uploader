"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  FileSpreadsheet,
  X,
  Info,
  Briefcase,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────── */
const WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/20973041/ujdtea8/";

const FIELDS = [
  { key: "identity_email",         label: "Identity Email",         required: true,  auto: false },
  { key: "identity_first_name",    label: "Identity First Name",    required: true,  auto: false },
  { key: "identity_last_name",     label: "Identity Last Name",     required: false, auto: false },
  { key: "identity_business_name", label: "Identity Business Name", required: false, auto: false },
  { key: "identity_phone",         label: "Identity Phone",         required: false, auto: false },
  { key: "identity_trade",         label: "Identity Trade",         required: false, auto: false },
  { key: "flow_type",              label: "Flow Type",              required: false, auto: true  },
  { key: "stage_progress",         label: "Stage / Progress",       required: false, auto: false },
] as const;

type FieldKey    = (typeof FIELDS)[number]["key"];
type UploadType  = "loans" | "insurance";
type UploadStatus = "idle" | "uploading" | "success" | "error";
type Mappings    = Partial<Record<FieldKey, string>>;
type DataRow     = Record<string, unknown>;

/* ─── Stage lists ────────────────────────────────────────── */
const STAGES: Record<UploadType, string[]> = {
  loans: [
    "New Leads",
    "Qualifying",
    "Discovery",
    "Work In Progress",
    "Submissions",
    "Approval",
    "Settlement",
    "Won",
    "Lost",
    "Archive",
  ],
  insurance: [
    "New Insurance Interest",
    "Submitted",
    "In Progress",
    "Closed - Won",
    "Closed - Lost",
  ],
};

const STAGE_FALLBACK: Record<UploadType, string> = {
  loans:     "New Leads",
  insurance: "Submitted",
};

/* ─── Stage normalisation ────────────────────────────────── */
function normalizeStage(raw: string, uploadType: UploadType): string {
  if (!raw?.trim()) return STAGE_FALLBACK[uploadType];

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const rawN = norm(raw);
  const stages = STAGES[uploadType];

  // 1. Exact match after normalisation
  const exact = stages.find((s) => norm(s) === rawN);
  if (exact) return exact;

  // 2. One fully contains the other
  const contains = stages.find((s) => {
    const sN = norm(s);
    return rawN.includes(sN) || sN.includes(rawN);
  });
  if (contains) return contains;

  // 3. Word-overlap scoring — return best if ≥ 1 word in common
  const rawWords = new Set(rawN.split(/\s+/).filter(Boolean));
  let bestStage = "";
  let bestScore = 0;
  for (const s of stages) {
    const stageWords = norm(s).split(/\s+/).filter(Boolean);
    const overlap = stageWords.filter((w) => rawWords.has(w)).length;
    if (overlap > bestScore) { bestScore = overlap; bestStage = s; }
  }
  if (bestScore >= 1) return bestStage;

  // 4. No match — use fallback
  return STAGE_FALLBACK[uploadType];
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1_048_576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1_048_576).toFixed(1) + " MB";
}

function autoSuggest(cols: string[]): Mappings {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const out: Mappings = {};
  FIELDS.filter((f) => !f.auto).forEach((f) => {
    const fn = norm(f.label);
    const hit = cols.find((c) => {
      const cn = norm(c);
      return cn === fn || cn.includes(fn) || fn.includes(cn);
    });
    if (hit) out[f.key] = hit;
  });
  return out;
}

/* ─── Logo ───────────────────────────────────────────────── */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/Tradiespace_Logo_Primary.png" alt="Tradiespace" width={196} height={48} />
    </div>
  );
}

/* ─── StepIndicator ──────────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  const steps = ["Upload Type", "Upload File", "Map Fields", "Review"];
  return (
    <div className="w-full max-w-[500px] mx-auto mt-9">
      <div className="flex items-start">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <div key={i} className="flex flex-col items-center flex-1 relative">
              {i < steps.length - 1 && (
                <div
                  className="absolute top-[12px] h-px"
                  style={{
                    left: "calc(50% + 16px)",
                    right: "calc(-50% + 16px)",
                    background: done ? "var(--amber)" : "var(--border-md)",
                    transition: "background var(--ts) var(--ease)",
                  }}
                />
              )}
              <div
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-display text-[11px] font-bold relative z-10"
                style={{
                  border: `1.5px solid ${active || done ? "var(--amber)" : "var(--border-md)"}`,
                  background: active
                    ? "var(--amber-lo)"
                    : done
                      ? "var(--amber)"
                      : "var(--s1)",
                  color: active ? "var(--amber)" : done ? "#fff" : "var(--text-3)",
                  boxShadow: active ? "0 0 0 4px var(--amber-lo)" : "none",
                  transition: "all var(--ts) var(--ease)",
                }}
              >
                {done ? <Check size={10} strokeWidth={3} /> : n}
              </div>
              <div
                className="mt-1.5 text-[10px] font-semibold uppercase"
                style={{
                  letterSpacing: "0.05em",
                  color: active ? "var(--amber)" : done ? "var(--text-2)" : "var(--text-3)",
                  transition: "color var(--t) var(--ease)",
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── TypePill ───────────────────────────────────────────── */
function TypePill({ type }: { type: UploadType }) {
  return (
    <span
      className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold uppercase"
      style={{
        letterSpacing: "0.05em",
        background: type === "loans" ? "var(--amber-lo)" : "var(--blue-lo)",
        color: type === "loans" ? "var(--amber)" : "var(--blue)",
        border: `1px solid ${type === "loans" ? "var(--amber-md)" : "var(--blue-md)"}`,
      }}
    >
      {type === "loans" ? "Loans" : "Insurance"}
    </span>
  );
}

/* ─── Badge ──────────────────────────────────────────────── */
type BadgeVariant = "required" | "optional" | "auto";

function Badge({ variant }: { variant: BadgeVariant }) {
  const map = {
    required: { bg: "var(--amber-lo)", color: "var(--amber)", border: "var(--amber-md)", label: "Required" },
    optional: { bg: "var(--s3)",       color: "var(--text-3)", border: "var(--border)",  label: "Optional" },
    auto:     { bg: "var(--blue-lo)",  color: "var(--blue)",   border: "var(--blue-md)", label: "Auto"     },
  } as const;
  const s = map[variant];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{
        letterSpacing: "0.05em",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

/* ─── Btn ────────────────────────────────────────────────── */
interface BtnProps {
  variant: "primary" | "secondary";
  size?: "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconPos?: "left" | "right";
}

function Btn({
  variant,
  size = "md",
  onClick,
  disabled,
  children,
  icon,
  iconPos = "right",
}: BtnProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    borderRadius: size === "lg" ? "var(--r-lg)" : "var(--r)",
    fontFamily: "inherit",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 1,
    border: "none",
    transition: "all 200ms var(--ease)",
    fontSize: size === "lg" ? 15 : 14,
    padding: size === "lg" ? "15px 38px" : "12px 24px",
    ...(variant === "primary"
      ? {
          background: "linear-gradient(135deg, var(--amber) 0%, var(--amber-hi) 100%)",
          color: "#fff",
          boxShadow: "0 4px 18px rgba(217,119,6,0.22)",
        }
      : {
          background: "var(--s1)",
          color: "var(--text-2)",
          border: "1px solid var(--border-md)",
        }),
  };

  return (
    <button
      style={base}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        el.style.transform = "translateY(-1px)";
        if (variant === "primary") el.style.boxShadow = "0 6px 26px rgba(217,119,6,0.33)";
        else { el.style.borderColor = "var(--border-hi)"; el.style.color = "var(--text-1)"; }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        if (variant === "primary") el.style.boxShadow = "0 4px 18px rgba(217,119,6,0.22)";
        else { el.style.borderColor = "var(--border-md)"; el.style.color = "var(--text-2)"; }
      }}
    >
      {iconPos === "left" && icon}
      {children}
      {iconPos === "right" && icon}
    </button>
  );
}

function BtnRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-7">{children}</div>
  );
}

/* ─── InfoBox ────────────────────────────────────────────── */
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 p-3 rounded-lg text-[13px] leading-relaxed mt-3.5"
      style={{
        background: "var(--s2)",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
      }}
    >
      <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-3)" }} />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 1: LANDING
══════════════════════════════════════════════════════════ */
function LandingStep({ onSelect }: { onSelect: (t: UploadType) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen px-6 pb-20 fade-in">
      <div className="w-full max-w-[540px] flex flex-col items-center">
        <Logo />
        <div className="mt-11 text-center">
          <h1
            className="font-display font-bold text-[32px] leading-tight"
            style={{ color: "var(--text-1)", letterSpacing: "-0.02em" }}
          >
            What are you trying
            <br />
            to upload?
          </h1>
          <p
            className="text-[14px] mt-3 leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            Select the type of data you'd like to import into Tradiespace.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mt-9 w-full max-sm:grid-cols-1">
          <TypeCard type="loans" onClick={() => onSelect("loans")} />
          <TypeCard type="insurance" onClick={() => onSelect("insurance")} />
        </div>
      </div>
    </div>
  );
}

function TypeCard({ type, onClick }: { type: UploadType; onClick: () => void }) {
  const isLoans = type === "loans";
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-[20px] p-7 flex flex-col gap-3.5 relative overflow-hidden cursor-pointer w-full"
      style={{
        background: "var(--s1)",
        border: "1.5px solid var(--border-md)",
        transition: "border-color var(--t) var(--ease), transform var(--t) var(--ease), box-shadow var(--t) var(--ease)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-3px)";
        el.style.borderColor = isLoans ? "var(--amber)" : "var(--blue)";
        el.style.boxShadow = isLoans
          ? "0 10px 36px rgba(0,0,0,0.09), 0 0 40px rgba(217,119,6,0.10)"
          : "0 10px 36px rgba(0,0,0,0.09), 0 0 40px rgba(37,99,235,0.10)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.borderColor = "";
        el.style.boxShadow = "";
      }}
    >
      <div
        className="w-12 h-12 rounded-[14px] flex items-center justify-center"
        style={{ background: "var(--s3)", border: "1px solid var(--border-md)" }}
      >
        {isLoans ? (
          <Briefcase size={22} style={{ color: "var(--amber)" }} />
        ) : (
          <ShieldCheck size={22} style={{ color: "var(--blue)" }} />
        )}
      </div>
      <div>
        <div
          className="font-display font-bold text-[20px]"
          style={{ color: "var(--text-1)" }}
        >
          {isLoans ? "Loans" : "Insurance"}
        </div>
        <div
          className="text-[13px] mt-1 leading-[1.55]"
          style={{ color: "var(--text-2)" }}
        >
          {isLoans
            ? "Import loan leads and applications for the loans pipeline."
            : "Import insurance prospects and policy holders."}
        </div>
      </div>
      <div
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center mt-auto"
        style={{
          border: "1px solid var(--border-md)",
          transition: "all var(--t) var(--ease)",
        }}
      >
        <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 2: UPLOAD FILE
══════════════════════════════════════════════════════════ */
interface UploadStepProps {
  uploadType: UploadType;
  file: File | null;
  onFile: (f: File | null) => void;
  onBack: () => void;
  onNext: () => void;
}

function UploadStep({ uploadType, file, onFile, onBack, onNext }: UploadStepProps) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div className="flex flex-col flex-1 w-full max-w-[680px] mx-auto px-6 pb-20 fade-in">
      <div className="flex justify-center pt-7">
        <Logo />
      </div>
      <StepIndicator current={2} />

      <div className="mt-9">
        <div className="flex items-center gap-2.5 mb-2">
          <h2
            className="font-display font-bold text-[26px]"
            style={{ color: "var(--text-1)", letterSpacing: "-0.015em" }}
          >
            Upload your file
          </h2>
          <TypePill type={uploadType} />
        </div>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Upload a CSV or Excel file containing your {uploadType} data.
        </p>
      </div>

      <div className="mt-7">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
        />

        {!file ? (
          <div
            className="rounded-[20px] flex flex-col items-center gap-3.5 cursor-pointer text-center"
            style={{
              padding: "56px 40px",
              border: `2px dashed ${dragging ? "var(--amber)" : "var(--border-md)"}`,
              background: dragging ? "var(--amber-lo)" : "var(--s1)",
              boxShadow: dragging ? "0 0 0 5px var(--amber-lo)" : "none",
              transition: "all var(--t) var(--ease)",
            }}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={(e) => {
              if (dragging) return;
              e.currentTarget.style.borderColor = "var(--amber)";
              e.currentTarget.style.background = "var(--amber-lo)";
            }}
            onMouseLeave={(e) => {
              if (dragging) return;
              e.currentTarget.style.borderColor = "var(--border-md)";
              e.currentTarget.style.background = "var(--s1)";
            }}
          >
            <div
              className="w-[60px] h-[60px] rounded-[17px] flex items-center justify-center"
              style={{ background: "var(--s3)", border: "1px solid var(--border-md)" }}
            >
              <Upload
                size={26}
                style={{ color: dragging ? "var(--amber)" : "var(--text-2)" }}
              />
            </div>
            <div
              className="font-display font-semibold text-[17px]"
              style={{ color: "var(--text-1)" }}
            >
              {dragging ? "Drop it here!" : "Drag & drop your file"}
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-2)" }}>
              or{" "}
              <span
                className="cursor-pointer"
                style={{ color: "var(--amber)" }}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              >
                click to browse
              </span>
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
            >
              .csv &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .xls
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-3.5 p-4 rounded-xl"
            style={{ background: "var(--s1)", border: "1px solid var(--border-md)" }}
          >
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--green-lo)", border: "1px solid var(--green-md)" }}
            >
              <FileSpreadsheet size={18} style={{ color: "var(--green)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium truncate"
                style={{ color: "var(--text-1)" }}
              >
                {file.name}
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
              >
                {fmtBytes(file.size)} &nbsp;·&nbsp; {file.name.split(".").pop()?.toUpperCase()}
              </div>
            </div>
            <button
              className="p-1.5 rounded-md cursor-pointer"
              style={{ color: "var(--text-3)", transition: "all var(--t) var(--ease)" }}
              onClick={() => onFile(null)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--red-lo)";
                e.currentTarget.style.color = "var(--red)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "var(--text-3)";
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {file && (
          <InfoBox>File ready. Press Continue to read columns and set up field mapping.</InfoBox>
        )}
      </div>

      <BtnRow>
        <Btn variant="secondary" onClick={onBack} icon={<ArrowLeft size={14} />} iconPos="left">
          Back
        </Btn>
        <Btn variant="primary" onClick={onNext} disabled={!file} icon={<ArrowRight size={14} color="#fff" />}>
          Continue
        </Btn>
      </BtnRow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 3: MAP FIELDS
══════════════════════════════════════════════════════════ */
interface MappingStepProps {
  uploadType: UploadType;
  columns: string[];
  mappings: Mappings;
  onChange: (key: FieldKey, val: string | undefined) => void;
  onBack: () => void;
  onNext: () => void;
}

function MappingStep({
  uploadType, columns, mappings, onChange, onBack, onNext,
}: MappingStepProps) {
  const canProceed = FIELDS.filter((f) => f.required && !f.auto).every(
    (f) => mappings[f.key]
  );

  return (
    <div className="flex flex-col flex-1 w-full max-w-[860px] mx-auto px-6 pb-20 fade-in">
      <div className="flex justify-center pt-7">
        <Logo />
      </div>
      <StepIndicator current={3} />

      <div className="mt-9">
        <h2
          className="font-display font-bold text-[26px]"
          style={{ color: "var(--text-1)", letterSpacing: "-0.015em" }}
        >
          Map your fields
        </h2>
        <p className="text-[14px] mt-2.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
          Match the columns from your file to the Tradiespace fields below.
        </p>
      </div>

      <div
        className="mt-6 rounded-[16px] p-5"
        style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
      >
        {/* Table header */}
        <div
          className="grid gap-3 pb-3 mb-3 max-sm:hidden"
          style={{
            gridTemplateColumns: "1fr 36px 1fr",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {["Tradiespace Field", "", "Your Column"].map((h, i) => (
            <span
              key={i}
              className="text-[11px] font-bold uppercase"
              style={{ letterSpacing: "0.07em", color: "var(--text-3)" }}
            >
              {h}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {FIELDS.map((f) => (
            <div
              key={f.key}
              className="grid gap-3 items-center max-sm:flex max-sm:flex-col"
              style={{ gridTemplateColumns: "1fr 36px 1fr" }}
            >
              {/* Field label */}
              <div
                className="flex flex-col gap-1 p-3 rounded-lg"
                style={{ background: "var(--s2)", border: "1px solid var(--border)" }}
              >
                <div className="text-[13px] font-medium" style={{ color: "var(--text-1)" }}>
                  {f.label}
                </div>
                <Badge variant={f.auto ? "auto" : f.required ? "required" : "optional"} />
              </div>

              {/* Arrow */}
              <div className="flex justify-center max-sm:hidden">
                <ArrowRight size={16} style={{ color: "var(--text-3)" }} />
              </div>

              {/* Column selector */}
              {f.auto ? (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg text-[12px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "var(--blue-lo)",
                    border: "1px solid var(--blue-md)",
                    color: "var(--blue)",
                  }}
                >
                  {uploadType}
                  <span style={{ opacity: 0.6, fontSize: 11 }}>(auto)</span>
                </div>
              ) : (
                <select
                  className="styled-select w-full p-3 rounded-lg text-[13px] cursor-pointer pr-9"
                  style={{
                    fontFamily: "inherit",
                    background: "var(--s2)",
                    border: `1px solid ${mappings[f.key] ? "rgba(5,150,105,0.30)" : "var(--border-md)"}`,
                    color: "var(--text-1)",
                    transition: "border-color var(--t) var(--ease)",
                  }}
                  value={mappings[f.key] || ""}
                  onChange={(e) =>
                    onChange(f.key, e.target.value || undefined)
                  }
                >
                  <option value="">— Select column —</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <InfoBox>
        {columns.length} columns detected from your file. Optional fields can be left unmapped.
      </InfoBox>

      <BtnRow>
        <Btn variant="secondary" onClick={onBack} icon={<ArrowLeft size={14} />} iconPos="left">
          Back
        </Btn>
        <Btn
          variant="primary"
          onClick={onNext}
          disabled={!canProceed}
          icon={<ArrowRight size={14} color="#fff" />}
        >
          Review Mappings
        </Btn>
      </BtnRow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 4: CONFIRM
══════════════════════════════════════════════════════════ */
interface ConfirmStepProps {
  uploadType: UploadType;
  file: File;
  rows: DataRow[];
  mappings: Mappings;
  onBack: () => void;
  onConfirm: () => void;
}

function ConfirmStep({
  uploadType, file, rows, mappings, onBack, onConfirm,
}: ConfirmStepProps) {
  const mappedCount = FIELDS.filter((f) => !f.auto && mappings[f.key]).length;
  const totalFields = FIELDS.filter((f) => !f.auto).length;

  return (
    <div className="flex flex-col flex-1 w-full max-w-[860px] mx-auto px-6 pb-20 fade-in">
      <div className="flex justify-center pt-7">
        <Logo />
      </div>
      <StepIndicator current={4} />

      <div className="mt-9">
        <h2
          className="font-display font-bold text-[26px]"
          style={{ color: "var(--text-1)", letterSpacing: "-0.015em" }}
        >
          Review &amp; confirm
        </h2>
        <p className="text-[14px] mt-2.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
          Check everything before sending to Tradiespace.
        </p>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mt-6 max-sm:flex-col">
        {[
          { val: rows.length.toLocaleString(), label: "Records to upload" },
          { val: `${mappedCount} / ${totalFields}`, label: "Fields mapped" },
        ].map((s, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 p-5 rounded-xl"
            style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
          >
            <div
              className="font-display font-bold text-[26px]"
              style={{ color: "var(--text-1)" }}
            >
              {s.val}
            </div>
            <div className="text-[11px] text-center" style={{ color: "var(--text-2)" }}>
              {s.label}
            </div>
          </div>
        ))}
        <div
          className="flex-1 flex flex-col items-center gap-1 p-5 rounded-xl"
          style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
        >
          <TypePill type={uploadType} />
          <div className="text-[11px] text-center mt-1" style={{ color: "var(--text-2)" }}>
            Upload type
          </div>
        </div>
      </div>

      {/* Source file */}
      <div
        className="mt-3 rounded-[16px] p-5"
        style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
      >
        <div
          className="text-[11px] font-bold uppercase mb-3.5"
          style={{ letterSpacing: "0.08em", color: "var(--text-3)" }}
        >
          Source File
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--green-lo)", border: "1px solid var(--green-md)" }}
          >
            <FileSpreadsheet size={18} style={{ color: "var(--green)" }} />
          </div>
          <div>
            <div className="text-[14px] font-medium" style={{ color: "var(--text-1)" }}>
              {file.name}
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
            >
              {fmtBytes(file.size)} &nbsp;·&nbsp; {file.name.split(".").pop()?.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Mappings summary */}
      <div
        className="mt-3 rounded-[16px] p-5"
        style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
      >
        <div
          className="text-[11px] font-bold uppercase mb-3.5"
          style={{ letterSpacing: "0.08em", color: "var(--text-3)" }}
        >
          Field Mappings
        </div>
        {FIELDS.map((f, i) => (
          <div
            key={f.key}
            className="flex items-center gap-2.5 py-2.5 text-[13px]"
            style={{
              borderBottom: i < FIELDS.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div className="w-[200px] shrink-0" style={{ color: "var(--text-2)" }}>
              {f.label}
            </div>
            <div style={{ color: "var(--text-3)" }}>→</div>
            {f.auto ? (
              <div className="flex items-center gap-2">
                <span
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-1)" }}
                >
                  {uploadType}
                </span>
                <Badge variant="auto" />
              </div>
            ) : mappings[f.key] ? (
              <span
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-1)" }}
              >
                {mappings[f.key]}
              </span>
            ) : (
              <span className="italic text-[12px]" style={{ color: "var(--text-3)" }}>
                Not mapped
              </span>
            )}
          </div>
        ))}
      </div>

      <BtnRow>
        <Btn variant="secondary" onClick={onBack} icon={<ArrowLeft size={14} />} iconPos="left">
          Back
        </Btn>
        <Btn
          variant="primary"
          size="lg"
          onClick={onConfirm}
          icon={<Check size={16} color="#fff" />}
        >
          Confirm &amp; Upload
        </Btn>
      </BtnRow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 5: STATUS
══════════════════════════════════════════════════════════ */
interface StatusStepProps {
  status: UploadStatus;
  error: string | null;
  recordCount: number;
  uploadType: UploadType;
  onReset: () => void;
}

function StatusStep({ status, error, recordCount, uploadType, onReset }: StatusStepProps) {
  return (
    <div className="flex items-center justify-center flex-1 min-h-screen px-6 pb-20 fade-in">
      <div className="text-center max-w-[440px]">

        {status === "uploading" && (
          <>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: "var(--amber-lo)",
                border: "2px solid var(--amber-md)",
                animation: "pulse-ring 1.6s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  width: 40, height: 40,
                  border: "3px solid var(--amber-md)",
                  borderTopColor: "var(--amber)",
                  borderRadius: "50%",
                  animation: "spin 0.75s linear infinite",
                }}
              />
            </div>
            <h2
              className="font-display font-bold text-[24px]"
              style={{ color: "var(--text-1)" }}
            >
              Uploading data…
            </h2>
            <p className="text-[14px] mt-2.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
              Sending {recordCount.toLocaleString()} records to Tradiespace.
              <br />
              Please don&apos;t close this tab.
            </p>
            <div
              className="h-1 rounded-full overflow-hidden mt-5 max-w-[320px] mx-auto"
              style={{ background: "var(--s3)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--amber), var(--amber-hi))",
                  animation: "progress-fill 2.5s ease forwards",
                }}
              />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "var(--green-lo)", border: "2px solid var(--green-md)" }}
            >
              <Check size={44} strokeWidth={2.5} style={{ color: "var(--green)" }} />
            </div>
            <h2
              className="font-display font-bold text-[24px]"
              style={{ color: "var(--text-1)" }}
            >
              Upload successful!
            </h2>
            <p className="text-[14px] mt-2.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
              {recordCount.toLocaleString()} {uploadType} records have been sent to Zapier and
              will be processed shortly.
            </p>
            <div className="flex justify-center mt-7">
              <Btn variant="secondary" onClick={onReset}>
                Upload another file
              </Btn>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "var(--red-lo)", border: "2px solid rgba(220,38,38,0.25)" }}
            >
              <X size={44} strokeWidth={2.5} style={{ color: "var(--red)" }} />
            </div>
            <h2
              className="font-display font-bold text-[24px]"
              style={{ color: "var(--text-1)" }}
            >
              Upload failed
            </h2>
            <p className="text-[14px] mt-2.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
              {error || "Something went wrong while sending your data."}
            </p>
            {error && (
              <div
                className="mt-3.5 p-3 rounded-lg text-[12px] text-left break-all"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: "var(--red-lo)",
                  border: "1px solid rgba(220,38,38,0.2)",
                  color: "var(--red)",
                }}
              >
                {error}
              </div>
            )}
            <div className="flex justify-center mt-6">
              <Btn variant="secondary" onClick={onReset}>
                Start over
              </Btn>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function UploaderApp() {
  const [step,         setStep]         = useState(1);
  const [uploadType,   setUploadType]   = useState<UploadType | null>(null);
  const [file,         setFile]         = useState<File | null>(null);
  const [columns,      setColumns]      = useState<string[]>([]);
  const [rows,         setRows]         = useState<DataRow[]>([]);
  const [mappings,     setMappings]     = useState<Mappings>({});
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError,  setUploadError]  = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (!f) { setColumns([]); setRows([]); }
  };

  const parseAndContinue = async () => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      const { default: Papa } = await import("papaparse");
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({
          data,
          meta,
        }: {
          data: DataRow[];
          meta: { fields?: string[] };
        }) => {
          const cols = meta.fields || [];
          setColumns(cols);
          setRows(data);
          setMappings(autoSuggest(cols));
          setStep(3);
        },
        error: () => alert("Could not parse CSV. Please check the file and try again."),
      });
    } else {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb  = XLSX.read(e.target!.result, { type: "array" });
          const ws  = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
          if (!raw.length) { alert("File is empty."); return; }
          const hdrs = (raw[0] as unknown[]).map((h) => String(h).trim()).filter(Boolean);
          const data = raw
            .slice(1)
            .map((row) => {
              const obj: DataRow = {};
              hdrs.forEach((h, i) => { obj[h] = (row as unknown[])[i] ?? ""; });
              return obj;
            })
            .filter((r) => Object.values(r).some((v) => v !== ""));
          setColumns(hdrs);
          setRows(data);
          setMappings(autoSuggest(hdrs));
          setStep(3);
        } catch {
          alert("Could not parse Excel file. Please check and try again.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleMappingChange = (key: FieldKey, val: string | undefined) => {
    setMappings((prev) => ({ ...prev, [key]: val }));
  };

  const handleConfirm = async () => {
    setStep(5);
    setUploadStatus("uploading");
    try {
      const records = rows.map((row) => {
        const rec: Record<string, unknown> = {};
        FIELDS.forEach((f) => {
          if (f.auto) {
            rec[f.key] = uploadType;
          } else if (mappings[f.key]) {
            const raw = String(row[mappings[f.key]!] ?? "");
            rec[f.key] =
              f.key === "stage_progress"
                ? normalizeStage(raw, uploadType!)
                : raw;
          }
        });
        return rec;
      });

      const payload = {
        upload_type:   uploadType,
        total_records: records.length,
        file_name:     file?.name,
        records,
      };

      // text/plain avoids the CORS preflight that application/json triggers.
      // Zapier catch hooks don't respond to OPTIONS, so the browser blocks
      // preflight requests. Zapier still receives and parses the JSON body.
      const res = await fetch(WEBHOOK_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify(payload),
      });

      // Zapier returns 200 for success; non-OK still gets flagged.
      if (!res.ok) throw new Error(`Webhook responded with status ${res.status}`);
      setUploadStatus("success");
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleReset = () => {
    setStep(1); setUploadType(null); setFile(null);
    setColumns([]); setRows([]); setMappings({});
    setUploadStatus("idle"); setUploadError(null);
  };

  return (
    <main className="relative z-10 flex flex-col flex-1">
      {step === 1 && (
        <LandingStep
          onSelect={(t) => { setUploadType(t); setStep(2); }}
        />
      )}
      {step === 2 && uploadType && (
        <UploadStep
          uploadType={uploadType}
          file={file}
          onFile={handleFile}
          onBack={() => setStep(1)}
          onNext={parseAndContinue}
        />
      )}
      {step === 3 && uploadType && (
        <MappingStep
          uploadType={uploadType}
          columns={columns}
          mappings={mappings}
          onChange={handleMappingChange}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && uploadType && file && (
        <ConfirmStep
          uploadType={uploadType}
          file={file}
          rows={rows}
          mappings={mappings}
          onBack={() => setStep(3)}
          onConfirm={handleConfirm}
        />
      )}
      {step === 5 && uploadType && (
        <StatusStep
          status={uploadStatus}
          error={uploadError}
          recordCount={rows.length}
          uploadType={uploadType}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
