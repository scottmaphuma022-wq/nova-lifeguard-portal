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
  Menu,
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

            {/* USER MENU */}
            <div className="flex items-center gap-4">
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
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
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
    </div>
  );
};

export default AdminLayout;