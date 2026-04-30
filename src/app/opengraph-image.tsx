import { ImageResponse } from "next/og";
import { siteConfig } from "./seo";

export const alt = `${siteConfig.name} options strategy simulator`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8fafc",
          color: "#020617",
          fontFamily: "Arial, sans-serif",
          padding: "64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "28px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "28px",
              }}
            >
              C
            </div>
            {siteConfig.name}
          </div>
          <div
            style={{
              border: "1px solid #bae6fd",
              borderRadius: "999px",
              background: "#e0f2fe",
              color: "#075985",
              padding: "10px 18px",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            Options strategy workspace
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              maxWidth: "920px",
              fontSize: "76px",
              lineHeight: 1,
              letterSpacing: "-1px",
              fontWeight: 800,
            }}
          >
            Model option spreads before you trade
          </div>
          <div
            style={{
              maxWidth: "900px",
              fontSize: "30px",
              lineHeight: 1.35,
              color: "#475569",
              fontWeight: 600,
            }}
          >
            Compare call spreads, put spreads, and long calls across price, time,
            volatility, and capital scenarios.
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", fontSize: "24px", fontWeight: 700 }}>
          {["Saved strategies", "Scenario cards", "Time value", "P/L matrix"].map(
            (item) => (
              <div
                key={item}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  background: "white",
                  padding: "14px 18px",
                  color: "#334155",
                }}
              >
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  );
}
