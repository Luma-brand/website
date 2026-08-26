# LUMA delivery research and rollout

Date reviewed: 26 August 2026

## Decision

Keep LUMA's existing production delivery prices unchanged. The checkout and admin systems now support a hierarchical delivery model, but no new domestic or international price should be published until LUMA collects carrier quotes for its real parcel sizes, weights, monthly volumes, origin, destination, and service level.

## Architecture now supported

Nigeria quotes resolve in this order:

1. exact country + state + city/LGA + area override;
2. country + state + city/LGA default;
3. country + state default;
4. country default;
5. nationwide fallback.

Each configured zone can carry a base fee, remote surcharge, ETA range, active status, free-shipping threshold, pickup availability, pickup label, and international region. The order stores the resolved delivery zone, amount, address area, ETA, and pickup details as a checkout-time snapshot.

Future international zones can use these region labels without changing checkout code:

- West Africa
- Rest of Africa
- United Kingdom
- Europe
- North America
- Middle East
- Asia/Oceania

Weight- or basket-value tiers should remain disabled until a carrier rate card has been approved. When needed, add tiers as child records of a delivery zone instead of duplicating countries or hardcoding rates in application code.

## Carrier findings

| Carrier | Verified capability | Pricing implication |
| --- | --- | --- |
| DHL Express Nigeria | International document and parcel service with destination-specific quotes and transit estimates | Use a live or account quote; do not derive a universal country price |
| FedEx Nigeria / Red Star Express | International services and Nigerian domestic/e-commerce coverage; FedEx publishes service-specific rates and surcharges | Store base rate and surcharges separately; review dimensional weight and remote-area rules |
| UPS Nigeria | Quote calculator uses origin, destination, and parcel weight; fuel surcharge is variable | Do not publish a static rate without a dated quote and surcharge policy |
| Red Star e-Commerce | Nigerian coverage, pickup/drop-off options, returns, tracking, and stated 24–72 hour transit to major cities/airport locations | Suitable for a domestic pilot, subject to a written merchant quote and service-area file |

Official sources:

- DHL Nigeria quote tool: https://www.dhl.com/ng-en/home/get-a-quote.html
- DHL Express Nigeria overview: https://www.dhl.com/ng-en/home/express.html
- FedEx Nigeria rates and surcharges: https://www.fedex.com/en-ng/shipping/rates.html
- FedEx Nigeria rate methodology: https://www.fedex.com/en-ng/new-customer/how-to-get-rates-and-transit-times.html
- UPS Nigeria quote calculator: https://www.ups.com/ng/en/shipping/quote
- UPS Nigeria fuel surcharge: https://www.ups.com/ng/en/support/shipping-support/shipping-costs-rates/fuel-surcharges
- Red Star e-Commerce coverage: https://redstarplc.com/services/e-commerce/
- Red Star international products: https://redstarplc.com/services/international-products/

## Quote collection sheet

Before adding any new production rate, collect the following for at least three representative LUMA parcels:

- packed dimensions and actual weight;
- dimensional/billable weight;
- pickup origin and pickup fee;
- destination country, state, city/LGA, postal code, and remote-area status;
- base transportation rate;
- fuel, remote-area, handling, insurance, and signature surcharges;
- customs brokerage, duties, and taxes treatment;
- return-to-origin and failed-delivery charges;
- stated business-day ETA and service exclusions;
- currency, VAT treatment, validity date, and account-volume discount.

## Recommended rollout

1. Export LUMA's last 60–90 days of delivery destinations and group them by state, city/LGA, and area.
2. Obtain written domestic merchant quotes from at least two carriers using the same three parcel profiles.
3. Compare landed delivery cost and failed-delivery/return terms, not only headline price.
4. Load reviewed domestic zones in inactive mode, test the fallback order, then activate them in small batches.
5. Pilot one international region with destination-specific quotes and a clearly stated duties/taxes policy.
6. Review rates monthly or whenever a carrier changes fuel, currency, remote-area, or handling surcharges.

## Production guardrails

- A missing exact zone must fall back predictably; it must never invent a rate.
- Inactive zones must not quote.
- The checkout must show the resolved fee and ETA before Paystack initialization.
- Paystack continues to settle in NGN; display-currency conversion does not change the settlement amount.
- Orders retain their original delivery snapshot even after an admin edits a zone.
