import { ChevronLeft, ChevronRight, Phone, ShieldAlert } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { useManagerBookings, parseAmount, formatAmount, PROCESSOR_FEE_RATE } from "@/data/managerBookings";

export default function ManagerCancelRefund() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { bookings, loaded, cancelAndRefund } = useManagerBookings();
  const { toast } = useToast();
  const booking = bookings.find((b) => b.id === id);

  if (!loaded) {
    return <div className="flex items-center justify-center min-h-screen bg-[#F0EFEA] text-[#8C8279] font-semibold">Loading…</div>;
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0EFEA] gap-4">
        <p className="text-[#463C38] font-bold">Booking not found.</p>
        <button onClick={() => navigate(ROUTES.manager.bookings)} className="text-[#A84A1A] font-bold">Back to bookings</button>
      </div>
    );
  }

  const paid = parseAmount(booking.amount);
  const fee = Math.round(paid * PROCESSOR_FEE_RATE);
  const net = formatAmount(paid - fee);

  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA]">
      {/* Header */}
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 flex items-center space-x-4">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#463C38] hover:bg-[#F8F6F3] transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-[#463C38]">Cancel & refund</h1>
          <p className="text-[#8C8279] text-sm font-medium mt-0.5">Booking {booking.ref} · {booking.guest}</p>
        </div>
        <div className="ml-auto"><NotificationsDropdown /></div>
      </div>

      <div className="px-5 lg:px-8 flex flex-col lg:flex-row gap-6 w-full">
        
        {/* Left Column (Booking Details) */}
        <div className="flex-1 space-y-6">
           <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="w-full h-32 bg-[#E5D0BA] rounded-xl overflow-hidden relative flex items-center justify-center pattern-diagonal-lines pattern-[#C8B09A] pattern-bg-white pattern-size-4 pattern-opacity-40 mb-5">
                 <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-widest text-[#5C4538]">
                    ROOM {booking.room}
                 </div>
              </div>

              <h2 className="text-[17px] font-bold text-[#463C38]">{booking.roomType} · {booking.room}</h2>
              <p className="text-[13px] font-medium text-[#8C8279] mt-0.5 mb-5">{booking.hostelName}</p>

              <div className="space-y-3 border-t border-[#F0EFEA] pt-4">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-[#8C8279] font-medium">Guest</span>
                    <span className="text-[#463C38] font-bold">{booking.guest}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-[#8C8279] font-medium">Move-in</span>
                    <span className="text-[#463C38] font-bold">{booking.moveIn}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-[#8C8279] font-medium">Semester</span>
                    <span className="text-[#463C38] font-bold">{booking.semester}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-[#8C8279] font-medium">Paid on</span>
                    <span className="text-[#463C38] font-bold">{booking.paidOn}</span>
                 </div>
              </div>
           </div>

           <div className="bg-[#F1E8DC]/60 border border-[#C8B09A]/40 rounded-2xl p-5 flex items-start space-x-3">
              <div className="text-[#A84A1A] shrink-0 mt-0.5">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3"/></svg>
              </div>
              <p className="text-[13px] font-medium text-[#5C4538] leading-relaxed">
                 <strong className="font-bold">Free-cancellation window.</strong> Only the payment processor fee is non-refundable.
              </p>
           </div>
        </div>

        {/* Right Column (Form & Breakdown) */}
        <div className="flex-[1.2] space-y-6">
           
           <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm space-y-5">
              <div>
                 <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-2">Reason for cancellation</label>
                 <button className="w-full flex items-center justify-between border border-[#E5E0D8] rounded-xl px-4 py-3.5 text-left focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all group">
                    <span className="text-[14px] font-semibold text-[#463C38]">Student requested cancellation</span>
                    <ChevronRight className="w-4 h-4 text-[#A29A91] group-hover:text-[#463C38] transition-colors" />
                 </button>
              </div>
              <div>
                 <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-2">Note to student (Optional)</label>
                 <textarea 
                    rows={2}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3.5 text-[14px] font-semibold text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all resize-none placeholder:text-[#A29A91] placeholder:font-medium"
                    placeholder="We're sorry to see you go — your refund is on the way."
                 />
              </div>
           </div>

           <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm">
              <h3 className="text-[15px] font-bold text-[#463C38] mb-5">Refund breakdown</h3>
              
              <div className="space-y-3 border-b border-[#F0EFEA] pb-5 mb-5">
                 <div className="flex justify-between text-[14px]">
                    <span className="text-[#8C8279] font-medium">Amount paid</span>
                    <span className="text-[#463C38] font-bold">GHS {booking.amount}</span>
                 </div>
                 <div className="flex justify-between text-[14px]">
                    <span className="text-[#8C8279] font-medium">Cancellation fee retained (0%)</span>
                    <span className="text-[#463C38] font-bold">- GHS 0</span>
                 </div>
                 <div className="flex justify-between text-[14px]">
                    <span className="text-[#8C8279] font-medium">Payment processor fee (1%)</span>
                    <span className="text-[#463C38] font-bold">- GHS {formatAmount(fee)}</span>
                 </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                 <span className="text-[15px] font-bold text-[#463C38]">Net refund</span>
                 <span className="text-xl font-bold text-emerald-600">GHS {net}</span>
              </div>

              <div className="bg-[#F8F6F3] rounded-xl p-4 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#E5D0BA] text-[#A84A1A] rounded-full flex items-center justify-center shrink-0">
                       <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[11px] font-bold text-[#8C8279]">Refund to original method</span>
                       <span className="text-[13px] font-bold text-[#463C38]">Original payment method (Paystack)</span>
                    </div>
                 </div>
                 <span className="text-[12px] font-medium text-[#8C8279]">2-3 days</span>
              </div>
           </div>

           <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start space-x-3">
              <div className="text-red-600 shrink-0 mt-0.5">
                 <ShieldAlert className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-red-800 leading-relaxed">
                 This cancels the booking and frees Room {booking.room}. The refund is issued immediately and can't be undone.
              </p>
           </div>

           <div className="flex items-center space-x-3 pt-2">
              <button onClick={() => navigate(-1)} className="flex-1 bg-white border border-[#E5E0D8] text-[#463C38] hover:bg-[#F8F6F3] px-6 py-3.5 rounded-xl font-bold text-[14px] transition-colors shadow-sm">
                 Keep booking
              </button>
              <button onClick={() => cancelAndRefund(booking.id).then(() => { toast("Booking cancelled."); navigate(ROUTES.manager.bookings); }).catch((e) => toast(errorMessage(e), "error"))} className="flex-[1.5] bg-[#B94431] hover:bg-[#9B3726] text-white px-6 py-3.5 rounded-xl font-bold text-[14px] transition-colors shadow-sm">
                 Cancel & refund GHS {net}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}
