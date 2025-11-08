import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Client {
  id: number;
  name: string;
  planType: string;
  planLimit: number;
  usedQuota: number;
  weeklyApplications: number;
  status: "Active" | "Inactive";
}

interface Activity {
  id: number;
  message: string;
  time: string;
}

const Home: React.FC = () => {
  const [clients] = useState<Client[]>([
    {
      id: 1,
      name: "Alexander Virtuous",
      planType: "Pro Plan",
      planLimit: 50,
      usedQuota: 34,
      weeklyApplications: 12,
      status: "Active",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      planType: "Basic Plan",
      planLimit: 20,
      usedQuota: 10,
      weeklyApplications: 8,
      status: "Active",
    },
    {
      id: 3,
      name: "Michael Ade",
      planType: "Enterprise",
      planLimit: 100,
      usedQuota: 75,
      weeklyApplications: 25,
      status: "Inactive",
    },
  ]);

  const [weeklyPerformance] = useState([
    { day: "Mon", applications: 4 },
    { day: "Tue", applications: 5 },
    { day: "Wed", applications: 6 },
    { day: "Thu", applications: 3 },
    { day: "Fri", applications: 8 },
    { day: "Sat", applications: 7 },
    { day: "Sun", applications: 5 },
  ]);

  const [activityFeed] = useState<Activity[]>([
    {
      id: 1,
      message: "Sarah Johnson’s assistant submitted 2 new applications.",
      time: "2 hrs ago",
    },
    {
      id: 2,
      message: "Alexander Virtuous secured an interview with Google.",
      time: "5 hrs ago",
    },
    {
      id: 3,
      message: "Michael Ade’s plan quota nearing limit (25 jobs left).",
      time: "1 day ago",
    },
  ]);

  const totalWeeklyApps = weeklyPerformance.reduce(
    (sum, d) => sum + d.applications,
    0
  );
  const totalClients = clients.length;
  const totalInterviews = 6;
  const successRate = Math.round((totalInterviews / totalWeeklyApps) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Welcome back,{" "}
          <span className="text-[var(--color-primary)]">Alexander</span>
        </h1>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { title: "Total Clients", value: totalClients },
            { title: "Applications This Week", value: totalWeeklyApps },
            { title: "Interviews Secured", value: totalInterviews },
            { title: "Success Rate", value: `${successRate}%` },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col justify-center text-center hover:shadow-lg transition"
            >
              <p className="text-sm text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {stat.value}
              </h3>
            </div>
          ))}
        </div>

        {/* Clients Overview */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Assigned Clients
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Plan Type</th>
                  <th className="text-left py-3 px-4">Remaining Quota</th>
                  <th className="text-left py-3 px-4">Weekly Applications</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const remaining = client.planLimit - client.usedQuota;
                  const percent = Math.round(
                    (remaining / client.planLimit) * 100
                  );
                  return (
                    <tr
                      key={client.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {client.name}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {client.planType}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {remaining} left{" "}
                        <span className="text-xs text-gray-500">
                          ({percent}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {client.weeklyApplications}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyPerformance}>
              <XAxis dataKey="day" stroke="#888" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="applications"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-gray-500">
              Total Applications: {totalWeeklyApps}
            </span>
            <span className="text-green-600 font-semibold">
              +12% vs last week
            </span>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <ul className="divide-y divide-gray-100">
            {activityFeed.map((item) => (
              <li
                key={item.id}
                className="py-3 flex justify-between items-center"
              >
                <p className="text-gray-800">{item.message}</p>
                <span className="text-xs text-gray-500">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Home;
