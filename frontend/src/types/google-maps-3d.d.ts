import React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gmp-map-3d": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        center?: string | { lat: number; lng: number; altitude?: number };
        tilt?: number | string;
        heading?: number | string;
        range?: number | string;
        roll?: number | string;
        mode?: "satellite" | "hybrid";
        "default-labels-disabled"?: boolean | string;
        "bounds"?: string;
      };
      "gmp-marker-3d": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        position?: string | { lat: number; lng: number; altitude?: number };
        title?: string;
        altitudeMode?: string;
      };
      "gmp-pin-3d": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "background-color"?: string;
        "border-color"?: string;
        "glyph-color"?: string;
        scale?: number | string;
      };
      "gmp-polyline-3d": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        altitudeMode?: string;
        strokeColor?: string;
        strokeWidth?: number | string;
      };
      "gmp-polygon-3d": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        altitudeMode?: string;
        fillColor?: string;
        strokeColor?: string;
        strokeWidth?: number | string;
      };
    }
  }

  interface Window {
    google?: any;
    initGoogleMaps3D?: () => void;
  }
}

export {};
