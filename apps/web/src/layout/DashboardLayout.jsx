import { Sidebar } from "./Sidebar";

export const DashboardLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#e6d9bd]">
      <Sidebar />
      <main className="lg:pl-[240px] min-h-screen pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
};
