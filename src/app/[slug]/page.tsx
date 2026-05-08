import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  getSeoPage,
  pagePath,
  pageUrl,
  seoPages,
} from "../seo-content";
import { absoluteUrl, siteConfig } from "../seo";
import { SeoPageArticle, SeoPageShell } from "../seo-page-components";
import { JsonLd } from "../structured-data";

type SeoPageRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return seoPages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: SeoPageRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);

  if (!page) {
    notFound();
  }

  return {
    title: {
      absolute: page.metaTitle,
    },
    description: page.description,
    alternates: {
      canonical: pagePath(page),
    },
    openGraph: {
      type: "website",
      url: pagePath(page),
      siteName: siteConfig.name,
      title: page.metaTitle,
      description: page.description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${page.title} on ${siteConfig.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.description,
      images: [absoluteUrl("/twitter-image")],
    },
  };
}

export default async function SeoRoutePage({ params }: SeoPageRouteProps) {
  const { slug } = await params;
  const page = getSeoPage(slug);

  if (!page) {
    notFound();
  }

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: pageUrl(page),
    description: page.description,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };

  return (
    <>
      <JsonLd data={[webPageJsonLd, buildBreadcrumbJsonLd(page), buildFaqJsonLd(page)]} />
      <SeoPageShell>
        <SeoPageArticle page={page} />
      </SeoPageShell>
    </>
  );
}
