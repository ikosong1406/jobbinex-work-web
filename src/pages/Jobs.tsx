import React, { useState, useEffect, useMemo } from "react";
import axios, { AxiosError } from "axios";
import localforage from "localforage";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import Api from "../components/Api";

// --- API Endpoints ---
const USER_DATA_ENDPOINT = `${Api}/work/userdata`;
const CREATE_JOB_ENDPOINT = `${Api}/work/newJob`;
const GET_CLIENT_JOBS_ENDPOINT = `${Api}/work/getClientJobs`; // New endpoint
const UPDATE_JOB_STATUS_ENDPOINT = `${Api}/work/updateJobStatus`; // New endpoint

// --- Interfaces ---
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
  jobEmail: string;
  jobPassword: string;
  cv: string;
  preferredIndustries: string | string[];
  preferredRoles: string | string[];
  preferredLocations: string | string[];
  plan?: ClientPlan; // Add plan field
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
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

interface NewJobPayload {
  client: string;
  title: string;
  company: string;
  jobUrl: string;
  appliedDate: string;
  notes: string;
  status:
    | "Applied"
    | "Pending"
    | "Interviewing"
    | "Offer Received"
    | "Rejected"
    | "Hired"
    | "Archived";
  description: string;
  location: string;
  jobType: string;
  requiredSkills: string[];
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

// Helper function to safely ensure a value is an array of strings
const safeArrayOfStrings = (
  value: string | string[] | null | undefined
): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
};

// Helper function to format plan expiration date
const formatPlanExpiration = (expiresAt: Date | string | undefined): string => {
  if (!expiresAt) return "No expiration date";
  
  try {
    const date = new Date(expiresAt);
    if (isNaN(date.getTime())) return "Invalid date";
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return "Invalid date";
  }
};

// Helper function to check if plan is expired
const isPlanExpired = (expiresAt: Date | string | undefined): boolean => {
  if (!expiresAt) return false;
  
  try {
    const expirationDate = new Date(expiresAt);
    const today = new Date();
    return expirationDate < today;
  } catch (error) {
    return false;
  }
};

// Helper function to get plan days remaining
const getPlanDaysRemaining = (expiresAt: Date | string | undefined): string => {
  if (!expiresAt) return "No expiration";
  
  try {
    const expirationDate = new Date(expiresAt);
    const today = new Date();
    const timeDiff = expirationDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysRemaining < 0) return `Expired ${Math.abs(daysRemaining)} days ago`;
    if (daysRemaining === 0) return "Expires today";
    if (daysRemaining === 1) return "1 day remaining";
    return `${daysRemaining} days remaining`;
  } catch (error) {
    return "Invalid date";
  }
};

