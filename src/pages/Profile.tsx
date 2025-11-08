import React, { useState } from "react";
import {
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaBell,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

const ProfilePage: React.FC = () => {
  const [online, setOnline] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [visibility, setVisibility] = useState(true);

  const profile = {
    name: "Alexander Virtuous",
    role: "Job Application Agent",
    avatar: "https://i.pravatar.cc/120?img=12",
    email: "alexander@example.com",
    phone: "+234 801 234 5678",
    location: "Lagos, Nigeria",
    bio: "A dedicated job application assistant helping clients find the best career opportunities. Skilled in automation, tailored job matching, and client communication.",
    stats: {
      clients: 12,
      totalApplications: 248,
      approvedJobs: 143,
      interviews: 37,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-md rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between mb-8 border border-gray-100">
          <div className="flex items-center gap-5">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow"
            />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {profile.name}
              </h1>
              <p className="text-sm text-gray-500">{profile.role}</p>

              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    online ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></span>
                <span className="text-sm text-gray-700 font-medium">
                  {online ? "Online" : "Offline"}
                </span>
                <button
                  onClick={() => setOnline(!online)}
                  className={`ml-3 px-4 py-1 text-sm rounded-full font-medium transition-all ${
                    online
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}
                >
                  {online ? "Go Offline" : "Go Online"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Personal Info */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-center gap-3">
                <FaEnvelope className="text-gray-400" />
                {profile.email}
              </li>
              <li className="flex items-center gap-3">
                <FaPhone className="text-gray-400" />
                {profile.phone}
              </li>
              <li className="flex items-center gap-3">
                <FaMapMarkerAlt className="text-gray-400" />
                {profile.location}
              </li>
            </ul>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {profile.bio}
              </p>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preferences & Settings
            </h2>

            <div className="space-y-5 text-sm text-gray-700">
              {/* Notifications Toggle */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FaBell className="text-gray-400" />
                  Notifications
                </span>
                <div
                  onClick={() => setNotifications(!notifications)}
                  className={`relative w-11 h-6 flex items-center rounded-full cursor-pointer transition ${
                    notifications ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute bg-white w-4 h-4 rounded-full transition-transform ${
                      notifications ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {visibility ? (
                    <FaEye className="text-gray-400" />
                  ) : (
                    <FaEyeSlash className="text-gray-400" />
                  )}
                  Profile Visibility
                </span>
                <div
                  onClick={() => setVisibility(!visibility)}
                  className={`relative w-11 h-6 flex items-center rounded-full cursor-pointer transition ${
                    visibility ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute bg-white w-4 h-4 rounded-full transition-transform ${
                      visibility ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>

              <div className="pt-3 border-t mt-4">
                <button className="text-blue-600 hover:underline text-sm">
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
