import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addBooking } = useBookings();
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<'momo' | 'card'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);

  const [momoDetails, setMomoDetails] = useState({
    number: "",
    network: "MTN",
    name: user?.name ?? ""
  });

  const summary = location.state || {
    hostelName: "Dufie Annex",
    location: "Berekuso",
    image: "https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&q=80&w=400&h=400",
    roomLabel: "Premium Studio · ensuite",
    price: 8500,
    serviceFee: 150,
    discount: 250,
    returnPath: null,
    returnToHostel: null
  };

  const totalDue = summary.price + (summary.serviceFee || 0) - (summary.discount || 0);

  const handleBack = () => {
    navigate(-1);
  };

  const handleProcessPayment = () => {
    setIsProcessing(true);
    
    // Simulate network delay
    setTimeout(() => {
      // 1. Add booking to global context
      addBooking({
        studentName: user?.name ?? "",
        hostelName: summary.hostelName,
        roomLabel: summary.roomLabel,
        roomNumber: "Rm 402B",
        price: totalDue,
        image: summary.image,
        location: summary.location
      });

      // 2. Navigate to Booking Confirmed
      navigate('/booking-confirmed', { 
        state: { ...summary, totalDue, paymentMethod: selectedMethod === 'momo' ? `MoMo · ${momoDetails.network}` : 'Card', reference: 'KC-4B29X', moveIn: 'Jan 12, 2026' },
        replace: true 
      });
    }, 1500);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F6F3] text-[#463C38] pb-24 md:pb-12 transition-colors font-sans">
      
      {/* Desktop Header */}
      <header className="hidden md:flex px-8 py-6 sticky top-0 z-50 bg-[#F8F6F3]/90 backdrop-blur-md">
        <div className="max-w-[1100px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleBack} className="w-9 h-9 rounded-full flex items-center justify-center text-[#C56A30] hover:bg-[#E5D0BA]/30 transition-colors cursor-pointer -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#3D261B]">Complete your booking</h1>
          </div>
          
          <div className="flex items-center space-x-2 text-sm font-bold text-[#A29A91]">
            <div className="flex items-center">
              <span className="w-6 h-6 rounded-full bg-[#C56A30] text-white flex items-center justify-center text-xs mr-2">1</span>
              <span>Details</span>
            </div>
            <div className="w-8 h-px bg-[#D6CEC4] mx-2" />
            <div className="flex items-center text-[#3D261B]">
              <span className="w-6 h-6 rounded-full bg-[#C56A30] text-white flex items-center justify-center text-xs mr-2">2</span>
              <span>Payment</span>
            </div>
            <div className="w-8 h-px bg-[#D6CEC4] mx-2" />
            <div className="flex items-center opacity-50">
              <span className="w-6 h-6 rounded-full bg-[#E5D0BA] text-[#8C5B4F] flex items-center justify-center text-xs mr-2">3</span>
              <span>Done</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex px-5 py-5 sticky top-0 z-50 bg-[#F8F6F3]/90 backdrop-blur-md items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={handleBack} className="w-10 h-10 rounded-full bg-white border border-[#E5E0D8] shadow-sm flex items-center justify-center text-[#463C38] cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-[#3D261B]">Review & pay</h1>
        </div>
        <div className="flex space-x-1.5 items-center">
          <div className="h-1.5 w-6 bg-[#C56A30] rounded-full" />
          <div className="h-1.5 w-6 bg-[#C56A30] rounded-full" />
          <div className="h-1.5 w-6 bg-[#E5E0D8] rounded-full" />
        </div>
      </header>
      
      <main className="max-w-[1100px] mx-auto px-5 md:px-8 pt-4 md:pt-8 flex flex-col md:flex-row gap-8 lg:gap-12 relative">
        
        {/* Left Column */}
        <div className="flex-1 space-y-8 md:space-y-10 order-2 md:order-1">
          
          {/* Mobile Top Card (Hidden on Desktop) */}
          <div className="md:hidden bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-sm flex items-center space-x-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
              <img src={summary.image} className="w-full h-full object-cover" alt="Selected Room" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#3D261B] text-[17px] leading-tight mb-1">{summary.hostelName}</h3>
              <p className="text-xs font-semibold text-[#8C8279] mb-1.5">{summary.roomLabel}</p>
              <div className="flex items-baseline space-x-1">
                <span className="font-extrabold text-[#3D261B] text-[17px]">GHS {summary.price.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-[#A29A91]">/sem</span>
              </div>
            </div>
          </div>

          {/* Move-in Details */}
          <div className="space-y-4">
            <h3 className="text-[12px] font-extrabold text-[#A29A91] uppercase tracking-widest">Move-in Details</h3>
            <div className="grid grid-cols-2 gap-4 md:gap-5">
               <div className="bg-white border border-[#E5E0D8] shadow-sm p-4 rounded-xl">
                 <p className="text-xs font-semibold text-[#8C8279] mb-1">Move-in date</p>
                 <p className="font-bold text-[#463C38] text-[15px]">Jan 12, 2026</p>
               </div>
               <div className="bg-white border border-[#E5E0D8] shadow-sm p-4 rounded-xl">
                 <p className="text-xs font-semibold text-[#8C8279] mb-1">Semester</p>
                 <p className="font-bold text-[#463C38] text-[15px]">Spring 2026</p>
               </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="text-[12px] font-extrabold text-[#A29A91] uppercase tracking-widest">Payment Method</h3>
            
            <div className="space-y-4">
              
              {/* MoMo Option */}
              <div 
                onClick={() => setSelectedMethod('momo')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedMethod === 'momo' 
                    ? 'border-[#C56A30] bg-[#FFF8F3]' 
                    : 'border-[#E5E0D8] bg-white hover:border-[#D6CEC4]'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-11 h-11 rounded-lg bg-[#FDF3E7] text-[#D47932] font-extrabold text-sm flex items-center justify-center shrink-0">
                    MoMo
                  </div>
                  <div>
                    <h4 className="font-bold text-[#3D261B] text-[15px]">Mobile Money</h4>
                    <p className="text-xs font-medium text-[#8C8279]">{momoDetails.network}{momoDetails.number ? ` · ${momoDetails.number}` : ""}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'momo' ? 'border-[#C56A30] bg-[#C56A30]' : 'border-[#D6CEC4]'}`}>
                  {selectedMethod === 'momo' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>

              {/* Debit/Credit Option */}
              <div 
                onClick={() => setSelectedMethod('card')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedMethod === 'card' 
                    ? 'border-[#C56A30] bg-[#FFF8F3]' 
                    : 'border-[#E5E0D8] bg-white hover:border-[#D6CEC4]'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-11 h-11 rounded-lg bg-[#F6F4F0] text-[#8C5B4F] flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#3D261B] text-[15px]">Debit / credit card</h4>
                    <p className="text-xs font-medium text-[#8C8279]">Visa, Mastercard</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'card' ? 'border-[#C56A30] bg-[#C56A30]' : 'border-[#D6CEC4]'}`}>
                  {selectedMethod === 'card' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>

            </div>

            {/* MoMo Form Sub-section */}
            {selectedMethod === 'momo' && (
              <div className="bg-white border border-[#E5E0D8] shadow-sm rounded-2xl p-5 md:p-6 mt-4 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#463C38] mb-1.5 block">Mobile Money number</label>
                    <Input 
                      value={momoDetails.number}
                      placeholder="e.g. 024 123 4567"
                      onChange={(e) => setMomoDetails({...momoDetails, number: e.target.value})}
                      className="h-11 bg-[#F8F6F3] border-[#E5E0D8] text-[15px] font-medium text-[#463C38]" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#463C38] mb-1.5 block">Network</label>
                      <Input 
                        value={momoDetails.network}
                        onChange={(e) => setMomoDetails({...momoDetails, network: e.target.value})}
                        className="h-11 bg-[#F8F6F3] border-[#E5E0D8] text-[15px] font-medium text-[#463C38]" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#463C38] mb-1.5 block">Account name</label>
                      <Input 
                        value={momoDetails.name}
                        onChange={(e) => setMomoDetails({...momoDetails, name: e.target.value})}
                        className="h-11 bg-[#F8F6F3] border-[#E5E0D8] text-[15px] font-medium text-[#463C38]" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Order Breakdown (Hidden on Desktop) */}
          <div className="md:hidden bg-[#F8F6F3] border-t border-b border-[#E5E0D8] mx-[-20px] px-5 py-6 space-y-3 mt-6 mb-24">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[#8C8279] font-medium">Room · semester</span>
              <span className="font-semibold text-[#463C38]">GHS {summary.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[#8C8279] font-medium">Service fee</span>
              <span className="font-semibold text-[#463C38]">GHS {summary.serviceFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[#137333] font-medium">Early-bird discount</span>
              <span className="font-semibold text-[#137333]">− GHS {summary.discount.toLocaleString()}</span>
            </div>
            <div className="h-px bg-[#E5E0D8] my-3 w-full" />
            <div className="flex justify-between items-end">
              <span className="font-extrabold text-[#3D261B] text-[16px]">Total due</span>
              <span className="font-extrabold text-[#3D261B] text-2xl tracking-tight leading-none">GHS {totalDue.toLocaleString()}</span>
            </div>
          </div>
          
        </div>

        {/* Right Column (Desktop Order Summary) */}
        <div className="hidden md:block w-[380px] shrink-0 order-1 md:order-2">
          <div className="sticky top-[120px]">
            <div className="bg-white border border-[#E5E0D8] shadow-lg shadow-black/5 rounded-3xl p-7">
              
              <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-[#E5E0D8]/60">
                <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shrink-0">
                  <img src={summary.image} className="w-full h-full object-cover" alt="Selected Room" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#3D261B] text-lg leading-tight mb-0.5">{summary.hostelName}</h3>
                  <p className="text-[13px] font-semibold text-[#8C8279] mb-2">{summary.roomLabel}</p>
                  <span className="bg-[#E6F4EA] text-[#137333] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center inline-flex space-x-1 w-fit">
                    <span className="w-1 h-1 rounded-full bg-[#137333]" />
                    <span>AVAILABLE</span>
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 mb-6">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-[#8C8279] font-medium">Room · semester</span>
                  <span className="font-semibold text-[#463C38]">GHS {summary.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-[#8C8279] font-medium">Service fee</span>
                  <span className="font-semibold text-[#463C38]">GHS {summary.serviceFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-[#137333] font-medium">Early-bird discount</span>
                  <span className="font-semibold text-[#137333]">− GHS {summary.discount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8 pt-6 border-t border-[#E5E0D8]/60">
                <span className="font-extrabold text-[#3D261B] text-[16px]">Total due</span>
                <span className="font-extrabold text-[#3D261B] text-[28px] tracking-tight leading-none">GHS {totalDue.toLocaleString()}</span>
              </div>

              <button 
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="w-full bg-[#C56A30] hover:bg-[#B85822] text-white font-extrabold py-4 rounded-full shadow-md flex justify-center items-center transition-all text-[16px] cursor-pointer"
              >
                {isProcessing ? "Processing..." : `Pay GHS ${totalDue.toLocaleString()}`}
              </button>
              
              <div className="flex items-center justify-center space-x-1.5 mt-4 text-[11px] font-medium text-[#8C8279]">
                <ShieldCheck className="w-4 h-4" />
                <span>Secure payment · free cancellation before move-in</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Mobile Fixed Bottom Pay Button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E0D8] p-5 pb-8 z-50 rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
         <button 
            onClick={handleProcessPayment}
            disabled={isProcessing}
            className="w-full bg-[#C56A30] active:bg-[#B85822] text-white font-extrabold py-4 rounded-full shadow-md flex justify-center items-center transition-all text-[16px]"
          >
            {isProcessing ? "Processing..." : `Pay GHS ${totalDue.toLocaleString()}`}
          </button>
      </div>

    </div>
  );
}
