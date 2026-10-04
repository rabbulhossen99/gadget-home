import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

export function WelcomeCard() {
  return (
    <Card className="relative overflow-hidden p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarImage src="/admin-avatar.png" alt="Mathew Anderson" />
              <AvatarFallback>MA</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              Welcome back Mathew Anderson!
            </h2>
          </div>

          <div className="mt-8 flex items-center gap-8">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold text-foreground">$2,763</span>
                <ArrowUpRight className="size-5 text-emerald-500" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Today&apos;s Sales</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold text-foreground">39%</span>
                <ArrowUpRight className="size-5 text-emerald-500" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Overall Performance</p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none relative h-40 w-56 shrink-0 self-center md:self-auto">
          <Image
            src="/welcome-illustration.png"
            alt="Welcome illustration"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </Card>
  )
}
