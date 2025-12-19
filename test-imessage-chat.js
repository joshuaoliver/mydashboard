#!/usr/bin/env node
/**
 * Test script to inspect iMessage chat data from Beeper API
 * Run with: node test-imessage-chat.js
 */

import BeeperDesktop from '@beeper/desktop-api';

const BEEPER_API_URL = process.env.BEEPER_API_URL || "https://beeper.bywave.com.au";
const BEEPER_TOKEN = process.env.BEEPER_TOKEN;

if (!BEEPER_TOKEN) {
  console.error("❌ BEEPER_TOKEN environment variable is not set");
  process.exit(1);
}

async function main() {
  console.log("🔍 Testing Beeper API for iMessage chat data...\n");
  
  const client = new BeeperDesktop({
    accessToken: BEEPER_TOKEN,
    baseURL: BEEPER_API_URL,
    timeout: 15000,
  });

  try {
    // Fetch all chats
    const response = await client.chats.list({});
    const chats = response.items || [];
    
    console.log(`📊 Total chats: ${chats.length}\n`);
    
    // Filter for iMessage chats only
    const iMessageChats = chats.filter(chat => 
      chat.network?.toLowerCase().includes('imessage') || 
      chat.accountID?.toLowerCase().includes('imessage')
    );
    
    console.log(`📱 iMessage chats found: ${iMessageChats.length}\n`);
    console.log("=" .repeat(80));
    
    // Show first 5 iMessage chats with full participant data
    for (const chat of iMessageChats.slice(0, 5)) {
      console.log(`\n📨 Chat: ${chat.title}`);
      console.log(`   ID: ${chat.chatId || chat.id}`);
      console.log(`   Network: ${chat.network}`);
      console.log(`   Account ID: ${chat.accountID}`);
      console.log(`   Type: ${chat.type}`);
      console.log(`   Last Activity: ${chat.lastActivity}`);
      
      // Check participants
      if (chat.participants) {
        console.log(`\n   👥 Participants (total: ${chat.participants.total}):`);
        
        for (const p of chat.participants.items || []) {
          console.log(`\n      - ID: ${p.id}`);
          console.log(`        isSelf: ${p.isSelf}`);
          console.log(`        fullName: ${p.fullName || '(none)'}`);
          console.log(`        username: ${p.username || '(none)'}`);
          console.log(`        phoneNumber: ${p.phoneNumber || '(none)'}`);
          console.log(`        email: ${p.email || '(none)'}`);
          console.log(`        imgURL: ${p.imgURL ? '(has image)' : '(no image)'}`);
          console.log(`        cannotMessage: ${p.cannotMessage}`);
        }
      } else {
        console.log(`\n   ⚠️ No participants data!`);
      }
      
      // Check preview
      if (chat.preview) {
        console.log(`\n   💬 Preview:`);
        console.log(`      Text: ${chat.preview.text?.substring(0, 50)}...`);
        console.log(`      Sender: ${chat.preview.isSender ? 'You' : 'Them'}`);
      }
      
      console.log("\n" + "-".repeat(80));
    }
    
    // Compare with Instagram chats
    console.log("\n\n🔄 COMPARISON: Instagram chat sample (for reference):\n");
    
    const instagramChat = chats.find(c => c.network === 'Instagram');
    if (instagramChat) {
      console.log(`📷 Instagram Chat: ${instagramChat.title}`);
      console.log(`   ID: ${instagramChat.chatId || instagramChat.id}`);
      console.log(`   Username: ${instagramChat.participants?.items?.find(p => !p.isSelf)?.username || '(none)'}`);
      console.log(`   Full Name: ${instagramChat.participants?.items?.find(p => !p.isSelf)?.fullName || '(none)'}`);
      console.log(`   Has Image: ${instagramChat.participants?.items?.find(p => !p.isSelf)?.imgURL ? 'Yes' : 'No'}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
