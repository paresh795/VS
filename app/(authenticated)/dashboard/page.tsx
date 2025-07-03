import { SafeCreditsDisplay } from "@/components/ui/credits-display-safe"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Palette, Upload, Sparkles } from "lucide-react"
import Link from "next/link"

export default function Page() {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual Staging Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Transform your real estate photos with AI-powered staging.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Room Staging
              </CardTitle>
              <Palette className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Ready</div>
              <p className="text-xs text-muted-foreground">
                Stage your rooms with professional furniture
              </p>
              <Button asChild className="w-full mt-3" size="sm">
                <Link href="/dashboard/staging">
                  Start Staging
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Upload Test
              </CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Available</div>
              <p className="text-xs text-muted-foreground">
                Test the complete staging workflow
              </p>
              <Button asChild variant="outline" className="w-full mt-3" size="sm">
                <Link href="/dashboard/upload-test">
                  Try Workflow
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                AI Powered
              </CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Active</div>
              <p className="text-xs text-muted-foreground">
                Latest AI models for best results
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-6">
        <SafeCreditsDisplay />
      </div>
    </div>
  )
}
