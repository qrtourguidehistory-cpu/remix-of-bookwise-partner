import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, UserPlus, Users, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RolesPermissionsPage() {
  const { profile, user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "staff">("staff");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeamMembers();
  }, [profile]);

  const loadTeamMembers = async () => {
    if (!profile?.business_id) return;

    try {
      // Get all profiles in this business
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("business_id", profile.business_id);

      if (profilesError) throw profilesError;

      // Get roles for these users
      const userIds = profiles?.map((p) => p.id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Combine data
      const members = profiles?.map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role || "staff",
      }));

      setTeamMembers(members || []);
    } catch (error: any) {
      console.error("Error loading team members:", error);
      toast.error("Error loading team members");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "manager" | "staff") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Role updated successfully");
      loadTeamMembers();
    } catch (error: any) {
      toast.error("Error updating role");
      console.error(error);
    }
  };

  const handleInvite = async () => {
    if (!profile?.business_id || !inviteEmail.trim()) {
      toast.error("Please enter a valid email");
      return;
    }

    setInviting(true);
    try {
      // For now, just show a message
      // In production, you'd call an edge function to send email invitation
      toast.success(`Invitation email would be sent to ${inviteEmail}`);
      toast.info("Email invitations feature requires edge function setup");
      setInviteEmail("");
    } catch (error: any) {
      toast.error("Error sending invitation");
      console.error(error);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("You cannot remove yourself");
      return;
    }

    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("profiles").update({ business_id: null }).eq("id", userId);

      toast.success("Team member removed");
      loadTeamMembers();
    } catch (error: any) {
      toast.error("Error removing team member");
      console.error(error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "manager":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Roles & Permissions</h2>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="team" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="invite">Invite</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : teamMembers.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No team members yet</h3>
                <p className="text-sm text-muted-foreground">
                  Invite team members to get started
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <Card key={member.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold">{member.full_name || "Unnamed User"}</h3>
                        {member.id === user?.id && (
                          <p className="text-xs text-muted-foreground">(You)</p>
                        )}
                      </div>
                      <Badge className={getRoleBadgeColor(member.role)}>
                        {member.role}
                      </Badge>
                    </div>

                    {member.id !== user?.id && (
                      <div className="flex gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(value: any) => handleRoleChange(member.id, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Permissions Matrix */}
            <Card className="p-4 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Permission Matrix</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-2 font-semibold pb-2 border-b">
                  <div>Permission</div>
                  <div className="text-center">Admin</div>
                  <div className="text-center">Manager</div>
                  <div className="text-center">Staff</div>
                </div>
                {[
                  { label: "Settings", admin: "✓", manager: "✗", staff: "✗" },
                  { label: "Manage Staff", admin: "✓", manager: "✓", staff: "✗" },
                  { label: "View Reports", admin: "✓", manager: "✓", staff: "✗" },
                  { label: "Manage Clients", admin: "✓", manager: "✓", staff: "✓" },
                  { label: "Create Sales", admin: "✓", manager: "✓", staff: "✓" },
                  { label: "View Calendar", admin: "✓", manager: "✓", staff: "Own" },
                ].map((perm) => (
                  <div key={perm.label} className="grid grid-cols-4 gap-2 py-1">
                    <div className="text-muted-foreground">{perm.label}</div>
                    <div className="text-center">{perm.admin}</div>
                    <div className="text-center">{perm.manager}</div>
                    <div className="text-center">{perm.staff}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <UserPlus className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-lg">Invite Team Member</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: any) => setInviteRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access</SelectItem>
                      <SelectItem value="manager">Manager - No settings access</SelectItem>
                      <SelectItem value="staff">Staff - Limited access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleInvite} disabled={inviting} className="w-full">
                  {inviting ? "Sending..." : "Send Invitation"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  An invitation email will be sent with instructions to join your business
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
