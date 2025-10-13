/**
 * Test different array parameter formats
 */
import fetch from 'node-fetch';

const BEEPER_API_URL = "https://beeper.bywave.com.au";
const BEEPER_TOKEN = "746af626-4909-4196-b659-06dc2a52b767";

async function testArrayFormats() {
  console.log("🧪 Testing different array parameter formats\n");

  // Get first chat
  const chatsResponse = await fetch(
    `${BEEPER_API_URL}/v0/search-chats?limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${BEEPER_TOKEN}`,
      },
    }
  );
  const chatsData = await chatsResponse.json();
  const chat = chatsData.items[0];
  const chatId = chat.id;

  console.log(`Testing with chat: ${chat.title}`);
  console.log(`Chat ID: ${chatId}\n`);

  const formats = [
    // Format 1: chatIDs[]=value
    `chatIDs[]=${encodeURIComponent(chatId)}&limit=3`,
    // Format 2: chatIDs=value (repeated - but we only have one)
    `chatIDs=${encodeURIComponent(chatId)}&limit=3`,
    // Format 3: JSON string
    `chatIDs=${encodeURIComponent(JSON.stringify([chatId]))}&limit=3`,
  ];

  for (let i = 0; i < formats.length; i++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`Test ${i + 1}: ${formats[i].substring(0, 60)}...`);
    console.log(`${'─'.repeat(80)}`);

    try {
      const messagesResponse = await fetch(
        `${BEEPER_API_URL}/v0/search-messages?${formats[i]}`,
        {
          headers: {
            'Authorization': `Bearer ${BEEPER_TOKEN}`,
          },
        }
      );

      const messagesData = await messagesResponse.json();

      if (messagesData.items && messagesData.items.length > 0) {
        console.log(`✅ SUCCESS! Got ${messagesData.items.length} messages`);
        console.log(`First message ID: ${messagesData.items[0].id}`);
        console.log(`First message from: ${messagesData.items[0].senderName}`);
        console.log(`Text: "${messagesData.items[0].text?.substring(0, 40) || '(no text)'}..."\n`);
      } else if (messagesData.error) {
        console.log(`❌ Error: ${messagesData.error.message}\n`);
      } else {
        console.log(`⚠️  No messages, no error\n`);
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}\n`);
    }
  }
}

testArrayFormats().catch(console.error);

