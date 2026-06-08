"use client";

import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  User,
  LogOut,
  Settings,
  ChevronDown,
  BarChart3,
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

interface AdminLayoutProps {
  children: ReactNode;
  role: "manager" | "officer";
}

const managerNavItems = [
  { name: "Dashboard", href: "/novaportal/manager", icon: LayoutDashboard },
  { name: "Claims", href: "/novaportal/manager/claims", icon: FileText },
  { name: "Analytics", href: "/novaportal/manager/analytics", icon: BarChart3 },
  { name: "Settings", href: "/novaportal/manager/settings", icon: Settings },
];

const officerNavItems = [
  { name: "Dashboard", href: "/novaportal/officer", icon: LayoutDashboard },
  { name: "Claims", href: "/novaportal/officer/claims", icon: FileText },
  { name: "Payments", href: "/novaportal/officer/payments", icon: CreditCard },
];

const AdminLayout = ({ children, role }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ logout removed

  const [adminName, setAdminName] = useState<string>("Admin");

  const navItems = role === "manager" ? managerNavItems : officerNavItems;

  // 🔹 FETCH ADMIN NAME FROM SUPABASE
  const fetchAdminProfile = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("userprofile")
      .select("username, role")
      .eq("id", user.id)
      .single();

    if (data && (data.role === "manager" || data.role === "claims_officer")) {
      setAdminName(data.username);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, [user]);

  // 🔹 LOGOUT (TERMINATE SESSION + REDIRECT)
  const handleLogout = async () => {
    await supabase.auth.signOut(); // terminate session
    navigate("/novaportal"); // redirect
  };

  const isActive = (href: string) => location.pathname === href;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <Link to="/novaportal">
          <Logo size="md" />
        </Link>
        <div className="mt-4 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium inline-block">
          {role === "manager" ? "Manager Portal" : "Claims Officer Portal"}
        </div>
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
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">

            {/* Mobile: show logo, no hamburger */}
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>

            {/* USER MENU */}
            <div className="flex items-center gap-4 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="hidden sm:inline font-medium">
                      {adminName}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate(`/novaportal/${role}/profile`)}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/novaportal/${role}/settings`)}>
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
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/60 flex items-center justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: '6px', minHeight: '60px' }}
      >
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
    </div>
  );
};

export default AdminLayout;