import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axios, { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import localforage from "localforage";
import {
  formatDistanceToNow,
  parseISO,
  isThisWeek,
  getDay,
} from "date-fns";
import Api from "../components/Api";

// --- Configuration ---
// NOTE: Assuming this endpoint returns the Assistant's data as provided in the JSON
const CLIENT_DASHBOARD_ENDPOINT = `${Api}/work/userdata`;

// --- Type Definitions based on the PROVIDED Assistant Schemas ---

// 1. Notification Type (Extracted from the root 'notifications' array)
interface Notification {
  _id: string;
  // NOTE: Assuming 'message' is the field for notification content, though
  // the JSON only shows 'messages' as an array of message *objects* (not single notifications).
  // Sticking to the original Notification type for simplicity, but the data is sparse.
  message: string;
  type: "message" | "job" | "plan" | "system" | "application" | "general"; // Retained from original code
  createdAt: string; // ISO date string
}

// 2. Job Type (Extracted from the root 'jobs' array)
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
  // interviewDates: Array<{ date: string }>; // Field is not present in the provided JSON
}

// 3. Client Type (Extracted from the root 'clients' array)
interface Client {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    jobs: string[]; // Array of Job IDs
    // Other fields like phonenumber, jobEmail, etc.
}

// 4. Backend Response Type (Adjusted to match the provided Assistant data structure)
interface AssistantDashboardData {
  firstname: string; // Assistant's first name
  lastname: string; // Assistant's last name
  clients: Client[]; // List of clients managed by the assistant
  jobs: Job[]; // List of all jobs associated with the assistant (or its clients)
  notifications: Notification[]; // List of notifications
}

// 5. UI State Types (Unchanged)
interface WeeklyPerformanceData {
  day: string;
  applications: number;
}
interface DashboardStats {
  totalApplications: number;
  activeJobs: number;
  interviewsScheduled: number;
}

// --- Component Utilities ---

/**
 * Calculates dashboard statistics from the Jobs array.
 * NOTE: The 'interviewDates' field is missing in the provided JSON, so the interview count will be 0.
 * To fix this, you would need to either:
 * a) Update the backend to include `interviewDates` in the root `jobs` array.
 * b) Refine the logic to check for a specific status like 'Interviewing' (which is done below).
 */
const calculateStats = (jobs: Job[]): DashboardStats => {
  const totalApplications = jobs.filter(
    (job) => job.status !== "Pending" && job.status !== "Archived"
  ).length;
  const activeJobs = jobs.filter((job) =>
    ["Applied", "Interviewing"].includes(job.status)
  ).length;

  // Since interviewDates is missing in the provided JSON, we approximate by counting 'Interviewing' status
  // If the backend is updated to include `interviewDates`, this logic should be changed.
  const interviewsScheduled = jobs.filter((job) =>
    job.status === "Interviewing"
  ).length;

  return {
    totalApplications,
    activeJobs,
    interviewsScheduled,
  };
};

/**
 * Calculates weekly application performance based on 'appliedDate'.
 */
const calculateWeeklyPerformance = (jobs: Job[]): WeeklyPerformanceData[] => {
  // Initialize data for Mon (1) to Sun (0)
  const initialData: WeeklyPerformanceData[] = [
    { day: "Sun", applications: 0 },
    { day: "Mon", applications: 0 },
    { day: "Tue", applications: 0 },
    { day: "Wed", applications: 0 },
    { day: "Thu", applications: 0 },
    { day: "Fri", applications: 0 },
    { day: "Sat", applications: 0 },
  ];

  // Filter jobs that have an appliedDate and were applied this week
  const appliedThisWeek = jobs.filter((job) => {
    if (job.appliedDate) {
      // FIX: Check if appliedDate is a valid date before parsing
      try {
        const appliedDate = parseISO(job.appliedDate);
        return isThisWeek(appliedDate, { weekStartsOn: 1 }); // Start week on Monday
      } catch (e) {
        console.warn(`Invalid appliedDate found for job ${job._id}: ${job.appliedDate}`);
        return false;
      }
    }
    return false;
  });

  // Count applications by day
  appliedThisWeek.forEach((job) => {
    if (job.appliedDate) {
      // getDay returns 0 (Sun) to 6 (Sat)
      const dayIndex = getDay(parseISO(job.appliedDate));
      initialData[dayIndex].applications += 1;
    }
  });

  // Reorder to start with Monday (1) and end with Sunday (0) for the chart
  const reorderedData = [
    initialData[1], // Mon
    initialData[2], // Tue
    initialData[3], // Wed
    initialData[4], // Thu
    initialData[5], // Fri
    initialData[6], // Sat
    initialData[0], // Sun
  ];

  return reorderedData;
};

