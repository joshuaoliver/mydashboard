/**
 * Test using chatIDs as an array (correct way)
 */
import BeeperDesktop from '@beeper/desktop-api';

const BEEPER_API_URL = "https://beeper.bywave.com.au";
const BEEPER_TOKEN = "746af626-4909-4196-b659-06dc2a52b767";

const client = new BeeperDesktop({
  accessToken: BEEPER_TOKEN,
  baseURL: BEEPER_API_URL,
  maxRetries: 2,
  timeout: 15000,
});

async function testChatIDsArray() {
  console.log("🧪 Testing /v0/search-messages with chatIDs as ARRAY\n");

  // Get first 2 chats
  const chatsResponse = await client.get('/v0/search-chats', {
    query: { limit: 2 }
  });

  const chats = chatsResponse.items || [];

  for (const chat of chats) {
    console.log(`${'━'.repeat(80)}`);
    console.log(`📱 ${chat.title}`);
    console.log(`   Chat ID: ${chat.id}`);
    console.log(`${'━'.repeat(80)}`);

    // Use chatIDs (plural) as array
    const messagesResponse = await client.get('/v0/search-messages', {
      query: {
        chatIDs: [chat.id],  // ARRAY!
        limit: 5
      }
    });

    const messages = messagesResponse.items || [];
    console.log(`✅ Received ${messages.length} messages\n`);

    if (messages.length > 0) {
      console.log(`First 3 messages:`);
      messages.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. ID: ${msg.id} | From: ${msg.senderName}`);
        console.log(`     "${msg.text?.substring(0, 50) || '(no text)'}"...\n`);
      });
    }
  }

  console.log(`${'═'.repeat(80)}`);
  console.log(`✅ If message IDs are DIFFERENT, the fix works!`);
  console.log(`${'═'.repeat(80)}`);
}

testChatIDsArray().catch(console.error);

