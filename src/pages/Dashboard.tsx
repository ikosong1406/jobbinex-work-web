import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import localforage from "localforage";
import { toast, Toaster } from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  parseISO,
  isThisMonth,
  isThisWeek,
  getDay,
  formatDistanceToNow,
} from "date-fns";
import {
  FaBriefcase,
  FaCalendarAlt,
  FaPoundSign,
  FaUserTie,
  FaChartLine,
  FaUsers,
  FaArrowRight,
  FaCheck,
  FaCheckCircle,
  FaClock,
  FaEnvelope,
} from "react-icons/fa";
import { FiArrowUpRight, FiChevronRight } from "react-icons/fi";
import Api from "../components/Api";

const PRIMARY = "#4eaa3c";
const DEEP = "#17231a";
const CLIENT_DASHBOARD_ENDPOINT = `${Api}/work/userdata`;
const RATE_PER_APPLICATION = 1;

// --------------------------------------------------
// Types
// --------------------------------------------------

interface Job {
  _id: string;
  title: string;
  company: string;
  status:
    | "Pending"
    | "Applied"
    | "Interviewing"
    | "Offer Received"
    | "Rejected"
    | "Hired"
    | "Archived";
  appliedDate: string | null;
}

interface Client {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  jobs: string[];
}

interface AssistantDashboardData {
  firstname: string;
  lastname: string;
  clients: Client[];
  jobs: Job[];
}

