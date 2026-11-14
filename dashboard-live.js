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

const portalStyle=document.createElement("style");
portalStyle.textContent=".order{grid-template-columns:minmax(0,1fr) auto}.order-details{grid-column:1/-1;border-top:1px solid #9dbbe718;padding-top:12px}.order-details summary{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#a9cfff;font-size:.73rem;font-weight:700;cursor:pointer;list-style:none}.order-details summary::-webkit-details-marker{display:none}.order-details summary:after{content:'＋';color:#8abfff;font-size:1rem;transition:transform .2s}.order-details[open] summary:after{content:'−'}.order-expand{padding:18px 0 3px}.tracker-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:11px;color:#d9eaff;font-size:.75rem;font-weight:700}.tracker-head span:last-child{color:#8fa8c8;font-size:.68rem;font-weight:500}.tracker-bar{height:6px;overflow:hidden;border-radius:99px;background:#ffffff12}.tracker-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#1677ff,#5bdcff);box-shadow:0 0 14px #2583ff88;transition:width .5s ease}.tracker-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.tracker-step{color:#7185a2;font-size:.63rem;line-height:1.4}.tracker-step:before{display:block;width:7px;height:7px;margin-bottom:6px;border:1px solid #5a7190;border-radius:50%;background:#0c192d;content:''}.tracker-step.done{color:#b9d9ff}.tracker-step.done:before{border-color:#50baff;background:#50baff;box-shadow:0 0 10px #50baff88}.order-timeline{display:grid;gap:0;margin:18px 0 15px}.order-timeline .activity{padding-bottom:14px}.order-timeline .activity:last-child{padding-bottom:0}.order-support{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #68aaff3b;border-radius:8px;background:#1677ff12;color:#a9d1ff;font-size:.69rem;font-weight:700}.order-support:hover{border-color:#68aaff88;background:#1677ff22}@media(max-width:560px){.tracker-step{font-size:.57rem}.order-details summary{font-size:.68rem}}";
portalStyle.textContent += ".deliverables,.feedback{margin:18px 0;padding:15px;border:1px solid #9dbbe718;border-radius:11px;background:#07142688}.feature-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 11px;color:#d9eaff;font-size:.78rem;font-weight:700}.feature-sub{color:#8196b5;font-size:.67rem;font-weight:500}.deliverable-list{display:grid;gap:8px}.deliverable{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid #9dbbe714;border-radius:8px;background:#ffffff05}.deliverable-name{color:#e4efff;font-size:.73rem;font-weight:700;overflow-wrap:anywhere}.deliverable-meta{margin-top:4px;color:#8196b5;font-size:.65rem;line-height:1.5}.download-deliverable{flex:none;padding:8px 10px;border:1px solid #438fff55;border-radius:8px;background:#1677ff18;color:#a9d1ff;font-size:.68rem;font-weight:700}.download-deliverable:disabled{opacity:.55;cursor:wait}.feedback-form{display:grid;gap:9px}.feedback-form label{color:#9aacc6;font-size:.68rem;font-weight:700}.feedback-form select,.feedback-form textarea{width:100%;padding:10px;border:1px solid #9dbbe72a;border-radius:8px;background:#09172b;color:#eaf2ff;font:inherit;font-size:.75rem}.feedback-form textarea{min-height:76px;resize:vertical}.feedback-submit{justify-self:start;padding:9px 13px;border:0;border-radius:8px;background:linear-gradient(110deg,#1680ff,#285ce6);color:white;font-size:.7rem;font-weight:700}.feedback-message{color:#ffb5a9;font-size:.68rem}.feedback-thanks{color:#9dc9ff;font-size:.73rem;line-height:1.6}.feedback-stars{color:#79caff;letter-spacing:2px}.feedback-comment{margin-top:5px;color:#aabbd2;font-size:.7rem;line-height:1.6;overflow-wrap:anywhere}@media(max-width:560px){.deliverable{align-items:flex-start;flex-direction:column}.download-deliverable{width:100%}}";
document.head.append(portalStyle);
const stageFor=status=>({approved:0,in_progress:1,revision_requested:1,revision_in_progress:1,quality_check:2,awaiting_review:2,completed:3,cancelled:-1}[status]??0);
const progressFor=status=>({approved:18,in_progress:48,revision_requested:48,revision_in_progress:54,quality_check:76,awaiting_review:91,completed:100,cancelled:0}[status]??18);
const orderEventsFor=(all,id)=>all.filter(event=>event.order_id===id).slice(0,8);
const orderDeliverablesFor=(all,id)=>all.filter(file=>file.order_id===id);
const orderFeedbackFor=(all,id)=>all.find(item=>item.order_id===id);
const formatBytes=value=>{const bytes=Number(value||0);if(!bytes)return "File";const units=["B","KB","MB","GB"];let size=bytes,index=0;while(size>=1024&&index<units.length-1){size/=1024;index++;}return size.toFixed(index?1:0)+" "+units[index];};
const renderOrderProgress=order=>{
 const steps=["Approved","In progress","Quality check","Completed"],stage=stageFor(order.status),percent=progressFor(order.status),cancelled=order.status==="cancelled";
 return '<div class="tracker-head"><span>'+(cancelled?"Order cancelled":"Project progress")+'</span><span>'+(cancelled?"Closed":percent+"%")+'</span></div>'+
 '<div class="tracker-bar" role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><div class="tracker-fill" style="width:'+percent+'%"></div></div>'+
 '<div class="tracker-steps">'+steps.map((label,index)=>'<div class="tracker-step '+(!cancelled&&index<=stage?"done":"")+'">'+label+'</div>').join("")+'</div>';
};
document.querySelector(".preview")?.remove();
let realtimeChannel = null;
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
 try {
   const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
   const supabase=createClient(config.url,config.anonKey);
 const renderLogin=()=>showMessage("Your projects, all in one place","Sign in securely with the Discord account you used when placing your Botsy Studios order.","Continue with Discord",async()=>{
   const {error}=await supabase.auth.signInWithOAuth({provider:"discord",options:{scopes:"identify",redirectTo:window.location.origin+window.location.pathname}});
   if(error) showMessage("Sign-in could not start",error.message);
 });
 const renderDashboard=async(user)=>{
   const {data:identity,error:identityError}=await supabase.from("discord_identities").select("discord_id").eq("user_id",user.id).maybeSingle();
   if(identityError){showMessage("Could not verify your Discord account",identityError.message);return;}
   const discordId=String(identity?.discord_id || "");
   if(!discordId){showMessage("Discord identity is still being linked","Sign out and sign in again with Discord. If this continues, contact Botsy support.");return;}
   const {data:orders,error}=await supabase.from("orders").select("*").eq("client_discord_id",discordId).order("created_at",{ascending:false});
   if(error){showMessage("Could not load your orders",error.message);return;}
   const orderIds=(orders||[]).map(o=>o.id);
   let events=[];
   let deliverables=[],feedback=[];
   if(orderIds.length){
     const [eventResult,fileResult,feedbackResult]=await Promise.all([
       supabase.from("order_events").select("*").in("order_id",orderIds).order("created_at",{ascending:false}).limit(20),
       supabase.from("order_deliverables").select("*").in("order_id",orderIds).order("created_at",{ascending:false}),
       supabase.from("client_feedback").select("*").in("order_id",orderIds)
     ]);
     if(eventResult.error){showMessage("Could not load order activity",eventResult.error.message);return;}
     if(fileResult.error){showMessage("Could not load project deliveries",fileResult.error.message);return;}
     if(feedbackResult.error){showMessage("Could not load client feedback",feedbackResult.error.message);return;}
     events=eventResult.data||[];
     deliverables=fileResult.data||[];
     feedback=feedbackResult.data||[];
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
       <div class="orders">${orders.length?orders.map(o=>{
        const orderEvents=orderEventsFor(events,o.id);
        const orderFiles=orderDeliverablesFor(deliverables,o.id);
        const submittedFeedback=orderFeedbackFor(feedback,o.id);
        return '<article class="order"><div><div class="order-name">'+esc(o.service_name)+'</div><div class="order-id">ORDER #'+esc(o.external_order_id)+'</div><div class="order-meta"><span>Placed '+esc(date(o.created_at))+'</span><span>·</span><span>'+(o.claimed_by_name?'Assigned to '+esc(o.claimed_by_name):'Awaiting staff assignment')+'</span></div></div><span class="status '+statusClass(o.status)+'">'+esc(statusLabel(o.status))+'</span>'+
          '<details class="order-details"><summary>View project progress and updates</summary><div class="order-expand">'+renderOrderProgress(o)+
          '<div class="tracker-head" style="margin-top:20px"><span>Project timeline</span><span>'+orderEvents.length+' update'+(orderEvents.length===1?"":"s")+'</span></div>'+
          (orderEvents.length?'<div class="order-timeline">'+orderEvents.map(event=>'<div class="activity"><span class="activity-dot">✓</span><div><strong>'+esc(event.title)+'</strong><p>'+esc(event.description || (event.actor_name?'Updated by '+event.actor_name:'Order progress updated'))+'</p><time>'+esc(date(event.created_at))+'</time></div></div>').join("")+'</div>':'<p class="empty-note" style="padding:7px 0 14px">Updates will appear here as the team progresses through your project.</p>')+
          '<section class="deliverables"><div class="feature-title"><span>Deliverables & files</span><span class="feature-sub">'+orderFiles.length+' file'+(orderFiles.length===1?"":"s")+'</span></div>'+
          (orderFiles.length?'<div class="deliverable-list">'+orderFiles.map(file=>'<div class="deliverable"><div><div class="deliverable-name">'+esc(file.file_name)+'</div><div class="deliverable-meta">'+esc(file.description||"Project file")+' · '+esc(formatBytes(file.file_size))+' · '+esc(date(file.created_at))+'</div></div><button type="button" class="download-deliverable" data-path="'+esc(file.object_path)+'" data-name="'+esc(file.file_name)+'">Download ↧</button></div>').join("")+'</div>':'<p class="empty-note">Your completed files and project documents will appear here when the team publishes them.</p>')+'</section>'+
          (o.status==="completed"?'<section class="feedback"><div class="feature-title"><span>Client feedback</span><span class="feature-sub">'+(submittedFeedback?"Submitted":"Your review")+'</span></div>'+
            (submittedFeedback?'<div class="feedback-thanks"><div class="feedback-stars">'+("★".repeat(Number(submittedFeedback.rating)))+("☆".repeat(5-Number(submittedFeedback.rating)))+'</div>Thanks for sharing your feedback.</div>'+(submittedFeedback.comment?'<div class="feedback-comment">'+esc(submittedFeedback.comment)+'</div>':""):
            '<form class="feedback-form" data-feedback-order="'+esc(o.id)+'"><label>How was your experience?</label><select name="rating" required><option value="">Choose a rating</option><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Could be better</option><option value="1">1 — Needs improvement</option></select><label for="feedback-'+esc(o.id)+'">Comments (optional)</label><textarea id="feedback-'+esc(o.id)+'" name="comment" maxlength="1000" placeholder="Tell us what went well or what we could improve."></textarea><div class="feedback-message" aria-live="polite"></div><button class="feedback-submit" type="submit">Submit feedback</button></form>')+'</section>':
            '<section class="feedback"><div class="feature-title"><span>Client feedback</span><span class="feature-sub">Available after completion</span></div><p class="empty-note">You can rate your experience once this order is marked completed.</p></section>')+
          '<a class="order-support" href="https://discord.gg/PQXCjgDQSe" target="_blank" rel="noopener noreferrer">Ask about this order · #'+esc(o.external_order_id)+' ↗</a></div></details></article>';
      }).join(""):'<div class="empty-note">No approved orders are linked to this Discord account yet. Once management approves your order in Discord, it will appear here.</div>'}</div>
      </section>
      <section class="panel" id="activity"><div class="panel-head"><h2>Latest activity</h2><span style="color:#91c5ff;font-size:.75rem">Live feed</span></div>
       <div class="activity-list">${events.length?events.map(e=>'<div class="activity"><span class="activity-dot">✓</span><div><strong>'+esc(e.title)+'</strong><p>'+esc(e.description || (e.actor_name?'Updated by '+e.actor_name:'Order progress updated'))+'</p><time>'+esc(date(e.created_at))+'</time></div></div>').join(""):'<div class="empty-note">Order updates will appear here as the Botsy team progresses through your project.</div>'}</div>
      </section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-head"><h2>Connected account</h2></div><div class="profile"><div class="profile-avatar">DC</div><div><strong>${esc(displayName)}</strong><span>Discord account verified</span></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Need support?</h2></div><div class="empty-note">Contact the Botsy Studios team through your Discord ticket for help with an order.</div></section>
    </div>`;
   root.querySelectorAll(".download-deliverable").forEach(button=>button.addEventListener("click",async()=>{
     const original=button.textContent;button.disabled=true;button.textContent="Preparing…";
     try{
       const {data,error}=await supabase.storage.from("client-deliverables").createSignedUrl(button.dataset.path,120,{download:button.dataset.name});
       if(error) throw error;
       window.open(data.signedUrl,"_blank","noopener,noreferrer");
     }catch(error){button.textContent="Try again";console.error("Deliverable download failed:",error);}
     finally{button.disabled=false;if(button.textContent==="Preparing…")button.textContent=original;}
   }));
   root.querySelectorAll(".feedback-form").forEach(form=>form.addEventListener("submit",async event=>{
     event.preventDefault();
     const submit=form.querySelector("button[type=submit]"),message=form.querySelector(".feedback-message");
     const values=new FormData(form),rating=Number(values.get("rating")),comment=String(values.get("comment")||"").trim();
     if(!Number.isInteger(rating)||rating<1||rating>5){message.textContent="Please choose a rating.";return;}
     submit.disabled=true;submit.textContent="Submitting…";message.textContent="";
     const {error}=await supabase.from("client_feedback").insert({order_id:form.dataset.feedbackOrder,client_user_id:user.id,rating,comment});
     if(error){message.textContent=error.code==="23505"?"Feedback has already been submitted for this order.":error.message;submit.disabled=false;submit.textContent="Submit feedback";return;}
     await renderDashboard(user);
   }));
   document.getElementById("signout").addEventListener("click",async()=>{await supabase.auth.signOut();location.reload()});
   // Realtime is supplementary; reload on any visible order or event change.
   if(realtimeChannel) await supabase.removeChannel(realtimeChannel);
   realtimeChannel=supabase.channel("client-orders-"+discordId)
    .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:"client_discord_id=eq."+discordId},()=>renderDashboard(user))
    .on("postgres_changes",{event:"*",schema:"public",table:"order_events"},()=>renderDashboard(user))
    .on("postgres_changes",{event:"*",schema:"public",table:"order_deliverables"},()=>renderDashboard(user))
    .on("postgres_changes",{event:"*",schema:"public",table:"client_feedback"},()=>renderDashboard(user))
    .subscribe();
 };
 const {data:{session},error}=await supabase.auth.getSession();
 if(error) showMessage("Session error",error.message);
 else if(session?.user) await renderDashboard(session.user);
 else renderLogin();
 supabase.auth.onAuthStateChange(async(event,session)=>{if(event==="SIGNED_IN" && session?.user) await renderDashboard(session.user);});
  } catch(error) {
   showMessage("Portal connection failed","The live client portal could not load its secure connection. Please reload this page. If the problem continues, contact Botsy support.");
  }
}
