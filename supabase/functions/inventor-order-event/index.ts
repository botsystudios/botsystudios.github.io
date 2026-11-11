import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-botsy-webhook-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const allowedStatuses = new Set(["approved","in_progress","quality_check","awaiting_review","revision_requested","revision_in_progress","completed","cancelled"]);
const eventCopy: Record<string,{title:string;status?:string}> = {
 order_approved:{title:"Order approved",status:"approved"},
 staff_claimed:{title:"Staff member claimed your order",status:"in_progress"},
 staff_released:{title:"Order assignment released",status:"approved"},
 work_started:{title:"Work started",status:"in_progress"},
 quality_check:{title:"Quality check started",status:"quality_check"},
 awaiting_review:{title:"Work submitted for review",status:"awaiting_review"},
 revision_requested:{title:"Revision requested",status:"revision_requested"},
 revision_started:{title:"Revision work started",status:"revision_in_progress"},
 order_completed:{title:"Order completed",status:"completed"},
 order_cancelled:{title:"Order cancelled",status:"cancelled"},
 progress_updated:{title:"Project progress updated"}
};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:corsHeaders});
 const expected=Deno.env.get("BOTSY_WEBHOOK_SECRET");
 if(!expected || req.headers.get("x-botsy-webhook-secret")!==expected) return Response.json({error:"Unauthorized"},{status:401,headers:corsHeaders});
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url || !key) return Response.json({error:"Server configuration is incomplete"},{status:500,headers:corsHeaders});
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400,headers:corsHeaders})}
 const eventId=String(body.event_id??"").trim(), eventType=String(body.event_type??"").trim(), externalId=String(body.external_order_id??"").trim();
 const clientId=String(body.client_discord_id??"").trim(), service=String(body.service_name??"").trim();
 if(!eventId || !eventType || !externalId || !eventCopy[eventType]) return Response.json({error:"event_id, supported event_type and external_order_id are required"},{status:400,headers:corsHeaders});
 if(eventType==="order_approved" && (!clientId || !service)) return Response.json({error:"Approved orders require client_discord_id and service_name"},{status:400,headers:corsHeaders});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:duplicate}=await db.from("order_events").select("id").eq("source_event_id",eventId).maybeSingle();
 if(duplicate) return Response.json({ok:true,duplicate:true},{headers:corsHeaders});
 let order:any;
 if(eventType==="order_approved"){
  const {data:existing,error:findError}=await db.from("orders").select("id,client_discord_id").eq("external_order_id",externalId).maybeSingle();
  if(findError) return Response.json({error:findError.message},{status:500,headers:corsHeaders});
  if(existing && existing.client_discord_id!==clientId) return Response.json({error:"Order ownership mismatch"},{status:409,headers:corsHeaders});
  const {data,error}=await db.from("orders").upsert({external_order_id:externalId,client_discord_id:clientId,client_discord_username:String(body.client_discord_username??""),service_name:service,status:"approved",ticket_channel_id:String(body.ticket_channel_id??"")||null,updated_at:new Date().toISOString()},{onConflict:"external_order_id"}).select().single();
  if(error) return Response.json({error:error.message},{status:500,headers:corsHeaders});
  order=data;
 }else{
  const {data,error}=await db.from("orders").select("*").eq("external_order_id",externalId).maybeSingle();
  if(error) return Response.json({error:error.message},{status:500,headers:corsHeaders});
  if(!data) return Response.json({error:"Order not found; approve it first"},{status:404,headers:corsHeaders});
  order=data;
 }
 const copy=eventCopy[eventType], nextStatus=eventType==="progress_updated"?String(body.status??order.status):(copy.status??order.status);
 if(!allowedStatuses.has(nextStatus)) return Response.json({error:"Unsupported order status"},{status:400,headers:corsHeaders});
 const patch:Record<string,unknown>={status:nextStatus,updated_at:new Date().toISOString()};
 if(eventType==="staff_claimed"){patch.claimed_by_discord_id=String(body.actor_discord_id??"");patch.claimed_by_name=String(body.actor_name??"Staff member")}
 if(eventType==="staff_released"){patch.claimed_by_discord_id=null;patch.claimed_by_name=null}
 const {error:updateError}=await db.from("orders").update(patch).eq("id",order.id);
 if(updateError) return Response.json({error:updateError.message},{status:500,headers:corsHeaders});
 const {error:eventError}=await db.from("order_events").insert({source_event_id:eventId,order_id:order.id,event_type:eventType,title:copy.title,description:String(body.description??""),actor_discord_id:String(body.actor_discord_id??"")||null,actor_name:String(body.actor_name??"")||null});
 if(eventError) return Response.json({error:eventError.message},{status:500,headers:corsHeaders});
 return Response.json({ok:true,order_id:order.id,status:nextStatus},{headers:corsHeaders});
});
