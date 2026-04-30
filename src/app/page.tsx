import DebitCallSpreadLab from "@/components/debit-call-spread-lab";
import { addDaysToIso, dateToIso } from "@/lib/debit-call-spread";
import { absoluteUrl, siteConfig } from "./seo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const todayIso = dateToIso(new Date());
  const defaultExpiryIso = addDaysToIso(todayIso, 60);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    alternateName: "Debit Spread Strategy Simulator",
    url: siteConfig.url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    description: siteConfig.description,
    image: absoluteUrl("/opengraph-image"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "Debit call spread modeling",
      "Debit put spread modeling",
      "Long call modeling",
      "Scenario analysis across stock price, date, volatility, and capital",
      "Saved strategy comparison cards, tables, and matrix views",
      "Black-Scholes option pricing estimates",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <DebitCallSpreadLab
        todayIso={todayIso}
        defaultExpiryIso={defaultExpiryIso}
      />
    </>
  );
}
