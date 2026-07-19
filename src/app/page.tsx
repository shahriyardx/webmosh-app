"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, FileCheck, Sparkles, Code2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingIn, setSigningIn] = useState(false);
  const claimInvite = trpc.freelancers.claimMyInvite.useMutation();
  const claimedRef = useRef(false);

  useEffect(() => {
    if (isPending || !session) return;
    const role = session.user?.role;
    if (role === "admin") {
      router.push("/admin");
      return;
    }
    if (role === "freelancer") {
      router.push("/freelancer");
      return;
    }
    if (claimedRef.current) return;
    claimedRef.current = true;
    // Existing user signing in for the first time after being invited —
    // upgrade their role, then route based on what came back.
    claimInvite.mutate(undefined, {
      onSuccess: (result) => {
        if (result.role === "freelancer") {
          router.push("/freelancer");
        } else {
          router.push("/dashboard");
        }
      },
      onError: () => router.push("/dashboard"),
    });
  }, [session, isPending, router, claimInvite]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    await authClient.signIn.social({ provider: "google" });
  };

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    );
  }

  if (session) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      {/* Left — Brand / Value props (hidden on mobile) */}
      <div className="hidden lg:relative lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:overflow-hidden lg:bg-muted lg:px-16 xl:px-24">
        {/* Brand */}
        <div className="animate-fade-in max-w-xl space-y-2">
          <Image
            src="/logo.png"
            alt="Webmosh"
            width={56}
            height={56}
            className="mb-5 size-14 object-contain"
            priority
          />
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
            Build, launch &amp; grow
            <br />
            <span className="text-sky-500">with confidence</span>
          </h1>
          <p className="pt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
            From professional website design and WordPress development to US LLC
            and UK LTD formation, Webmosh provides complete business solutions
            for entrepreneurs and growing companies.
          </p>
        </div>

        {/* Value props */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {[
            {
              icon: Building2,
              title: "US & UK formation",
              desc: "Register a US LLC or UK LTD with a guided, global-ready process.",
            },
            {
              icon: Code2,
              title: "Website development",
              desc: "WordPress and custom websites for a professional presence.",
            },
            {
              icon: Sparkles,
              title: "Brand & SEO",
              desc: "Strategic brand positioning and on-page SEO to stand out.",
            },
            {
              icon: FileCheck,
              title: "Compliance & tax",
              desc: "Annual renewals, filings, and tax return support.",
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className="group animate-fade-in-up space-y-1.5 rounded-xl border border-border bg-card/20 px-5 py-4 transition-colors hover:border-sky-500/20 hover:bg-sky-500/3"
              style={{ animationDelay: `${200 + i * 100}ms` }}
            >
              <item.icon className="size-4 text-sky-500/70" />
              <h3 className="text-sm font-medium text-foreground">
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <p className="mt-12 text-xs text-muted-foreground/50">
          Trusted by founders —{" "}
          <span className="text-muted-foreground">400+ companies formed</span>
        </p>
      </div>

      {/* Right — Sign-in card */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-16 lg:px-16 xl:px-24">
        {/* Mobile brand hero */}
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <Image
            src="/logo.png"
            alt="Webmosh"
            width={56}
            height={56}
            className="size-14 object-contain"
            priority
          />
          <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Build, launch &amp; grow{" "}
            <span className="text-sky-500">with confidence</span>
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            US &amp; UK formation, website development, brand &amp; SEO, and
            compliance — all in one place.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <Card className="animate-fade-in border-border/60 bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>
                Sign in with your Google account to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                variant="outline"
                className="flex w-full items-center justify-center gap-3"
              >
                <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                  <title>Google</title>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {signingIn ? "Redirecting…" : "Continue with Google"}
              </Button>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground/50">
                By continuing, you agree to our{" "}
                <a
                  href="https://webmosh.com/trams-and-conditions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://webmosh.com/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </CardFooter>
          </Card>

          {/* Mobile trust line */}
          <p className="mt-6 text-center text-xs text-muted-foreground/60 lg:hidden">
            Trusted by founders —{" "}
            <span className="text-muted-foreground">
              400+ companies formed
            </span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out both;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out both;
        }
      `}</style>
    </div>
  );
}
