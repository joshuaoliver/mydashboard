#!/usr/bin/env bun
/**
 * Test script for Hubstaff API endpoints
 * Run with: bun scripts/test-hubstaff-api.ts
 * 
 * Requires HUBSTAFF_REFRESH_TOKEN and HUBSTAFF_ORGANIZATION_ID env vars
 * or reads from transdirect-pm config.json
 */

import fs from 'fs';
import path from 'path';

const HUBSTAFF_API_BASE = "https://api.hubstaff.com/v2";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// Try to get config from transdirect-pm or env
async function getConfig(): Promise<{ refreshToken: string; organizationId: number }> {
  // Check env vars first
  if (process.env.HUBSTAFF_REFRESH_TOKEN && process.env.HUBSTAFF_ORGANIZATION_ID) {
    return {
      refreshToken: process.env.HUBSTAFF_REFRESH_TOKEN,
      organizationId: parseInt(process.env.HUBSTAFF_ORGANIZATION_ID),
    };
  }

  // Try to read from transdirect-pm config
  const configPath = path.join(process.env.HOME || '', 'Projects/transdirect-pm/config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    if (config.hubstaff?.refreshToken && config.hubstaff?.organizationId) {
      console.log('✅ Using config from transdirect-pm/config.json');
      return {
        refreshToken: config.hubstaff.refreshToken,
        organizationId: config.hubstaff.organizationId,
      };
    }
  } catch (e) {
    // Config file doesn't exist or can't be read
  }

  throw new Error(
    'No Hubstaff config found. Set HUBSTAFF_REFRESH_TOKEN and HUBSTAFF_ORGANIZATION_ID env vars.'
  );
}

async function getAccessToken(refreshToken: string): Promise<string> {
  console.log('\n🔑 Getting access token...');
  
  // Step 1: Get OpenID Connect Discovery configuration
  const discoveryResponse = await fetch(
    "https://account.hubstaff.com/.well-known/openid-configuration"
  );
  
  if (!discoveryResponse.ok) {
    throw new Error("Failed to fetch Hubstaff OIDC configuration");
  }
  
  const discoveryConfig = await discoveryResponse.json();
  console.log('   Token endpoint:', discoveryConfig.token_endpoint);

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
    console.error("❌ Token refresh failed:", error);
    throw new Error(`Failed to refresh Hubstaff token: ${tokenResponse.status}`);
  }

  const tokens: TokenResponse = await tokenResponse.json();
  console.log('✅ Got access token (expires in', tokens.expires_in, 'seconds)');
  return tokens.access_token;
}

async function testEndpoint(accessToken: string, endpoint: string, description: string) {
  console.log(`\n📡 Testing: ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  const response = await fetch(`${HUBSTAFF_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  
  if (!response.ok) {
    console.log(`❌ Status: ${response.status}`);
    console.log(`   Response: ${text.substring(0, 500)}`);
    return null;
  }

  try {
    const json = JSON.parse(text);
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Response keys: ${Object.keys(json).join(', ')}`);
    return json;
  } catch {
    console.log(`⚠️ Non-JSON response: ${text.substring(0, 200)}`);
    return null;
  }
}

async function main() {
  console.log('🧪 Hubstaff API Test Script');
  console.log('===========================\n');

  try {
    const config = await getConfig();
    console.log(`📋 Organization ID: ${config.organizationId}`);
    
    const accessToken = await getAccessToken(config.refreshToken);

    // Test 1: Get organizations
    const orgs = await testEndpoint(accessToken, '/organizations', 'Get organizations');
    if (orgs?.organizations) {
      console.log(`   Found ${orgs.organizations.length} organization(s):`);
      orgs.organizations.forEach((org: any) => {
        console.log(`     - ${org.name} (ID: ${org.id})`);
      });
    }

    // Test 2: Get members (without include)
    const membersRaw = await testEndpoint(
      accessToken,
      `/organizations/${config.organizationId}/members`,
      'Get members (raw)'
    );
    if (membersRaw?.members) {
      console.log(`   Found ${membersRaw.members.length} member(s)`);
      console.log(`   First member structure:`, JSON.stringify(membersRaw.members[0], null, 2));
    }

    // Test 3: Get members with users side-loaded
    const membersWithUsers = await testEndpoint(
      accessToken,
      `/organizations/${config.organizationId}/members?include[]=users`,
      'Get members with users side-loaded'
    );
    if (membersWithUsers) {
      if (membersWithUsers.users) {
        console.log(`   ✅ Side-loaded ${membersWithUsers.users.length} user(s):`);
        membersWithUsers.users.slice(0, 5).forEach((user: any) => {
          console.log(`     - ${user.name} (ID: ${user.id}, email: ${user.email || 'N/A'})`);
        });
        if (membersWithUsers.users.length > 5) {
          console.log(`     ... and ${membersWithUsers.users.length - 5} more`);
        }
      } else {
        console.log(`   ⚠️ No side-loaded users array`);
        console.log(`   Response:`, JSON.stringify(membersWithUsers, null, 2).substring(0, 500));
      }
    }

    // Test 4: Get projects
    const projects = await testEndpoint(
      accessToken,
      `/organizations/${config.organizationId}/projects`,
      'Get projects'
    );
    if (projects?.projects) {
      console.log(`   Found ${projects.projects.length} project(s):`);
      projects.projects.slice(0, 5).forEach((proj: any) => {
        console.log(`     - ${proj.name} (ID: ${proj.id})`);
      });
      if (projects.projects.length > 5) {
        console.log(`     ... and ${projects.projects.length - 5} more`);
      }
    }

    // Test 5: Get activities with side-loading (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const activities = await testEndpoint(
      accessToken,
      `/organizations/${config.organizationId}/activities/daily?date[start]=${dateStr}&date[stop]=${dateStr}&include[]=users&include[]=projects`,
      `Get activities for ${dateStr} with users+projects side-loaded`
    );
    if (activities) {
      console.log(`   Activities: ${activities.daily_activities?.length || 0}`);
      console.log(`   Side-loaded users: ${activities.users?.length || 0}`);
      console.log(`   Side-loaded projects: ${activities.projects?.length || 0}`);
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
