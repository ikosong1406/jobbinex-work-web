import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import localforage from "localforage";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/Forgot";
import TabLayout from "./components/Tab";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Inbox from "./pages/Inbox";
import Profile from "./pages/Profile";

function ProtectedRoute() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const token = await localforage.getItem<string>("authToken");

        if (mounted) {
          setAuthenticated(Boolean(token));
        }
      } catch (error) {
        console.error("Auth check failed:", error);

        if (mounted) {
          setAuthenticated(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#4eaa3c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

// --- Main App Component ---
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes (Accessible without login) */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot" element={<ForgotPassword />} />

         <Route element={<ProtectedRoute />}>
          <Route element={<TabLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
