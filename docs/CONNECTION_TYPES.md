# Connection Types

The dashboard supports multi-select connection types for organizing your contacts. These are used in the Dex CRM integration to categorize relationships. You can assign multiple connection types to a single contact.

## Available Connection Types

| Type | Emoji | Description |
|------|-------|-------------|
| **Professional** | 💼 | Work colleagues, business contacts, professional networking connections |
| **Friend** | 👥 | Casual friends, acquaintances |
| **Good friend** | 🤝 | Close friends, trusted relationships |
| **Romantic** | 💝 | Romantic partners, dates, significant others |
| **Intimate** | 😈 | Intimate connections |
| **Other** | ⚙️ | Any other type of relationship that doesn't fit the above categories |

## Usage

Connection types are displayed and edited in the Contact Panel on the right side of the Messages view. They are:

1. **Multi-select**: You can assign multiple connection types to a single contact (e.g., someone can be both "Friend" and "Professional")
2. **Local-only**: These settings are stored in your dashboard and do NOT sync back to Dex
3. **Used for AI context**: The AI reply suggestions use connection types to tailor response style
4. **Visual indicators**: Connection types are shown as grayscale emoji buttons for quick recognition
5. **Toggle behavior**: Click an emoji to toggle that connection type on/off

## Implementation Details

### Database Schema
```typescript
connections: v.optional(v.array(v.string()))
// Can contain any combination of: "Professional", "Friend", "Good friend", "Romantic", "Intimate", "Other"
```

### Component Location
- **UI Component**: `src/components/messages/ContactPanel.tsx`
- **Database Table**: `contacts`
- **API Functions**: `convex/contactMutations.ts`

### API Functions
- `updateContactConnections(contactId, connections)` - Update a contact's connection types (array)
- `toggleConnectionType(contactId, connectionType)` - Toggle a single connection type on/off
- The connection types are automatically passed to AI suggestions for context-aware replies

## Additional Contact Fields

The Contact Panel also includes expandable "More Fields" section with PIN-protected data:

### PIN-Protected Fields
- **Sex**: Male/Female/Not set
- **Private Notes**: Separate from regular notes, requires PIN to view/edit
- **Location**: Select from user-defined locations (managed in Settings > Locations)
- **Intimate Connection**: Yes/no toggle

PIN code: `2020` (hardcoded in frontend)

## Future Enhancements

Potential improvements to connection types:
- Custom connection types (user-defined categories)
- Connection strength/priority levels
- Auto-suggest connection type based on conversation patterns
- Filter messages by connection type

