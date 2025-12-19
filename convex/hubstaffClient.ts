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
  billable?: number;      // Billable seconds (not boolean)
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
 * Member object from Hubstaff API /members endpoint
 */
interface HubstaffMember {
  user_id: number;
  pay_rate?: number;
  bill_rate?: number;
  role?: string;
  status?: string;
  // When include[]=users is used, user data is side-loaded separately
}

/**
 * Get users in an organization
 * Uses the /members endpoint with include[]=users to side-load user details
 */
export async function getOrganizationUsers(
  accessToken: string,
  organizationId: number
): Promise<{ users: HubstaffUser[] }> {
  // Use members endpoint with users side-loaded
  const response = await makeRequest<{ 
    members?: HubstaffMember[];
    users?: HubstaffUser[];
  }>(
    accessToken,
    `/organizations/${organizationId}/members?include[]=users`
  );
  
  console.log("Hubstaff members response:", JSON.stringify(response, null, 2));
  
  // Users are side-loaded in a separate "users" array
  if (response.users && response.users.length > 0) {
    return { users: response.users };
  }
  
  // Fallback: If no side-loaded users, create entries from member user_ids
  const users: HubstaffUser[] = (response.members || []).map(member => ({
    id: member.user_id,
    name: `User #${member.user_id}`,
  }));
  
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
 * Hubstaff API has a maximum of 31 days per request.
 * This helper splits a date range into chunks of maxDays.
 */
function splitDateRange(
  startDate: string,
  endDate: string,
  maxDays: number = 31
): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let chunkStart = new Date(start);

  while (chunkStart <= end) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);

    // Don't exceed the overall end date
    const actualEnd = chunkEnd > end ? end : chunkEnd;

    chunks.push({
      start: chunkStart.toISOString().split("T")[0],
      end: actualEnd.toISOString().split("T")[0],
    });

    // Move to next chunk
    chunkStart = new Date(actualEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  return chunks;
}

/**
 * Fetch activities for a single date range chunk (max 31 days)
 */
async function fetchActivitiesChunk(
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
 * Get daily activities with side-loading (users, projects, tasks)
 * 
 * Automatically batches requests into 31-day chunks to comply with Hubstaff API limits.
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
  // Split date range into 31-day chunks
  const chunks = splitDateRange(options.startDate, options.endDate, 31);

  if (chunks.length === 1) {
    // Single chunk, no batching needed
    return fetchActivitiesChunk(accessToken, organizationId, options);
  }

  console.log(`Hubstaff: Fetching ${chunks.length} date range chunks (31-day API limit)`);

  // Fetch all chunks and merge results
  const allActivities: HubstaffActivity[] = [];
  const usersMap = new Map<number, HubstaffUser>();
  const projectsMap = new Map<number, HubstaffProject>();
  const tasksMap = new Map<number, HubstaffTask>();

  for (const chunk of chunks) {
    console.log(`Hubstaff: Fetching chunk ${chunk.start} to ${chunk.end}`);
    
    const response = await fetchActivitiesChunk(accessToken, organizationId, {
      ...options,
      startDate: chunk.start,
      endDate: chunk.end,
    });

    // Merge activities
    if (response.daily_activities) {
      allActivities.push(...response.daily_activities);
    }

    // Merge users (dedupe by id)
    if (response.users) {
      response.users.forEach((u) => usersMap.set(u.id, u));
    }

    // Merge projects (dedupe by id)
    if (response.projects) {
      response.projects.forEach((p) => projectsMap.set(p.id, p));
    }

    // Merge tasks (dedupe by id)
    if (response.tasks) {
      response.tasks.forEach((t) => tasksMap.set(t.id, t));
    }
  }

  console.log(`Hubstaff: Merged ${allActivities.length} activities from ${chunks.length} chunks`);

  return {
    daily_activities: allActivities,
    users: Array.from(usersMap.values()),
    projects: Array.from(projectsMap.values()),
    tasks: Array.from(tasksMap.values()),
  };
}

/**
 * Refresh access token using refresh token (Personal Access Token)
 * Uses OpenID Connect discovery endpoint
 * 
 * Note: Hubstaff Personal Access Tokens work like refresh tokens but don't rotate.
 * They're obtained from Hubstaff > Account Settings > Personal Access Tokens.
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
  // For Personal Access Tokens, only grant_type and refresh_token are needed
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
    throw new Error(`Failed to refresh Hubstaff token: ${tokenResponse.status} - ${error}`);
  }

  return tokenResponse.json();
}
