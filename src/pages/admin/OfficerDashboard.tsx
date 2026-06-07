"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, CheckCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const ITEMS_PER_PAGE = 5;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  missing: "bg-destructive/10 text-destructive",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const OfficerDashboard = () => {
  const navigate = useNavigate();

  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [officerId, setOfficerId] = useState<string | null>(null);

  const [stats, setStats] = useState([
    { title: "Assigned Claims", value: "0", icon: FileText, color: "primary" },
    { title: "Pending Review",  value: "0", icon: Clock,     color: "warning" },
    { title: "Completed",       value: "0", icon: CheckCircle, color: "success" },
    { title: "Missing Docs",    value: "0", icon: AlertTriangle, color: "destructive" },
  ]);

  // Pagination
  const [page, setPage] = useState(1);

  /* ─── Core fetch ──────────────────────────────────────────────────────── */
  const fetchClaims = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Resolve officer id once; re-use on realtime updates
      let uid = officerId;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData?.user?.id ?? null;
        if (!uid) { setLoading(false); setRefreshing(false); return; }
        setOfficerId(uid);
      }

      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          claim_number,
          claim_amount,
          claim_status,
          document_status,
          claim_reason,
          created_at,
          officer_id,
          userprofile!claims_user_id_fkey (
            username
          )
        `)
        .eq("officer_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setClaims(data);
        setPage(1); // reset to first page after refresh

        const total   = data.length;
        const pending = data.filter(c => c.claim_status === "pending").length;
        const approved = data.filter(c => c.claim_status === "approved").length;
        const missing = data.filter(c => c.document_status === "rejected").length;

        setStats([
          { title: "Assigned Claims", value: String(total),    icon: FileText,    color: "primary" },
          { title: "Pending Review",  value: String(pending),  icon: Clock,       color: "warning" },
          { title: "Completed",       value: String(approved), icon: CheckCircle, color: "success" },
          { title: "Missing Docs",    value: String(missing),  icon: AlertTriangle, color: "destructive" },
        ]);
      } else if (error) {
        console.error("OfficerDashboard fetch error:", error.message);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [officerId]);

  /* ─── Initial load ────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchClaims();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Realtime subscription — picks up new / updated claims instantly ─── */
  useEffect(() => {
    // Subscribe once we know the officer id
    if (!officerId) return;

    const channel = supabase
      .channel("officer-claims-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",            // INSERT, UPDATE, DELETE
          schema: "public",
          table: "claims",
          filter: `officer_id=eq.${officerId}`,
        },
        () => {
          // Silent refresh — don't show the full spinner on each update
          fetchClaims(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officerId, fetchClaims]);

  /* ─── Refetch when officer navigates back to this tab ─────────────────── */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchClaims(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchClaims]);

  /* ─── Pagination ──────────────────────────────────────────────────────── */
  const startIndex     = (page - 1) * ITEMS_PER_PAGE;
  const paginatedClaims = claims.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalPages      = Math.ceil(claims.length / ITEMS_PER_PAGE);

  /* ─── Process button ──────────────────────────────────────────────────── */
  const handleProcess = (_id: string) => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      navigate("/novaportal/officer/claims");
    }, 3000);
  };

  /* ─── Empty state ─────────────────────────────────────────────────────── */
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <FileText className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-muted-foreground">No claims assigned to you yet</p>
      <p className="text-sm text-muted-foreground/70">New claims will appear here automatically.</p>
    </div>
  );

  return (
    <AdminLayout role="officer">
      <div className="space-y-6 relative">

        {/* PROCESSING OVERLAY */}
        {processing && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-4 animate-pulse">
              <div className="text-lg font-semibold">Processing Request...</div>
              <div className="relative w-64 h-10 overflow-hidden">
                <div className="absolute left-0 animate-[moveRight_3s_linear]">✉️</div>
              </div>
              <p className="text-sm text-muted-foreground">Sending claim data securely...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims Officer</h1>
            <p className="text-muted-foreground">Process and verify assigned insurance claims</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Manual refresh button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchClaims(true)}
              disabled={refreshing}
              aria-label="Refresh claims"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => navigate("/novaportal/officer/claims")}>
              View All Claims
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`w-10 h-10 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Claims list */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Assigned Claims</CardTitle>
              <CardDescription>Claims awaiting your review</CardDescription>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading assigned claims…</p>
              </div>
            ) : claims.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {paginatedClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{claim.claim_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {claim.userprofile?.username} • {claim.claim_reason}
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          {new Date(claim.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">KSH {Number(claim.claim_amount).toLocaleString()}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[claim.claim_status] || "bg-muted text-muted-foreground"}`}>
                          {claim.claim_status}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcess(claim.id)}
                      >
                        Process
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PAGINATION */}
            {claims.length > ITEMS_PER_PAGE && (
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/novaportal/officer/claims")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold">Process Claims</h3>
                <p className="text-sm text-muted-foreground">Verify documents and process claims</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/novaportal/officer/payments")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <h3 className="font-semibold">Process Payments</h3>
                <p className="text-sm text-muted-foreground">B2C payments for approved claims</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ANIMATION STYLE */}
      <style>
        {`
          @keyframes moveRight {
            0% { transform: translateX(0); }
            100% { transform: translateX(220px); }
          }
        `}
      </style>
    </AdminLayout>
  );
};

export default OfficerDashboard;