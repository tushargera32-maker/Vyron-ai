import {
  Brain,
  Bot,
  FolderKanban,
  LayoutDashboard,
  Library,
  MessageSquare,
  Settings,
  User,
  SlidersHorizontal,
  Home,
  MoreHorizontal,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Home", icon: Home, mobile: false },
  { href: "/chat", label: "Chat", icon: MessageSquare, mobile: false },
  { href: "/projects", label: "Projects", icon: FolderKanban, mobile: false },
  { href: "/memory", label: "Memory", icon: Brain, mobile: false },
  { href: "/knowledge", label: "Knowledge", icon: Library, mobile: false },
  { href: "/agents", label: "Agents", icon: Bot, mobile: false },
  { href: "/models", label: "Models", icon: SlidersHorizontal, mobile: false },
  { href: "/usage", label: "Usage", icon: LayoutDashboard, mobile: false },
  { href: "/settings", label: "Settings", icon: Settings, mobile: false },
  { href: "/profile", label: "Profile", icon: User, mobile: false },
];

export const mobilePrimary = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/memory", label: "Memory", icon: Brain },
];

export const mobileMore = [
  { href: "/knowledge", label: "Knowledge", icon: Library },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/models", label: "Models", icon: SlidersHorizontal },
  { href: "/usage", label: "Usage", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Profile", icon: User },
];

export const moreIcon = MoreHorizontal;
