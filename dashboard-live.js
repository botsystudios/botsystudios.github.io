import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const root = document.querySelector(".content");
const config = window.BOTSY_SUPABASE_CONFIG || {};
const configured = config.url && !config.url.includes("YOUR_PROJECT_REF") &&
  config.anonKey && !config.anonKey.includes("YOUR_SUPABASE");

const esc = (value="") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date = value => value ? new Date(value).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}) : "—";
const statusLabel = value => ({
 approved:"Approved",in_progress:"In progress",quality_check:"Quality check",
 awaiting_review:"Awaiting review",revision_requested:"Revision requested",
 revision_in_progress:"Revision in progress",completed:"Completed",cancelled:"Cancelled"
}[value] || String(value || "Updated").replaceAll("_"," "));
const statusClass = value => ["completed"].includes(value)?"done":
  ["quality_check","awaiting_review","revision_requested"].includes(value)?"review":"";
const showMessage = (heading, body, buttonText="", onClick=null) => {
 root.innerHTML = `<section class="panel" style="max-width:680px;margin:55px auto;padding:28px">
   <div class="eyebrow">Botsy Studios · Client Portal</div>
   <h1 style="font:700 1.8rem 'Space Grotesk';margin:13px 0">${esc(heading)}</h1>
   <p style="color:#9aacc6;line-height:1.8">${esc(body)}</p>
   ${buttonText?'<button id="portal-action" class="new-order" style="margin-top:15px">'+esc(buttonText)+'</button>':""}
 </section>`;
 if(buttonText && onClick) root.querySelector("#portal-action").addEventListener("click",onClick);
};
if(!configured){
 showMessage("Portal setup required","The live client portal is prepared, but it is not connected to a Supabase project yet. Follow supabase/README.md, then add your public project URL and anon key to supabase-config.js. Demo orders are intentionally hidden.");
} else {
 const supabase=createClient(config.url,config.anonKey);
 const renderLogin=()=>showMessage("Your projects, all in one place","Sign in securely with the Discord account you used when placing your Botsy Studios order.","Continue with Discord",async()=>{
   const {error}=await supabase.auth.signInWithOAuth({provider:"discord",options:{scopes:"identify",redirectTo:window.location.origin+window.location.pathname}});
   if(error) showMessage("Sign-in could not start",error.message);
 });
 const renderDashboard=async(user)=>{
   const discordId=String(user.user_metadata?.provider_id || "");
   if(!discordId){await supabase.auth.signOut();showMessage("Discord identity unavailable","Supabase did not return the Discord account ID. Check that Discord OAuth is enabled and configured correctly.");return;}
   const {data:orders,error}=await supabase.from("orders").select("*").eq("client_discord_id",discordId).order("created_at",{ascending:false});
   if(error){showMessage("Could not load your orders",error.message);return;}
   const orderIds=(orders||[]).map(o=>o.id);
   let events=[];
   if(orderIds.length){
     const result=await supabase.from("order_events").select("*").in("order_id",orderIds).order("created_at",{ascending:false}).limit(20);
     if(result.error){showMessage("Could not load order activity",result.error.message);return;}
     events=result.data||[];
   }
   const active=orders.filter(o=>!["completed","cancelled"].includes(o.status)).length;
   const completed=orders.filter(o=>o.status==="completed").length;
   const waiting=orders.filter(o=>["approved","awaiting_review","quality_check"].includes(o.status)).length;
   const displayName=user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || "Discord client";
   const avatar=user.user_metadata?.avatar_url;
   document.querySelector(".top-actions").innerHTML='<button id="signout" class="secondary btn" style="min-height:36px;padding:0 12px">Sign out</button><div class="avatar">'+(avatar?'<img src="'+esc(avatar)+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">':esc(displayName.slice(0,2).toUpperCase()))+'</div>';
   document.querySelector(".topbar .crumb").innerHTML='Workspace <span style="color:#536b8b">/</span> <strong>Overview</strong>';
   root.innerHTML=`
    <section class="welcome"><div><div class="eyebrow">Client workspace</div><h1>Welcome back, ${esc(displayName)}.</h1><p>Here is the latest progress on your Botsy Studios projects.</p></div><a class="new-order" href="https://discord.gg/PQXCjgDQSe" target="_blank" rel="noopener noreferrer">＋ Start a new enquiry ↗</a></section>
    <section class="stats">
      <article class="stat"><div class="stat-top"><span>Active orders</span><span class="stat-icon">◷</span></div><div class="stat-value">${active}</div><div class="stat-foot">Currently being handled</div></article>
      <article class="stat"><div class="stat-top"><span>Awaiting action</span><span class="stat-icon">⌛</span></div><div class="stat-value">${waiting}</div><div class="stat-foot">In review or awaiting next step</div></article>
      <article class="stat"><div class="stat-top"><span>Completed orders</span><span class="stat-icon">✓</span></div><div class="stat-value">${completed}</div><div class="stat-foot">Successfully delivered</div></article>
      <article class="stat"><div class="stat-top"><span>Activity updates</span><span class="stat-icon">↗</span></div><div class="stat-value">${events.length}</div><div class="stat-foot">Latest recorded events</div></article>
    </section>
    <div class="section-grid">
      <section class="panel" id="orders"><div class="panel-head"><h2>My orders</h2><span style="color:#91c5ff;font-size:.75rem">${orders.length} total</span></div>
       <div class="orders">${orders.length?orders.map(o=>'<article class="order"><div><div class="order-name">'+esc(o.service_name)+'</div><div class="order-id">ORDER #'+esc(o.external_order_id)+'</div><div class="order-meta"><span>Placed '+esc(date(o.created_at))+'</span><span>·</span><span>'+(o.claimed_by_name?'Assigned to '+esc(o.claimed_by_name):'Awaiting staff assignment')+'</span></div></div><span class="status '+statusClass(o.status)+'">'+esc(statusLabel(o.status))+'</span></article>').join(""):'<div class="empty-note">No approved orders are linked to this Discord account yet. Once management approves your order in Discord, it will appear here.</div>'}</div>
      </section>
      <section class="panel" id="activity"><div class="panel-head"><h2>Latest activity</h2><span style="color:#91c5ff;font-size:.75rem">Live feed</span></div>
       <div class="activity-list">${events.length?events.map(e=>'<div class="activity"><span class="activity-dot">✓</span><div><strong>'+esc(e.title)+'</strong><p>'+esc(e.description || (e.actor_name?'Updated by '+e.actor_name:'Order progress updated'))+'</p><time>'+esc(date(e.created_at))+'</time></div></div>').join(""):'<div class="empty-note">Order updates will appear here as the Botsy team progresses through your project.</div>'}</div>
      </section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-head"><h2>Connected account</h2></div><div class="profile"><div class="profile-avatar">DC</div><div><strong>${esc(displayName)}</strong><span>Discord account verified</span></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Need support?</h2></div><div class="empty-note">Contact the Botsy Studios team through your Discord ticket for help with an order.</div></section>
    </div>`;
   document.getElementById("signout").addEventListener("click",async()=>{await supabase.auth.signOut();location.reload()});
   // Realtime is supplementary; reload on any visible order or event change.
   supabase.channel("client-orders-"+discordId)
    .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:"client_discord_id=eq."+discordId},()=>renderDashboard(user))
    .on("postgres_changes",{event:"*",schema:"public",table:"order_events"},()=>renderDashboard(user))
    .subscribe();
 };
 const {data:{session},error}=await supabase.auth.getSession();
 if(error) showMessage("Session error",error.message);
 else if(session?.user) await renderDashboard(session.user);
 else renderLogin();
 supabase.auth.onAuthStateChange(async(event,session)=>{if(event==="SIGNED_IN" && session?.user) await renderDashboard(session.user);});
}
