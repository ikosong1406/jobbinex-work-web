import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import localforage from "localforage";
import { toast, Toaster } from "react-hot-toast";
import {
  FaEnvelope,
  FaPhone,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaChevronDown,
  FaBriefcase,
  FaBuilding,
  FaMapMarkerAlt,
  FaExternalLinkAlt,
  FaPlus,
  FaTimes,
  FaArrowLeft,
  FaUserTie,
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaRegCalendarAlt,
  FaLock,
  FaHourglassHalf,
} from "react-icons/fa";
import { FiChevronRight } from "react-icons/fi";
import Api from "../components/Api";

const DEEP = "#17231a";

const USER_DATA_ENDPOINT = `${Api}/work/userdata`;
const CREATE_JOB_ENDPOINT = `${Api}/work/newJob`;
const GET_CLIENT_JOBS_ENDPOINT = `${Api}/work/getClientJobs`;
const UPDATE_JOB_STATUS_ENDPOINT = `${Api}/work/updateJobStatus`;

// --------------------------------------------------
// Plan limits — single source of truth
// --------------------------------------------------

interface PlanLimits {
  totalQuota: number | null; // null = unlimited
  dailyLimit: number | null; // null = unlimited
  label: string;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  Starter: { totalQuota: 30, dailyLimit: 1, label: "Starter" },
  Professional: { totalQuota: 60, dailyLimit: 2, label: "Professional" },
  Elite: { totalQuota: null, dailyLimit: null, label: "Elite" },
};

const getPlanLimits = (planName?: string): PlanLimits => {
  if (!planName) return { totalQuota: 0, dailyLimit: 0, label: "No plan" };
  return (
    PLAN_LIMITS[planName] ?? {
      totalQuota: 0,
      dailyLimit: 0,
      label: planName,
    }
  );
};

// --------------------------------------------------
// Types
// --------------------------------------------------

interface ClientPlan {
  name: "Starter" | "Professional" | "Elite";
  expiresAt: Date | string;
}

interface Client {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  phonenumber: string;
  jobProvider: string;
  jobEmail: string;
  jobPassword: string;
  cv: string;
  preferredIndustries: string | string[];
  preferredRoles: string | string[];
  preferredLocations: string | string[];
  plan?: ClientPlan;
}

interface UserData {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: string;
  clients: Client[];
}

interface Application {
  _id: string;
  title: string;
  company: string;
  jobUrl: string;
  appliedDate: string;
  notes: string;
  status: string;
  description: string;
  location: string;
  jobType: string;
  requiredSkills: string[];
  salaryRange?: { min?: number; max?: number; currency?: string };
}

interface NewJobPayload {
  client: string;
  title: string;
  company: string;
  jobUrl: string;
  appliedDate: string;
  notes: string;
  status: string;
  description: string;
  location: string;
  jobType: string;
  requiredSkills: string[];
  salaryRange?: { min?: number; max?: number; currency?: string };
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const safeArrayOfStrings = (
  value: string | string[] | null | undefined,
): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string")
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
};

const getInitials = (first?: string, last?: string) => {
  if (!first && !last) return "?";
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase();
};

const formatDate = (date?: string | Date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const isPlanExpired = (expiresAt?: Date | string) => {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt) < new Date();
  } catch {
    return false;
  }
};

const getDaysRemaining = (expiresAt?: Date | string) => {
  if (!expiresAt) return "No expiration";
  try {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return "Expires today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  } catch {
    return "Invalid date";
  }
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const STATUS_OPTIONS = [
  "Pending",
  "Applied",
  "Interviewing",
  "Offer Received",
  "Rejected",
  "Hired",
  "Archived",
];

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Applied: "bg-blue-50 text-blue-700",
  Interviewing: "bg-violet-50 text-violet-700",
  "Offer Received": "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-700",
  Hired: "bg-green-50 text-green-700",
  Archived: "bg-gray-100 text-gray-600",
};

