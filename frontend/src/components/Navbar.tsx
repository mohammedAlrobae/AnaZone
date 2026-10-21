"use client";

import React, { useState } from "react";
import { Mail, Info, X, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Navbar() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { language, toggleLanguage, t } = useI18n();

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-50 bg-black border-b border-white/10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo / Brand Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-normal text-sm">
              A
            </div>
            <span className="text-white font-normal text-lg sm:text-xl tracking-tight">
              {t.brand}
            </span>
          </div>

          {/* Top Bar Navigation: Language Toggle, About & Contact */}
          <nav className="flex items-center gap-5 sm:gap-6">
            {/* Language Switcher Link (EN / AR) */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-white/85 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-sm font-normal"
              title={language === "en" ? "التبديل إلى العربية" : "Switch to English"}
            >
              <Globe className="w-4 h-4 text-white/80" />
              <span>{language === "en" ? "العربية" : "English"}</span>
            </button>

            <button
              onClick={() => setAboutOpen(true)}
              className="flex items-center gap-1.5 text-white/85 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-sm font-normal"
            >
              <Info className="w-4 h-4 text-white/80" />
              <span>{t.about}</span>
            </button>

            <a
              href="mailto:moalrobae@gmail.com"
              className="flex items-center gap-1.5 text-white/85 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-sm font-normal"
            >
              <Mail className="w-4 h-4 text-white/80" />
              <span>{t.contact}</span>
            </a>
          </nav>
        </div>
      </header>

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/15 rounded-xl text-white p-8 max-w-xl w-full relative max-h-[85vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute top-5 right-5 rtl:left-5 rtl:right-auto p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h3 className="text-2xl font-normal text-white mb-4">
              {t.aboutModalTitle}
            </h3>
            <p className="text-white/95 text-sm sm:text-base leading-relaxed mb-6 font-normal whitespace-pre-line">
              {t.aboutModalBody}
            </p>
            <button
              onClick={() => setAboutOpen(false)}
              className="w-full py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-normal transition-colors cursor-pointer border border-white/10"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