// --- Home Component ---

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // State for the Assistant's name
  const [name, setName] = useState("Assistant");
  // State for the ALL jobs managed by the Assistant
  const [jobs, setJobs] = useState<Job[]>([]);
  // State for the ALL notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    activeJobs: 0,
    interviewsScheduled: 0,
  });

  const [weeklyPerformance, setWeeklyPerformance] = useState<
    WeeklyPerformanceData[]
  >([]);

  // Helper for dummy toast (replace with your actual toast implementation)
  const toast = {
    error: (message: string) => console.error(`Toast Error: ${message}`),
  };

  /**
     * Fetches all dashboard data (user, jobs, notifications)
     */
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = await localforage.getItem("authToken");

        if (!token) {
          toast.error("Session expired. Please log in.");
          navigate("/");
          return;
        }

        const response = await axios.get<AssistantDashboardData>( // Use the new type
          CLIENT_DASHBOARD_ENDPOINT,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = response.data;

        // FIX: Extract Assistant's name from the root object
        setName(data.firstname || "Assistant");

        // FIX: Use the root 'jobs' and 'notifications' arrays, which are the collective data
        setJobs(data.jobs || []);
        setNotifications(data.notifications || []); // Assuming notifications in the JSON are correctly structured

        // Calculate and set stats
        setStats(calculateStats(data.jobs || []));

        // NEW CALCULATION for the chart data
        setWeeklyPerformance(calculateWeeklyPerformance(data.jobs || []));
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error("Dashboard data fetch failed:", axiosError);

        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          toast.error("Your session has expired. Please log in again.");
          await localforage.removeItem("authToken");
          navigate("/", { replace: true });
        } else {
          toast.error("Failed to load dashboard data.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  // Derived values for the UI
  const totalWeeklyApps = weeklyPerformance.reduce(
    (sum, d) => sum + d.applications,
    0
  );

  // FIX: Notifications array is an array of simple objects with only _id, not the full Notification type.
  // The provided JSON for 'messages' at the root level is:
  /*
    "messages": [
      {
        "_id": "6925ed051f522086171b8ad7",
        ...
        "conversation": [...]
      }
    ]
  */
  // Since the UI uses a `Notification[]` type, and the provided JSON's `notifications: []` is empty,
  // we cannot show recent activity from the root `notifications` or `messages` without mapping them.
  // **ASSUMPTION:** We will keep the `notifications` array as the source for `recentActivity`
  // and assume it will eventually contain proper Notification objects.
  const recentActivity = notifications
    .filter(item => item.createdAt && item.message) // Only show items with valid data
    .sort(
      (a, b) =>
        parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
    ) // Sort by newest
    .slice(0, 5); // Show top 5

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl font-medium text-gray-700">
          Loading dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* 1. Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, <span className="text-[#4eaa3c]">{name}</span>
        </h1>

        {/* 2. Summary Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {[
            { title: "Total Applications", value: stats.totalApplications },
            { title: "Active Jobs", value: stats.activeJobs },
            { title: "Interviews Secured", value: stats.interviewsScheduled },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col justify-center text-center hover:shadow-lg transition"
            >
              <p className="text-sm text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-[#4eaa3c] mt-1">
                {stat.value}
              </h3>
            </div>
          ))}
        </div>

        {/* 3. Main Content Grid: Performance Chart & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Weekly Performance Chart */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Application Volume (This Week)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyPerformance}>
                <XAxis dataKey="day" stroke="#888" />
                <YAxis allowDecimals={false} /> {/* Ensures whole numbers on Y-axis */}
                <Tooltip />
                <Bar
                  dataKey="applications"
                  fill="#4eaa3c"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-gray-500">
                Total Submissions This Week: **{totalWeeklyApps}**
              </span>
              <span className="text-gray-500 italic">
                Data calculated from live applications.
              </span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
            </h2>
            <ul className="divide-y divide-gray-100">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <li
                    key={item._id}
                    className="py-3 flex justify-between items-start"
                  >
                    <p className="text-gray-800 text-sm mr-2">{item.message}</p>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(parseISO(item.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-3 text-gray-500 italic text-sm">
                  No recent activity.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* 4. Recent Applications */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Applications
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="text-left py-3 px-4">Job Title</th>
                  <th className="text-left py-3 px-4">Company</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Applied Date</th>
                </tr>
              </thead>
              <tbody>
                {/* FIX: Ensure that only valid dates are formatted */}
                {jobs.slice(0, 5).map(
                  (
                    job // Display top 5 recent jobs
                  ) => (
                    <tr
                      key={job._id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {job.title}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{job.company}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            job.status === "Hired"
                              ? "bg-green-100 text-green-700"
                              : job.status === "Interviewing"
                              ? "bg-blue-100 text-blue-700"
                              : job.status === "Rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {job.appliedDate && !isNaN(new Date(job.appliedDate).getTime())
                          ? new Date(job.appliedDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                  )
                )}
                {jobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-5 text-center text-gray-500 italic"
                    >
                      No applications tracked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;