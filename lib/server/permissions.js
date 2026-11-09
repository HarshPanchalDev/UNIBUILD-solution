// Role-based permissions (spec section 2 and 11). Checked on the server for every API call and page.

const STAFF = ["STORE_MANAGER", "OWNER"];
const OWNER = ["OWNER"];

export const PERMISSIONS = {
  "dashboard.view": STAFF,
  "uploads.manage": STAFF,
  "exceptions.manage": STAFF,
  "sites.manage": STAFF,
  "partners.manage": STAFF,
  "links.manage": STAFF,
  "redemptions.manage": STAFF,
  "reports.view": STAFF, // Store Manager: read-only
  "rewards.manage": OWNER,
  "settings.manage": OWNER,
  "staff.manage": OWNER,
  "points.adjust": OWNER,
  "tiers.manage": OWNER,
  "audit.view": OWNER,
};

export function can(role, permission) {
  if (!role) return false;
  return (PERMISSIONS[permission] ?? []).includes(role);
}

export const isStaffRole = (role) => STAFF.includes(role);
