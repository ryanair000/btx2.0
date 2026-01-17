"use client";

interface FooterProps {
  disclaimer?: string;
}

export function Footer({
  disclaimer = "Predictions are informational only • Data refreshed hourly • Not a guarantee of match outcome",
}: FooterProps) {
  return (
    <footer className="border-t border-gray-200 mt-16 py-8 text-center text-gray-500 text-sm bg-white">
      <p>{disclaimer}</p>
    </footer>
  );
}