const PLAN_STYLES: Record<string, string> = {
  Starter: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Professional: "bg-blue-50 text-blue-700 ring-blue-100",
  Elite: "bg-violet-50 text-violet-700 ring-violet-100",
};

// --------------------------------------------------
// Quota computation
// --------------------------------------------------

interface QuotaInfo {
  used: number;
  total: number | null; // null = unlimited
  remaining: number | null;
  usedToday: number;
  dailyLimit: number | null;
  remainingToday: number | null;
  quotaExhausted: boolean;
  dailyExhausted: boolean;
  canApply: boolean;
  blockedReason: string | null;
  planExpired: boolean;
}

const computeQuota = (
  plan: ClientPlan | undefined,
  apps: Application[],
): QuotaInfo => {
  const expired = !!plan && isPlanExpired(plan.expiresAt);
  const limits = getPlanLimits(plan?.name);

  const used = apps.length;
  const remaining =
    limits.totalQuota === null ? null : Math.max(limits.totalQuota - used, 0);

  const today = new Date();
  const usedToday = apps.filter((a) => {
    if (!a.appliedDate) return false;
    const d = new Date(a.appliedDate);
    return !isNaN(d.getTime()) && isSameDay(d, today);
  }).length;

  const remainingToday =
    limits.dailyLimit === null
      ? null
      : Math.max(limits.dailyLimit - usedToday, 0);

  const quotaExhausted = remaining !== null && remaining === 0;
  const dailyExhausted = remainingToday !== null && remainingToday === 0;

  let blockedReason: string | null = null;
  if (expired) blockedReason = "The client's plan has expired.";
  else if (quotaExhausted)
    blockedReason = `Monthly quota reached (${limits.totalQuota}/${limits.totalQuota}).`;
  else if (dailyExhausted)
    blockedReason = `Daily limit reached (${limits.dailyLimit}/day on ${limits.label}).`;

  return {
    used,
    total: limits.totalQuota,
    remaining,
    usedToday,
    dailyLimit: limits.dailyLimit,
    remainingToday,
    quotaExhausted,
    dailyExhausted,
    canApply: !blockedReason,
    blockedReason,
    planExpired: expired,
  };
};

// --------------------------------------------------
// UI pieces
// --------------------------------------------------

const SectionHeader: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="mb-4">
    <div className="flex items-center gap-2">
      <span className="w-1 h-5 bg-[#4eaa3c] rounded-full" />
      <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
    </div>
    {description && (
      <p className="text-xs text-gray-400 mt-1 pl-3">{description}</p>
    )}
  </div>
);

const baseInput =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#4eaa3c] focus:ring-4 focus:ring-green-50";

const baseLabel =
  "flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5";

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3">
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#4eaa3c] text-xs">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <div className="mt-0.5 break-words text-sm font-semibold text-gray-900">
        {value || <span className="text-gray-400 font-normal">Not set</span>}
      </div>
    </div>
  </div>
);

