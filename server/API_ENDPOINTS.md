# Application API Endpoints

This document lists all active API endpoints identified in the project, organized by module. It includes the required authentication protections applied to each endpoint.

## 🏢 Hostels (`/api/hostels`)
- `GET /` : Get all hostels **(Public)**
- `GET /:id` : Get details for a specific hostel **(Public)**
- `POST /` : Create a new hostel **(Requires Auth, Role: HOSTEL_MANAGER)**
- `PATCH /:id` : Update hostel details **(Requires Auth, Hostel Owner)**
- `PUT /:id/amenities` : Bulk update amenities **(Requires Auth, Hostel Owner)**
- `POST /:id/amenities` : Add single amenity **(Requires Auth, Hostel Owner)**
- `DELETE /:id/amenities/:amenityId` : Delete amenity **(Requires Auth, Hostel Owner)**
- `POST /:id/images` : Upload hostel images to Supabase (up to 10) **(Requires Auth, Hostel Owner)**

## 🛏️ Rooms (`/api/rooms`)
- `GET /` : Get all rooms **(Public)**
- `GET /:id` : Get details for a specific room **(Public)**
- `POST /` : Create a new room **(Requires Auth, Role: HOSTEL_MANAGER, must own the hostel)**
- `PATCH /:id` : Update room details **(Requires Auth, Room Owner)**
- `DELETE /:id` : Delete a room **(Requires Auth, Room Owner)**
- `PUT /:id/amenities` : Bulk update room amenities **(Requires Auth, Room Owner)**
- `POST /:id/amenities` : Add single room amenity **(Requires Auth, Room Owner)**
- `DELETE /:id/amenities/:amenityId` : Delete room amenity **(Requires Auth, Room Owner)**
- `POST /:id/images` : Upload room images to Supabase (up to 10) **(Requires Auth, Room Owner)**
- `POST /:id/tours` : Store a room tour scene (dynamically links panoramas for Frontend merging) **(Requires Auth, Room Owner)**
- `DELETE /:id/tours/:sceneId` : Delete a room tour scene **(Requires Auth, Room Owner)**

## 📅 Bookings (`/api/bookings`)
- `GET /` : View all bookings (Filtered automatically for Students; Managers/Admins may filter by `student_id`) **(Requires Auth)**
- `GET /:id` : Get specific booking details — owner student, the hostel's manager, or ADMIN only **(Requires Auth)**
- `POST /` : Create a booking **(Requires Auth, complete profile required)**
- `PATCH /:id` : Update a booking status — students may only cancel their own; managers may only act on bookings for hostels they manage; confirming is rejected with 409 if the room is already at capacity **(Requires Auth)**

## 💬 Complaints (`/api/complaints`)
- `GET /` : View complaints — students only ever see their own, managers only see complaints for hostels they manage **(Requires Auth)**
- `GET /:id` : Get specific complaint details — owner student, the hostel's manager, or ADMIN only **(Requires Auth)**
- `POST /` : Submit a new complaint — student must have an existing booking at the hostel **(Requires Auth)**
- `PATCH /:id` : Update a complaint status — the hostel's manager or ADMIN only **(Requires Auth)**

## ⭐ Reviews (`/api/reviews`)
- `GET /` : Get reviews **(Public)**
- `POST /` : Submit a review — student must have a CONFIRMED or CHECKED_OUT booking at the hostel **(Requires Auth, Role: STUDENT)**

## 👤 Users (`/api/users`)
- `GET /me` : View current user profile **(Requires Auth)**
- `PATCH /me` : Update current user profile **(Requires Auth)**
- `PATCH /me/profile-complete` : Provide student details (ID & course) **(Requires Auth, Role: STUDENT)**
- `PATCH /me/manager-profile-complete` : Provide manager payment details **(Requires Auth, Role: HOSTEL_MANAGER)**
- `GET /me/hostels` : View hostels managed by user **(Requires Auth, Role: HOSTEL_MANAGER)**
- `GET /` : View all users **(Requires Auth, Role: ADMIN)**
- `POST /` : Explicitly create an admin user **(Requires Auth, Role: ADMIN)**
- `GET /:id` : View specific user details **(Requires Auth, Role: ADMIN)**
- `PATCH /:id` : Admin manual override update for a user **(Requires Auth, Role: ADMIN)**

## 🔐 Auth (`/api/auth`)
Custom routes (handled before the BetterAuth wildcard, see `src/modules/auth/auth.routes.js`):
- `POST /api/auth/register` : Explicit HOSTEL_MANAGER signup **(Public)**
- `POST /api/auth/sign-up/email` : Create an account (starts as STUDENT; see `auth.js`) **(Public)**
- `POST /api/auth/sign-in/email` : Sign in with email & password **(Public)**
- `POST /api/auth/sign-out` : Sign out **(Public)**

All other `/api/auth/*` paths (session lookup, etc.) are handled by the **BetterAuth** node handler directly. Microsoft SSO has been officially removed; all users authenticate via local email/password.
