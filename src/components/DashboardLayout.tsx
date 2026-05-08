"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
  Bell,
  AlertCircle,
  CheckCircle,
  Shield,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Logo from "@/components/Logo";
import ChatBot from "@/components/ChatBot";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Claims", href: "/claims", icon: FileText },
  { name: "Payments", href: "/payments", icon: CreditCard },
];

/* ─── Mock notifications ─── */
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    title: "Action Required",
    body: "Claim CLM-2024-0003 requires additional documents.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: 2,
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
    title: "Payment Successful",
    body: "Payment of KES 1,500 was received. Thank you!",
    time: "1 day ago",
    read: false,
  },
  {
    id: 3,
    icon: Shield,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Policy Active",
    body: "Your policy POL-2024-001256 is now active.",
    time: "3 days ago",
    read: true,
  },
  {
    id: 4,
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
    title: "Claim Approved",
    body: "Claim CLM-2024-0002 has been approved.",
    time: "5 days ago",
    read: true,
  },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [username, setUsername] = useState("User");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 🔹 FETCH USERNAME FROM SUPABASE
  const fetchProfile = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("userprofile")
      .select("username")
      .eq("id", user.id)
      .single();

    if (data?.username) {
      setUsername(data.username);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 🔹 LOGOUT WITH UX LOADING
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  const markAllRead = () => {
    setNotifications((n) => n.map((item) => ({ ...item, read: true })));
  };

  const dismissNotif = (id: number) => {
    setNotifications((n) => n.filter((item) => item.id !== id));
  };

  const isActive = (href: string) => location.pathname === href;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* 🔹 LOGOUT LOADING OVERLAY */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Logging out securely...
            </p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="lg:hidden">
              <Logo size="sm" />
            </div>

            {/* Right: Notifications + User Menu */}
            <div className="flex items-center gap-2">
              
              {/* ─── Notification Bell ─── */}
              <div className="relative" ref={notifRef}>
                <button
                  id="notif-bell-btn"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-background" />
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {notifOpen && (
                  <div
                    id="notif-panel"
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">Notifications</p>
                        {unreadCount > 0 && (
                          <Badge className="bg-destructive text-white text-[10px] h-4 px-1.5 rounded-full">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={markAllRead}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Mark all read
                      </button>
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 relative transition-colors ${
                              n.read ? "opacity-60 bg-transparent" : "bg-muted/30"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.bg}`}>
                              <n.icon className={`w-4 h-4 ${n.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">{n.time}</p>
                            </div>
                            <button
                              onClick={() => dismissNotif(n.id)}
                              className="shrink-0 text-muted-foreground hover:text-foreground mt-1 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border px-4 py-2.5 text-center">
                      <button className="text-xs text-primary hover:underline font-medium">
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── User Dropdown ─── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:inline font-medium text-sm">
                      {username}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <ChatBot />
    </div>
  );
};

export default DashboardLayout;