const JobScreen: React.FC = () => {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [newApp, setNewApp] = useState({
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

  const [activeTab, setActiveTab] = useState<"details" | "applications">(
    "details"
  );

  // Fetch user/assistant data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await localforage.getItem("authToken");
        if (!token) {
          toast.error("Authentication required.");
          navigate("/");
          return;
        }

        const response = await axios.get<UserData>(USER_DATA_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setClients(
          response.data.clients.map((client) => ({
            ...client,
            jobEmail: client.jobEmail || "",
            jobPassword: client.jobPassword || "",
            cv: client.cv || "",
            preferredIndustries: safeArrayOfStrings(client.preferredIndustries),
            preferredRoles: safeArrayOfStrings(client.preferredRoles),
            preferredLocations: safeArrayOfStrings(client.preferredLocations),
            plan: client.plan || undefined,
          }))
        );
      } catch (error) {
        const err = error as AxiosError;
        toast.error("Failed to load user data.");

        if (err.response?.status === 401) {
          localforage.removeItem("authToken").then(() => navigate("/"));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Fetch client jobs when a client is selected
  useEffect(() => {
    const fetchClientJobs = async () => {
      if (!selectedClient) return;

      try {
        const token = await localforage.getItem("authToken");
        if (!token) return;

        const response = await axios.get(
          `${GET_CLIENT_JOBS_ENDPOINT}/${selectedClient._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setApplications(response.data.jobs || []);
      } catch (error) {
        console.error("Failed to fetch client jobs:", error);
        toast.error("Failed to load client applications.");
      }
    };

    fetchClientJobs();
  }, [selectedClient]);

  const getClientName = (client: Client) =>
    `${client.firstname} ${client.lastname}`;

  // SUBMIT NEW JOB
  const handleAddApplication = async () => {
    if (!selectedClient) return toast.error("Select a client first.");

    if (!newApp.jobTitle || !newApp.company || !newApp.description) {
      toast.error("Job Title, Company, and Description are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await localforage.getItem("authToken");
      if (!token) throw new Error("Missing token.");

      const payload: NewJobPayload = {
        client: selectedClient._id,
        title: newApp.jobTitle,
        company: newApp.company,
        jobUrl: newApp.link,
        appliedDate: newApp.submissionDate,
        notes: newApp.notes,
        status: newApp.status as NewJobPayload["status"],
        description: newApp.description,
        location: newApp.location,
        jobType: newApp.jobType,
        requiredSkills: newApp.skillsInput
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== ""),
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

      // Refresh the applications list
      const jobsResponse = await axios.get(
        `${GET_CLIENT_JOBS_ENDPOINT}/${selectedClient._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setApplications(jobsResponse.data.jobs || []);
      toast.success("Application added!");

      // Reset form
      setNewApp({
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
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPDATE JOB STATUS
  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    setUpdatingStatus(jobId);

    try {
      const token = await localforage.getItem("authToken");
      if (!token) throw new Error("Missing token.");

      await axios.patch(
        `${UPDATE_JOB_STATUS_ENDPOINT}/${jobId}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          app._id === jobId ? { ...app, status: newStatus } : app
        )
      );

      toast.success("Status updated successfully!");
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const clientDetails = useMemo(() => {
    if (!selectedClient) return null;

    const roles = Array.isArray(selectedClient.preferredRoles)
      ? selectedClient.preferredRoles
      : [];
    const locations = Array.isArray(selectedClient.preferredLocations)
      ? selectedClient.preferredLocations
      : [];
    const industries = Array.isArray(selectedClient.preferredIndustries)
      ? selectedClient.preferredIndustries
      : [];

    const details = [
      { label: "Email", value: selectedClient.email },
      { label: "Phone", value: selectedClient.phonenumber },
      { label: "Job Email", value: selectedClient.jobEmail },
      { label: "Job Password", value: selectedClient.jobPassword },
      { label: "CV Link", value: selectedClient.cv },
      {
        label: "Preferred Roles",
        value: roles.join(", ") || "N/A",
      },
      {
        label: "Locations",
        value: locations.join(", ") || "N/A",
      },
      {
        label: "Industries",
        value: industries.join(", ") || "N/A",
      },
    ];

    // Add plan details if available
    if (selectedClient.plan) {
      const isExpired = isPlanExpired(selectedClient.plan.expiresAt);
      
      details.push(
        {
          label: "Plan",
          value: selectedClient.plan.name,
        },
        {
          label: "Plan Expires",
          value: formatPlanExpiration(selectedClient.plan.expiresAt),
        },
        {
          label: "Plan Status",
          value: (
            <span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
              {isExpired ? 'EXPIRED' : 'ACTIVE'} - {getPlanDaysRemaining(selectedClient.plan.expiresAt)}
            </span>
          ),
        }
      );
    } else {
      details.push({
        label: "Plan",
        value: "No plan assigned",
      });
    }

    return details;
  }, [selectedClient]);

  // Status options for dropdown
  const statusOptions = [
    "Applied",
    "Pending",
    "Interviewing",
    "Offer Received",
    "Rejected",
    "Hired",
    "Archived",
  ];

  // --- UI ---
  if (loading)
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <p>Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <Toaster />

      <h1 className="text-2xl font-bold mb-6">Client Job Management</h1>

      {/* CLIENT LIST */}
      {!selectedClient ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.length > 0 ? (
            clients.map((client) => (
              <div
                key={client._id}
                onClick={() => setSelectedClient(client)}
                className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-lg cursor-pointer"
              >
                <h2 className="text-lg font-semibold mb-2">
                  {getClientName(client)}
                </h2>
                {/* Display plan info in client card */}
                {client.plan && (
                  <div className="mb-2">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                      client.plan.name === "Elite" ? "bg-purple-100 text-purple-800" :
                      client.plan.name === "Professional" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {client.plan.name} Plan
                    </span>
                    {isPlanExpired(client.plan.expiresAt) ? (
                      <span className="ml-2 text-xs text-red-600 font-semibold">
                        EXPIRED
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-green-600 font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm">
                  <strong>Roles:</strong>{" "}
                  {Array.isArray(client.preferredRoles)
                    ? client.preferredRoles.join(", ") || "N/A"
                    : client.preferredRoles || "N/A"}
                </p>
                <p className="text-sm">
                  <strong>Locations:</strong>{" "}
                  {Array.isArray(client.preferredLocations)
                    ? client.preferredLocations.join(", ") || "N/A"
                    : client.preferredLocations || "N/A"}
                </p>
                <p className="text-sm">
                  <strong>Industries:</strong>{" "}
                  {Array.isArray(client.preferredIndustries)
                    ? client.preferredIndustries.join(", ") || "N/A"
                    : client.preferredIndustries || "N/A"}
                </p>
              </div>
            ))
          ) : (
            <p>No clients assigned.</p>
          )}
        </div>
      ) : (
        <>
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {getClientName(selectedClient)}
              </h2>
              {selectedClient.plan && (
                <div className="flex items-center mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    selectedClient.plan.name === "Elite" ? "bg-purple-100 text-purple-800" :
                    selectedClient.plan.name === "Professional" ? "bg-blue-100 text-blue-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {selectedClient.plan.name} Plan
                  </span>
                  {isPlanExpired(selectedClient.plan.expiresAt) ? (
                    <span className="ml-2 text-xs text-red-600 font-semibold">
                      • EXPIRED
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-green-600 font-semibold">
                      • ACTIVE
                    </span>
                  )}
                  <span className="ml-2 text-xs text-gray-600">
                    {getPlanDaysRemaining(selectedClient.plan.expiresAt)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedClient(null)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              ← Back
            </button>
          </div>

          {/* TABS */}
          <div className="flex border-b mb-6">
            {["details", "applications"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 font-medium capitalize ${
                  activeTab === tab
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold mb-4">Client Details</h3>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                {clientDetails?.map((item) => (
                  <div key={item.label} className={item.label === "Plan Status" ? "col-span-2" : ""}>
                    <dt className="text-gray-500">{item.label}</dt>
                    <dd className="text-gray-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === "applications" && (
            <div className="bg-white rounded-xl p-6 shadow space-y-4">
              <h3 className="font-semibold text-gray-800 mb-3">
                Log New Job Application
              </h3>

              {/* FORM */}
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Job Title (Required)"
                  value={newApp.jobTitle}
                  onChange={(e) =>
                    setNewApp({ ...newApp, jobTitle: e.target.value })
                  }
                />

                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Company (Required)"
                  value={newApp.company}
                  onChange={(e) =>
                    setNewApp({ ...newApp, company: e.target.value })
                  }
                />

                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Job Link"
                  value={newApp.link}
                  onChange={(e) =>
                    setNewApp({ ...newApp, link: e.target.value })
                  }
                />

                <input
                  type="date"
                  className="border rounded-lg px-3 py-2"
                  value={newApp.submissionDate}
                  onChange={(e) =>
                    setNewApp({
                      ...newApp,
                      submissionDate: e.target.value,
                    })
                  }
                />

                <textarea
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                  placeholder="Job Description (Required)"
                  value={newApp.description}
                  onChange={(e) =>
                    setNewApp({ ...newApp, description: e.target.value })
                  }
                />

                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Location"
                  value={newApp.location}
                  onChange={(e) =>
                    setNewApp({ ...newApp, location: e.target.value })
                  }
                />

                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Job Type (Remote / Hybrid / Onsite)"
                  value={newApp.jobType}
                  onChange={(e) =>
                    setNewApp({ ...newApp, jobType: e.target.value })
                  }
                />

                <input
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                  placeholder="Required Skills (comma separated)"
                  value={newApp.skillsInput}
                  onChange={(e) =>
                    setNewApp({ ...newApp, skillsInput: e.target.value })
                  }
                />

                {/* Salary Fields */}
                <div className="grid grid-cols-3 gap-2 md:col-span-2">
                  <input
                    className="border rounded-lg px-3 py-2"
                    type="number"
                    placeholder="Salary Min"
                    value={newApp.salaryMin}
                    onChange={(e) =>
                      setNewApp({ ...newApp, salaryMin: e.target.value })
                    }
                  />

                  <input
                    className="border rounded-lg px-3 py-2"
                    type="number"
                    placeholder="Salary Max"
                    value={newApp.salaryMax}
                    onChange={(e) =>
                      setNewApp({ ...newApp, salaryMax: e.target.value })
                    }
                  />

                  <select
                    className="border rounded-lg px-3 py-2 bg-white"
                    value={newApp.salaryCurrency}
                    onChange={(e) =>
                      setNewApp({ ...newApp, salaryCurrency: e.target.value })
                    }
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <textarea
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                  placeholder="Notes (optional)"
                  value={newApp.notes}
                  onChange={(e) =>
                    setNewApp({ ...newApp, notes: e.target.value })
                  }
                />

                <select
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={newApp.status}
                  onChange={(e) =>
                    setNewApp({ ...newApp, status: e.target.value })
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAddApplication}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg mt-3 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Add Application"}
              </button>

              {/* APPLICATION LIST TABLE */}
              <div className="mt-6">
                <h4 className="font-semibold mb-2">
                  Applications for {getClientName(selectedClient)}
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="text-left py-2 px-3">Job Title</th>
                        <th className="text-left py-2 px-3">Company</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Notes</th>
                      </tr>
                    </thead>

                    <tbody>
                      {applications.length > 0 ? (
                        applications.map((app) => (
                          <tr
                            key={app._id}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="py-2 px-3">{app.title}</td>
                            <td className="py-2 px-3">{app.company}</td>
                            <td className="py-2 px-3">
                              <select
                                value={app.status}
                                onChange={(e) =>
                                  handleUpdateStatus(app._id, e.target.value)
                                }
                                disabled={updatingStatus === app._id}
                                className="border rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
                              >
                                {statusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              {updatingStatus === app._id && (
                                <span className="ml-2 text-xs text-gray-500">
                                  Updating...
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {new Date(app.appliedDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3">{app.notes}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center text-gray-500 py-3"
                          >
                            No applications logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobScreen;