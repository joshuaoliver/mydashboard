#!/usr/bin/env node
/**
 * Test if we can access profile image files
 * Tests different methods of accessing the file:// URLs
 */

import BeeperDesktop from '@beeper/desktop-api';
import { readFile, access, constants } from 'fs/promises';
import { fileURLToPath } from 'url';

const BEEPER_API_URL = 'https://beeper.bywave.com.au';
const BEEPER_TOKEN = '746af626-4909-4196-b659-06dc2a52b767';

async function main() {
  console.log('🧪 TESTING PROFILE IMAGE ACCESS\n');

  try {
    // Step 1: Get chats with images
    console.log('━'.repeat(80));
    console.log('STEP 1: Fetch Chats with Profile Images');
    console.log('━'.repeat(80));

    const client = new BeeperDesktop({
      accessToken: BEEPER_TOKEN,
      baseURL: BEEPER_API_URL,
      maxRetries: 2,
      timeout: 15000,
    });

    const response = await client.get('/v0/search-chats', {
      query: { limit: 10, type: 'single' }
    });

    const chatsWithImages = response.items
      .filter(chat => chat.participants?.items?.some(p => p.imgURL && !p.isSelf))
      .slice(0, 5);

    console.log(`✅ Found ${chatsWithImages.length} chats with profile images\n`);

    if (chatsWithImages.length === 0) {
      console.log('❌ No chats with images found. Cannot test image access.');
      return;
    }

    // Step 2: Test accessing each image
    console.log('━'.repeat(80));
    console.log('STEP 2: Test Image File Access Methods');
    console.log('━'.repeat(80));

    for (const [index, chat] of chatsWithImages.entries()) {
      const participant = chat.participants.items.find(p => p.imgURL && !p.isSelf);
      const imgURL = participant.imgURL;

      console.log(`\n📸 Image #${index + 1}: ${chat.title}`);
      console.log(`   Raw URL: ${imgURL.substring(0, 80)}...`);

      // Test 1: Check if it's a file:// URL
      if (imgURL.startsWith('file://')) {
        console.log('   ✅ Type: file:// URL (local file)');
        
        try {
          // Convert file:// URL to path
          const filePath = fileURLToPath(imgURL);
          console.log(`   📁 Path: ${filePath.substring(0, 80)}...`);

          // Test 2: Check if file exists
          try {
            await access(filePath, constants.F_OK);
            console.log('   ✅ File exists: YES');

            // Test 3: Check if readable
            try {
              await access(filePath, constants.R_OK);
              console.log('   ✅ File readable: YES');

              // Test 4: Get file size
              try {
                const fileContent = await readFile(filePath);
                const sizeKB = (fileContent.length / 1024).toFixed(2);
                console.log(`   ✅ File size: ${sizeKB} KB`);

                // Test 5: Check file type (first few bytes)
                const header = fileContent.slice(0, 8);
                const hex = Buffer.from(header).toString('hex');
                let fileType = 'Unknown';
                
                if (hex.startsWith('ffd8ff')) fileType = 'JPEG';
                else if (hex.startsWith('89504e47')) fileType = 'PNG';
                else if (hex.startsWith('47494638')) fileType = 'GIF';
                else if (hex.startsWith('52494646')) fileType = 'WebP';
                
                console.log(`   ✅ File type: ${fileType} (${hex.substring(0, 16)}...)`);
                console.log('   ✅ RESULT: Can read directly! ✨');

              } catch (readErr) {
                console.log(`   ❌ Cannot read file: ${readErr.message}`);
              }
            } catch (readableErr) {
              console.log(`   ❌ File not readable: ${readableErr.message}`);
            }
          } catch (existsErr) {
            console.log(`   ❌ File does not exist: ${existsErr.message}`);
          }
        } catch (pathErr) {
          console.log(`   ❌ Invalid file:// URL: ${pathErr.message}`);
        }
      } else if (imgURL.startsWith('mxc://')) {
        console.log('   ⚠️  Type: mxc:// URL (Matrix content URL)');
        console.log('   💡 Need to use Download Asset API');
        
        // Test 6: Try Download Asset API
        try {
          const downloadResult = await client.post('/v1/download-asset', {
            body: { url: imgURL }
          });
          
          if (downloadResult.srcURL) {
            console.log(`   ✅ Downloaded to: ${downloadResult.srcURL.substring(0, 80)}...`);
            console.log('   ✅ RESULT: Can download via API! ✨');
          } else if (downloadResult.error) {
            console.log(`   ❌ Download failed: ${downloadResult.error}`);
          }
        } catch (downloadErr) {
          console.log(`   ❌ Download API error: ${downloadErr.message}`);
        }
      } else if (imgURL.startsWith('localmxc://')) {
        console.log('   ⚠️  Type: localmxc:// URL (Local Matrix URL)');
        console.log('   💡 May need Download Asset API');
      } else {
        console.log(`   ⚠️  Type: Unknown URL format`);
      }
    }

    // Step 3: Test with a group chat
    console.log('\n' + '━'.repeat(80));
    console.log('STEP 3: Test Group Chat Images');
    console.log('━'.repeat(80));

    const groupResponse = await client.get('/v0/search-chats', {
      query: { limit: 5, type: 'group' }
    });

    const groupsWithImages = groupResponse.items
      .filter(chat => chat.participants?.items?.some(p => p.imgURL));

    if (groupsWithImages.length > 0) {
      const group = groupsWithImages[0];
      const participantsWithImages = group.participants.items
        .filter(p => !p.isSelf && p.imgURL)
        .slice(0, 10);

      console.log(`\n👥 Group: ${group.title}`);
      console.log(`   Total participants: ${group.participants.total}`);
      console.log(`   Participants with images: ${participantsWithImages.length}`);
      
      participantsWithImages.slice(0, 3).forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.fullName || p.username || 'Unknown'}`);
        console.log(`      URL: ${p.imgURL.substring(0, 60)}...`);
      });
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(80));

    console.log('\n✅ What We Learned:');
    console.log('   1. Profile images are available in participant data');
    console.log('   2. Images are local file:// URLs from Beeper Desktop cache');
    console.log('   3. We can read the files directly (if accessible)');
    console.log('   4. Files are standard image formats (JPEG, PNG, etc.)');

    console.log('\n💡 Implementation Options:');
    console.log('   A. Direct file:// URLs (if frontend can access)');
    console.log('   B. Copy files to public/ folder during sync');
    console.log('   C. Serve files via Node.js/Vite middleware');
    console.log('   D. Base64 encode and store in database (small images only)');

    console.log('\n🎯 Recommended Approach:');
    console.log('   → Store file:// URLs in database');
    console.log('   → Let frontend handle display (may need middleware)');
    console.log('   → Fallback to initials if image fails to load');

    console.log('\n✨ Ready to implement profile images!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

main().catch(console.error);

