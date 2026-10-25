"use client";

import React, { useState } from "react";
import { Shield, FileText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  const currentYear = 2026;

  const [activeModal, setActiveModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <>
      <footer className="w-full bg-black border-t border-white/10 py-6 px-6 sm:px-10 text-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
          {/* Brand & Copyright */}
          <div className="flex flex-wrap items-center gap-2 text-white/70">
            <span className="font-medium text-white tracking-wide">
              {t.footerBrand}
            </span>
            <span>•</span>
            <span>
              &copy; {currentYear} {t.footerBrand}. {t.footerRights}
            </span>
          </div>

          {/* Standard Navigation & Legal Links */}
          <div className="flex items-center flex-wrap gap-5 text-white/80 font-normal">
            <button
              onClick={() => setActiveModal("privacy")}
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs sm:text-sm"
            >
              <Shield className="w-3.5 h-3.5 text-white/60" />
              <span>{t.footerPrivacy}</span>
            </button>

            <button
              onClick={() => setActiveModal("terms")}
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs sm:text-sm"
            >
              <FileText className="w-3.5 h-3.5 text-white/60" />
              <span>{t.footerTerms}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {activeModal === "privacy" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/15 rounded-xl text-white p-7 sm:p-8 max-w-xl w-full relative max-h-[85vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 rtl:left-5 rtl:right-auto p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <Shield className="w-6 h-6" />
              <h3 className="text-xl sm:text-2xl font-normal text-white">
                {t.privacyModalTitle}
              </h3>
            </div>
            <p className="text-white/90 text-sm sm:text-base leading-relaxed mb-6 font-normal whitespace-pre-line">
              {t.privacyModalBody}
            </p>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-normal transition-colors cursor-pointer border border-white/10"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {activeModal === "terms" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/15 rounded-xl text-white p-7 sm:p-8 max-w-xl w-full relative max-h-[85vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 rtl:left-5 rtl:right-auto p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <FileText className="w-6 h-6" />
              <h3 className="text-xl sm:text-2xl font-normal text-white">
                {t.termsModalTitle}
              </h3>
            </div>
            <p className="text-white/90 text-sm sm:text-base leading-relaxed mb-6 font-normal whitespace-pre-line">
              {t.termsModalBody}
            </p>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-normal transition-colors cursor-pointer border border-white/10"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
