/**
 * Hugeicons Integration for shadcn/ui
 *
 * This module provides a convenient way to use Hugeicons in the application.
 * Icons are imported from @hugeicons/core-free-icons and rendered via @hugeicons/react.
 *
 * Usage:
 *   import { Icon, Search01Icon, Menu01Icon } from '~/lib/icons'
 *   <Icon icon={Search01Icon} size={20} />
 */

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

// Re-export commonly used icons from the free icons package
// Note: Icon names follow the pattern from @hugeicons/core-free-icons
export {
  // Navigation & Menu
  Menu01Icon,
  Menu02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MoreHorizontalIcon,
  MoreVerticalIcon,

  // Actions
  Search01Icon,
  Search02Icon,
  Add01Icon,
  Add02Icon,
  AddCircleIcon,
  Delete01Icon,
  Delete02Icon,
  Edit01Icon,
  Edit02Icon,
  Copy01Icon,
  Copy02Icon,
  CheckmarkCircle01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Cancel02Icon,
  RefreshIcon,
  DownloadCircle01Icon,
  Upload01Icon,

  // Communication
  Mail01Icon,
  Mail02Icon,
  MailOpen01Icon,
  Message01Icon,
  Message02Icon,
  MessageAdd01Icon,
  Chatting01Icon,
  Call02Icon,
  Notification01Icon,
  Notification02Icon,

  // User & People
  User02Icon,
  User03Icon,
  UserAdd01Icon,
  UserGroup02Icon,
  UserCircleIcon,
  UserCircle02Icon,
  ContactIcon,
  Contact01Icon,
  Contact02Icon,

  // Settings & System
  Settings01Icon,
  Settings02Icon,
  Settings03Icon,
  Configuration01Icon,
  FilterIcon,
  SortByDown01Icon,
  SortByUp01Icon,

  // Files & Documents
  File01Icon,
  File02Icon,
  FileAddIcon,
  Folder01Icon,
  Folder02Icon,
  FolderAddIcon,
  DocumentCodeIcon,
  Note01Icon,
  Note02Icon,
  Note03Icon,
  NoteEditIcon,

  // Media
  Image01Icon,
  Image02Icon,
  Video01Icon,
  Video02Icon,
  MusicNote01Icon,
  MusicNote02Icon,
  Camera01Icon,
  Camera02Icon,
  Mic01Icon,
  Mic02Icon,

  // Time & Calendar
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  Clock01Icon,
  Clock02Icon,
  Clock03Icon,
  Time01Icon,
  Time02Icon,
  Timer01Icon,
  Timer02Icon,

  // Layout & View
  GridIcon,
  Grid02Icon,
  LayoutIcon,
  Layout01Icon,
  Layout02Icon,
  DashboardSpeed01Icon,
  DashboardSpeed02Icon,
  ViewIcon,
  TableIcon,
  Table01Icon,

  // Status & Info
  InformationCircleIcon,
  AlertCircleIcon,
  AlertDiamondIcon,
  HelpCircleIcon,
  StarIcon,
  StarCircleIcon,

  // Security
  LockIcon,
  LockPasswordIcon,
  ShieldIcon,
  Shield01Icon,
  Shield02Icon,

  // Misc
  Home01Icon,
  Home02Icon,
  Home03Icon,
  LinkIcon,
  Link01Icon,
  Link02Icon,
  ExternalLink,
  AttachmentIcon,
  Attachment01Icon,
  Attachment02Icon,
  PinIcon,
  Pan01Icon,
  Pin02Icon,
  BookmarkIcon,
  Bookmark01Icon,
  Bookmark02Icon,
  TagIcon,
  Tag01Icon,
  Tag02Icon,
  SentIcon,
  Sent02Icon,
  ShareIcon,
  Share01Icon,
  Share02Icon,
  FavouriteIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  EyeIcon,
  ViewOffSlashIcon,
  ZoomIcon,
  ExpanderIcon,
  Maximize01Icon,
  Minimize01Icon,
  FullScreenIcon,

  // Toggle/Switch
  ToggleOnIcon,
  ToggleOffIcon,
  Moon01Icon,
  Moon02Icon,
  Sun01Icon,
  Sun02Icon,
  Sun03Icon,

  // Loading
  Loading01Icon,
  Loading02Icon,
  Loading03Icon,

  // AI & Tech
  AiBrain01Icon,
  AiBrain02Icon,
  CpuIcon,
  CommandIcon,

  // Social & Brands
  Github01Icon,
  GlobeIcon,
  Globe02Icon,
} from "@hugeicons/core-free-icons";

// Type for icon props
export type IconProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  "icon"
>;

// Helper component for rendering icons
export function Icon({
  icon,
  ...props
}: IconProps & { icon: IconSvgElement }) {
  return <HugeiconsIcon icon={icon} {...props} />;
}

// Default export for the Icon component
export default Icon;
