import { getCustomerByUserId } from "@/actions/customers"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import DashboardClientLayout from "./_components/layout-client"

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()

  if (!user) {
    redirect("/login")
  }

  const customer = await getCustomerByUserId(user.id)

  // Temporarily disable pro gate for development/testing
  // TODO: Re-enable when payment system is fully implemented
  // if (!customer || customer.membership !== "pro") {
  //   redirect("/?redirect=dashboard#pricing")
  // }

  const userData = {
    name:
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.username || "User",
    email: user.emailAddresses[0]?.emailAddress || "",
    avatar: user.imageUrl,
    membership: customer?.membership || "free"
  }

  return (
    <DashboardClientLayout userData={userData}>
      {children}
    </DashboardClientLayout>
  )
}
