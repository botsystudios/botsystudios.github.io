const config = window.BOTSY_SUPABASE_CONFIG || {};
const reviewList = document.getElementById("reviews");
const reviewSummary = document.getElementById("summary");

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const stars = (rating) => {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(value) + "☆".repeat(5 - value);
};

async function readLegacyReviews() {
  try {
    const response = await fetch("reviews.json", { cache: "no-store" });
    if (!response.ok) return [];
    const reviews = await response.json();
    return Array.isArray(reviews) ? reviews : [];
  } catch {
    return [];
  }
}

function normalizeLiveReview(row) {
  const average = (Number(row.staff_rating) + Number(row.efficiency_rating) + Number(row.final_product_rating)) / 3;
  return {
    name: row.reviewer_name,
    service: row.service_name,
    date: row.created_at,
    text: row.feedback,
    rating: average,
    staff: Number(row.staff_rating),
    efficiency: Number(row.efficiency_rating),
    product: Number(row.final_product_rating),
  };
}

function renderReviews(reviews) {
  if (!reviews.length) {
    reviewList.innerHTML = '<article class="card empty"><div class="icon">⭐</div><h3>No reviews yet</h3><p>Clients can share feedback with <code>/review</code> in the Botsy Studios Discord.</p></article>';
    return;
  }

  const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
  reviewSummary.hidden = false;
  reviewSummary.innerHTML = `<b>${average.toFixed(1)}</b><div><div class="stars">${stars(average)}</div><small>${reviews.length} client review${reviews.length === 1 ? "" : "s"}</small></div>`;

  reviewList.innerHTML = reviews.map((review) => {
    const name = escapeHtml(review.name || "Client");
    const service = escapeHtml(review.service || "Botsy Studios project");
    const date = review.date ? new Date(review.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    const ratingRows = [
      ["Staff Service", review.staff],
      ["Service Efficiency", review.efficiency],
      ["Final Product", review.product],
    ].filter(([, rating]) => Number(rating) > 0);
    const ratings = ratingRows.length
      ? `<div class="review-ratings">${ratingRows.map(([label, rating]) => `<div class="review-rating"><span>${label}</span><strong>${Number(rating)}/5</strong></div>`).join("")}</div>`
      : `<div class="stars">${stars(review.rating)}</div>`;
    return `<article class="card review"><div class="review-head"><div class="avatar" aria-hidden="true">${name.charAt(0).toUpperCase()}</div><div><strong>${name}</strong><small>${service}${date ? ` · ${date}` : ""}</small></div></div>${ratings}<p>${escapeHtml(review.text || "")}</p></article>`;
  }).join("");
}

async function loadWebsiteReviews() {
  let liveReviews = [];
  if (config.url && config.anonKey) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const client = createClient(config.url, config.anonKey);
      const { data, error } = await client
        .from("website_reviews")
        .select("reviewer_name,service_name,staff_rating,efficiency_rating,final_product_rating,feedback,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      liveReviews = (data || []).map(normalizeLiveReview);
    } catch (error) {
      console.error("Could not load live Botsy reviews", error);
    }
  }

  const legacyReviews = await readLegacyReviews();
  renderReviews([...liveReviews, ...legacyReviews]);
}

if (reviewList) loadWebsiteReviews();
