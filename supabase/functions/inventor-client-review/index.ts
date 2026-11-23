import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-botsy-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const cleanText = (value: unknown, max: number) =>
  String(value ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("BOTSY_WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-botsy-webhook-secret") !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const eventId = cleanText(body.event_id, 100);
  const reviewerName = cleanText(body.reviewer_name, 80);
  const serviceName = cleanText(body.service_name, 100);
  const feedback = cleanText(body.feedback, 1000);
  const staffRating = Number(body.staff_rating);
  const efficiencyRating = Number(body.efficiency_rating);
  const finalProductRating = Number(body.final_product_rating);

  if (!eventId || reviewerName.length < 1 || serviceName.length < 2 || feedback.length < 5) {
    return json({ error: "A review ID, reviewer, service, and feedback are required" }, 400);
  }
  if (![staffRating, efficiencyRating, finalProductRating].every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    return json({ error: "Ratings must be whole numbers from 1 to 5" }, 400);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("website_reviews").insert({
    source_event_id: eventId,
    reviewer_name: reviewerName,
    service_name: serviceName,
    staff_rating: staffRating,
    efficiency_rating: efficiencyRating,
    final_product_rating: finalProductRating,
    feedback,
  });

  if (error?.code === "23505") return json({ ok: true, duplicate: true });
  if (error) return json({ error: "Review could not be saved" }, 500);
  return json({ ok: true }, 201);
});