const PlanPill = ({ plan }: { plan?: ClientPlan }) => {
  if (!plan) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500">
        No plan
      </span>
    );
  }
  const expired = isPlanExpired(plan.expiresAt);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${
          PLAN_STYLES[plan.name] || "bg-gray-50 text-gray-600 ring-gray-100"
        }`}
      >
        {plan.name}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          expired
            ? "bg-rose-50 text-rose-700"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {expired ? (
          <FaExclamationCircle className="text-[8px]" />
        ) : (
          <FaCheckCircle className="text-[8px]" />
        )}
        {expired ? "Expired" : "Active"}
      </span>
    </span>
  );
};

const QuotaBar: React.FC<{
  quota: QuotaInfo;
  compact?: boolean;
}> = ({ quota, compact = false }) => {
  const pct =
    quota.total === null || quota.total === 0
      ? 0
      : Math.min(100, Math.round((quota.used / quota.total) * 100));

  const barColor = quota.quotaExhausted
    ? "bg-rose-500"
    : pct >= 80
      ? "bg-amber-500"
      : "bg-[#4eaa3c]";

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-gray-500">
            {quota.total === null
              ? `${quota.used} used · unlimited`
              : `${quota.used} / ${quota.total} used`}
          </span>
          {quota.dailyLimit !== null && (
            <span
              className={`font-bold ${
                quota.dailyExhausted ? "text-rose-600" : "text-gray-700"
              }`}
            >
              {quota.usedToday}/{quota.dailyLimit} today
            </span>
          )}
        </div>
        {quota.total !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#4eaa3c]">
            Application quota
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {quota.total === null
              ? "Unlimited applications this cycle"
              : `${quota.used} of ${quota.total} used this cycle`}
          </p>
        </div>
        {quota.total !== null && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              quota.quotaExhausted
                ? "bg-rose-50 text-rose-700"
                : quota.remaining !== null && quota.remaining <= 5
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {quota.remaining} left
          </span>
        )}
      </div>

      {quota.total !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {quota.dailyLimit !== null && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FaHourglassHalf className="text-[#4eaa3c] text-[10px]" />
            <span>
              <span className="font-bold text-gray-800">{quota.usedToday}</span>{" "}
              of <span className="font-bold">{quota.dailyLimit}</span> used
              today
            </span>
          </div>
          <span
            className={`text-[11px] font-bold ${
              quota.dailyExhausted ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {quota.dailyExhausted
              ? "Daily limit reached"
              : `${quota.remainingToday} left today`}
          </span>
        </div>
      )}

      {quota.blockedReason && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <FaLock className="mt-0.5 shrink-0 text-[10px] text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            {quota.blockedReason} You can still update existing applications.
          </p>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------
// Client card (list)
// --------------------------------------------------

const ClientCard: React.FC<{
  client: Client;
  applications: Application[];
  onOpen: () => void;
}> = ({ client, applications, onOpen }) => {
  const roles = safeArrayOfStrings(client.preferredRoles);
  const locations = safeArrayOfStrings(client.preferredLocations);
  const quota = useMemo(
    () => computeQuota(client.plan, applications),
    [client.plan, applications],
  );

  return (
    <button
      onClick={onOpen}
      className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
          style={{ backgroundColor: DEEP }}
        >
          {getInitials(client.firstname, client.lastname)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#17231a] group-hover:text-[#4eaa3c] transition">
            {client.firstname} {client.lastname}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {client.email}
          </p>
        </div>
        <FiChevronRight className="shrink-0 text-gray-300 transition group-hover:text-gray-500 group-hover:translate-x-0.5" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PlanPill plan={client.plan} />
        {!quota.canApply && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
            <FaLock className="text-[8px]" />
            Blocked
          </span>
        )}
      </div>

      <div className="mt-3">
        <QuotaBar quota={quota} compact />
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <p className="truncate">
          <span className="text-gray-400 font-medium">Roles:</span>{" "}
          <span className="text-gray-700">
            {roles.length > 0 ? roles.slice(0, 2).join(", ") : "—"}
            {roles.length > 2 && ` +${roles.length - 2}`}
          </span>
        </p>
        <p className="truncate">
          <span className="text-gray-400 font-medium">Locations:</span>{" "}
          <span className="text-gray-700">
            {locations.length > 0 ? locations.slice(0, 2).join(", ") : "—"}
            {locations.length > 2 && ` +${locations.length - 2}`}
          </span>
        </p>
      </div>
    </button>
  );
};

// --------------------------------------------------
// Main
// --------------------------------------------------

const JobScreen: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [applicationsByClient, setApplicationsByClient] = useState<
    Record<string, Application[]>
  >({});
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "applications">(
    "details",
  );
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emptyForm = () => ({
    jobTitle: "",
    company: "",
    link: "",
    submissionDate: new Date().toISOString().split("T")[0],
    notes: "",
    status: "Pending",
    description: "",
    location: "",
    jobType: "",
    skillsInput: "",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "GBP",
  });
  const [newApp, setNewApp] = useState(emptyForm());

  // Load clients + all their applications in one go
  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        const token = await localforage.getItem<string>("authToken");
        if (!token) {
          navigate("/", { replace: true });
          return;
        }
        const res = await axios.get<UserData>(USER_DATA_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;

        const clientList = (res.data.clients || []).map((c) => ({
          ...c,
          jobEmail: c.jobEmail || "",
          jobPassword: c.jobPassword || "",
          cv: c.cv || "",
        }));
        setClients(clientList);

        // Fetch each client's applications in parallel
        const entries = await Promise.all(
          clientList.map(async (c) => {
            try {
              const r = await axios.get(
                `${GET_CLIENT_JOBS_ENDPOINT}/${c._id}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              return [c._id, (r.data.jobs || []) as Application[]] as const;
            } catch {
              return [c._id, [] as Application[]] as const;
            }
          }),
        );
        if (mounted) setApplicationsByClient(Object.fromEntries(entries));
      } catch (err) {
        if (!mounted) return;
        const axiosError = err as AxiosError;
        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          await localforage.removeItem("authToken");
          navigate("/", { replace: true });
        } else {
          toast.error("Failed to load clients.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const applications = selectedClient
    ? (applicationsByClient[selectedClient._id] ?? [])
    : [];

  const quota = useMemo(
    () => computeQuota(selectedClient?.plan, applications),
    [selectedClient?.plan, applications],
  );

  const clientDetails = useMemo(() => {
    if (!selectedClient) return null;
    return {
      roles: safeArrayOfStrings(selectedClient.preferredRoles),
      industries: safeArrayOfStrings(selectedClient.preferredIndustries),
      locations: safeArrayOfStrings(selectedClient.preferredLocations),
      planExpired: isPlanExpired(selectedClient.plan?.expiresAt),
      daysLeft: getDaysRemaining(selectedClient.plan?.expiresAt),
    };
  }, [selectedClient]);

  const resetSelection = () => {
    setSelectedClient(null);
    setActiveTab("details");
    setShowForm(false);
    setNewApp(emptyForm());
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedClient) return;
    if (!quota.canApply) {
      toast.error(
        quota.blockedReason || "You can't add more applications right now.",
      );
      return;
    }
    if (!newApp.jobTitle || !newApp.company || !newApp.description) {
      toast.error("Job title, company, and description are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await localforage.getItem<string>("authToken");
      if (!token) throw new Error("Missing token.");

      const payload: NewJobPayload = {
        client: selectedClient._id,
        title: newApp.jobTitle,
        company: newApp.company,
        jobUrl: newApp.link,
        appliedDate: newApp.submissionDate,
        notes: newApp.notes,
        status: newApp.status,
        description: newApp.description,
        location: newApp.location,
        jobType: newApp.jobType,
        requiredSkills: newApp.skillsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        salaryRange:
          newApp.salaryMin || newApp.salaryMax
            ? {
                min: Number(newApp.salaryMin),
                max: Number(newApp.salaryMax),
                currency: newApp.salaryCurrency,
              }
            : undefined,
      };

      await axios.post(CREATE_JOB_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const refresh = await axios.get(
        `${GET_CLIENT_JOBS_ENDPOINT}/${selectedClient._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setApplicationsByClient((prev) => ({
        ...prev,
        [selectedClient._id]: refresh.data.jobs || [],
      }));
      setNewApp(emptyForm());
      setShowForm(false);
      toast.success("Application added.");
    } catch {
      toast.error("Failed to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    if (!selectedClient) return;
    setUpdatingStatus(jobId);
    try {
      const token = await localforage.getItem<string>("authToken");
      if (!token) throw new Error("Missing token.");
      await axios.patch(
        `${UPDATE_JOB_STATUS_ENDPOINT}/${jobId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setApplicationsByClient((prev) => ({
        ...prev,
        [selectedClient._id]: (prev[selectedClient._id] ?? []).map((a) =>
          a._id === jobId ? { ...a, status: newStatus } : a,
        ),
      }));
      toast.success("Status updated.");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#4eaa3c] rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">Loading clients…</p>
      </div>
    );
  }

  // --------------------------------------------------
  // Client list view
  // --------------------------------------------------

  if (!selectedClient) {
    return (
      <div className="w-full max-w-[1400px] mx-auto space-y-6 px-4 sm:px-6 py-6">
        <Toaster position="top-center" />

        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#17231a] tracking-tight">
              Client job management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {clients.length} {clients.length === 1 ? "client" : "clients"}{" "}
              assigned to you
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <FaRegCalendarAlt className="text-[#4eaa3c]" />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </section>

        <section>
          <SectionHeader
            title="Your clients"
            description="Open a client to see their details and log applications."
          />

          {clients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {clients.map((c) => (
                <ClientCard
                  key={c._id}
                  client={c}
                  applications={applicationsByClient[c._id] ?? []}
                  onOpen={() => setSelectedClient(c)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#4eaa3c]">
                <FaUserTie size={20} />
              </div>
              <p className="mt-4 text-sm font-bold text-[#17231a]">
                No clients assigned yet
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Once the team assigns clients to you, they'll show up here.
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

  // --------------------------------------------------
  // Client detail view
  // --------------------------------------------------

  const canApply = quota.canApply;

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 py-4 px-2">
      <Toaster position="top-center" />

      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={resetSelection}
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shrink-0"
            aria-label="Back to clients"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: DEEP }}
            >
              {getInitials(selectedClient.firstname, selectedClient.lastname)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl sm:text-2xl font-bold text-[#17231a]">
                {selectedClient.firstname} {selectedClient.lastname}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <PlanPill plan={selectedClient.plan} />
                {selectedClient.plan && (
                  <span className="text-[11px] text-gray-500">
                    {clientDetails?.daysLeft}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("applications");
              setShowForm(true);
            }}
            disabled={!canApply}
            title={quota.blockedReason ?? undefined}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17231a] hover:bg-[#263d2a] text-white px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canApply ? (
              <FaPlus className="text-[10px]" />
            ) : (
              <FaLock className="text-[10px]" />
            )}
            {canApply ? "Log application" : "Limit reached"}
          </button>
        </div>
      </section>

      {/* Quota card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
        <QuotaBar quota={quota} />
      </div>

      {/* Tabs */}
      <section className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
        {(["details", "applications"] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                active
                  ? "bg-[#17231a] text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab === "details"
                ? "Details"
                : `Applications (${applications.length})`}
            </button>
          );
        })}
      </section>

      {/* Details tab */}
      {activeTab === "details" && clientDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Contact */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-7 shadow-sm">
            <SectionHeader
              title="Contact"
              description="How to reach this client."
            />
            <div className="divide-y divide-gray-100">
              <DetailRow
                icon={<FaEnvelope className="text-[10px]" />}
                label="Email"
                value={selectedClient.email}
              />
              <DetailRow
                icon={<FaPhone className="text-[10px]" />}
                label="Phone"
                value={selectedClient.phonenumber}
              />
              <DetailRow
                icon={<FaBriefcase className="text-[10px]" />}
                label="Preferred roles"
                value={
                  clientDetails.roles.length > 0
                    ? clientDetails.roles.join(", ")
                    : null
                }
              />
              <DetailRow
                icon={<FaBuilding className="text-[10px]" />}
                label="Industries"
                value={
                  clientDetails.industries.length > 0
                    ? clientDetails.industries.join(", ")
                    : null
                }
              />
              <DetailRow
                icon={<FaMapMarkerAlt className="text-[10px]" />}
                label="Locations"
                value={
                  clientDetails.locations.length > 0
                    ? clientDetails.locations.join(", ")
                    : null
                }
              />
            </div>
          </div>

          {/* Credentials (dark) */}
          <div className="relative overflow-hidden rounded-2xl bg-[#14251a] p-5 sm:p-7 text-white shadow-lg shadow-green-950/10">
            <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full bg-[#4eaa3c]/20 blur-3xl" />
            <div className="pointer-events-none absolute right-0 bottom-0 opacity-[0.07]">
              <FaShieldAlt size={180} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#8cdb78]">
                  <FaShieldAlt className="text-xs" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Credentials & access
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Used to submit applications on the client's behalf
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Provider
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {selectedClient.jobProvider || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Job email
                  </p>
                  <p className="mt-0.5 break-all text-sm font-semibold text-white">
                    {selectedClient.jobEmail || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Password
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-white transition"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <FaEyeSlash className="text-[10px]" />
                      ) : (
                        <FaEye className="text-[10px]" />
                      )}
                    </button>
                  </div>
                  <p className="mt-0.5 break-all font-mono text-sm font-semibold text-white">
                    {selectedClient.jobPassword
                      ? showPassword
                        ? selectedClient.jobPassword
                        : "•".repeat(
                            Math.min(selectedClient.jobPassword.length, 12),
                          )
                      : "—"}
                  </p>
                </div>

                {selectedClient.cv && (
                  <a
                    href={selectedClient.cv}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        CV
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-white">
                        Open client's CV
                      </p>
                    </div>
                    <FaExternalLinkAlt className="shrink-0 text-[10px] text-white/60" />
                  </a>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Plan
                    </p>
                    {selectedClient.plan && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          clientDetails.planExpired
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-emerald-400/15 text-emerald-300"
                        }`}
                      >
                        {clientDetails.planExpired ? "Expired" : "Active"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {selectedClient.plan?.name || "No plan"}
                  </p>
                  {selectedClient.plan && (
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {formatDate(selectedClient.plan.expiresAt)} ·{" "}
                      {clientDetails.daysLeft}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applications tab */}
      {activeTab === "applications" && (
        <div className="space-y-5">
          {/* Form (collapsible, disabled if quota blocked) */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => canApply && setShowForm((v) => !v)}
              disabled={!canApply}
              className="w-full flex items-center justify-between gap-3 px-5 sm:px-7 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    canApply
                      ? "bg-emerald-50 text-[#4eaa3c]"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {canApply ? (
                    <FaPlus className="text-xs" />
                  ) : (
                    <FaLock className="text-xs" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#17231a]">
                    {canApply
                      ? showForm
                        ? "Hide form"
                        : "Log a new application"
                      : "Application limit reached"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {canApply
                      ? `Add a job you applied to on behalf of ${selectedClient.firstname}`
                      : quota.blockedReason ||
                        "You can't log new applications right now."}
                  </p>
                </div>
              </div>
              {canApply && (
                <FaChevronDown
                  className={`shrink-0 text-gray-400 transition-transform ${
                    showForm ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {showForm && canApply && (
              <div className="border-t border-gray-100 p-5 sm:p-7 space-y-4">
                {/* ...form fields identical to previous version... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={baseLabel}>Job title *</label>
                    <input
                      className={baseInput}
                      placeholder="e.g. Care Assistant"
                      value={newApp.jobTitle}
                      onChange={(e) =>
                        setNewApp({ ...newApp, jobTitle: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={baseLabel}>Company *</label>
                    <input
                      className={baseInput}
                      placeholder="e.g. Sunrise Care Ltd"
                      value={newApp.company}
                      onChange={(e) =>
                        setNewApp({ ...newApp, company: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={baseLabel}>Job link</label>
                    <input
                      className={baseInput}
                      placeholder="https://…"
                      value={newApp.link}
                      onChange={(e) =>
                        setNewApp({ ...newApp, link: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={baseLabel}>Submission date</label>
                    <input
                      type="date"
                      className={baseInput}
                      value={newApp.submissionDate}
                      onChange={(e) =>
                        setNewApp({
                          ...newApp,
                          submissionDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={baseLabel}>Job description *</label>
                    <textarea
                      className={`${baseInput} min-h-[100px]`}
                      placeholder="Paste or summarise the role description"
                      value={newApp.description}
                      onChange={(e) =>
                        setNewApp({ ...newApp, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={baseLabel}>Location</label>
                    <input
                      className={baseInput}
                      placeholder="City, or Remote"
                      value={newApp.location}
                      onChange={(e) =>
                        setNewApp({ ...newApp, location: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={baseLabel}>Job type</label>
                    <select
                      className={baseInput}
                      value={newApp.jobType}
                      onChange={(e) =>
                        setNewApp({ ...newApp, jobType: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      <option value="remote">Remote</option>
                      <option value="onsite">On-site</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={baseLabel}>
                      Required skills (comma separated)
                    </label>
                    <input
                      className={baseInput}
                      placeholder="Communication, Manual handling, Driving"
                      value={newApp.skillsInput}
                      onChange={(e) =>
                        setNewApp({
                          ...newApp,
                          skillsInput: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-3 gap-3">
                    <div>
                      <label className={baseLabel}>Salary min</label>
                      <input
                        type="number"
                        className={baseInput}
                        placeholder="20000"
                        value={newApp.salaryMin}
                        onChange={(e) =>
                          setNewApp({
                            ...newApp,
                            salaryMin: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={baseLabel}>Salary max</label>
                      <input
                        type="number"
                        className={baseInput}
                        placeholder="26000"
                        value={newApp.salaryMax}
                        onChange={(e) =>
                          setNewApp({
                            ...newApp,
                            salaryMax: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={baseLabel}>Currency</label>
                      <select
                        className={baseInput}
                        value={newApp.salaryCurrency}
                        onChange={(e) =>
                          setNewApp({
                            ...newApp,
                            salaryCurrency: e.target.value,
                          })
                        }
                      >
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={baseLabel}>Notes</label>
                    <textarea
                      className={`${baseInput} min-h-[70px]`}
                      placeholder="Anything worth remembering about this application"
                      value={newApp.notes}
                      onChange={(e) =>
                        setNewApp({ ...newApp, notes: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className={baseLabel}>Initial status</label>
                    <select
                      className={baseInput}
                      value={newApp.status}
                      onChange={(e) =>
                        setNewApp({ ...newApp, status: e.target.value })
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setNewApp(emptyForm());
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    <FaTimes className="text-xs" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !canApply}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4eaa3c] hover:bg-[#60bb4d] text-white px-6 py-2.5 text-sm font-bold shadow-md shadow-green-900/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Saving…" : "Save application"}
                    {!isSubmitting && <FaCheck className="text-xs" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Applications table */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-7 shadow-sm">
            <SectionHeader
              title={`Applications for ${selectedClient.firstname}`}
              description={`${applications.length} ${
                applications.length === 1 ? "application" : "applications"
              } logged`}
            />

            <div className="overflow-x-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-2.5 pr-3">Job title</th>
                    <th className="py-2.5 pr-3">Company</th>
                    <th className="py-2.5 pr-3">Location</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 pr-3 text-right">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length > 0 ? (
                    applications.map((app) => (
                      <tr
                        key={app._id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                      >
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-[#17231a]">
                            {app.title}
                          </p>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4eaa3c] hover:underline"
                            >
                              Job posting
                              <FaExternalLinkAlt className="text-[8px]" />
                            </a>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-gray-700">
                          {app.company}
                        </td>
                        <td className="py-3 pr-3 text-gray-600">
                          {app.location || "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="relative inline-block">
                            <select
                              value={app.status}
                              onChange={(e) =>
                                handleUpdateStatus(app._id, e.target.value)
                              }
                              disabled={updatingStatus === app._id}
                              className={`appearance-none rounded-full border-0 py-1 pl-2.5 pr-6 text-[11px] font-bold outline-none cursor-pointer ${
                                STATUS_STYLES[app.status] ||
                                "bg-gray-100 text-gray-600"
                              } disabled:opacity-50`}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <FaChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px]" />
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(app.appliedDate)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-xs text-gray-400 italic"
                      >
                        No applications logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {applications.length === 0 && canApply && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#17231a] hover:bg-[#263d2a] text-white px-5 py-2.5 text-sm font-semibold transition"
                >
                  <FaPlus className="text-xs" />
                  Log the first application
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobScreen;
