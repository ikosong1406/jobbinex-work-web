import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import localforage from "localforage";
import { toast, Toaster } from "react-hot-toast";
import {
  FaEnvelope,
  FaBell,
  FaEye,
  FaEyeSlash,
  FaSignOutAlt,
  FaUserTie,
  FaBriefcase,
  FaCheckCircle,
  FaRegCalendarAlt,
  FaUsers,
  FaCircle,
  FaChartLine,
  FaRegCalendarAlt as FaCalendar,
} from "react-icons/fa";
import { FiArrowUpRight } from "react-icons/fi";
import Api from "../components/Api";

const DEEP = "#17231a";
const USER_DATA_ENDPOINT = `${Api}/work/userdata`;

// --------------------------------------------------
// Types
// --------------------------------------------------

interface Job {
  _id: string;
  title: string;
  status:
    | "Pending"
    | "Applied"
    | "Interviewing"
    | "Offer Received"
    | "Rejected"
    | "Hired"
    | "Archived";
  interviewDates: Array<{
    date: string;
    type: "Screening" | "Technical" | "Behavioral" | "On-site";
    notes: string;
  }>;
}

interface BackendResponse {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: "online" | "offline";
  clients: string[];
  jobs: Job[];
}

interface UserStats {
  clients: number;
  totalApplications: number;
  approvedJobs: number;
  interviews: number;
}

interface UserProfile {
  firstname: string;
  lastname: string;
  email: string;
  status: "online" | "offline";
  stats: UserStats;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const getInitials = (first?: string, last?: string) => {
  if (!first && !last) return "A";
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase();
};

const calculateJobStats = (jobs: Job[]): UserStats => {
  const appliedJobs = jobs.filter(
    (j) => j.status !== "Pending" && j.status !== "Archived"
  );
  const approvedJobs = jobs.filter(
    (j) => j.status === "Offer Received" || j.status === "Hired"
  ).length;

  let totalInterviews = 0;
  jobs.forEach((job) => {
    if (
      ["Interviewing", "Offer Received", "Hired"].includes(job.status) &&
      Array.isArray(job.interviewDates)
    ) {
      totalInterviews += job.interviewDates.length;
    }
  });

  return {
    clients: 0, // filled from API
    totalApplications: appliedJobs.length,
    approvedJobs,
    interviews: totalInterviews,
  };
};

// --------------------------------------------------
// Sub-components
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

const SummaryRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}> = ({ icon, label, value, hint }) => (
  <div className="flex items-start gap-3 py-3">
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#4eaa3c] text-xs">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <div className="mt-0.5 text-sm font-bold text-gray-900">{value}</div>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  </div>
);

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  icon: React.ReactNode;
  description?: string;
}> = ({ checked, onChange, label, icon, description }) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-xs">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 shrink-0 flex items-center rounded-full transition ${
        checked ? "bg-[#4eaa3c]" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute bg-white w-4 h-4 rounded-full transition-transform shadow ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

