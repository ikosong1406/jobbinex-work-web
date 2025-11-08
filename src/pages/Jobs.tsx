import React, { useState } from "react";

interface Client {
  id: number;
  name: string;
  preferences: string;
  cvUrl: string;
  coverLetterUrl: string;
  filters: {
    location: string;
    salaryRange: string;
    industries: string[];
  };
}

interface Application {
  id: number;
  jobTitle: string;
  company: string;
  link: string;
  submissionDate: string;
  notes: string;
  status: string;
}

const JobScreen: React.FC = () => {
  const [clients] = useState<Client[]>([
    {
      id: 1,
      name: "Alexander Virtuous",
      preferences: "Remote tech roles in Europe, full-time or contract.",
      cvUrl: "/cv/alexander.pdf",
      coverLetterUrl: "/cv/alexander-cover.pdf",
      filters: {
        location: "Europe, Remote",
        salaryRange: "$70,000 - $100,000",
        industries: ["Tech", "AI", "Software"],
      },
    },
    {
      id: 2,
      name: "Sarah Johnson",
      preferences: "Administrative or HR roles in the UK.",
      cvUrl: "/cv/sarah.pdf",
      coverLetterUrl: "/cv/sarah-cover.pdf",
      filters: {
        location: "UK",
        salaryRange: "$40,000 - $60,000",
        industries: ["HR", "Administration"],
      },
    },
  ]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [newApp, setNewApp] = useState<Omit<Application, "id">>({
    jobTitle: "",
    company: "",
    link: "",
    submissionDate: "",
    notes: "",
    status: "Applied",
  });
  const [activeTab, setActiveTab] = useState<"details" | "shortlist" | "applications">("details");

  const handleAddApplication = () => {
    if (!newApp.jobTitle || !newApp.company) return;
    setApplications([...applications, { id: Date.now(), ...newApp }]);
    setNewApp({
      jobTitle: "",
      company: "",
      link: "",
      submissionDate: "",
      notes: "",
      status: "Applied",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Client Job Management</h1>

      {/* CLIENT LIST */}
      {!selectedClient ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition cursor-pointer"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{client.name}</h2>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Location:</strong> {client.filters.location}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Salary:</strong> {client.filters.salaryRange}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Industries:</strong> {client.filters.industries.join(", ")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{selectedClient.name}</h2>
            <button
              onClick={() => setSelectedClient(null)}
              className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              ← Back to Clients
            </button>
          </div>

          {/* TABS */}
          <div className="flex border-b border-gray-200 mb-4">
            {["details", "shortlist", "applications"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Preferences</h3>
                <p className="text-gray-600">{selectedClient.preferences}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">CV & Cover Letter</h3>
                <div className="flex gap-4 text-blue-600">
                  <a href={selectedClient.cvUrl} target="_blank" rel="noopener noreferrer">
                    View CV
                  </a>
                  <a href={selectedClient.coverLetterUrl} target="_blank" rel="noopener noreferrer">
                    View Cover Letter
                  </a>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Job Search Filters</h3>
                <ul className="list-disc list-inside text-gray-600">
                  <li>Location: {selectedClient.filters.location}</li>
                  <li>Salary Range: {selectedClient.filters.salaryRange}</li>
                  <li>Industries: {selectedClient.filters.industries.join(", ")}</li>
                </ul>
              </div>
            </div>
          )}

          {/* SHORTLIST TAB */}
          {activeTab === "shortlist" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Upload Shortlisted Jobs</h3>
              <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center">
                <p className="text-gray-500 mb-3">Drag & drop job links or upload file</p>
                <button className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                  Upload File
                </button>
              </div>
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === "applications" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Log Job Application</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Job Title"
                  value={newApp.jobTitle}
                  onChange={(e) => setNewApp({ ...newApp, jobTitle: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Company"
                  value={newApp.company}
                  onChange={(e) => setNewApp({ ...newApp, company: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Job Link"
                  value={newApp.link}
                  onChange={(e) => setNewApp({ ...newApp, link: e.target.value })}
                />
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={newApp.submissionDate}
                  onChange={(e) => setNewApp({ ...newApp, submissionDate: e.target.value })}
                />
                <textarea
                  className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                  placeholder="Notes"
                  value={newApp.notes}
                  onChange={(e) => setNewApp({ ...newApp, notes: e.target.value })}
                />
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={newApp.status}
                  onChange={(e) => setNewApp({ ...newApp, status: e.target.value })}
                >
                  <option>Applied</option>
                  <option>Waiting</option>
                  <option>Interview</option>
                </select>
              </div>
              <button
                onClick={handleAddApplication}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Add Application
              </button>

              <div className="mt-6">
                <h4 className="font-semibold text-gray-800 mb-2">Application Tracker</h4>
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
                      {applications.map((app) => (
                        <tr key={app.id} className="border-t border-gray-100">
                          <td className="py-2 px-3">{app.jobTitle}</td>
                          <td className="py-2 px-3">{app.company}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                app.status === "Applied"
                                  ? "bg-blue-100 text-blue-700"
                                  : app.status === "Waiting"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {app.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">{app.submissionDate}</td>
                          <td className="py-2 px-3 text-gray-600">{app.notes}</td>
                        </tr>
                      ))}
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
