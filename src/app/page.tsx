import DebitCallSpreadLab from "@/components/debit-call-spread-lab";
import { addDaysToIso, dateToIso } from "@/lib/debit-call-spread";
import type { Metadata } from "next";
import { buildWebApplicationJsonLd, buildWebsiteJsonLd } from "./seo-content";
import { HomeSeoContent } from "./seo-page-components";
import { JsonLd } from "./structured-data";
import { absoluteUrl, siteConfig } from "./seo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.title,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} options strategy calculator preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [absoluteUrl("/twitter-image")],
  },
};

export default function Home() {
  const todayIso = dateToIso(new Date());
  const defaultExpiryIso = addDaysToIso(todayIso, 60);

  return (
    <>
      <JsonLd data={[buildWebApplicationJsonLd(), buildWebsiteJsonLd()]} />
      <DebitCallSpreadLab
        todayIso={todayIso}
        defaultExpiryIso={defaultExpiryIso}
      >
        <HomeSeoContent />
      </DebitCallSpreadLab>
    </>
  );
}
