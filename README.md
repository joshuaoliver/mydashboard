# Personal Dashboard

A modern personal dashboard built with TanStack Start, Convex, and Shadcn/ui.

## 🚀 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (Beta) - Full-stack React framework with SSR, streaming, and type safety
- **Backend**: [Convex](https://convex.dev) - Real-time database with built-in authentication
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com) - Beautiful, accessible components built on Tailwind CSS and Radix UI
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) - Latest version with enhanced performance
- **Icons**: [Lucide React](https://lucide.dev) - Beautiful SVG icon library

## 🏗️ Project Structure

```
mydashboard/
├── src/
│   ├── components/
│   │   ├── ui/           # Shadcn/ui components
│   │   └── layout/       # Layout components
│   ├── routes/           # File-based routing
│   ├── styles/           # Global styles with Tailwind
│   └── lib/              # Utility functions
├── convex/               # Backend functions and schema
└── public/               # Static assets
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd mydashboard
   npm install
   ```

2. **Set up Convex**:
   ```bash
   npm run dev
   ```
   This will start both the frontend and Convex backend. On first run, it will:
   - Set up a Convex project (login with GitHub when prompted)
   - Deploy your backend functions
   - Start the dev server at http://localhost:3000

### Development Commands

- `npm run dev` - Start development server with Convex (dev deployment)
- `npm run dev:prod` - Start development server connected to production deployment
- `npm run build` - Build for production
- `npm run format` - Format code with Prettier
- `npm run setup:deployments` - Configure multiple Convex deployments (one-time setup)

### Switching Between Dev and Production Deployments

This project supports running locally against either your **dev** or **production** Convex deployment:

```bash
# Use dev deployment (default - safe for development)
npm run dev

# Use production deployment (⚠️ affects live data!)
npm run dev:prod
```

**First time setup:**
```bash
# Configure your deployments (one-time)
npm run setup:deployments
source ~/.zshrc
```

**How it works:**
- `npm run dev` connects to: `https://posh-starfish-269.convex.cloud` (dev)
- `npm run dev:prod` connects to: `https://quick-bear-158.convex.cloud` (prod)

**Additional commands:**
```bash
npm run deployments        # List all deployments
npm run verify:deployments # Check configuration
npm run switch:dev         # Manually switch to dev
npm run switch:prod        # Manually switch to prod
```

⚠️ **Important**: When using `npm run dev:prod`, you're connected to production data. Any mutations or schema changes will affect your live deployment.

See the [Convex Deployments Guide](./docs/CONVEX_DEPLOYMENTS.md) for detailed documentation.

## 🎯 Features

### Current Features

- ✅ Modern dashboard layout with sidebar navigation
- ✅ Real-time data synchronization with Convex
- ✅ Beautiful UI components with Shadcn/ui
- ✅ Responsive design with Tailwind CSS
- ✅ Type-safe API calls between frontend and backend
- ✅ File-based routing with TanStack Router
- ✅ Beeper messaging integration with caching
- ✅ Dex CRM contact sync
- ✅ Prompts library for AI workflows

### Planned Features

- 🔄 User authentication (login/signup)
- 🔄 **AI Chat Assistant** - Conversational AI interface ([See AI Integration Guide](./docs/AI_ELEMENTS_SUMMARY.md))
- 🔄 **Smart Reply Suggestions** - AI-powered message replies for Beeper
- 🔄 **Message Summarization** - AI summaries of long conversations
- 🔄 Customizable dashboard widgets
- 🔄 Data source integrations (APIs, files, webhooks)
- 🔄 Personal tools and utilities
- 🔄 Data visualization components
- 🔄 Dark/light theme toggle
- 🔄 Drag-and-drop dashboard customization

## 🛠️ Development

### Adding New Components

Add Shadcn/ui components:
```bash
npx shadcn@latest add [component-name]
```

### Database Schema

The project includes tables for:
- `users` - User authentication (from Convex Auth)
- `dashboardItems` - User's dashboard widgets and tools
- `dataSources` - External data connections
- `numbers` - Demo table for testing

### Backend Functions

Convex functions are in the `convex/` directory:
- `myFunctions.ts` - Demo functions for testing
- `auth.ts` - Authentication setup
- `schema.ts` - Database schema definitions

## 🎨 Customization

### Styling

- Global styles: `src/styles/app.css`
- Tailwind config is handled by the Tailwind v4 plugin
- Shadcn/ui components can be customized by editing files in `src/components/ui/`

### Adding New Routes

Create new files in `src/routes/` following TanStack Router conventions:
- `src/routes/about.tsx` → `/about`
- `src/routes/dashboard/settings.tsx` → `/dashboard/settings`

## 📝 Next Steps

1. **Set up authentication**:
   - Configure OAuth providers in `convex/auth.config.ts`
   - Add login/signup forms
   - Protect routes with authentication

2. **Add data sources**:
   - Create API integrations
   - File upload capabilities
   - Webhook endpoints

3. **Build dashboard tools**:
   - Custom widgets
   - Data visualization
   - Personal utilities

## 🤝 Contributing

This is a personal project, but feel free to use it as a template for your own dashboard!

## 🤖 AI Integration

This project is ready to integrate AI-powered features using [AI SDK Elements](https://ai-sdk.dev/elements/overview).

**Quick Start:**
- 📘 [AI Elements Summary](./docs/AI_ELEMENTS_SUMMARY.md) - Overview and recommendations
- 🚀 [Quick Start Guide](./docs/AI_CHAT_QUICK_START.md) - Build AI chat in 15 minutes
- 💡 [Use Cases](./docs/AI_USE_CASES.md) - 7 practical implementations with code examples
- 📖 [Full Integration Guide](./docs/AI_SDK_ELEMENTS_INTEGRATION.md) - Complete reference

**Recommended first steps:**
1. Add smart reply suggestions to Beeper messages (2-3 hours)
2. Build standalone AI chat interface (4-6 hours)

## 📚 Resources

- [TanStack Start Documentation](https://tanstack.com/start)
- [Convex Documentation](https://docs.convex.dev)
- [Shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [AI SDK Documentation](https://ai-sdk.dev)
- [AI SDK Elements](https://ai-sdk.dev/elements/overview)