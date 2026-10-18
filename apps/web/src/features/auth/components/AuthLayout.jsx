export const AuthLayout = ({ children, brandPanel }) => (
  <div className="min-h-screen bg-[#e6d9bd] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-noise pointer-events-none" />
    <div className="absolute inset-0 bg-gradient-radial from-amber-900/10 via-transparent to-transparent animate-gradient-shift pointer-events-none" />
    <div className="flex flex-col lg:flex-row w-full max-w-5xl bg-[#e1d4b8] rounded-3xl shadow-2xl overflow-hidden min-h-[700px] border border-white/[0.06] relative z-10">
      {brandPanel}
      <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-[#e6d9bd] relative">
        {children}
      </div>
    </div>
  </div>
);
