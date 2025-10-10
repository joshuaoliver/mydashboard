#!/usr/bin/env node
/**
 * Test the Download Asset API to see what URLs it returns
 * Does it return HTTP URLs or file:// URLs?
 */

import BeeperDesktop from '@beeper/desktop-api';

const BEEPER_API_URL = 'https://beeper.bywave.com.au';
const BEEPER_TOKEN = '746af626-4909-4196-b659-06dc2a52b767';

async function main() {
  console.log('🧪 TESTING DOWNLOAD ASSET API\n');

  try {
    const client = new BeeperDesktop({
      accessToken: BEEPER_TOKEN,
      baseURL: BEEPER_API_URL,
      maxRetries: 2,
      timeout: 15000,
    });

    // Step 1: Get chats with images
    console.log('━'.repeat(80));
    console.log('STEP 1: Get Image URLs from Chats');
    console.log('━'.repeat(80));

    const response = await client.get('/v0/search-chats', {
      query: { limit: 20 }
    });

    const chatsWithImages = response.items.filter(chat => 
      chat.participants?.items?.some(p => p.imgURL)
    );

    console.log(`✅ Found ${chatsWithImages.length} chats with images\n`);

    // Collect different URL types
    const urlTypes = {
      'file://': [],
      'mxc://': [],
      'localmxc://': [],
      'http://': [],
      'https://': [],
      'other': []
    };

    chatsWithImages.forEach(chat => {
      chat.participants.items.forEach(p => {
        if (p.imgURL) {
          if (p.imgURL.startsWith('file://')) urlTypes['file://'].push(p.imgURL);
          else if (p.imgURL.startsWith('mxc://')) urlTypes['mxc://'].push(p.imgURL);
          else if (p.imgURL.startsWith('localmxc://')) urlTypes['localmxc://'].push(p.imgURL);
          else if (p.imgURL.startsWith('http://')) urlTypes['http://'].push(p.imgURL);
          else if (p.imgURL.startsWith('https://')) urlTypes['https://'].push(p.imgURL);
          else urlTypes['other'].push(p.imgURL);
        }
      });
    });

    console.log('📊 URL Types Found:');
    Object.entries(urlTypes).forEach(([type, urls]) => {
      if (urls.length > 0) {
        console.log(`   ${type.padEnd(15)} → ${urls.length} URLs`);
      }
    });

    // Step 2: Test Download Asset API with file:// URLs
    if (urlTypes['file://'].length > 0) {
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 2: Test Download Asset API with file:// URLs');
      console.log('━'.repeat(80));

      const testURL = urlTypes['file://'][0];
      console.log(`\nTesting with: ${testURL.substring(0, 80)}...\n`);

      try {
        const result = await client.post('/v1/download-asset', {
          body: { url: testURL }
        });

        console.log('API Response:');
        console.log(JSON.stringify(result, null, 2));

        if (result.srcURL) {
          console.log(`\n✅ Got srcURL: ${result.srcURL.substring(0, 100)}...`);
          
          // Check what type of URL we got back
          if (result.srcURL.startsWith('http://') || result.srcURL.startsWith('https://')) {
            console.log('🎉 SUCCESS! Got HTTP URL - browser can access this!');
          } else if (result.srcURL.startsWith('file://')) {
            console.log('⚠️  Still file:// URL - browser cannot access');
          } else {
            console.log(`⚠️  Got different URL type: ${result.srcURL.substring(0, 20)}...`);
          }
        } else if (result.error) {
          console.log(`\n❌ API returned error: ${result.error}`);
        }
      } catch (error) {
        console.log(`\n❌ API call failed: ${error.message}`);
        if (error.status) {
          console.log(`   Status: ${error.status}`);
        }
      }
    }

    // Step 3: Test with mxc:// URLs if we have any
    if (urlTypes['mxc://'].length > 0) {
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 3: Test Download Asset API with mxc:// URLs');
      console.log('━'.repeat(80));

      const mxcURL = urlTypes['mxc://'][0];
      console.log(`\nTesting with: ${mxcURL}\n`);

      try {
        const result = await client.post('/v1/download-asset', {
          body: { url: mxcURL }
        });

        console.log('API Response:');
        console.log(JSON.stringify(result, null, 2));

        if (result.srcURL) {
          console.log(`\n✅ Got srcURL: ${result.srcURL}`);
          
          if (result.srcURL.startsWith('http://') || result.srcURL.startsWith('https://')) {
            console.log('🎉 SUCCESS! Got HTTP URL - browser can access this!');
          } else if (result.srcURL.startsWith('file://')) {
            console.log('⚠️  Still file:// URL - browser cannot access');
          }
        }
      } catch (error) {
        console.log(`\n❌ API call failed: ${error.message}`);
      }
    }

    // Step 4: Test with localmxc:// URLs if we have any
    if (urlTypes['localmxc://'].length > 0) {
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 4: Test Download Asset API with localmxc:// URLs');
      console.log('━'.repeat(80));

      const localMxcURL = urlTypes['localmxc://'][0];
      console.log(`\nTesting with: ${localMxcURL}\n`);

      try {
        const result = await client.post('/v1/download-asset', {
          body: { url: localMxcURL }
        });

        console.log('API Response:');
        console.log(JSON.stringify(result, null, 2));

        if (result.srcURL) {
          console.log(`\n✅ Got srcURL: ${result.srcURL}`);
          
          if (result.srcURL.startsWith('http://') || result.srcURL.startsWith('https://')) {
            console.log('🎉 SUCCESS! Got HTTP URL - browser can access this!');
          } else if (result.srcURL.startsWith('file://')) {
            console.log('⚠️  Still file:// URL - browser cannot access');
          }
        }
      } catch (error) {
        console.log(`\n❌ API call failed: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    if (urlTypes['file://'].length > 0 && 
        (urlTypes['mxc://'].length === 0 && urlTypes['localmxc://'].length === 0)) {
      console.log('\n❌ All images are file:// URLs');
      console.log('   Download Asset API is designed for mxc:// URLs, not file:// URLs');
      console.log('   We need Base64 encoding or file serving solution');
    } else if (urlTypes['http://'].length > 0 || urlTypes['https://'].length > 0) {
      console.log('\n🎉 Some images are already HTTP URLs!');
      console.log('   These can be used directly in the browser');
    } else {
      console.log('\n💡 Results depend on API response - see above');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
  }
}

main().catch(console.error);