interface WeeklyPerformanceData {
  day: string;
  applications: number;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const getInitials = (first?: string, last?: string) => {
  if (!first && !last) return "A";
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase();
};

const getMonthApplications = (jobs: Job[]): number =>
  jobs.filter((job) => {
    if (!job.appliedDate) return false;
    try {
      return isThisMonth(parseISO(job.appliedDate));
    } catch {
      return false;
    }
  }).length;

const calculateWeeklyPerformance = (jobs: Job[]): WeeklyPerformanceData[] => {
  const buckets: WeeklyPerformanceData[] = [
    { day: "Sun", applications: 0 },
    { day: "Mon", applications: 0 },
    { day: "Tue", applications: 0 },
    { day: "Wed", applications: 0 },
    { day: "Thu", applications: 0 },
    { day: "Fri", applications: 0 },
    { day: "Sat", applications: 0 },
  ];

  jobs.forEach((job) => {
    if (!job.appliedDate) return;
    try {
      const d = parseISO(job.appliedDate);
      if (isThisWeek(d, { weekStartsOn: 1 })) {
        buckets[getDay(d)].applications += 1;
      }
    } catch {
      /* ignore */
    }
  });

  // Monday-first
  return [
    buckets[1],
    buckets[2],
    buckets[3],
    buckets[4],
    buckets[5],
    buckets[6],
    buckets[0],
  ];
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

const StatRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  complete?: boolean;
}> = ({ icon, label, value, hint, complete = true }) => (
  <div className="flex items-start gap-3 py-3">
    <div
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
        complete ? "bg-emerald-50 text-[#4eaa3c]" : "bg-gray-100 text-gray-400"
      }`}
    >
      {complete ? icon : <FaClock className="text-[10px]" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          complete ? "text-gray-900" : "text-gray-400"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  </div>
);

const StatusPill = ({ status }: { status: Job["status"] }) => {
  const styles: Record<Job["status"], string> = {
    Pending: "bg-amber-50 text-amber-700",
    Applied: "bg-blue-50 text-blue-700",
    Interviewing: "bg-violet-50 text-violet-700",
    "Offer Received": "bg-emerald-50 text-emerald-700",
    Rejected: "bg-rose-50 text-rose-700",
    Hired: "bg-green-50 text-green-700",
    Archived: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}
    >
      {status}
    </span>
  );
};

// --------------------------------------------------
// Main
// --------------------------------------------------

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Assistant");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState<
    WeeklyPerformanceData[]
  >([]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await localforage.getItem<string>("authToken");
        if (!token) {
          navigate("/", { replace: true });
          return;
        }

        const res = await axios.get<AssistantDashboardData>(
          CLIENT_DASHBOARD_ENDPOINT,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!mounted) return;
        setName(res.data.firstname || "Assistant");
        setJobs(res.data.jobs || []);
        setClients(res.data.clients || []);
        setWeeklyPerformance(calculateWeeklyPerformance(res.data.jobs || []));
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
          toast.error("Failed to load dashboard.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Derived
  const monthlyApplications = useMemo(() => getMonthApplications(jobs), [jobs]);
  const monthlyEarnings = monthlyApplications * RATE_PER_APPLICATION;

  const activeJobs = useMemo(
    () =>
      jobs.filter((j) => ["Applied", "Interviewing"].includes(j.status)).length,
    [jobs],
  );
  const interviewsSecured = useMemo(
    () => jobs.filter((j) => j.status === "Interviewing").length,
    [jobs],
  );
  const totalWeeklyApps = weeklyPerformance.reduce(
    (s, d) => s + d.applications,
    0,
  );

  const clientJobStats = useMemo(() => {
    const byId: Record<string, { total: number; inFlight: number }> = {};
    clients.forEach((c) => {
      const clientJobs = jobs.filter((j) => c.jobs?.includes(j._id));
      byId[c._id] = {
        total: clientJobs.length,
        inFlight: clientJobs.filter((j) =>
          ["Applied", "Interviewing"].includes(j.status),
        ).length,
      };
    });
    return byId;
  }, [clients, jobs]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => {
        const aS = clientJobStats[a._id] ?? { total: 0, inFlight: 0 };
        const bS = clientJobStats[b._id] ?? { total: 0, inFlight: 0 };
        if (bS.inFlight !== aS.inFlight) return bS.inFlight - aS.inFlight;
        return `${a.firstname} ${a.lastname}`.localeCompare(
          `${b.firstname} ${b.lastname}`,
        );
      }),
    [clients, clientJobStats],
  );

  const recentApplications = useMemo(() => jobs.slice(0, 5), [jobs]);

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#4eaa3c] rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-4">Loading your dashboard…</p>
      </div>
    );
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 px-4 sm:px-6 py-6">
      <Toaster position="top-center" />

      {/* ── Identity header ─────────────────────── */}
      <section className="flex flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: DEEP }}
          >
            {getInitials(name)}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#17231a] tracking-tight">
              Welcome back, {name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <FaCalendarAlt className="text-[#4eaa3c]" />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </section>

      {/* ── Next steps: earnings + clients ──────── */}
      <section>
        <SectionHeader
          title="This month"
          description="Your earnings and pipeline at a glance."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Earnings card — mirrors Profile readiness */}
          <div className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-50 rounded-full blur-3xl opacity-70 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#4eaa3c] flex items-center justify-center">
                    <FaPoundSign size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      Earnings this month
                    </h3>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs text-gray-400 font-medium">
                  Estimated payout
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h2 className="text-4xl font-extrabold text-[#17231a]">
                    £{monthlyEarnings.toFixed(2)}
                  </h2>
                </div>
              </div>

              <div className="mt-5 divide-y divide-gray-100">
                <StatRow
                  icon={<FaBriefcase className="text-[10px]" />}
                  label="Applications submitted"
                  value={monthlyApplications}
                  hint="Counted from this month's applied dates"
                />
                <StatRow
                  icon={<FaChartLine className="text-[10px]" />}
                  label="Active jobs"
                  value={activeJobs}
                  hint="Applied or currently interviewing"
                />
                <StatRow
                  icon={<FaUserTie className="text-[10px]" />}
                  label="Interviews secured"
                  value={interviewsSecured}
                  hint="Clients in an interview loop"
                />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => navigate("/jobs")}
                  className="inline-flex items-center justify-center gap-2 bg-[#17231a] hover:bg-[#263d2a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                >
                  View pipeline
                  <FiArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Clients card — dark card, mirrors Profile plan card */}
          <div className="relative overflow-hidden bg-[#14251a] rounded-2xl p-6 text-white shadow-lg shadow-green-950/10">
            <div className="absolute -right-12 -top-16 w-64 h-64 rounded-full bg-[#4eaa3c]/20 blur-3xl pointer-events-none" />
            <div className="absolute right-0 bottom-0 opacity-[0.07] pointer-events-none">
              <FaUsers size={180} />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[#8cdb78]">
                    <FaUsers size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">My clients</h3>
                  </div>
                </div>
                <span className="bg-emerald-400/10 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full">
                  {sortedClients.reduce(
                    (sum, c) => sum + (clientJobStats[c._id]?.inFlight ?? 0),
                    0,
                  )}{" "}
                  active
                </span>
              </div>

              <div className="-mx-2 mt-5 flex-1 overflow-y-auto max-h-[260px] divide-y divide-white/5">
                {sortedClients.length > 0 ? (
                  sortedClients.map((client) => {
                    const s = clientJobStats[client._id] ?? {
                      total: 0,
                      inFlight: 0,
                    };
                    return (
                      <button
                        key={client._id}
                        onClick={() => navigate(`/jobs?client=${client._id}`)}
                        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/5"
                      >
                        <div className="relative shrink-0">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: PRIMARY }}
                          >
                            {getInitials(client.firstname, client.lastname)}
                          </div>
                          {s.inFlight > 0 && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#14251a] bg-[#4eaa3c]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {client.firstname} {client.lastname}
                          </p>
                          <p className="truncate text-[11px] text-gray-400">
                            {s.total}{" "}
                            {s.total === 1 ? "application" : "applications"}
                            {s.inFlight > 0 && (
                              <span className="text-[#8cdb78] font-semibold">
                                {" · "}
                                {s.inFlight} active
                              </span>
                            )}
                          </p>
                        </div>
                        <FiChevronRight className="shrink-0 text-white/30 transition group-hover:text-white/70" />
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-6 text-center text-xs text-white/40 italic">
                    No clients assigned yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Weekly performance ────────────────── */}
      <section>
        <SectionHeader
          title="Weekly performance"
          description="Applications submitted on behalf of all clients this week."
        />

        <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-semibold text-gray-500">
                Total this week
              </p>
              <p className="text-2xl font-bold text-[#17231a] mt-0.5">
                {totalWeeklyApps}{" "}
                <span className="text-sm font-semibold text-gray-400">
                  applications
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4eaa3c]">
                Sun – Sat
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={weeklyPerformance}
              margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f2f0"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "#f5f9f4" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #edf0ed",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="applications"
                fill={PRIMARY}
                radius={[6, 6, 0, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Recent applications ───────────────── */}
      <section>
        <SectionHeader
          title="Recent applications"
          description="Latest submissions across all clients."
        />

        <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="overflow-x-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2.5 pr-3">Job title</th>
                  <th className="py-2.5 pr-3">Company</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3 text-right">Applied</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.length > 0 ? (
                  recentApplications.map((job) => (
                    <tr
                      key={job._id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                    >
                      <td className="py-3 pr-3 text-sm font-semibold text-[#17231a]">
                        {job.title}
                      </td>
                      <td className="py-3 pr-3 text-sm text-gray-600">
                        {job.company}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill status={job.status} />
                      </td>
                      <td className="py-3 pr-3 text-right text-xs text-gray-500 whitespace-nowrap">
                        {job.appliedDate &&
                        !isNaN(new Date(job.appliedDate).getTime())
                          ? formatDistanceToNow(new Date(job.appliedDate), {
                              addSuffix: true,
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-xs text-gray-400 italic"
                    >
                      No applications tracked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {jobs.length > 5 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => navigate("/jobs")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4eaa3c] hover:bg-[#60bb4d] text-white px-5 py-2.5 text-sm font-bold shadow-md shadow-green-900/15 transition"
              >
                View all jobs
                <FaArrowRight className="text-xs" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
