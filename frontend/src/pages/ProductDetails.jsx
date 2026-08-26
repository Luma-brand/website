import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Heart } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { PageSkeleton } from "../components/layout/PageSkeleton";
import { PageSeo } from "../components/seo/PageSeo";
import { ProductSalesStrip } from "../components/product/ProductSalesStrip";
import { useCart } from "../context/CartContext";
import {
  getProductById,
  getProductSalesRecommendations,
  joinProductWaitlist,
} from "../services/api";
import { recordProductView } from "../services/growthApi";
import { formatNaira } from "../utils/currency";
import { getProductImage } from "../utils/images";
import {
  getRecentlyViewedProducts,
  saveRecentlyViewedProduct,
} from "../utils/recentlyViewed";
import { getStockMessage, isProductUnavailable } from "../utils/stock";

function formatProduct(product) {
  return {
    ...product,
    slug: product.slug || product.id,
    image: getProductImage(product),
    priceValue: Number(product.price),
    price: formatNaira(product.price),
    description: product.description || "A soft luxury LUMA beauty product.",
  };
}

function getSiteOrigin() {
  return (
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export function ProductDetails() {
  const { slug } = useParams();

  const [product, setProduct] = useState(null);
  const [recommendations, setRecommendations] = useState({
    relatedProducts: [],
    frequentlyBoughtTogether: [],
    upsells: [],
    bundles: [],
  });
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState([]);
  const [showUpsell, setShowUpsell] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState("details");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [backInStockForm, setBackInStockForm] = useState({
    email: "",
    phone: "",
  });
  const [backInStockMessage, setBackInStockMessage] = useState("");
  const [isBackInStockSubmitting, setIsBackInStockSubmitting] = useState(false);
  const trackedProductViewRef = useRef("");

  const { addToCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;

    async function loadProductDetails() {
      try {
        setIsLoading(true);
        setError("");

        const singleResponse = await getProductById(slug);
        const selectedProduct = formatProduct(singleResponse.data);

        if (!mounted) return;

        const previousRecentlyViewed = getRecentlyViewedProducts()
          .filter((item) => item.id !== selectedProduct.id)
          .slice(0, 4);

        setProduct(selectedProduct);
        setBackInStockForm((current) => ({
          email: current.email || user?.email || "",
          phone:
            current.phone ||
            user?.whatsapp_e164 ||
            user?.whatsapp_number ||
            user?.phone_e164 ||
            user?.phone ||
            "",
        }));
        setRecentlyViewedProducts(previousRecentlyViewed);
        setShowUpsell(false);
        setActiveInfoTab("details");
        setIsLoading(false);
        saveRecentlyViewedProduct(selectedProduct);

        const productViewKey = `${selectedProduct.id}:${user?.email || "guest"}`;
        if (trackedProductViewRef.current !== productViewKey) {
          trackedProductViewRef.current = productViewKey;
          void recordProductView({
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productImage: selectedProduct.image,
            productUrl: `${getSiteOrigin()}/products/${selectedProduct.slug || selectedProduct.id}`,
            customerId: user?.id || null,
            customerEmail: user?.email || null,
            source: "product_details",
          }).catch(() => {
            trackedProductViewRef.current = "";
          });
        }

        try {
          const recommendationResponse = await getProductSalesRecommendations({
            productId: selectedProduct.id,
            limit: 4,
          });

          if (!mounted) return;

          setRecommendations({
            relatedProducts:
              recommendationResponse.data?.relatedProducts?.map(formatProduct) || [],
            frequentlyBoughtTogether:
              recommendationResponse.data?.frequentlyBoughtTogether?.map(formatProduct) ||
              [],
            upsells: recommendationResponse.data?.upsells?.map(formatProduct) || [],
            bundles: recommendationResponse.data?.bundles?.map(formatProduct) || [],
          });
        } catch {
          // Product recommendations are optional and must not block the core page.
        }
      } catch (error) {
        if (mounted) {
          setError(error.message || "Failed to load product.");
          setProduct(null);
          setIsLoading(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadProductDetails();
    return () => {
      mounted = false;
    };
  }, [slug, user?.email, user?.id, user?.phone, user?.phone_e164, user?.whatsapp_e164, user?.whatsapp_number]);

  if (isLoading) {
    return (
      <main className="page-shell inner-page">
        <PageSeo
          title="Loading product | LUMA"
          description="Loading LUMA product information."
          robots="noindex, nofollow"
        />
        <Header />
        <PageSkeleton />
        <Footer />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="page-shell inner-page">
        <PageSeo
          title="Product not found | LUMA"
          description="This LUMA product is unavailable or may have moved."
          robots="noindex, nofollow, noarchive"
        />
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Product not found.</h2>
            <p>{error || "This LUMA product does not exist or may have been moved."}</p>
            <Link to="/products" className="btn btn-primary">
              Back to products
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  const saved = isInWishlist(product.slug);
  const unavailable = isProductUnavailable(product);
  const canonicalUrl = `${getSiteOrigin()}/products/${product.slug || product.id}`;
  const productDescription =
    product.meta_description || product.description || `${product.name} by LUMA Skincare.`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    image: product.image ? [product.image] : undefined,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "LUMA Skincare",
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "NGN",
      price: Number(product.priceValue || product.price || 0),
      availability: unavailable
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  function handleAddToCart() {
    const result = addToCart(product);

    showToast(
      result.message ||
        (result.success
          ? `${product.name} added to cart.`
          : "Unable to add product to cart."),
      result.success ? "success" : "error"
    );

    if (result.success) {
      setShowUpsell(true);
    }
  }

  function handleBackInStockChange(event) {
    const { name, value } = event.target;

    setBackInStockForm((current) => ({
      ...current,
      [name]: value,
    }));
    setBackInStockMessage("");
  }

  async function handleBackInStockSubmit(event) {
    event.preventDefault();

    if (!backInStockForm.email.trim()) {
      setBackInStockMessage("Add your email so we can notify you.");
      return;
    }

    try {
      setIsBackInStockSubmitting(true);
      setBackInStockMessage("");

      const response = await joinProductWaitlist({
        productId: product.id,
        fullName: user?.full_name || user?.name || "",
        email: backInStockForm.email,
        phone: backInStockForm.phone,
        whatsappNumber:
          user?.whatsapp_e164 ||
          user?.whatsapp_number ||
          backInStockForm.phone,
        customerId: isAuthenticated ? user?.id : null,
        requestedSize: product.size || "",
      });

      setBackInStockMessage(
        response.data?.message ||
          response.message ||
          "You're on the waitlist for this product."
      );
      if (!isAuthenticated) {
        setBackInStockForm({ email: "", phone: "" });
      }
    } catch (error) {
      setBackInStockMessage(
        error.message || "We could not save your request. Please try again."
      );
    } finally {
      setIsBackInStockSubmitting(false);
    }
  }

  return (
    <main className="page-shell inner-page">
      <PageSeo
        title={product.meta_title || `${product.name} | LUMA Skincare`}
        description={productDescription}
        canonical={canonicalUrl}
        jsonLd={productJsonLd}
      />
      <Header />

      <section className="product-detail-page">
        <Link to="/products" className="product-breadcrumb">
          <ArrowLeft size={17} />
          Products
          <span>/</span>
          <strong>{product.name}</strong>
        </Link>

        <div className="product-detail-layout">
          <div className="product-detail-media">
            <div className="product-detail-image">
              {product.image ? (
                <img
                  src={product.image || product.image_url}
                  alt={product.name}
                />
              ) : (
                <div className="empty-state">
                  <p>No product image</p>
                </div>
              )}
            </div>

            <div className="product-image-caption">
              <span>LUMA.</span>
              <p>Functional beauty, designed for brows.</p>
            </div>
          </div>

          <div className="product-detail-content">
            <div className="product-detail-heading-row">
              <div>
                <p className="eyebrow">LUMA brow essential</p>
                <h1>{product.name}</h1>
              </div>

              <span className={`product-stock-pill ${unavailable ? "unavailable" : ""}`}>
                {unavailable ? "Unavailable" : "In stock"}
              </span>
            </div>

            <div className="product-meta-row">
              <span>{product.size || "LUMA Beauty"}</span>
              <i aria-hidden="true" />
              <span>{getStockMessage(product)}</span>
            </div>

            <div className="product-price-row">
              <strong>{product.price}</strong>
              <span>One-time purchase</span>
            </div>

            <p className="product-detail-summary">{product.description}</p>

            <div className="product-purchase-note">
              <Check size={15} />
              <span>Made for an easy, everyday LUMA brow routine.</span>
            </div>

            {unavailable && (
              <div className="stock-alert">
                This product is currently unavailable.
              </div>
            )}

            {unavailable && (
              <form
                className="back-in-stock-form"
                onSubmit={handleBackInStockSubmit}
              >
                <h2>Get notified when it returns</h2>
                <div className="form-grid two">
                  <div className="form-field">
                    <label htmlFor="backInStockEmail">Email</label>
                    <input
                      id="backInStockEmail"
                      name="email"
                      type="email"
                      value={backInStockForm.email}
                      onChange={handleBackInStockChange}
                      placeholder="you@example.com"
                      disabled={isBackInStockSubmitting}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="backInStockPhone">Phone</label>
                    <input
                      id="backInStockPhone"
                      name="phone"
                      value={backInStockForm.phone}
                      onChange={handleBackInStockChange}
                      placeholder="+234..."
                      disabled={isBackInStockSubmitting}
                    />
                  </div>
                </div>

                {backInStockMessage && <p>{backInStockMessage}</p>}

                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isBackInStockSubmitting}
                >
                  {isBackInStockSubmitting ? "Saving..." : "Notify me"}
                </button>
              </form>
            )}

            <div className="product-purchase-actions">
              <button
                type="button"
                className="btn btn-primary product-detail-button"
                onClick={handleAddToCart}
                disabled={unavailable}
              >
                {unavailable ? "Unavailable" : "Add to cart"}
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                className={`wishlist-detail-button ${saved ? "saved" : ""}`}
                onClick={() => toggleWishlist(product)}
              >
                <Heart size={18} />
                {saved ? "Saved" : "Save"}
              </button>
            </div>

            {showUpsell && recommendations.upsells.length > 0 && (
              <div className="one-click-upsell">
                <ProductSalesStrip
                  eyebrow="Added to cart"
                  title="Add one more before checkout?"
                  products={recommendations.upsells.slice(0, 2)}
                  actionLabel="Add"
                />

                <Link to="/cart" className="btn btn-primary">
                  View cart
                  <ArrowRight size={18} />
                </Link>
              </div>
            )}

            <div className="product-info-tabs">
              <div className="product-info-tablist" role="tablist" aria-label="Product information">
                {[
                  ["details", "Product details"],
                  ["use", "How to use"],
                  ["luma", "Why LUMA"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activeInfoTab === value}
                    className={activeInfoTab === value ? "active" : ""}
                    onClick={() => setActiveInfoTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="product-info-panel" role="tabpanel">
                {activeInfoTab === "details" && (
                  <>
                    <p>{product.description}</p>
                    <dl>
                      <div>
                        <dt>Size</dt>
                        <dd>{product.size || "Not specified"}</dd>
                      </div>
                      <div>
                        <dt>Availability</dt>
                        <dd>{getStockMessage(product)}</dd>
                      </div>
                      <div>
                        <dt>Brand</dt>
                        <dd>LUMA</dd>
                      </div>
                    </dl>
                  </>
                )}

                {activeInfoTab === "use" && (
                  <p>
                    Apply gently as part of your daily brow routine. Use a small
                    amount, shape with precision, and allow the product to settle
                    before layering more.
                  </p>
                )}

                {activeInfoTab === "luma" && (
                  <p>
                    LUMA creates focused brow essentials that make professional,
                    polished results feel simple enough for every day.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <ProductSalesStrip
          eyebrow="Frequently bought together"
          title="Build the routine."
          products={recommendations.frequentlyBoughtTogether}
          mode="bundle"
          actionLabel="Add"
        />

        <ProductSalesStrip
          eyebrow="Related products"
          title="Pair it with."
          products={recommendations.relatedProducts}
          actionLabel="Add"
        />

        <ProductSalesStrip
          eyebrow="Recently viewed"
          title="Pick up where you left off."
          products={recentlyViewedProducts}
          actionLabel="Add"
        />
      </section>

      <Footer />
    </main>
  );
}


