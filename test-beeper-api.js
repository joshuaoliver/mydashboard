#!/usr/bin/env node
/**
 * Beeper API Explorer
 * Tests different endpoints to see what data we can get
 */

const BEEPER_API_URL = 'https://beeper.bywave.com.au';
const BEEPER_TOKEN = '746af626-4909-4196-b659-06dc2a52b767';

// Utility to make API calls
async function callBeeperAPI(endpoint, description) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Testing: ${description}`);
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(`${BEEPER_API_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEEPER_TOKEN}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Pretty print the response
    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Network Error: ${error.message}`);
    return null;
  }
}

// Main test suite
async function main() {
  console.log('🚀 Starting Beeper API Exploration\n');

  // Test 1: Old v0 search endpoint (what we're currently using)
  const v0SearchData = await callBeeperAPI(
    '/v0/search-chats?limit=10',
    'V0 Search Chats (Current Implementation)'
  );

  // Test 2: New v1 list chats endpoint
  const v1ListData = await callBeeperAPI(
    '/v1/chats?limit=10',
    'V1 List Chats (Standard List)'
  );

  // Test 3: V1 search with filters
  const v1SearchData = await callBeeperAPI(
    '/v1/search/chats?limit=10&type=any&unreadOnly=false',
    'V1 Search Chats (With Filters)'
  );

  // Test 4: Get details of a specific chat (if we have one)
  if (v1ListData?.items?.[0]?.id) {
    const firstChatId = v1ListData.items[0].id;
    await callBeeperAPI(
      `/v1/chats/${encodeURIComponent(firstChatId)}`,
      'V1 Retrieve Specific Chat (Get Full Details)'
    );
  }

  // Test 5: Search for group chats specifically
  const v1GroupsData = await callBeeperAPI(
    '/v1/search/chats?limit=10&type=group',
    'V1 Search Chats (Groups Only)'
  );

  // Test 6: Search for single (direct) chats only
  const v1SingleData = await callBeeperAPI(
    '/v1/search/chats?limit=10&type=single',
    'V1 Search Chats (Single/Direct Only)'
  );

  // Test 7: Get unread chats only
  const v1UnreadData = await callBeeperAPI(
    '/v1/search/chats?limit=10&unreadOnly=true',
    'V1 Search Chats (Unread Only)'
  );

  // Test 8: Get archived chats
  const v1ArchivedData = await callBeeperAPI(
    '/v1/search/chats?limit=10&inbox=archive',
    'V1 Search Chats (Archived)'
  );

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY & COMPARISON');
  console.log(`${'='.repeat(80)}\n`);

  console.log('Endpoint Comparison:');
  console.log(`├─ V0 Search: ${v0SearchData ? `✅ ${v0SearchData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`├─ V1 List: ${v1ListData ? `✅ ${v1ListData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`├─ V1 Search: ${v1SearchData ? `✅ ${v1SearchData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`├─ V1 Groups: ${v1GroupsData ? `✅ ${v1GroupsData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`├─ V1 Single: ${v1SingleData ? `✅ ${v1SingleData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`├─ V1 Unread: ${v1UnreadData ? `✅ ${v1UnreadData.items?.length || 0} chats` : '❌ Failed'}`);
  console.log(`└─ V1 Archived: ${v1ArchivedData ? `✅ ${v1ArchivedData.items?.length || 0} chats` : '❌ Failed'}`);

  console.log('\n📝 Key Findings:');
  
  // Check what fields are available
  if (v1ListData?.items?.[0]) {
    const sampleChat = v1ListData.items[0];
    console.log('\n🔑 Available Fields in Chat Object:');
    console.log(Object.keys(sampleChat).join(', '));
    
    console.log('\n👥 Participant Info:');
    if (sampleChat.participants?.items?.[0]) {
      console.log(Object.keys(sampleChat.participants.items[0]).join(', '));
    }
    
    console.log('\n🖼️ Image URLs:');
    console.log(`├─ Chat has imgURL field: ${sampleChat.participants?.items?.[0]?.imgURL ? '✅ YES' : '❌ NO'}`);
    if (sampleChat.participants?.items?.[0]?.imgURL) {
      console.log(`└─ Example: ${sampleChat.participants.items[0].imgURL}`);
    }
    
    console.log('\n📊 Chat Type Info:');
    console.log(`├─ Type: ${sampleChat.type}`);
    console.log(`├─ Network: ${sampleChat.network}`);
    console.log(`└─ Participant Count: ${sampleChat.participants?.total || 0}`);
  }

  console.log('\n✅ API exploration complete!\n');
}

// Run the tests
main().catch(console.error);

