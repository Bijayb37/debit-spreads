import { absoluteUrl, siteConfig } from "./seo";

type ChangeFrequency = "weekly" | "monthly" | "yearly";

export type SeoFaq = {
  question: string;
  answer: string;
};

type DetailSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

type Example = {
  heading: string;
  body: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

export type SeoPage = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  updated: string;
  sections: DetailSection[];
  steps?: string[];
  example?: Example;
  faqs: SeoFaq[];
  relatedSlugs: string[];
  sitemap: {
    priority: number;
    changeFrequency: ChangeFrequency;
  };
};

export const calculatorPages: SeoPage[] = [
  {
    slug: "debit-spread-calculator",
    title: "Debit Spread Calculator",
    metaTitle: "Debit Spread Calculator | Call & Put Spread Simulator | Callculator",
    description:
      "Calculate debit spread cost, break-even price, max profit, max loss, and scenario profit or loss before expiration.",
    heroEyebrow: "Options strategy calculator",
    heroTitle: "Debit Spread Calculator",
    heroLead:
      "Estimate the risk, reward, break-even price, and future value of debit call spreads and debit put spreads before you place a trade.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "What this calculator helps with",
        body:
          "A debit spread uses one long option and one short option with the same expiration. Callculator models the entry debit, capital used, break-even price, maximum profit, maximum loss, and what the spread could be worth at different prices and dates.",
        bullets: [
          "Compare call spreads and put spreads with the same ticker assumptions.",
          "Test what happens if implied volatility changes before expiration.",
          "See how much of the position value comes from time value versus intrinsic value.",
        ],
      },
      {
        heading: "What to check before relying on the output",
        body:
          "The calculator is a planning tool, not a broker quote. Actual fills, commissions, assignment risk, bid-ask spreads, early exercise, dividends, and changing volatility can all change the final result.",
      },
    ],
    steps: [
      "Enter the current stock price and implied volatility.",
      "Choose a debit call spread or debit put spread.",
      "Set the long strike, short strike, expiration, and capital amount.",
      "Move the future price, date, and volatility controls to inspect the scenario.",
    ],
    example: {
      heading: "Simple debit spread example",
      body:
        "If a stock is at $100, a trader might buy a $100 call and sell a $110 call for the same expiration.",
      rows: [
        { label: "Net debit", value: "$4.10 per share" },
        { label: "Maximum loss", value: "$4.10 per share" },
        { label: "Maximum profit", value: "$5.90 per share" },
        { label: "Break-even at expiration", value: "$104.10" },
      ],
    },
    faqs: [
      {
        question: "What is a debit spread?",
        answer:
          "A debit spread is an options position that costs money to open. It usually buys one option and sells another option with the same expiration to reduce cost and define part of the risk profile.",
      },
      {
        question: "Does the calculator use live option prices?",
        answer:
          "No. Callculator estimates option values from the inputs you provide. It is best used for planning and comparison, not as a replacement for a live options chain.",
      },
      {
        question: "Why does implied volatility matter?",
        answer:
          "Before expiration, option value can change because of stock price, time remaining, interest rates, dividends, and implied volatility. Expiration value depends only on intrinsic value.",
      },
    ],
    relatedSlugs: [
      "call-spread-calculator",
      "put-spread-calculator",
      "options-profit-calculator",
      "methodology",
    ],
    sitemap: {
      priority: 0.95,
      changeFrequency: "weekly",
    },
  },
  {
    slug: "call-spread-calculator",
    title: "Call Spread Calculator",
    metaTitle: "Call Spread Calculator | Debit Call Spread Profit Simulator | Callculator",
    description:
      "Calculate debit call spread cost, upside target, break-even price, max profit, max loss, and future profit or loss scenarios.",
    heroEyebrow: "Bullish options calculator",
    heroTitle: "Call Spread Calculator",
    heroLead:
      "Model a debit call spread by buying a lower-strike call and selling a higher-strike call for the same expiration.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "When a call spread is useful",
        body:
          "A debit call spread can fit a defined bullish view: the trader expects the stock to rise, but not necessarily far beyond the short strike. Selling the higher-strike call lowers the entry cost and caps the upside.",
        bullets: [
          "Plan the price target needed to beat the entry cost.",
          "Compare narrow and wide spreads with the same expiration.",
          "Check whether a cheaper spread gives up too much upside.",
        ],
      },
      {
        heading: "What the payoff means",
        body:
          "At expiration, the maximum value of a standard call spread is the distance between the two strikes. The maximum profit is that width minus the debit paid. The maximum loss is the debit paid.",
      },
    ],
    steps: [
      "Choose debit call spread in the calculator.",
      "Set the long call strike below the short call strike.",
      "Enter the expected expiration date and capital allocation.",
      "Use the scenario curve to compare profit or loss before and at expiration.",
    ],
    example: {
      heading: "Debit call spread example",
      body:
        "For a $100 stock, a $100/$110 debit call spread with a $4.10 debit has a defined payoff at expiration.",
      rows: [
        { label: "Spread width", value: "$10.00" },
        { label: "Debit paid", value: "$4.10" },
        { label: "Break-even", value: "$104.10" },
        { label: "Max profit", value: "$5.90 per share" },
      ],
    },
    faqs: [
      {
        question: "Can a debit call spread lose more than the debit?",
        answer:
          "A standard long debit call spread generally has maximum loss equal to the debit paid, before commissions and execution differences.",
      },
      {
        question: "Why sell the higher-strike call?",
        answer:
          "Selling the higher-strike call lowers the cost of the position, but it also caps the profit above that strike.",
      },
      {
        question: "What happens if the stock finishes above the short strike?",
        answer:
          "At expiration, a standard debit call spread is usually worth the strike width when the stock is above the short strike.",
      },
    ],
    relatedSlugs: [
      "debit-spread-calculator",
      "options-profit-calculator",
      "black-scholes-calculator",
    ],
    sitemap: {
      priority: 0.9,
      changeFrequency: "weekly",
    },
  },
  {
    slug: "put-spread-calculator",
    title: "Put Spread Calculator",
    metaTitle: "Put Spread Calculator | Debit Put Spread Profit Simulator | Callculator",
    description:
      "Calculate debit put spread break-even price, max profit, max loss, entry debit, and future profit or loss scenarios.",
    heroEyebrow: "Bearish options calculator",
    heroTitle: "Put Spread Calculator",
    heroLead:
      "Model a debit put spread by buying a higher-strike put and selling a lower-strike put for the same expiration.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "When a put spread is useful",
        body:
          "A debit put spread can fit a defined bearish view: the trader expects the stock to fall, but wants to reduce the cost of buying a put by selling a lower-strike put.",
        bullets: [
          "Estimate the downside move required to break even.",
          "Compare strike widths for different bearish targets.",
          "Check how much value may remain before expiration if the move happens early.",
        ],
      },
      {
        heading: "What the payoff means",
        body:
          "At expiration, a standard put spread reaches maximum value when the stock finishes at or below the short put strike. The maximum profit is the spread width minus the debit paid.",
      },
    ],
    steps: [
      "Choose debit put spread in the calculator.",
      "Set the long put strike above the short put strike.",
      "Enter the expiration, implied volatility, and capital amount.",
      "Move the future stock price lower to inspect bearish outcomes.",
    ],
    example: {
      heading: "Debit put spread example",
      body:
        "For a $100 stock, a $100/$90 debit put spread with a $4.10 debit has a defined payoff at expiration.",
      rows: [
        { label: "Spread width", value: "$10.00" },
        { label: "Debit paid", value: "$4.10" },
        { label: "Break-even", value: "$95.90" },
        { label: "Max profit", value: "$5.90 per share" },
      ],
    },
    faqs: [
      {
        question: "Can a debit put spread lose more than the debit?",
        answer:
          "A standard long debit put spread generally has maximum loss equal to the debit paid, before commissions and execution differences.",
      },
      {
        question: "Why sell the lower-strike put?",
        answer:
          "Selling the lower-strike put reduces the cost of the long put, but it caps the profit if the stock falls below that strike.",
      },
      {
        question: "Does the calculator handle early assignment?",
        answer:
          "No. It models theoretical option value and expiration payoff. Early assignment and exercise decisions require separate judgment.",
      },
    ],
    relatedSlugs: [
      "debit-spread-calculator",
      "options-profit-calculator",
      "methodology",
    ],
    sitemap: {
      priority: 0.9,
      changeFrequency: "weekly",
    },
  },
  {
    slug: "options-profit-calculator",
    title: "Options Profit Calculator",
    metaTitle: "Options Profit Calculator | Scenario Profit & Loss Tool | Callculator",
    description:
      "Estimate options strategy profit and loss across stock price, time, implied volatility, and capital scenarios.",
    heroEyebrow: "Scenario analysis",
    heroTitle: "Options Profit Calculator",
    heroLead:
      "Use scenario controls to estimate how an options position may change as the stock price, date, and implied volatility move.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "What makes this different from a payoff chart",
        body:
          "A payoff chart usually shows expiration value only. Callculator also estimates pre-expiration value, so you can compare what a position may be worth before the final day.",
        bullets: [
          "Model the same position today, midway to expiration, and at expiration.",
          "Compare scenario profit or loss against the entry debit.",
          "See tables for date-by-date and price-by-price outcomes.",
        ],
      },
      {
        heading: "How to read the scenario output",
        body:
          "Positive profit or loss means the estimated position value is above the initial cost. Negative profit or loss means the estimated position value is below the initial cost.",
      },
    ],
    steps: [
      "Enter the current stock and option assumptions.",
      "Select a strategy and expiration.",
      "Save multiple strategies if you want to compare them.",
      "Use the heat map, curve, and tables to inspect the outcome range.",
    ],
    example: {
      heading: "Scenario example",
      body:
        "A trader can test whether a spread is attractive if the stock reaches a target before expiration rather than only on expiration day.",
      rows: [
        { label: "Today", value: "Stock $100, 60 days to expiration" },
        { label: "Scenario", value: "Stock $108, 30 days to expiration" },
        { label: "Variable to test", value: "Future implied volatility" },
        { label: "Decision point", value: "Estimated profit or loss before expiration" },
      ],
    },
    faqs: [
      {
        question: "Can I compare more than one options strategy?",
        answer:
          "Yes. The app lets you save strategies and compare their expected outcomes across the same market scenario.",
      },
      {
        question: "Are commissions included?",
        answer:
          "No. Commissions, fees, bid-ask spreads, and execution quality are not included in the model output.",
      },
      {
        question: "Why can pre-expiration profit differ from expiration profit?",
        answer:
          "Before expiration, options can still contain time value and volatility value. At expiration, only intrinsic value remains.",
      },
    ],
    relatedSlugs: [
      "debit-spread-calculator",
      "call-spread-calculator",
      "put-spread-calculator",
      "black-scholes-calculator",
    ],
    sitemap: {
      priority: 0.88,
      changeFrequency: "weekly",
    },
  },
  {
    slug: "black-scholes-calculator",
    title: "Black-Scholes Calculator",
    metaTitle: "Black-Scholes Calculator | Option Pricing Assumptions | Callculator",
    description:
      "Estimate theoretical option value using stock price, strike price, time, volatility, rates, and dividend yield assumptions.",
    heroEyebrow: "Pricing model",
    heroTitle: "Black-Scholes Calculator",
    heroLead:
      "Callculator uses Black-Scholes style estimates for non-expiration option values, with inputs for price, time, implied volatility, rates, and dividends.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "What Black-Scholes estimates",
        body:
          "Black-Scholes is a theoretical option pricing model. It estimates option value from the stock price, strike price, time to expiration, volatility, risk-free rate, and dividend yield.",
        bullets: [
          "Calls and puts are estimated from the same core assumptions.",
          "Spread value is estimated by pricing each leg, then combining the legs.",
          "At expiration, Callculator uses intrinsic value instead of model value.",
        ],
      },
      {
        heading: "Important limitations",
        body:
          "The model is theoretical. Real option prices can differ because of supply and demand, early exercise risk, dividends, borrow costs, liquidity, skew, and the bid-ask spread.",
      },
    ],
    steps: [
      "Enter the stock price and strike price.",
      "Set the days to expiration.",
      "Choose implied volatility, risk-free rate, and dividend yield.",
      "Compare the model value against the strategy cost and payoff.",
    ],
    example: {
      heading: "Model input example",
      body:
        "Small input changes can produce noticeably different option values, especially when expiration is close or implied volatility is high.",
      rows: [
        { label: "Stock price", value: "$100" },
        { label: "Strike price", value: "$105" },
        { label: "Time remaining", value: "60 days" },
        { label: "Volatility", value: "35%" },
      ],
    },
    faqs: [
      {
        question: "Is Black-Scholes the same as a live market quote?",
        answer:
          "No. It is a model estimate. Market prices can be higher or lower than the theoretical value.",
      },
      {
        question: "Does Black-Scholes include volatility skew?",
        answer:
          "No. Callculator applies the selected volatility assumption to the modeled legs. Market skew can make different strikes trade at different implied volatilities.",
      },
      {
        question: "Why model each leg separately?",
        answer:
          "A spread is built from option legs. Estimating each leg separately makes it easier to calculate the combined value, cost, profit, and loss.",
      },
    ],
    relatedSlugs: [
      "methodology",
      "options-profit-calculator",
      "debit-spread-calculator",
    ],
    sitemap: {
      priority: 0.82,
      changeFrequency: "monthly",
    },
  },
];

