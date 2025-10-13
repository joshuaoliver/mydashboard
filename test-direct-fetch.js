/**
 * Test using direct fetch with chatIDs array
 */
import fetch from 'node-fetch';

const BEEPER_API_URL = "https://beeper.bywave.com.au";
const BEEPER_TOKEN = "746af626-4909-4196-b659-06dc2a52b767";

async function testDirectFetch() {
  console.log("🧪 Testing /v0/search-messages with direct fetch\n");

  // Get first 2 chats
  const chatsResponse = await fetch(
    `${BEEPER_API_URL}/v0/search-chats?limit=2`,
    {
      headers: {
        'Authorization': `Bearer ${BEEPER_TOKEN}`,
      },
    }
  );
  const chatsData = await chatsResponse.json();
  const chats = chatsData.items || [];

  for (const chat of chats) {
    console.log(`${'━'.repeat(80)}`);
    console.log(`📱 ${chat.title}`);
    console.log(`   Chat ID: ${chat.id}`);
    console.log(`${'━'.repeat(80)}`);

    // Try different ways to pass the array
    const params = new URLSearchParams();
    params.append('chatIDs', chat.id);  // Single value
    params.append('limit', '5');

    console.log(`Trying URL: /v0/search-messages?${params.toString()}\n`);

    const messagesResponse = await fetch(
      `${BEEPER_API_URL}/v0/search-messages?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${BEEPER_TOKEN}`,
        },
      }
    );

    const messagesData = await messagesResponse.json();

    if (messagesData.items && messagesData.items.length > 0) {
      console.log(`✅ Received ${messagesData.items.length} messages\n`);
      messagesData.items.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. ID: ${msg.id} | From: ${msg.senderName}`);
        console.log(`     "${msg.text?.substring(0, 50) || '(no text)'}"...\n`);
      });
    } else if (messagesData.error) {
      console.log(`❌ Error: ${JSON.stringify(messagesData.error, null, 2)}`);
    } else {
      console.log(`⚠️  No messages returned\n`);
    }
  }
}

testDirectFetch().catch(console.error);

