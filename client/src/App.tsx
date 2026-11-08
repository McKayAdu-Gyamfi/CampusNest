import { NotificationsProvider } from "./contexts/NotificationsContext";
import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ManagerLayout from "./components/ManagerLayout";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { ThemeProvider } from "./components/theme-provider";
import { BookingProvider } from "./contexts/BookingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { HostelsProvider } from "./contexts/HostelsContext";
import { ComingSoonProvider } from "./contexts/ComingSoonContext";
import { ToastProvider } from "./components/ui/toaster";
import RouteTitle from "./components/RouteTitle";
import LegacyRedirect from "./components/LegacyRedirect";
import { LEGACY_REDIRECTS } from "./lib/routes";

const Home = React.lazy(() => import("./pages/Home"));
const Explore = React.lazy(() => import("./pages/Explore"));
const LivePreview = React.lazy(() => import("./pages/LivePreview"));
const Booking = React.lazy(() => import("./pages/Booking"));
const Login = React.lazy(() => import("./pages/Login"));
const Profile = React.lazy(() => import("./pages/Profile"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const NotificationsPage = React.lazy(() => import("./pages/Notifications"));
const ManageBookings = React.lazy(() => import("./pages/ManageBookings"));
const Saved = React.lazy(() => import("./pages/Saved"));
const BookingDetail = React.lazy(() => import("./pages/BookingDetail"));
const ManagerDashboard = React.lazy(() => import("./pages/manager/ManagerDashboard"));
const ManagerProperties = React.lazy(() => import("./pages/manager/ManagerProperties"));
const ManagerPropertyDetail = React.lazy(() => import("./pages/manager/ManagerPropertyDetail"));
const ManagerBookings = React.lazy(() => import("./pages/manager/ManagerBookings"));
const ManagerClients = React.lazy(() => import("./pages/manager/ManagerClients"));
const ManagerMessages = React.lazy(() => import("./pages/manager/ManagerMessages"));
const ManagerPayouts = React.lazy(() => import("./pages/manager/ManagerPayouts"));
const ManagerCancelRefund = React.lazy(() => import("./pages/manager/ManagerCancelRefund"));
const ManagerProfile = React.lazy(() => import("./pages/manager/ManagerProfile"));
const PaymentDetails = React.lazy(() => import("./pages/PaymentDetails"));
const BookingConfirmed = React.lazy(() => import("./pages/BookingConfirmed"));
const HostelDetail = React.lazy(() => import("./pages/HostelDetail"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const AdminLogin = React.lazy(() => import("./pages/AdminLogin"));

const AdminLayout = React.lazy(() => import("./components/AdminLayout"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminHostels = React.lazy(() => import("./pages/admin/AdminHostels"));
const AdminSchools = React.lazy(() => import("./pages/admin/AdminSchools"));
const AdminRoomTours = React.lazy(() => import("./pages/admin/AdminRoomTours"));
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));

const ScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ToastProvider>
        <ComingSoonProvider>
        <AuthProvider>
        <NotificationsProvider>
        <HostelsProvider>
        <BookingProvider>
        <Router>
        <Suspense fallback={<ScreenLoader />}>
        <RouteTitle />
        <Routes>
        {/* ── Student area ── */}
        <Route element={<RoleProtectedRoute allow={["student"]}><Layout /></RoleProtectedRoute>}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="hostels/:id" element={<HostelDetail />} />
          <Route path="saved" element={<Saved />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="bookings" element={<ManageBookings />} />
          <Route path="bookings/:id" element={<BookingDetail />} />
        </Route>

        {/* Student full-screen flows (no navigation bars) */}
        <Route path="settings" element={<RoleProtectedRoute allow={["student"]}><SettingsPage /></RoleProtectedRoute>} />
        <Route path="tour" element={<RoleProtectedRoute allow={["student"]}><LivePreview /></RoleProtectedRoute>} />
        <Route path="checkout" element={<RoleProtectedRoute allow={["student"]}><Booking /></RoleProtectedRoute>} />
        <Route path="checkout/payment" element={<RoleProtectedRoute allow={["student"]}><PaymentDetails /></RoleProtectedRoute>} />
        <Route path="checkout/confirmation" element={<RoleProtectedRoute allow={["student"]}><BookingConfirmed /></RoleProtectedRoute>} />

        {/* ── Manager area ── */}
        <Route path="manager" element={<RoleProtectedRoute allow={["manager"]}><ManagerLayout /></RoleProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="properties" element={<ManagerProperties />} />
          <Route path="properties/:id" element={<ManagerPropertyDetail />} />
          <Route path="bookings" element={<ManagerBookings />} />
          <Route path="bookings/:id/cancel" element={<ManagerCancelRefund />} />
          <Route path="clients" element={<ManagerClients />} />
          <Route path="messages" element={<ManagerMessages />} />
          <Route path="payouts" element={<ManagerPayouts />} />
          <Route path="profile" element={<ManagerProfile />} />
        </Route>

        {/* ── Admin area ── */}
        <Route path="admin" element={<RoleProtectedRoute allow={["admin"]}><AdminLayout /></RoleProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="hostels" element={<AdminHostels />} />
          <Route path="schools" element={<AdminSchools />} />
          <Route path="room-tours" element={<AdminRoomTours />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* ── Sign in / sign up: one page per role ── */}
        <Route path="login" element={<Login key="student" role="student" mode="signin" />} />
        <Route path="signup" element={<Login key="student" role="student" mode="signup" />} />
        <Route path="manager/login" element={<Login key="manager" role="manager" mode="signin" />} />
        <Route path="manager/signup" element={<Login key="manager" role="manager" mode="signup" />} />
        <Route path="admin/login" element={<AdminLogin />} />

        {/* ── Old URLs keep working ── */}
        {LEGACY_REDIRECTS.map(({ from, to }) => (
          <Route key={from} path={from.slice(1)} element={<LegacyRedirect to={to} />} />
        ))}

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </Router>
        </BookingProvider>
        </HostelsProvider>
        </NotificationsProvider>
        </AuthProvider>
        </ComingSoonProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
