import React, { useState } from "react";
import { FiBell, FiSearch, FiSettings } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import ModeratorSidebar from "./ModeratorSidebar";
import "../../styles/moderator/ModeratorWorkspace.css";

export default function ModeratorWorkspace({
  active,
  title,
  description,
  actions,
  children,
  searchPlaceholder = "Search insights...",
}) {
  const [searchText, setSearchText] = useState("");
  const { user } = useAuth();

  const displayName = user?.fullName || user?.username || "Moderator";

  return (
    <div className="moderator-workspace-page">
      <ModeratorSidebar active={active} />

      <main className="moderator-workspace-main">
        <header className="moderator-workspace-topbar">
          <div className="moderator-workspace-search">
            <FiSearch aria-hidden="true" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="moderator-workspace-tools">
            <button type="button" className="moderator-workspace-icon-btn" aria-label="Notifications">
              <FiBell />
            </button>
            <button type="button" className="moderator-workspace-icon-btn" aria-label="Settings">
              <FiSettings />
            </button>

            <div className="moderator-workspace-user-chip">
              <div>
                <div className="moderator-workspace-user-name">{displayName}</div>
                <div className="moderator-workspace-user-role">Moderator</div>
              </div>
              <div className="moderator-workspace-avatar">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <section className="moderator-workspace-header">
          <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="moderator-workspace-header-actions">{actions}</div> : null}
        </section>

        {children}
      </main>
    </div>
  );
}
