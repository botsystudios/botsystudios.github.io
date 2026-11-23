import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ORIGINS = new Set(["http://localhost:5500","https://botsystudios.github.io","https://botsystudios.com","https://www.botsystudios.com"]);
const ROLES = new Set(["1484246357467463793","1484246312542011492","1484246309450813652","1484246358763376640"]);
const DISCORD_GUILD_ID = "1409889811896078368";
const cors = (origin:string|null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.has(origin) ? origin : "https://botsystudios.github.io",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"
});
const reply = (body:unknown,status=200,h:Record<string,string>={}) => new Response(JSON.stringify(body),{status,headers:{...h,"Content-Type":"application/json"}});
const statuses = new Set(["approved","in_progress","quality_check","awaiting_review","revision_requested","revision_in_progress","completed","cancelled"]);
const titles:Record<string,string> = {approved:"Order approved",in_progress:"Work in progress",quality_check:"Quality check started",awaiting_review:"Work submitted for review",revision_requested:"Revision requested",revision_in_progress:"Revision work started",completed:"Order completed",cancelled:"Order cancelled"};
Deno.serve(async req => {
 const h=cors(req.headers.get("origin"));
 if(req.method==="OPTIONS") return new Response("ok",{headers:h});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405,h);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token) return reply({error:"Sign in with Discord to continue."},401,h);
 const url=Deno.env.get("SUPABASE_URL")||"", service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const pub=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const bot=Deno.env.get("DISCORD_BOT_TOKEN")||"", guild=DISCORD_GUILD_ID;
 if(!url||!service||!pub||!bot) return reply({error:"Staff access verification is not fully configured. Contact the site administrator."},503,h);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await auth.auth.getUser(token);
 if(authError||!authData.user) return reply({error:"Your sign-in session is invalid. Please sign in again."},401,h);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:identityError}=await db.from("discord_identities").select("discord_id").eq("user_id",authData.user.id).maybeSingle();
 if(identityError) return reply({error:"Could not verify your linked Discord account."},500,h);
 if(!identity?.discord_id) return reply({error:"No linked Discord account was found. Sign in using your Botsy Discord account."},403,h);
 let memberRes:Response;
 try{memberRes=await fetch("https://discord.com/api/v10/guilds/"+guild+"/members/"+identity.discord_id,{headers:{Authorization:"Bot "+bot}})}catch(error){console.error("Discord member lookup network failure:",String(error));return reply({error:"Could not reach Discord. Please try again shortly."},502,h)}
 if(memberRes.status===404){
  const discordError=await memberRes.clone().json().catch(()=>null);
  const discordCode=Number(discordError?.code||0);
  console.error("Discord member lookup returned 404:",{code:discordCode,message:String(discordError?.message||"").slice(0,120)});
  if(discordCode===10004) return reply({error:"Discord cannot find this server for the installed bot. Confirm the Botsy bot integration is in the configured server."},403,h);
  if(discordCode===10007) return reply({error:"Discord found the server, but the account linked to this portal is not a member. Sign in with the Discord account that has the Staff Team role."},403,h);
  return reply({error:"Discord could not find the linked member in this server. Check that the bot and the Discord account linked to the portal are both in the same server."},403,h);
 }
 if(memberRes.status===401){console.error("Discord member lookup rejected the bot token (401).");return reply({error:"The Discord bot token saved in Supabase is invalid or expired. Update DISCORD_BOT_TOKEN in Edge Function Secrets."},502,h)}
 if(memberRes.status===403){console.error("Discord denied the bot access to the configured guild member (403).");return reply({error:"Discord denied the bot access. Check that the bot is in the configured server and that Server Members Intent is enabled in the Discord Developer Portal."},502,h)}
 if(memberRes.status===429){console.error("Discord rate-limited the staff role verification request (429).");return reply({error:"Discord is rate-limiting role checks. Wait briefly and try again."},503,h)}
 if(!memberRes.ok){console.error("Discord member lookup failed with HTTP status:",memberRes.status);return reply({error:"Discord role verification failed (HTTP "+memberRes.status+"). Check the bot token, server ID and bot access."},502,h)}
 const discordMember=await memberRes.json();
 const matched=(discordMember.roles||[]).filter((role:string)=>ROLES.has(role));
 if(!matched.length) return reply({error:"Access denied. Staff Dashboard access requires Staff Team, Development Team, Ownership, or Founder."},403,h);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return reply({error:"Invalid request body."},400,h)}
 const actor=authData.user.user_metadata?.full_name||authData.user.user_metadata?.name||authData.user.user_metadata?.user_name||"Botsy Staff";
 const actorDiscord=identity.discord_id;
 if(body.action==="list"){
  const [o,e,n]=await Promise.all([
   db.from("orders").select("id,external_order_id,client_discord_id,client_discord_username,service_name,status,claimed_by_discord_id,claimed_by_name,ticket_channel_id,created_at,updated_at").order("updated_at",{ascending:false}),
   db.from("order_events").select("id,order_id,event_type,title,description,actor_name,created_at").order("created_at",{ascending:false}).limit(500),
   db.from("order_internal_notes").select("id,order_id,note,author_name,created_at").order("created_at",{ascending:false}).limit(500)
  ]);
  if(o.error||e.error||n.error) return reply({error:"Could not load staff workspace data."},500,h);
  return reply({ok:true,staff:{discord_id:actorDiscord,name:actor,roles:matched},orders:o.data||[],events:e.data||[],notes:n.data||[]},200,h);
 }
 if(body.action==="update_order"){
  const id=String(body.order_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id)) return reply({error:"Choose a valid order."},400,h);
  const {data:order,error:oe}=await db.from("orders").select("id,status").eq("id",id).maybeSingle();
  if(oe||!order) return reply({error:"Order not found."},404,h);
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  const events:Record<string,unknown>[]=[];
  if(body.status!==undefined){
   const status=String(body.status);
   if(!statuses.has(status)) return reply({error:"Unsupported status."},400,h);
   if(status!==order.status){patch.status=status;events.push({event_type:"staff_status_updated",title:titles[status],description:"Order status changed to "+status.replaceAll("_"," ")+ "."})}
  }
  if(body.assigned_discord_id!==undefined){
   const did=String(body.assigned_discord_id||"").trim(),name=String(body.assigned_name||"").trim();
   if(did && (!/^\d{17,20}$/.test(did)||!name||name.length>100)) return reply({error:"Enter a valid Discord user ID and display name."},400,h);
   patch.claimed_by_discord_id=did||null;patch.claimed_by_name=did?name:null;
   events.push({event_type:"staff_assignment_updated",title:"Staff assignment updated",description:did?"Assigned to "+name+".":"Staff assignment released."});
  }
  const completed=String(body.work_completed||"").trim().slice(0,1500),next=String(body.next_steps||"").trim().slice(0,1500),blocked=String(body.blocked||"").trim().slice(0,1000);
  if(completed||next||blocked){const lines=[];if(completed)lines.push("Work completed: "+completed);if(next)lines.push("Next steps: "+next);if(blocked)lines.push("Blocked / client action: "+blocked);events.push({event_type:"progress_updated",title:"Project progress updated",description:lines.join("\n")})}
  const {error:updateError}=await db.from("orders").update(patch).eq("id",id);
  if(updateError)return reply({error:"Could not save the order update."},500,h);
  for(const event of events){const {error}=await db.from("order_events").insert({source_event_id:"staff-console:"+crypto.randomUUID(),order_id:id,...event,actor_discord_id:actorDiscord,actor_name:actor});if(error)return reply({error:"Order saved, but its timeline event could not be recorded."},500,h)}
  return reply({ok:true},200,h);
 }
 if(body.action==="add_note"){
  const id=String(body.order_id||""),note=String(body.note||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(id)||!note||note.length>3000)return reply({error:"Enter an internal note (maximum 3,000 characters)."},400,h);
  const {error}=await db.from("order_internal_notes").insert({order_id:id,note,author_user_id:authData.user.id,author_name:actor});
  if(error)return reply({error:"Could not save the internal note."},500,h);
  return reply({ok:true},200,h);
 }
 return reply({error:"Unknown action."},400,h);
});
