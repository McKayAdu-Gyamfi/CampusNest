export interface ManagerBooking {
  id: string;
  guest: string;
  hostelName: string;
  room: string;
  moveIn: string;
  semester: string;
  paidOn: string;
  amount: string;
  status: "Pending" | "Confirmed" | "Cancelled";
  initials: string;
  color: string;
  refundAmount?: string;
}

// Mock data shared between the bookings list and the cancel/refund detail page,
// so navigating to a specific booking shows that booking's own details.
export const MANAGER_BOOKINGS: ManagerBooking[] = [
  {
    id: "KC-7J14M",
    guest: "Kojo Mensah",
    hostelName: "Dufie Platinum",
    room: "Twin · 118",
    moveIn: "Jan 15, 2026",
    semester: "Spring 2026",
    paidOn: "Dec 5, 2025",
    amount: "5,200",
    status: "Pending",
    initials: "KM",
    color: "bg-[#4A3B32] text-white",
  },
  {
    id: "KC-9P02R",
    guest: "Efua Owusu",
    hostelName: "Tanko",
    room: "Twin · 207",
    moveIn: "Jan 15, 2026",
    semester: "Spring 2026",
    paidOn: "Dec 6, 2025",
    amount: "5,200",
    status: "Pending",
    initials: "EO",
    color: "bg-emerald-600 text-white",
  },
  {
    id: "KC-4B29X",
    guest: "Ama Boateng",
    hostelName: "Dufie Annex",
    room: "Studio · 402B",
    moveIn: "Jan 12, 2026",
    semester: "Spring 2026",
    paidOn: "Dec 2, 2025",
    amount: "8,400",
    status: "Confirmed",
    initials: "AB",
    color: "bg-[#D2BDA7] text-[#5C4538]",
  },
  {
    id: "KC-2M55K",
    guest: "Nana Adjei",
    hostelName: "New Hosanna",
    room: "Single · 305",
    moveIn: "Jan 18, 2026",
    semester: "Spring 2026",
    paidOn: "Dec 8, 2025",
    amount: "7,000",
    status: "Confirmed",
    initials: "NA",
    color: "bg-[#8A79B8] text-white",
  },
  {
    id: "KC-6T88W",
    guest: "Yaw Antwi",
    hostelName: "Dufie Annex",
    room: "Studio · 311",
    moveIn: "Jan 10, 2026",
    semester: "Spring 2026",
    paidOn: "Nov 28, 2025",
    amount: "8,400",
    status: "Cancelled",
    initials: "YA",
    color: "bg-[#8C8279] text-white",
    refundAmount: "8,316",
  },
];
