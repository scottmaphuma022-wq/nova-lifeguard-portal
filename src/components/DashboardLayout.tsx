"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Shield,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Bell,
  AlertCircle,
  CheckCircle,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { name: "Policies", href: "/policies", icon: Shield },
  { name: "Claims", href: "/claims", icon: FileText },
  { name: "Payments", href: "/payments", icon: CreditCard },
];

/* ─── Notification type helpers ─── */
type NotifType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  read: boolean;
  created_at: string;
}

const notifStyle: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  info:    { icon: Info,         color: 'text-primary',     bg: 'bg-primary/10'     },
  success: { icon: CheckCircle,  color: 'text-success',     bg: 'bg-success/10'     },
  warning: { icon: AlertCircle,  color: 'text-warning',     bg: 'bg-warning/10'     },
  error:   { icon: AlertCircle,  color: 'text-destructive', bg: 'bg-destructive/10' },
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [username, setUsername] = useState("User");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ── Load profile ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("userprofile").select("username").eq("id", user.id).single()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user]);

  /* ── Load notifications from Supabase ──────────────────────────────── */
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  }, [user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  /* ── Realtime — new notifications arrive instantly ─────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadNotifications]);

  /* ── Close panel on outside click ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate("/"), 2000);
  };

  /* ── Mark all read ─────────────────────────────────────────────────── */
  const markAllRead = async () => {
    if (!user?.id) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  /* ── Dismiss (delete) a single notification ─────────────────────────── */
  const dismissNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /* ── Mark read when panel is opened ────────────────────────────────── */
  const handleOpenNotifPanel = () => {
    setNotifOpen(o => !o);
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
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex bg-muted/30">
      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Logging out securely...</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            {/* Mobile: Logo centred, no hamburger */}
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 ml-auto">

              {/* ─── Notification Bell ─── */}
              <div className="relative" ref={notifRef}>
                <button
                  id="notif-bell-btn"
                  onClick={handleOpenNotifPanel}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-background" />
                  )}
                </button>

                {/* Notification dropdown — fixed width, right-anchored, viewport-safe */}
                {notifOpen && (
                  <div
                    id="notif-panel"
                    className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-1rem)] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                    style={{ transform: "none" }}
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

                    {/* Notification list */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const style = notifStyle[n.type] ?? notifStyle.info;
                          const Icon = style.icon;
                          return (
                            <div
                              key={n.id}
                              className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                                n.read ? "opacity-60" : "bg-muted/30"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                                <Icon className={`w-4 h-4 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold">{n.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                              </div>
                              <button
                                onClick={() => dismissNotif(n.id)}
                                className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer — links to claims for action */}
                    <div className="border-t border-border px-4 py-2.5 text-center">
                      <button
                        onClick={() => { setNotifOpen(false); navigate("/claims"); }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View all activity →
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
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/60 flex items-center justify-around" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: '6px', minHeight: '60px' }}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative"
            >
              {/* Active indicator pill */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div className={`flex items-center justify-center w-9 h-7 rounded-xl transition-colors ${
                active ? 'bg-primary/10' : ''
              }`}>
                <item.icon className={`h-5 w-5 transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <ChatBot />
    </div>
  );
};

export default DashboardLayout;