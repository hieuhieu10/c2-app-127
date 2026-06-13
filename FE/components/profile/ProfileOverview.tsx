import type { Analysis, UserProfile } from "@/lib/types";

export default function ProfileOverview({
  analyses,
  user,
}: {
  analyses: Analysis[];
  user: UserProfile;
}) {
  return (
    <main className="page-content">
      <div className="section-copy">
        <h1>Profile</h1>
        <p>Basic account information and a quick view of your activity.</p>
      </div>

      <section className="profile-layout">
        <div className="profile-card profile-identity">
          <div className="profile-avatar">{user.initials}</div>
          <div className="profile-copy">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <span className="profile-role">{user.role}</span>
        </div>

        <div className="profile-grid">
          <section className="profile-card">
            <span className="eyebrow-label">Account</span>
            <dl className="profile-details">
              <div>
                <dt>Organization</dt>
                <dd>{user.organization}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{user.joinedAt}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Active</dd>
              </div>
            </dl>
          </section>

          <section className="profile-card">
            <span className="eyebrow-label">Activity</span>
            <div className="profile-stats">
              <div>
                <strong>{analyses.length}</strong>
                <span>Processed papers</span>
              </div>
              <div>
                <strong>{Math.round(analyses.reduce((sum, item) => sum + item.overallScore, 0) / analyses.length)}%</strong>
                <span>Average faithfulness</span>
              </div>
              <div>
                <strong>{analyses[0]?.date ?? "-"}</strong>
                <span>Latest analysis</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
