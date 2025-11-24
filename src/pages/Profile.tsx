import React, { useState, useEffect } from "react";
import {
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaBell,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import axios, { AxiosError } from "axios";
// Assuming you have a navigation hook and a storage library
import { useNavigate } from "react-router-dom";
import localforage from "localforage";
import Api from "../components/Api";
// Assuming toast is imported from a library like 'react-hot-toast'
// import toast from "react-hot-toast";

// --- Configuration ---
const USER_DATA_ENDPOINT = `${Api}/work/userdata`; // Replace with your actual endpoint URL

// Type for the Job object based on the provided Mongoose schema
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
    date: Date;
    type: "Screening" | "Technical" | "Behavioral" | "On-site";
    notes: string;
  }>;
  // Include other necessary fields from your schema
  // For calculation, 'status' and 'interviewDates' are the most crucial
}

// Interface for the actual API response structure
interface BackendResponse {
  resetCode: string | null;
  resetCodeExpires: string | null;
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: "online" | "offline";
  clients: string[]; // Used to calculate the 'clients' stat
  jobs: Job[]; // UPDATED: Now an array of Job objects
  notifications: string[];
  messages: string[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

// --- 2. UI-Optimized Interface (What the component consumes) ---
interface UserStats {
  clients: number;
  totalApplications: number; // Mocked for display
  approvedJobs: number; // Mocked for display
  interviews: number; // Mocked for display
}

interface UserProfile {
  name: string;
  role: string;
  initial: string; // New field for avatar generation
  email: string;
  phone: string;
  location: string;
  bio: string;
  status: "online" | "offline";
  stats: UserStats;
}

// Default profile structure to use before data is fetched or on error
const DEFAULT_PROFILE: UserProfile = {
  name: "Loading User...",
  role: "Job Application Agent",
  initial: "L",
  email: "...",
  phone: "+234 801 234 5678",
  location: "Lagos, Nigeria",
  bio: "Loading user profile information...",
  status: "offline",
  stats: {
    clients: 0,
    totalApplications: 0,
    approvedJobs: 0,
    interviews: 0,
  },
};

// --- Avatar Component (Displays the first letter of the name) ---
const InitialAvatar: React.FC<{ initial: string; className?: string }> = ({
  initial,
  className,
}) => (
  <div
    className={`w-20 h-20 rounded-full flex items-center justify-center bg-[#4eaa3c] text-white font-bold text-4xl shadow-lg border-4 border-white ring-2 ring-[#4eaa3c] ${className}`}
  >
    {initial.toUpperCase()}
  </div>
);

// --- ProfilePage Component ---
const ProfilePage: React.FC = () => {
  const navigate = useNavigate(); // Hook for navigation/redirection

  // State for fetched user data
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  // State for toggles
  // NOTE: 'online' state is now linked to 'profile.status'
  const [notifications, setNotifications] = useState(true);
  const [visibility, setVisibility] = useState(true);

  // Helper function for dummy toast (replace with your actual toast implementation)
  const toast = {
    error: (message: string) => console.error(`Toast Error: ${message}`),
  };

  /**
   * Calculates the stats based on the jobs array.
   */
  const calculateJobStats = (jobs: Job[]): UserStats => {
    let totalApplications = 0;
    let approvedJobs = 0;
    let totalInterviews = 0;

    // Filter jobs that were actually applied to (not just Pending or Archived)
    const appliedJobs = jobs.filter(
      (job) => job.status !== "Pending" && job.status !== "Archived"
    );
    totalApplications = appliedJobs.length;

    // Count 'Offer Received' and 'Hired' jobs
    approvedJobs = jobs.filter(
      (job) => job.status === "Offer Received" || job.status === "Hired"
    ).length;

    // Count total unique interview dates across all jobs
    jobs.forEach((job) => {
      // We only count interviews if the job status is 'Interviewing' or higher
      if (
        job.status === "Interviewing" ||
        job.status === "Offer Received" ||
        job.status === "Hired"
      ) {
        totalInterviews += job.interviewDates.length;
      }
    });

    return {
      clients: appliedJobs.length > 0 ? 1 : 0, // Simplified client count: 1 if user has applied for any job, otherwise 0.
      totalApplications,
      approvedJobs,
      interviews: totalInterviews,
    };
  };

  /**
   * Fetches the user data from the API endpoint using a Bearer token.
   */
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = await localforage.getItem("authToken");

        if (!token) {
          toast.error("Session expired or token missing. Please log in.");
          navigate("/");
          return;
        }

        // Make the API call using the BackendResponse type
        const response = await axios.get<BackendResponse>(USER_DATA_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // 3. Map the API response to the UI-Optimized UserProfile state
        const apiData = response.data;

        // Calculate the dynamic stats
        const jobStats = calculateJobStats(apiData.jobs);

        // Map the API response to the UI-Optimized UserProfile state
        const mappedProfile: UserProfile = {
          name: `${apiData.firstname} ${apiData.lastname}`,
          email: apiData.email,
          status: apiData.status,
          initial: apiData.firstname.charAt(0) || DEFAULT_PROFILE.initial, // Get the first letter
          stats: {
            ...jobStats,
            clients: apiData.clients.length, // Use actual clients count from API
          },

          // Default/placeholder values for fields missing in the API response
          role: DEFAULT_PROFILE.role,
          phone: DEFAULT_PROFILE.phone,
          location: DEFAULT_PROFILE.location,
          bio: DEFAULT_PROFILE.bio,
        };

        setProfile(mappedProfile);
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error("User data fetch failed:", axiosError);

        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          toast.error("Your session has expired. Please log in again.");
          await localforage.removeItem("authToken");
          navigate("/", { replace: true });
        } else {
          setProfile(DEFAULT_PROFILE);
          toast.error("Failed to load user data.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Use the 'profile.status' for the online state in the UI
  const isOnline = profile.status === "online";

  // Display a loading screen while data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl font-medium text-gray-700">
          Loading profile data...
        </p>
      </div>
    );
  }

  // --- Render Profile Data ---
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        {/* 🚀 Header */}
        <div className="bg-white shadow-md rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between mb-8 border border-gray-100">
          <div className="flex items-center gap-5">
            <InitialAvatar initial={profile.initial} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {profile.name}
              </h1>
              <p className="text-sm text-gray-500">{profile.role}</p>

              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></span>
                <span className="text-sm text-gray-700 font-medium">
                  {isOnline ? "Online" : "Offline"}
                </span>
                {/* <button
                  // This button now needs to send an API request to change the status
                  onClick={() =>
                    console.log(
                      `Attempting to set status to ${
                        isOnline ? "offline" : "online"
                      }`
                    )
                  }
                  className={`ml-3 px-4 py-1 text-sm rounded-full font-medium transition-all ${
                    isOnline
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}
                >
                  {isOnline ? "Go Offline" : "Go Online"}
                </button> */}
              </div>
            </div>
          </div>
        </div>

        {/* --- */}

        {/* 📝 Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Personal Info & Bio */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contact & Bio
            </h2>
            <ul className="space-y-3 text-sm text-gray-700 border-b pb-4 mb-4">
              <li className="flex items-center gap-3">
                <FaEnvelope className="text-blue-500" />
                Email: {profile.email}
              </li>
            </ul>
          </div>

          {/* Right: Settings */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preferences & Settings
            </h2>

            <div className="space-y-5 text-sm text-gray-700">
              {/* Notifications Toggle (Using local state) */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <FaBell className="text-gray-500 text-lg" />
                  Notifications
                </span>
                <div
                  onClick={() => setNotifications(!notifications)}
                  className={`relative w-11 h-6 flex items-center rounded-full cursor-pointer transition ${
                    notifications ? "bg-[#4eaa3c]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute bg-white w-4 h-4 rounded-full transition-transform shadow ${
                      notifications ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>

              {/* Visibility Toggle (Using local state) */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  {visibility ? (
                    <FaEye className="text-gray-500 text-lg" />
                  ) : (
                    <FaEyeSlash className="text-gray-500 text-lg" />
                  )}
                  Profile Visibility
                </span>
                <div
                  onClick={() => setVisibility(!visibility)}
                  className={`relative w-11 h-6 flex items-center rounded-full cursor-pointer transition ${
                    visibility ? "bg-[#4eaa3c]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute bg-white w-4 h-4 rounded-full transition-transform shadow ${
                      visibility ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>

              <div className="pt-5 border-t mt-6">
                <button className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors">
                  Update Password
                </button>
                <p className="text-xs text-red-500 mt-4">
                  Danger Zone:
                  <button className="ml-1 text-red-600 hover:underline">
                    Deactivate Account
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
