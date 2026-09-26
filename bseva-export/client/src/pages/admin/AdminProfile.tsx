import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAdminRole } from "@bseva/config";

function roleLabel(role: string | undefined) {
  if (role === "super_admin") return "Super Admin";
  if (isAdminRole(role)) return "Admin";
  return role || "Admin";
}

export default function AdminProfile() {
  const { user } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground">Your admin account details. Platform configuration is under Settings.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{user?.name || "Admin"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Role:</span> {roleLabel(user?.role)}
            </p>
            {user?.email ? (
              <p>
                <span className="text-muted-foreground">Email:</span> {user.email}
              </p>
            ) : null}
            {user?.phone ? (
              <p>
                <span className="text-muted-foreground">Phone:</span> {user.phone}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
