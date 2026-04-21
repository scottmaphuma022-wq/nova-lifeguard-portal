"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
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
};

const priorityColors: Record<string, string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-warning/10 text-warning",
  Low: "bg-muted text-muted-foreground",
};

const OfficerDashboard = () => {
  const navigate = useNavigate();

  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [stats, setStats] = useState([
    { title: "Assigned Claims", value: "0", icon: FileText, trend: "", color: "primary" },
    { title: "Pending Review", value: "0", icon: Clock, trend: "", color: "warning" },
    { title: "Completed", value: "0", icon: CheckCircle, trend: "", color: "success" },
    { title: "Missing Docs", value: "0", icon: AlertTriangle, trend: "", color: "destructive" },
  ]);

  // Pagination
  const [page, setPage] = useState(1);

  // FETCH CLAIMS
  const fetchClaims = async () => {
    setLoading(true);

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
        userprofile (
          username
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClaims(data);

      // COMPUTE STATS
      const total = data.length;
      const pending = data.filter(c => c.claim_status === "pending").length;
      const approved = data.filter(c => c.claim_status === "approved").length;
      const missing = data.filter(c => c.document_status === "rejected").length;

      setStats([
        { title: "Assigned Claims", value: String(total), icon: FileText, trend: "", color: "primary" },
        { title: "Pending Review", value: String(pending), icon: Clock, trend: "Action needed", color: "warning" },
        { title: "Completed", value: String(approved), icon: CheckCircle, trend: "Processed", color: "success" },
        { title: "Missing Docs", value: String(missing), icon: AlertTriangle, trend: "Follow up", color: "destructive" },
      ]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  // PAGINATED DATA
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedClaims = claims.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(claims.length / ITEMS_PER_PAGE);

  // PROCESS BUTTON UX
  const handleProcess = (id: string) => {
    setProcessing(true);

    setTimeout(() => {
      setProcessing(false);
      navigate("/novaportal/officer/claims");
    }, 3000);
  };

  return (
    <AdminLayout role="officer">
      <div className="space-y-6 relative">

        {/* PROCESSING OVERLAY */}
        {processing && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-4 animate-pulse">
              <div className="text-lg font-semibold">Processing Request...</div>

              {/* EMAIL ANIMATION */}
              <div className="relative w-64 h-10 overflow-hidden">
                <div className="absolute left-0 animate-[moveRight_3s_linear]">
                  ✉️
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Sending claim data securely...
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims Officer Dashboard</h1>
            <p className="text-muted-foreground">Process and verify assigned insurance claims</p>
          </div>
          <Button onClick={() => navigate("/novaportal/officer/claims")}>
            View All Claims
          </Button>
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

        {/* Claims */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Assigned Claims</CardTitle>
            <CardDescription>Claims awaiting your review</CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">
                Loading claims...
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{claim.claim_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {claim.userprofile?.username} • {claim.claim_reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">KSH {claim.claim_amount}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[claim.claim_status] || ""}`}>
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
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages || 1}
              </span>

              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
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
                <p className="text-sm text-muted-foreground">
                  Verify documents and process claims
                </p>
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
                <p className="text-sm text-muted-foreground">
                  B2C payments for approved claims
                </p>
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