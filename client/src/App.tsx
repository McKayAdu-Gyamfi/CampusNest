import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ManagerLayout from "./components/ManagerLayout";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { ThemeProvider } from "./components/theme-provider";
import { BookingProvider } from "./contexts/BookingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/toaster";

const Home = React.lazy(() => import("./pages/Home"));
const Explore = React.lazy(() => import("./pages/Explore"));
const LivePreview = React.lazy(() => import("./pages/LivePreview"));
const Booking = React.lazy(() => import("./pages/Booking"));
const Login = React.lazy(() => import("./pages/Login"));
const Profile = React.lazy(() => import("./pages/Profile"));
const EditProfile = React.lazy(() => import("./pages/EditProfile"));
const ManageBookings = React.lazy(() => import("./pages/ManageBookings"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const Saved = React.lazy(() => import("./pages/Saved"));
const ManagerDashboard = React.lazy(() => import("./pages/manager/ManagerDashboard"));
const ManagerProperties = React.lazy(() => import("./pages/manager/ManagerProperties"));
const ManagerBookings = React.lazy(() => import("./pages/manager/ManagerBookings"));
const ManagerClients = React.lazy(() => import("./pages/manager/ManagerClients"));
const ManagerPayouts = React.lazy(() => import("./pages/manager/ManagerPayouts"));
const ManagerCancelRefund = React.lazy(() => import("./pages/manager/ManagerCancelRefund"));
const ManagerProfile = React.lazy(() => import("./pages/manager/ManagerProfile"));
const PaymentDetails = React.lazy(() => import("./pages/PaymentDetails"));
const BookingConfirmed = React.lazy(() => import("./pages/BookingConfirmed"));

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
        <AuthProvider>
        <BookingProvider>
        <Router>
        <Suspense fallback={<ScreenLoader />}>
        <Routes>
        <Route element={<RoleProtectedRoute allow={["student"]}><Layout /></RoleProtectedRoute>}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/manage-bookings" element={<ManageBookings />} />
        </Route>

        {/* Manager Routes */}
        <Route element={<RoleProtectedRoute allow={["manager"]}><ManagerLayout /></RoleProtectedRoute>}>
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/manager/properties" element={<ManagerProperties />} />
          <Route path="/manager/bookings" element={<ManagerBookings />} />
          <Route path="/manager/clients" element={<ManagerClients />} />
          <Route path="/manager/payouts" element={<ManagerPayouts />} />
          <Route path="/manager/profile" element={<ManagerProfile />} />
          <Route path="/manager/cancel-refund/:id" element={<ManagerCancelRefund />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<RoleProtectedRoute allow={["admin"]}><AdminLayout /></RoleProtectedRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/hostels" element={<AdminHostels />} />
          <Route path="/admin/schools" element={<AdminSchools />} />
          <Route path="/admin/room-tours" element={<AdminRoomTours />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        {/* Full-screen routes without bottom nav */}
        <Route path="/login" element={<Login />} />
        <Route path="/edit-profile" element={<RoleProtectedRoute allow={["student"]}><EditProfile /></RoleProtectedRoute>} />
        <Route path="/settings" element={<RoleProtectedRoute allow={["student"]}><SettingsPage /></RoleProtectedRoute>} />
        <Route path="/live-preview" element={<RoleProtectedRoute allow={["student"]}><LivePreview /></RoleProtectedRoute>} />
        <Route path="/booking" element={<RoleProtectedRoute allow={["student"]}><Booking /></RoleProtectedRoute>} />
        <Route path="/payment" element={<RoleProtectedRoute allow={["student"]}><PaymentDetails /></RoleProtectedRoute>} />
        <Route path="/booking-confirmed" element={<RoleProtectedRoute allow={["student"]}><BookingConfirmed /></RoleProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
      </Router>
        </BookingProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
