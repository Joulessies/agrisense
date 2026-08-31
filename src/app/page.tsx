"use client";

import { useStore } from "@/store/useStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

import { DashboardView } from "@/components/views/DashboardView";
import { AlertsView } from "@/components/views/AlertsView";
import { SensorsView } from "@/components/views/SensorsView";

import { AnalyticsView } from "@/components/views/AnalyticsView";
import { DatabaseView } from "@/components/views/DatabaseView";
import { SettingsView } from "@/components/views/SettingsView";
import { UsersView } from "@/components/views/UsersView";

export default function Home() {
  const { currentView } = useStore();

  const renderView = () => {
    switch (currentView) {
      case "dashboard": return <DashboardView />;
      case "sensors": return <SensorsView />;
      case "alerts": return <AlertsView />;
      case "analytics": return <AnalyticsView />;
      case "database": return <DatabaseView />;
      case "settings": return <SettingsView />;
      case "users": return <UsersView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col min-w-0">
        <Header />
        {renderView()}
      </main>
      
      <div id="toastContainer" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none"></div>
    </div>
  );
}
