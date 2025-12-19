/**
 * Test script for Linear API
 * Run with: bunx tsx test-linear-api.ts
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

async function makeGraphQLRequest<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  console.log("Making request with query:", query.substring(0, 200) + "...");
  console.log("Variables:", JSON.stringify(variables));

  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  console.log("Response status:", response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error("Linear API error response:", error);
    throw new Error(`Linear API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    console.error("Linear GraphQL errors:", JSON.stringify(json.errors, null, 2));
    throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

async function testGetMyIssues(apiKey: string) {
  console.log("\n=== Testing getMyUncompletedIssues (no teamId) ===\n");

  const first = 10;

  // This is the FIXED query - no $teamId variable when not used
  const query = `
    query($first: Int!) {
      issues(
        filter: {
          assignee: { isMe: { eq: true } }
          completedAt: { null: true }
          canceledAt: { null: true }
        }
        first: $first
        orderBy: updatedAt
      ) {
        nodes {
          id
          identifier
          title
          priority
          priorityLabel
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
    issues: { nodes: any[]; pageInfo: { hasNextPage: boolean } };
  }>(apiKey, query, { first });

  console.log("\n✅ Success! Found", data.issues.nodes.length, "issues");
  
  if (data.issues.nodes.length > 0) {
    console.log("\nFirst few issues:");
    data.issues.nodes.slice(0, 3).forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.identifier}] ${issue.title} (${issue.state.name})`);
    });
  }

  return data.issues.nodes;
}

async function testGetViewer(apiKey: string) {
  console.log("\n=== Testing viewer query ===\n");

  const query = `
    query {
      viewer {
        id
        name
        email
      }
    }
  `;

  const data = await makeGraphQLRequest<{ viewer: { id: string; name: string; email: string } }>(
    apiKey,
    query
  );

  console.log("✅ Logged in as:", data.viewer.name, `(${data.viewer.email})`);
  return data.viewer;
}

async function main() {
  // Get API key from environment or prompt
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("❌ Please set LINEAR_API_KEY environment variable");
    console.log("\nUsage: LINEAR_API_KEY=lin_api_xxx bunx tsx test-linear-api.ts");
    process.exit(1);
  }

  try {
    await testGetViewer(apiKey);
    await testGetMyIssues(apiKey);
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
