import { products } from "../data/siteContent";

export function getProductBySlug(slug) {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(currentSlug) {
  return products.filter((product) => product.slug !== currentSlug).slice(0, 2);
}