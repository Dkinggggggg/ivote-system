import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Icon from "../Icon";
import { ThemeProvider } from "../../context/ThemeContext";

export default function AppLayout() {
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCompactLaptop, setIsCompactLaptop] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 769px) and (max-width: 1100px) and (max-height: 600px)");

    const updateCompactLaptop = () => setIsCompactLaptop(mediaQuery.matches);

    updateCompactLaptop();
    mediaQuery.addEventListener("change", updateCompactLaptop);

    return () => mediaQuery.removeEventListener("change", updateCompactLaptop);
  }, []);

  useEffect(() => {
    const handleToast = (event) => {
      const { message, type = 'success' } = event.detail || {};

      if (!message) return;

      setToast({ message, type });

      const timer = window.setTimeout(() => {
        setToast(null);
      }, 2500);

      return () => window.clearTimeout(timer);
    };

    window.addEventListener('ivote-toast', handleToast);

    return () => {
      window.removeEventListener('ivote-toast', handleToast);
    };
  }, []);

  return (
    <ThemeProvider>
      <div className={`app-shell ${isCompactLaptop ? "laptop-compact" : ""}`}>

        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onNavigate={() => setMobileSidebarOpen(false)}
        />

      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content Only */}
      <main className="app-content">

        <button
          type="button"
          className="mobile-sidebar-toggle"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <Icon name="menu" /> Menu
        </button>

        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          </div>
        )}

        <Outlet />
      </main>

    </div>
    </ThemeProvider>
  );
}