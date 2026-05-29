import { trustItems } from "../../data/siteContent";

export function TrustStrip() {
  return (
    <section className="trust-strip" aria-label="LUMA brand promises">
      {trustItems.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </section>
  );
}