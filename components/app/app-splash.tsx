import Image from "next/image";

export function AppSplash() {
  return (
    <div
      role="status"
      aria-label="Loading Duti"
      className="flex min-h-svh w-full items-center justify-center bg-background"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-125 rounded-full bg-primary/15 blur-2xl motion-safe:animate-pulse"
        />
        <Image
          src="/icons/android-chrome-192x192.png"
          alt=""
          width={80}
          height={80}
          priority
          className="relative z-10 size-20 rounded-[1.25rem] shadow-sm ring-1 ring-foreground/10"
        />
      </div>
    </div>
  );
}
