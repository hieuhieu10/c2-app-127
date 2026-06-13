import ProfileOverview from "@/components/profile/ProfileOverview";
import AppHeader from "@/components/layout/AppHeader";
import { getRecentAnalyses } from "@/lib/api/analyses";
import { mockUser } from "@/lib/mock/user.mock";

export default async function ProfilePage() {
  const analyses = await getRecentAnalyses();

  return (
    <div className="app-screen">
      <AppHeader />
      <ProfileOverview analyses={analyses} user={mockUser} />
    </div>
  );
}
