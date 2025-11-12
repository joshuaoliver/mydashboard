# Beeper Media Server

A **secure** local HTTP file server for serving Beeper media files.

## Server Details

- **Port**: 47392
- **URL**: http://localhost:47392/
- **Media Directory**: `/Users/joshuaoliver/Library/Application Support/BeeperTexts/media`
- **Auth Token**: See `beeper-media-config.txt`

## Security Features

- ✅ **Token-based authorization** - All requests require Bearer token
- ✅ **Directory listings DISABLED** - Only specific files can be accessed
- ✅ **Rate limiting** - Max 100 requests per minute per IP
- ✅ **Directory traversal prevention** - Path security enforced
- ✅ **CORS enabled** - Allows requests from any origin (*)
- ✅ **GET-only** - Only GET and OPTIONS methods allowed
- ✅ **Security headers** - X-Frame-Options, X-Content-Type-Options
- ✅ **Access logging** - All requests logged with IP addresses
- ✅ Auto-restart on crashes
- ✅ Process monitoring with PM2

## Usage

### Accessing Files

**⚠️ Important**: All requests require an Authorization header with the Bearer token.

Files are accessible via:
```
http://localhost:47392/local.beeper.com/filename
http://localhost:47392/beeper.com/filename
```

### Authentication Methods

You can authenticate using **either** method:

#### Method 1: Authorization Header (recommended for API calls)

```javascript
const response = await fetch('http://localhost:47392/local.beeper.com/filename', {
  headers: {
    'Authorization': 'Bearer 1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9'
  }
});
const blob = await response.blob();
```

```bash
curl -H "Authorization: Bearer 1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9" \
  http://localhost:47392/local.beeper.com/filename
```

#### Method 2: Query String (easier for direct links/browser/img tags)

```javascript
const url = 'http://localhost:47392/local.beeper.com/filename?token=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9';
const response = await fetch(url);
const blob = await response.blob();
```

```html
<!-- Use directly in img tags -->
<img src="http://localhost:47392/local.beeper.com/filename?token=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9" />
```

```bash
curl "http://localhost:47392/local.beeper.com/filename?token=1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9"
```

### Managing the Server

```bash
# View server status
pm2 status

# View logs
pm2 logs beeper-media-server

# Restart server
pm2 restart beeper-media-server

# Stop server
pm2 stop beeper-media-server

# Start server (if stopped)
pm2 start beeper-media-server

# Delete server
pm2 delete beeper-media-server
```

### Startup on Boot

✅ **AUTO-START IS CONFIGURED!**

The server will automatically start every time your Mac boots up. The configuration is managed by macOS LaunchAgents:

- Launch Agent: `/Users/joshuaoliver/Library/LaunchAgents/pm2.joshuaoliver.plist`
- PM2 will resurrect all saved processes on boot
- The server starts automatically without needing to open Terminal

To disable auto-start:
```bash
pm2 unstartup launchd
```

To re-enable:
```bash
pm2 startup launchd
pm2 save
```

## File Locations

- **Server Script**: `/Users/joshuaoliver/Projects/mydashboard/beeper-media-server.cjs`
- **PM2 Config**: `/Users/joshuaoliver/Projects/mydashboard/beeper-media-server.config.cjs`
- **Logs Directory**: `/Users/joshuaoliver/Projects/mydashboard/logs/`
  - Error logs: `beeper-media-error.log`
  - Output logs: `beeper-media-out.log`

## Example

Access a Beeper media file:
```
http://localhost:47392/local.beeper.com/joshuaoliver_l7FsmrCHl8TxNrcly5oyFGBBf52NgTVVsN7gEgTBKb1vtYaOY6z84QjXLQstxWND
```

## Technical Details

- Built with Node.js `http` module
- Managed by PM2 process manager
- Runs in fork mode (single instance)
- Memory limit: 200MB
- Auto-restart enabled

