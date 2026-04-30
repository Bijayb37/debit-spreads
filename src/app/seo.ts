const fallbackSiteUrl = "https://callculator.app";

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) {
    return fallbackSiteUrl;
  }

  const withProtocol = value.startsWith("http") ? value : `https://${value}`;

  return withProtocol.replace(/\/$/, "");
}

export const siteConfig = {
  name: "Callculator",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  title: "Callculator | Debit Spread Strategy Simulator",
  description:
    "Model debit call spreads, debit put spreads, and long calls across stock price, time, volatility, and capital scenarios.",
  shortDescription:
    "Model option spread outcomes across price, time, volatility, and capital scenarios.",
  keywords: [
    "debit spread calculator",
    "call spread calculator",
    "put spread calculator",
    "options profit calculator",
    "options strategy simulator",
    "option spread payoff",
    "Black Scholes calculator",
    "stock options calculator",
    "options risk reward",
    "options trading tool",
  ],
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}
