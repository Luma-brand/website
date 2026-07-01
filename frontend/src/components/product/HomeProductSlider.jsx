import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { getProducts } from "../../services/api";
import { formatNaira } from "../../utils/currency";
import { getProductImage } from "../../utils/images";

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeProduct(product) {
  const rating = Number(product.average_rating ?? product.rating ?? 0);
  const reviewCount = Number(product.review_count ?? product.reviews_count ?? 0);
  return {
    ...product,
    slug: product.slug || product.id,
    image: getProductImage(product),
    category: product.category || product.product_category || product.size || "LUMA Brow Care",
    description: product.description || "A soft luxury LUMA brow essential.",
    priceLabel: formatNaira(product.price),
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    tags: asList(product.features || product.tags || product.details || product.highlights).slice(0, 3),
  };
}

const ProductSlide = memo(function ProductSlide({ product }) {
  const roundedRating = Math.round(product.rating);
  return (
    <article className="product-card home-product-slide">
      <Link to={`/products/${product.slug}`} className="product-image" tabIndex={-1} aria-hidden="true">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" sizes="(max-width: 640px) 82vw, (max-width: 1024px) 42vw, 24vw" />
        ) : (
          <div className="product-image-fallback"><small>Image coming soon</small></div>
        )}
      </Link>
      <div className="product-card-content">
        <p className="home-product-category">{product.category}</p>
        <h3>{product.name}</h3>
        <p className="home-product-description">{product.description}</p>
        <div className="home-product-rating" aria-label={product.reviewCount ? `${product.rating.toFixed(1)} out of 5 stars from ${product.reviewCount} reviews` : "No reviews yet"}>
          {product.reviewCount > 0 ? (
            <>
              <span aria-hidden="true">{"\u2605\u2605\u2605\u2605\u2605".split("").map((star, index) => (
                <i key={index} className={index < roundedRating ? "filled" : ""}>{star}</i>
              ))}</span>
              <small>({product.reviewCount})</small>
            </>
          ) : <small>No reviews yet</small>}
        </div>
        <strong className="home-product-price">{product.priceLabel}</strong>
        {product.tags.length > 0 && (
          <div className="product-details home-product-tags">
            {product.tags.map((tag) => <small key={tag}>{tag}</small>)}
          </div>
        )}
        <Link to={`/products/${product.slug}`} className="product-home-link">
          Product info <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
});

export function HomeProductSlider() {
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");

  const loadProducts = useCallback((showLoading = true) => {
    if (showLoading) setStatus("loading");
    return getProducts()
      .then((response) => {
        setProducts((response.data || []).map(normalizeProduct));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadProducts(false); });
  }, [loadProducts]);

  function scroll(direction) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".home-product-slide");
    track.scrollBy({ left: direction * ((card?.getBoundingClientRect().width || 320) + 22), behavior: "smooth" });
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch") return;
    const track = trackRef.current;
    dragRef.current = { active: true, moved: false, startX: event.clientX, scrollLeft: track.scrollLeft };
    track.setPointerCapture(event.pointerId);
    track.classList.add("is-dragging");
  }

  function handlePointerMove(event) {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 5) dragRef.current.moved = true;
    trackRef.current.scrollLeft = dragRef.current.scrollLeft - delta;
  }

  function endDrag(event) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    trackRef.current?.classList.remove("is-dragging");
    if (trackRef.current?.hasPointerCapture(event.pointerId)) trackRef.current.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    trackRef.current.scrollLeft += event.deltaY;
  }

  if (status === "loading") return <div className="home-product-state" aria-live="polite">Preparing the brow collection…</div>;
  if (status === "error") return (
    <div className="home-product-state" role="alert">
      <strong>We couldn’t load the collection.</strong>
      <span>Please check your connection or try again.</span>
      <button type="button" className="btn btn-secondary" onClick={loadProducts}><RefreshCw size={16} /> Try again</button>
    </div>
  );
  if (products.length === 0) return (
    <div className="home-product-state">
      <strong>The next brow ritual is almost here.</strong>
      <span>Published LUMA products will appear here as soon as they are available.</span>
      <Link to="/products" className="product-home-link">View the shop <ArrowUpRight size={16} /></Link>
    </div>
  );

  return (
    <div className="home-product-carousel" role="region" aria-roledescription="carousel" aria-label="LUMA products">
      <div className="home-product-carousel-controls" aria-label="Carousel controls">
        <button type="button" onClick={() => scroll(-1)} aria-label="Previous products"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => scroll(1)} aria-label="Next products"><ArrowRight size={18} /></button>
      </div>
      <div ref={trackRef} className="home-product-track" tabIndex={0} aria-label="Scrollable product list"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); scroll(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); scroll(1); }
        }}
        onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (dragRef.current.moved) { event.preventDefault(); event.stopPropagation(); dragRef.current.moved = false; }
        }}
      >
        {products.map((product) => <ProductSlide key={product.id || product.slug} product={product} />)}
      </div>
    </div>
  );
}
