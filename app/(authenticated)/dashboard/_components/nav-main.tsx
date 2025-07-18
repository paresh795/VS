"use client"

import {
  CreditCard,
  History,
  Home,
  Plus,
  HelpCircle,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Main navigation items
const items = [
  {
    title: "Main Actions",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
      },
      {
        title: "New Session",
        url: "/dashboard/new",
        icon: Plus,
      },
      {
        title: "History",
        url: "/dashboard/history",
        icon: History,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        title: "Credits",
        url: "/dashboard/credits",
        icon: CreditCard,
      },
      {
        title: "Support",
        url: "/dashboard/support",
        icon: HelpCircle,
      },
    ],
  },
]

export function NavMain() {
  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
      <SidebarMenu>
            {group.items.map((item) => (
          <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                    </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
      ))}
    </>
  )
}
