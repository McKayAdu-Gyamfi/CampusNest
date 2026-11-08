import { useManagerBookings, parseAmount, formatAmount } from "@/data/managerBookings";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Receipt, Clock, ArrowUpRight } from "lucide-react";

export default function ManagerPayouts() {
  const { bookings } = useManagerBookings();
  const confirmed = bookings.filter((b) => b.status === "Confirmed");
  const available = confirmed.reduce((sum, b) => sum + parseAmount(b.amount), 0);
  const transactions = confirmed.map((b) => ({
    desc: `Booking ${b.ref} · ${b.guest}`, date: b.paidOn,
    amount: `+ GHS ${b.amount}`, status: "Completed", type: "deposit",
  }));
  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA]">
      {/* Header */}
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-[#463C38]">Payouts</h1>
        <NotificationsDropdown />
      </div>

      <div className="px-5 lg:px-8 space-y-6 w-full">
         
         <div className="bg-[#A84A1A] rounded-2xl p-6 lg:p-8 shadow-sm text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
               <Receipt className="w-32 h-32" />
            </div>
            <div className="relative z-10">
               <p className="text-[12px] font-bold uppercase tracking-widest text-white/80 mb-2">Available Balance</p>
               <h2 className="text-3xl lg:text-4xl font-extrabold mb-6">GHS {formatAmount(available)}</h2>
               <button className="bg-white text-[#A84A1A] hover:bg-white/90 px-6 py-3 rounded-xl font-bold text-[14px] transition-colors shadow-sm inline-flex items-center space-x-2">
                  <span>Withdraw Funds</span>
                  <ArrowUpRight className="w-4 h-4" />
               </button>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#463C38] mb-5">Recent transactions</h3>
            
            <div className="space-y-4">
               {transactions.length === 0 && <p className="text-sm font-medium text-[#8C8279]">No payments yet.</p>}
               {transactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-[#F0EFEA] last:border-0 last:pb-0">
                     <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'withdrawal' ? 'bg-[#F8F6F3] text-[#463C38]' : 'bg-emerald-50 text-emerald-600'}`}>
                           {t.type === 'withdrawal' ? <ArrowUpRight className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                           <span className="font-bold text-[#463C38] text-[15px]">{t.desc}</span>
                           <span className="text-[12px] font-medium text-[#8C8279] mt-0.5">{t.date}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className={`font-bold text-[15px] ${t.type === 'withdrawal' ? 'text-[#463C38]' : 'text-emerald-600'}`}>{t.amount}</div>
                        <div className="text-[12px] font-medium text-[#8C8279] mt-0.5">{t.status}</div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

      </div>
    </div>
  );
}