export const trustPages: SeoPage[] = [
  {
    slug: "about",
    title: "About Callculator",
    metaTitle: "About Callculator | Options Strategy Planning Tool",
    description:
      "Learn what Callculator is, who it is for, and how it helps traders compare options strategy scenarios.",
    heroEyebrow: "About",
    heroTitle: "About Callculator",
    heroLead:
      "Callculator is a browser-based options strategy planning tool focused on debit spreads, long calls, and scenario comparison.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "Why this exists",
        body:
          "Options positions can look simple at expiration and still behave differently before expiration. Callculator is built to make those tradeoffs easier to inspect before risking capital.",
      },
      {
        heading: "Who it is for",
        body:
          "The app is intended for people who already understand the basics of listed options and want a clearer way to compare defined-risk strategy scenarios.",
      },
    ],
    faqs: [
      {
        question: "Is Callculator a broker?",
        answer:
          "No. Callculator does not route orders, connect to brokerage accounts, or provide trading recommendations.",
      },
      {
        question: "Does Callculator provide financial advice?",
        answer:
          "No. The app provides calculations and educational context. Trading decisions remain the user's responsibility.",
      },
    ],
    relatedSlugs: ["methodology", "disclaimer", "privacy"],
    sitemap: {
      priority: 0.55,
      changeFrequency: "monthly",
    },
  },
  {
    slug: "methodology",
    title: "Methodology",
    metaTitle: "Methodology | How Callculator Estimates Option Strategy Outcomes",
    description:
      "Understand the assumptions Callculator uses for option pricing, spread payoff, scenario analysis, and capital sizing.",
    heroEyebrow: "Methodology",
    heroTitle: "How Callculator estimates outcomes",
    heroLead:
      "The calculator combines option pricing estimates, expiration payoff logic, and user-entered assumptions to show possible strategy outcomes.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "Pricing approach",
        body:
          "For non-expiration scenarios, Callculator uses Black-Scholes style estimates for option legs. At expiration, it uses intrinsic value because time value has expired.",
        bullets: [
          "Current implied volatility is used for the estimated entry cost.",
          "Future implied volatility is used for future scenario values.",
          "Risk-free rate and dividend yield are user inputs.",
        ],
      },
      {
        heading: "Spread calculations",
        body:
          "For standard debit spreads, the app prices the long leg and the short leg, subtracts the short leg value from the long leg value, then applies the contract multiplier and position size.",
      },
      {
        heading: "What is excluded",
        body:
          "The app does not include commissions, taxes, slippage, margin requirements, assignment risk, exercise decisions, liquidity, or live market quote checks.",
      },
    ],
    faqs: [
      {
        question: "Why can my broker show a different value?",
        answer:
          "A broker quote reflects live market prices and bid-ask spreads. Callculator shows a theoretical estimate from your selected assumptions.",
      },
      {
        question: "Does the app assume European-style exercise?",
        answer:
          "The theoretical pricing model treats options in a European-style way. American-style exercise and assignment risk should be evaluated separately.",
      },
      {
        question: "How is capital sizing handled?",
        answer:
          "The app estimates how many contracts or spreads fit within the capital amount based on the modeled entry cost and the contract multiplier.",
      },
    ],
    relatedSlugs: [
      "black-scholes-calculator",
      "debit-spread-calculator",
      "disclaimer",
    ],
    sitemap: {
      priority: 0.65,
      changeFrequency: "monthly",
    },
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    metaTitle: "Disclaimer | Callculator",
    description:
      "Read the educational-use disclaimer for Callculator's options strategy calculations and scenario estimates.",
    heroEyebrow: "Disclaimer",
    heroTitle: "Educational use only",
    heroLead:
      "Callculator provides estimates and scenario analysis. It does not provide investment, tax, legal, or financial advice.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "No financial advice",
        body:
          "The calculations, examples, and explanations on Callculator are for education and planning. They should not be treated as a recommendation to buy, sell, hold, or avoid any security or options strategy.",
      },
      {
        heading: "Model risk",
        body:
          "All model outputs depend on the inputs provided. Real trades can differ because of market movement, execution prices, bid-ask spreads, liquidity, volatility changes, assignment, and fees.",
      },
      {
        heading: "User responsibility",
        body:
          "Before trading options, users should understand the strategy, read the relevant options disclosure documents, and consider consulting a qualified professional.",
      },
    ],
    faqs: [
      {
        question: "Can I rely on Callculator for trade decisions?",
        answer:
          "Callculator can help inspect scenarios, but it should not be the only source used for a trading decision.",
      },
      {
        question: "Are the examples recommendations?",
        answer:
          "No. Examples are generic illustrations of how calculations work.",
      },
    ],
    relatedSlugs: ["methodology", "privacy", "about"],
    sitemap: {
      priority: 0.45,
      changeFrequency: "yearly",
    },
  },
  {
    slug: "privacy",
    title: "Privacy",
    metaTitle: "Privacy | Callculator",
    description:
      "Learn how Callculator handles local saved strategies, browser storage, and aggregate analytics.",
    heroEyebrow: "Privacy",
    heroTitle: "Privacy and local storage",
    heroLead:
      "Callculator does not require an account or brokerage connection. Saved strategies and preferences are stored in your browser.",
    updated: "Reviewed May 2026",
    sections: [
      {
        heading: "Information stored in your browser",
        body:
          "Saved strategies, display preferences, and share-state details can be stored locally in your browser so the app can restore your workspace.",
      },
      {
        heading: "Analytics",
        body:
          "The app uses Vercel Analytics to understand aggregate usage. This helps measure page visits and app usage without requiring a user account.",
      },
      {
        heading: "No brokerage connection",
        body:
          "Callculator does not ask for brokerage login details, does not place trades, and does not access portfolio holdings.",
      },
    ],
    faqs: [
      {
        question: "Can I clear saved strategies?",
        answer:
          "Yes. Saved browser data can be removed through the app controls where available or by clearing site data in your browser settings.",
      },
      {
        question: "Does Callculator sell trade data?",
        answer:
          "Callculator does not collect brokerage trade data because it does not connect to brokerage accounts.",
      },
    ],
    relatedSlugs: ["about", "disclaimer"],
    sitemap: {
      priority: 0.45,
      changeFrequency: "yearly",
    },
  },
];

export const seoPages = [...calculatorPages, ...trustPages];

export function getSeoPage(slug: string): SeoPage | undefined {
  return seoPages.find((page) => page.slug === slug);
}

export function getRelatedPages(page: SeoPage): SeoPage[] {
  return page.relatedSlugs
    .map((slug) => getSeoPage(slug))
    .filter((relatedPage): relatedPage is SeoPage => Boolean(relatedPage));
}

export function pagePath(page: SeoPage): string {
  return `/${page.slug}`;
}

export function pageUrl(page: SeoPage): string {
  return absoluteUrl(pagePath(page));
}

export function buildFaqJsonLd(page: SeoPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(page: SeoPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: siteConfig.name,
        item: siteConfig.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.title,
        item: pageUrl(page),
      },
    ],
  };
}

export function buildWebApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    alternateName: [
      "Debit Spread Calculator",
      "Call Spread Calculator",
      "Put Spread Calculator",
      "Options Profit Calculator",
    ],
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
}

export function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: absoluteUrl("/callculator-icon.png"),
    },
  };
}
