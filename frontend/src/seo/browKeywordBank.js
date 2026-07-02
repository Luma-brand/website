const groups = {
  primaryCommercial: [
    "brow products", "premium brow products", "luxury brow products", "shop brow products", "buy brow products online", "brow essentials", "eyebrow products", "brow beauty products", "professional brow products", "everyday brow products", "clean beauty brow products", "soft glam brow products", "natural brow products", "brow grooming products", "brow styling products", "brow makeup products", "brow care products", "brow routine products", "at-home brow products", "polished brow products"
  ],
  productKeywords: [
    "brow gel", "eyebrow gel", "clear brow gel", "tinted brow gel", "brow wax", "eyebrow wax", "brow soap", "brow pomade", "brow pencil", "eyebrow pencil", "brow pen", "brow tint", "brow stain", "hybrid brow stain", "brow lamination product", "brow setting product", "brow styling wax", "brow sculpting gel", "brow brush", "brow spoolie", "brow wand", "precision brow wand", "brow kit", "eyebrow kit", "brow essentials kit", "brow shaping kit", "brow maintenance kit", "brow touch up tool", "brow finishing tool", "brow detail brush"
  ],
  careKeywords: [
    "brow care", "eyebrow care", "brow care routine", "eyebrow care routine", "daily brow care", "gentle brow care", "healthy-looking brows", "conditioned-looking brows", "soft brow care", "brow maintenance", "eyebrow maintenance", "brow prep", "brow aftercare", "brow-friendly routine", "clean brow routine", "simple brow routine", "minimal brow routine", "beauty routine for brows", "brow ritual", "brow care essentials"
  ],
  groomingKeywords: [
    "brow grooming", "eyebrow grooming", "brow grooming tools", "eyebrow grooming tools", "brow shaping products", "eyebrow shaping products", "brow shaping at home", "brow grooming at home", "brow styling at home", "at-home brow grooming", "easy brow grooming", "quick brow grooming", "daily brow grooming", "clean brow grooming", "polished brow grooming", "brow brushing", "brow lifting", "brow smoothing", "brow control", "brow hold"
  ],
  naturalBrowKeywords: [
    "natural brows", "natural-looking brows", "soft natural brows", "natural brow makeup", "natural brow styling", "natural brow routine", "natural brow finish", "clean brow look", "clean brows", "polished brows", "defined brows", "soft defined brows", "fuller-looking brows", "fluffy brows", "feathered brows", "brushed-up brows", "lifted brows", "face-framing brows", "effortless brows", "minimal brow look"
  ],
  softGlamKeywords: [
    "soft glam brows", "soft brow look", "soft brow makeup", "soft beauty brows", "everyday soft glam", "clean girl brows", "polished everyday brows", "minimal glam brows", "natural glam brows", "beauty essentials for brows", "soft luxury brows", "luxury brow routine", "quiet luxury beauty", "premium beauty routine", "effortless beauty brows", "modern brow beauty", "clean finish brows", "smooth brow finish", "controlled brow finish", "refined brow look"
  ],
  nigeriaKeywords: [
    "brow products in Nigeria", "buy brow products in Nigeria", "shop brow products in Nigeria", "brow products Lagos", "brow products Abuja", "eyebrow products Nigeria", "brow grooming Nigeria", "brow care Nigeria", "brow makeup Nigeria", "brow gel Nigeria", "brow wax Nigeria", "brow tint Nigeria", "brow stain Nigeria", "brow lamination product Nigeria", "online brow store Nigeria", "beauty products Nigeria", "premium beauty Nigeria", "Lagos beauty products", "Nigeria beauty store", "shop beauty products online Nigeria"
  ],
  longTailKeywords: [
    "how to style brows at home", "how to groom brows at home", "how to get natural-looking brows", "how to make brows look polished", "how to shape brows with product", "how to keep brows in place", "how to create soft glam brows", "how to get fuller-looking brows", "how to brush brows upward", "how to use brow wax", "how to use brow gel", "how to use brow stain", "how to choose brow products", "brow routine for beginners", "easy brow routine for beginners", "simple brow routine for everyday", "best brow routine for natural brows", "what brow product should I use", "brow products for sparse brows", "brow products for thick brows", "brow products for unruly brows", "brow products for soft definition", "brow product for clean finish", "brow product for daily makeup", "brow styling without salon"
  ],
  productDetailKeywords: [
    "LUMA LamiFix", "LamiFix brow product", "LUMA Hybrid Stain", "Hybrid Stain brow product", "LUMA Precision Wand", "precision brow wand", "LUMA brow wand", "LUMA brow products", "LUMA brow essentials", "LUMA brow grooming", "LUMA brow care", "LUMA brow styling", "brow product for lifted brows", "brow product for defined brows", "brow product for brushed brows", "brow product for polished brows", "brow product for smooth brows", "brow product for everyday touch ups", "brow product for natural definition", "brow product for clean beauty routines"
  ],
  faqSupportKeywords: [
    "brow product questions", "brow care FAQ", "brow grooming FAQ", "eyebrow product FAQ", "brow product support", "LUMA customer support", "LUMA order support", "brow product enquiry", "brow product help", "how to order brow products", "brow product delivery questions", "brow product return questions", "brow product stock questions", "brow product restock updates", "brow product waitlist", "brow product shipping", "beauty order support", "LUMA contact", "contact LUMA Skincare", "LUMA support"
  ],
  shippingOrderKeywords: [
    "brow product shipping", "LUMA shipping", "LUMA delivery", "beauty product delivery", "brow product delivery", "order brow products online", "track LUMA order", "LUMA checkout", "secure beauty checkout", "online beauty order", "brow products delivered", "delivery for brow products", "beauty delivery Nigeria", "LUMA returns", "LUMA refund policy", "brow product returns", "brow product exchange", "customer care for beauty orders", "LUMA order confirmation", "LUMA payment support"
  ],
  brandKeywords: [
    "LUMA Skincare", "LUMA", "LUMA beauty", "LUMA brows", "LUMA brow care", "LUMA brow beauty", "LUMA brow routine", "LUMA beauty products", "LUMA clean beauty", "LUMA soft luxury", "LUMA everyday beauty", "LUMA polished brows", "LUMA natural brows", "LUMA brow styling", "LUMA brow grooming", "LUMA beauty essentials", "LUMA product system", "LUMA at-home brows", "shop LUMA", "shop LUMA Skincare"
  ],
  problemSolutionKeywords: [
    "brow products for uneven brows", "brow products for patchy brows", "brow products for thin brows", "brow products for light brows", "brow products for dark brows", "brow products for coarse brows", "brow products for soft hold", "brow products for stronger hold", "brow products for natural colour", "brow product for filling gaps", "brow product for shaping arches", "brow product for taming brow hairs", "brow product for no-makeup makeup", "brow product for polished work makeup", "brow product for quick mornings", "brow product for low maintenance beauty", "brow product for salon-like finish", "brow product for clean application", "brow product for controlled strokes", "brow product for face-framing definition"
  ],
  beginnerKeywords: [
    "brow products for beginners", "eyebrow products for beginners", "beginner brow routine", "simple brow products", "easy brow products", "starter brow kit", "first brow product", "how beginners style brows", "beginner eyebrow grooming", "beginner brow makeup", "brow essentials for beginners", "daily brow routine for beginners", "natural brow makeup for beginners", "brow styling guide", "brow care guide", "brow product guide", "what to buy for brows", "how to start brow grooming", "easy eyebrow styling", "beginner-friendly brow products"
  ],
  premiumKeywords: [
    "premium brow care", "premium brow grooming", "premium brow styling", "premium eyebrow products", "luxury eyebrow products", "soft luxury beauty products", "elevated brow routine", "high-quality brow products", "refined brow essentials", "professional-looking brows at home", "salon-inspired brow products", "beauty products for polished brows", "modern luxury beauty", "clean premium beauty", "luxury beauty essentials", "premium everyday beauty", "elegant brow products", "minimal luxury brows", "premium brow finish", "sophisticated brow routine"
  ],
};

export const browKeywordGroups = groups;
export const browKeywordBank = Object.values(groups).flat();
export const browKeywordCount = browKeywordBank.length;

export const keywordBankNote =
  "Meta keywords are not used because modern search engines do not rely on the meta keywords tag, and keyword stuffing can hurt SEO. The keyword bank is used only for natural content planning.";
