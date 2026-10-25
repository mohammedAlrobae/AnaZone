import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "AnaZone | Docs",
};

export default function DocsPage() {
  return (
    <main className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="flex flex-col items-center justify-center gap-6 max-w-md w-full text-center">
        <div className="relative w-72 sm:w-80 h-72 sm:h-80 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900 flex items-center justify-center">
          <Image
            src="/laughing-cat.gif"
            alt="Docs"
            width={320}
            height={320}
            unoptimized
            priority
            className="w-full h-full object-cover"
          />
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-normal border border-white/20 transition-all hover:scale-105 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to AnaZone</span>
        </Link>
      </div>
    </main>
  );
}
