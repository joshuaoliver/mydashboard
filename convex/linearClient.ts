/**
 * Linear API Client
 * 
 * Uses Linear's GraphQL API
 * Ported from transdirect-pm/linear-api-direct.js
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

export interface LinearUser {
  id: string;
  name: string;
  email?: string;
  displayName?: string;
  isMe?: boolean;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearState {
  id: string;
  name: string;
  type: string; // "backlog" | "unstarted" | "started" | "completed" | "canceled"
  color?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
  dueDate?: string;
  url: string;
  assignee?: {
    id: string;
    name: string;
    email?: string;
  };
  state: {
    id: string;
    name: string;
    type: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
}

export interface LinearWorkspace {
  id: string;
  name: string;
  urlKey: string;
}

/**
 * Make GraphQL request to Linear API
 */
async function makeGraphQLRequest<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Linear API error:", error);
    throw new Error(`Linear API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    console.error("Linear GraphQL errors:", json.errors);
    throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

/**
 * Get the current user (owner of the API key)
 */
export async function getCurrentUser(apiKey: string): Promise<LinearUser> {
  const query = `
    query {
      viewer {
        id
        name
        email
        displayName
      }
    }
  `;

  const data = await makeGraphQLRequest<{ viewer: LinearUser }>(apiKey, query);
  return data.viewer;
}

/**
 * Get workspace info
 */
export async function getWorkspace(apiKey: string): Promise<LinearWorkspace> {
  const query = `
    query {
      organization {
        id
        name
        urlKey
      }
    }
  `;

  const data = await makeGraphQLRequest<{ organization: LinearWorkspace }>(apiKey, query);
  return data.organization;
}

/**
 * Get teams in the workspace
 */
export async function getTeams(apiKey: string): Promise<LinearTeam[]> {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const data = await makeGraphQLRequest<{ teams: { nodes: LinearTeam[] } }>(apiKey, query);
  return data.teams.nodes;
}

/**
 * Get uncompleted issues assigned to the current user
 */
export async function getMyUncompletedIssues(
  apiKey: string,
  options: {
    first?: number;
    teamId?: string;
  } = {}
): Promise<{ issues: LinearIssue[]; hasMore: boolean }> {
  const first = options.first ?? 100;

  const query = `
    query($first: Int!, $teamId: String) {
      issues(
        filter: {
          assignee: { isMe: { eq: true } }
          completedAt: { null: true }
          canceledAt: { null: true }
          ${options.teamId ? 'team: { id: { eq: $teamId } }' : ''}
        }
        first: $first
        orderBy: updatedAt
      ) {
        nodes {
          id
          identifier
          title
          description
          priority
          priorityLabel
          createdAt
          updatedAt
          completedAt
          canceledAt
          dueDate
          url
          assignee {
            id
            name
            email
          }
          state {
            id
            name
            type
          }
          team {
            id
            name
            key
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  `;

  const data = await makeGraphQLRequest<{
    issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean } };
  }>(apiKey, query, { first, teamId: options.teamId });

  return {
    issues: data.issues.nodes,
    hasMore: data.issues.pageInfo.hasNextPage,
  };
}

/**
 * Get issue by ID
 */
export async function getIssueById(
  apiKey: string,
  issueId: string
): Promise<LinearIssue | null> {
  const query = `
    query($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        priority
        priorityLabel
        createdAt
        updatedAt
        completedAt
        canceledAt
        dueDate
        url
        assignee {
          id
          name
          email
        }
        state {
          id
          name
          type
        }
        team {
          id
          name
          key
        }
      }
    }
  `;

  try {
    const data = await makeGraphQLRequest<{ issue: LinearIssue | null }>(
      apiKey,
      query,
      { id: issueId }
    );
    return data.issue;
  } catch {
    return null;
  }
}

/**
 * Get webhook signing secret
 */
export async function getWebhooks(apiKey: string): Promise<{
  id: string;
  url: string;
  enabled: boolean;
}[]> {
  const query = `
    query {
      webhooks {
        nodes {
          id
          url
          enabled
        }
      }
    }
  `;

  const data = await makeGraphQLRequest<{
    webhooks: { nodes: { id: string; url: string; enabled: boolean }[] };
  }>(apiKey, query);

  return data.webhooks.nodes;
}

/**
 * Create a webhook
 */
export async function createWebhook(
  apiKey: string,
  options: {
    url: string;
    teamId?: string;
    resourceTypes: string[];
  }
): Promise<{ id: string; enabled: boolean }> {
  const mutation = `
    mutation($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        success
        webhook {
          id
          enabled
        }
      }
    }
  `;

  const data = await makeGraphQLRequest<{
    webhookCreate: { success: boolean; webhook: { id: string; enabled: boolean } };
  }>(apiKey, mutation, {
    input: {
      url: options.url,
      teamId: options.teamId,
      resourceTypes: options.resourceTypes,
    },
  });

  return data.webhookCreate.webhook;
}
