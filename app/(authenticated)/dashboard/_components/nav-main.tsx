"use client"

import {
  CreditCard,
  Settings2,
  Upload,
  Zap,
  TestTube,
  Bug,
  ChevronRight,
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
    title: "Virtual Staging",
    items: [
      {
        title: "New Staging",
        url: "/dashboard/staging",
        icon: Upload,
      },
      {
        title: "Upload Test",
        url: "/dashboard/upload-test",
        icon: TestTube,
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
        title: "Billing",
        url: "/dashboard/billing",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Debug",
    items: [
      {
        title: "Auth Debug",
        url: "/dashboard/auth-debug",
        icon: Bug,
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
