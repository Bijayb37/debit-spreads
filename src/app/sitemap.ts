import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "./seo";
import { pagePath, seoPages } from "./seo-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...seoPages.map((page) => ({
      url: absoluteUrl(pagePath(page)),
      lastModified,
      changeFrequency: page.sitemap.changeFrequency,
      priority: page.sitemap.priority,
    })),
  ];
}
