-- Enums
CREATE TYPE user_type AS ENUM ('STUDENT', 'HOSTEL_MANAGER', 'ADMIN');
CREATE TYPE room_type AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CHECKED_OUT');
CREATE TYPE complaint_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE amenity_name AS ENUM ('WIFI', 'AIR_CONDITIONING', 'RUNNING_WATER', 'KITCHEN_ACCESS', 'PARKING', 'GYM', 'LAUNDRY', 'STUDY_ROOM', 'RESERVED_1', 'RESERVED_2', 'RESERVED_3');
CREATE TYPE hostel_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ==========================================
-- BETTER AUTH CORE TABLES & CUSTOM FIELDS
-- ==========================================

CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Custom Fields explicitly tracked
    "user_type" user_type NOT NULL DEFAULT 'STUDENT',
    "profile_complete" BOOLEAN DEFAULT FALSE,
    "student_id" TEXT,
    "course" TEXT,
    "current_room_id" UUID, -- Foreign key to ROOM (Added after ROOM table is created)
    "payment_details" TEXT
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
    "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE,
    "updatedAt" TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- BUSINESS TABLES
-- ==========================================

-- Hostel Table (Managed by a HOSTEL_MANAGER or ADMIN)
CREATE TABLE IF NOT EXISTS "HOSTEL" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_name VARCHAR NOT NULL,
    location VARCHAR NOT NULL,
    description TEXT,
    total_rooms INT NOT NULL DEFAULT 0,
    available_rooms INT NOT NULL DEFAULT 0,
    distance_from_campus DECIMAL(5,2),
    manager_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    status hostel_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hostel Images Table
CREATE TABLE IF NOT EXISTS "HOSTEL_IMAGE_URLS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    image_url VARCHAR NOT NULL
);

-- Hostel Amenity Table
CREATE TABLE IF NOT EXISTS "HOSTEL_AMENITY" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    name amenity_name NOT NULL,
    UNIQUE(hostel_id, name)
);

-- Bank Account Table for Hostels
CREATE TABLE IF NOT EXISTS "BANK_ACCOUNT" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR NOT NULL,
    bank_name VARCHAR NOT NULL,
    manager_id TEXT REFERENCES "user"("id") ON DELETE CASCADE,
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Room Table
CREATE TABLE IF NOT EXISTS "ROOM" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR NOT NULL,
    room_type room_type NOT NULL,
    price_per_bed DECIMAL(10,2) NOT NULL,
    capacity INT NOT NULL,
    current_occupancy INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    length DECIMAL(6,2),
    width DECIMAL(6,2),
    height DECIMAL(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add ForeignKey for User's current room now that ROOM exists
ALTER TABLE "user" ADD CONSTRAINT fk_current_room FOREIGN KEY (current_room_id) REFERENCES "ROOM"(id) ON DELETE SET NULL;

-- Room Images Table
CREATE TABLE IF NOT EXISTS "ROOM_IMAGE_URLS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES "ROOM"(id) ON DELETE CASCADE,
    image_url VARCHAR NOT NULL
);

-- Room Tour Scenes Table
CREATE TABLE IF NOT EXISTS "ROOM_TOUR_SCENES" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES "ROOM"(id) ON DELETE CASCADE,
    scene_name VARCHAR NOT NULL,
    scene_config_url VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Room Amenity Table
CREATE TABLE IF NOT EXISTS "ROOM_AMENITY" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES "ROOM"(id) ON DELETE CASCADE,
    name amenity_name NOT NULL,
    UNIQUE(room_id, name)
);

-- Review Table
CREATE TABLE IF NOT EXISTS "REVIEW" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating INT CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    student_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Booking Table
CREATE TABLE IF NOT EXISTS "BOOKING" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_in_date TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status booking_status NOT NULL DEFAULT 'PENDING',
    student_id TEXT REFERENCES "user"("id") ON DELETE CASCADE,
    room_id UUID REFERENCES "ROOM"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Complaint Table
CREATE TABLE IF NOT EXISTS "COMPLAINT" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    status complaint_status NOT NULL DEFAULT 'OPEN',
    student_id TEXT REFERENCES "user"("id") ON DELETE CASCADE,
    hostel_manager_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    hostel_id UUID REFERENCES "HOSTEL"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

