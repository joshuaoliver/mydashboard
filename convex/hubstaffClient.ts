/**
 * Hubstaff API Client
 * 
 * Ported from transdirect-pm/hubstaff-api.js
 * Uses fetch instead of Node.js https module
 */

const HUBSTAFF_API_BASE = "https://api.hubstaff.com/v2";
const HUBSTAFF_TOKEN_URL = "https://account.hubstaff.com/access_tokens";

export interface HubstaffUser {
  id: number;
  name: string;
  email?: string;
  time_zone?: string;
  status?: string;
}

export interface HubstaffProject {
  id: number;
  name: string;
  status?: string;
  billable?: boolean;
}

export interface HubstaffTask {
  id: number;
  summary: string;
  project_id?: number;
}

export interface HubstaffActivity {
  id: number;
  user_id: number;
  project_id: number;
  task_id?: number;
  date: string;
  tracked: number;        // Seconds tracked
  overall?: number;       // Overall activity
  keyboard?: number;      // Keyboard seconds
  mouse?: number;         // Mouse seconds
  input_tracked?: number; // Input tracked seconds
  billable?: boolean;
}

export interface HubstaffActivitiesResponse {
  daily_activities?: HubstaffActivity[];
  users?: HubstaffUser[];
  projects?: HubstaffProject[];
  tasks?: HubstaffTask[];
}

export interface HubstaffOrganization {
  id: number;
  name: string;
  status?: string;
}

/**
 * Make authenticated request to Hubstaff API
 */
async function makeRequest<T>(
  accessToken: string,
  endpoint: string,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const response = await fetch(`${HUBSTAFF_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Hubstaff API error (${endpoint}):`, error);
    throw new Error(`Hubstaff API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get organizations for the authenticated user
 */
export async function getOrganizations(
  accessToken: string
): Promise<{ organizations: HubstaffOrganization[] }> {
  return makeRequest(accessToken, "/organizations");
}

/**
 * Member object from Hubstaff API - may contain nested user data
 */
interface HubstaffMember {
  id?: number;
  user_id?: number;
  name?: string;
  email?: string;
  user?: {
    id: number;
    name: string;
    email?: string;
  };
}

/**
 * Get users in an organization
 * Note: Hubstaff API returns "members" array, not "users"
 * Members may have user data at top level or nested in a "user" property
 */
export async function getOrganizationUsers(
  accessToken: string,
  organizationId: number
): Promise<{ users: HubstaffUser[] }> {
  const response = await makeRequest<{ members?: HubstaffMember[] }>(
    accessToken,
    `/organizations/${organizationId}/members`
  );
  
  // Transform members to users, handling both nested and flat structures
  const users: HubstaffUser[] = (response.members || [])
    .map((member) => {
      // Try nested user object first, then top-level properties
      const id = member.user?.id ?? member.user_id ?? member.id;
      const name = member.user?.name ?? member.name ?? 'Unknown';
      
      if (id === undefined) {
        console.warn('Hubstaff member missing id:', member);
        return null;
      }
      
      return { id, name };
    })
    .filter((user): user is HubstaffUser => user !== null);
  
  return { users };
}

/**
 * Get projects in an organization
 */
export async function getOrganizationProjects(
  accessToken: string,
  organizationId: number
): Promise<{ projects: HubstaffProject[] }> {
  return makeRequest(accessToken, `/organizations/${organizationId}/projects`);
}

/**
 * Get daily activities with side-loading (users, projects, tasks)
 */
export async function getOrganizationActivities(
  accessToken: string,
  organizationId: number,
  options: {
    startDate: string;
    endDate: string;
    projectIds?: number[];
    userIds?: number[];
    include?: ("users" | "projects" | "tasks")[];
    pageLimit?: number;
  }
): Promise<HubstaffActivitiesResponse> {
  const params = new URLSearchParams();

  // Date parameters
  params.append("date[start]", options.startDate);
  params.append("date[stop]", options.endDate);

  // Filter by projects
  if (options.projectIds?.length) {
    options.projectIds.forEach((id) => params.append("project_ids[]", id.toString()));
  }

  // Filter by users
  if (options.userIds?.length) {
    options.userIds.forEach((id) => params.append("user_ids[]", id.toString()));
  }

  // Include side-loading
  if (options.include?.length) {
    options.include.forEach((item) => params.append("include[]", item));
  }

  // Pagination
  if (options.pageLimit) {
    params.append("page_limit", options.pageLimit.toString());
  }

  const endpoint = `/organizations/${organizationId}/activities/daily?${params.toString()}`;
  return makeRequest(accessToken, endpoint);
}

/**
 * Refresh access token using refresh token
 * Uses OpenID Connect discovery endpoint
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  // Step 1: Get OpenID Connect Discovery configuration
  const discoveryResponse = await fetch(
    "https://account.hubstaff.com/.well-known/openid-configuration"
  );
  
  if (!discoveryResponse.ok) {
    throw new Error("Failed to fetch Hubstaff OIDC configuration");
  }
  
  const discoveryConfig = await discoveryResponse.json();

  // Step 2: Exchange refresh token for access token
  const tokenResponse = await fetch(discoveryConfig.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error("Token refresh failed:", error);
    throw new Error(`Failed to refresh Hubstaff token: ${tokenResponse.status}`);
  }

  return tokenResponse.json();
}