// --------------------------------------------------
// Main
// --------------------------------------------------

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [notifications, setNotifications] = useState(true);
  const [visibility, setVisibility] = useState(true);

  const handleLogout = useCallback(async () => {
    try {
      await localforage.removeItem("authToken");
      toast.success("Logged out");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = await localforage.getItem<string>("authToken");
        if (!token) {
          navigate("/", { replace: true });
          return;
        }

        const res = await axios.get<BackendResponse>(USER_DATA_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!mounted) return;
        const api = res.data;
        const jobStats = calculateJobStats(api.jobs || []);

        setProfile({
          firstname: api.firstname || "",
          lastname: api.lastname || "",
          email: api.email || "",
          status: api.status || "offline",
          stats: {
            ...jobStats,
            clients: api.clients?.length ?? 0,
          },
        });
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
          toast.error("Failed to load your profile.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const isOnline = profile?.status === "online";
  const initials = getInitials(profile?.firstname, profile?.lastname);

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#4eaa3c] rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) return null;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 py-6 px-2">
      <Toaster position="top-center" />

      {/* ── Identity header ─────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: DEEP }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#17231a] tracking-tight">
              {profile.firstname} {profile.lastname}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
              <FaUserTie className="text-[#4eaa3c] text-xs" />
              Job Application Agent
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <FaCircle
                  className={`text-[6px] ${
                    isOnline ? "text-[#4eaa3c]" : "text-gray-300"
                  }`}
                />
                {isOnline ? "Online" : "Offline"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <FaCalendar className="text-[#4eaa3c]" />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <FaSignOutAlt className="text-[11px]" />
            Log out
          </button>
        </div>
      </section>

      {/* ── At a glance ─────────────────────────── */}
      <section>
        <SectionHeader
          title="At a glance"
          description="Your current work in numbers."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Stats card */}
          <div className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-50 rounded-full blur-3xl opacity-70 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#4eaa3c] flex items-center justify-center">
                    <FaChartLine size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      Performance snapshot
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Across all assigned clients
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    isOnline
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isOnline ? "Available" : "Offline"}
                </span>
              </div>

              <div className="mt-4 divide-y divide-gray-100">
                <SummaryRow
                  icon={<FaUsers className="text-[10px]" />}
                  label="Clients managed"
                  value={profile.stats.clients}
                  hint="Active client accounts you represent"
                />
                <SummaryRow
                  icon={<FaBriefcase className="text-[10px]" />}
                  label="Applications submitted"
                  value={profile.stats.totalApplications}
                  hint="Excludes pending and archived jobs"
                />
                <SummaryRow
                  icon={<FaCheckCircle className="text-[10px]" />}
                  label="Approved offers"
                  value={profile.stats.approvedJobs}
                  hint="Offers received or hired"
                />
                <SummaryRow
                  icon={<FaRegCalendarAlt className="text-[10px]" />}
                  label="Interviews scheduled"
                  value={profile.stats.interviews}
                  hint="Total across active pipelines"
                />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => navigate("/jobs")}
                  className="inline-flex items-center justify-center gap-2 bg-[#17231a] hover:bg-[#263d2a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                >
                  Open job pipeline
                  <FiArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Dark contact card — mirrors client plan card */}
          <div className="relative overflow-hidden bg-[#14251a] rounded-2xl p-6 text-white shadow-lg shadow-green-950/10">
            <div className="absolute -right-12 -top-16 w-64 h-64 rounded-full bg-[#4eaa3c]/20 blur-3xl pointer-events-none" />
            <div className="absolute right-0 bottom-0 opacity-[0.07] pointer-events-none">
              <FaUserTie size={180} />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[#8cdb78]">
                    <FaEnvelope size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Contact</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      How we reach you
                    </p>
                  </div>
                </div>
                <span className="bg-emerald-400/10 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full">
                  Verified
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Email
                  </p>
                  <p className="mt-0.5 break-all text-sm font-semibold text-white">
                    {profile.email}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Account role
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    Job Application Agent
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray-400 max-w-md">
                Update your email from settings if it ever changes. Clients see
                this address when reviewing your work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Preferences ─────────────────────────── */}
      <section>
        <SectionHeader
          title="Preferences"
          description="Control how your account behaves."
        />

        <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={notifications}
              onChange={() => setNotifications(!notifications)}
              label="Notifications"
              icon={<FaBell />}
              description="Get notified about client updates, interview requests, and job changes."
            />
            <Toggle
              checked={visibility}
              onChange={() => setVisibility(!visibility)}
              label="Profile visibility"
              icon={visibility ? <FaEye /> : <FaEyeSlash />}
              description="When enabled, clients can see your availability and current workload."
            />
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              Preference changes are saved instantly on this device.
            </p>
            <button
              onClick={() => toast.success("Preferences saved")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4eaa3c] hover:bg-[#60bb4d] text-white px-5 py-2.5 text-sm font-bold shadow-md shadow-green-900/15 transition"
            >
              Save preferences
            </button>
          </div>
        </div>
      </section>

      {/* ── Mobile logout ──────────────────────── */}
      <div className="sm:hidden">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600"
        >
          <FaSignOutAlt className="text-xs" /> Log out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;