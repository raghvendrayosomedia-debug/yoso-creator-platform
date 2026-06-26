/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { Bell, Check, ChevronRight, CircleDollarSign, ClipboardList, FileText, LayoutDashboard, LogOut, Plus, Send, Settings, Users } from 'lucide-react';
import './styles.css';

type Role = 'creator' | 'account_manager' | 'founder_finance' | 'cofounder';
type AuthenticatedUser = { id: string; email: string; role: Role; creatorId?: string };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', persistSession: true }
}) : null;
const hasAuthCallbackParams = () => new URLSearchParams(window.location.search).has('code') || window.location.hash.includes('access_token');
const clearAuthCallbackParams = () => {
  if (hasAuthCallbackParams()) window.history.replaceState({}, document.title, window.location.pathname);
};
const getAccessToken = async () => {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Missing Supabase session.');
  return data.session.access_token;
};
const apiFetch = async (path:string, init:RequestInit = {}, accessToken?:string) => {
  if (!apiBaseUrl) throw new Error('API is not configured.');
  const headers = new Headers(init.headers);
  const token = accessToken ?? await getAccessToken();
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers });
};
type Creator = { name:string; industry:string; followers:number; rateRepost:number|null; rateComment:number|null; status:'Active'|'Inactive'; email:string };
const creators: Creator[] = [
  {name:'Ravi Kumar',industry:'Finance',followers:18400,rateRepost:150,rateComment:50,status:'Active',email:'ravi@gmail.com'},
  {name:'Sneha Patil',industry:'D2C / Retail',followers:26200,rateRepost:200,rateComment:60,status:'Active',email:'sneha@gmail.com'},
  {name:'Arjun Mehta',industry:'Tech / SaaS',followers:9100,rateRepost:null,rateComment:null,status:'Active',email:'arjun@gmail.com'},
  {name:'Priya Nair',industry:'Health / Wellness',followers:14700,rateRepost:175,rateComment:55,status:'Active',email:'priya@gmail.com'},
  {name:'Karan Shah',industry:'Finance',followers:31500,rateRepost:250,rateComment:75,status:'Inactive',email:'karan@gmail.com'}
];
const invoices = [
  {name:'Ravi Kumar', month:"June'26", reposts:14, comments:22, amount:3200, bank:'Match', approval:'Approved', paid:false},
  {name:'Sneha Patil', month:"June'26", reposts:20, comments:22, amount:5320, bank:'Mismatch', approval:'Approved', paid:false},
  {name:'Arjun Mehta', month:"June'26", reposts:11, comments:16, amount:null, bank:'Match', approval:'Pending', paid:false},
  {name:'Priya Nair', month:"June'26", reposts:9, comments:18, amount:2565, bank:'Match', approval:'Approved', paid:false}
];
const money = (value:number|null) => value === null ? 'Pending — rate not set' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
const Pill = ({children, kind='pending'}:{children:React.ReactNode,kind?:'good'|'bad'|'pending'|'neutral'}) => <span className={`pill ${kind}`}>{children}</span>;
function App(){
 const [user,setUser] = useState<AuthenticatedUser | null>(null);
 const [loading,setLoading] = useState(true);
 const [authError,setAuthError] = useState<string | null>(null);
 const [onboarding,setOnboarding] = useState(false);
 const [page,setPage] = useState('My Tasks'); const [paid,setPaid]=useState<string[]>([]); const [sent,setSent]=useState(false);
 const loadedAccessToken = useRef<string | null>(null);
 useEffect(() => {
   if (!supabase || !apiBaseUrl) { setAuthError('Authentication is not configured. Add the VITE_SUPABASE_* and VITE_API_BASE_URL variables.'); setLoading(false); return; }
   let cancelled = false;
   const loadAuthenticatedUser = async (session: Session) => {
     if (cancelled) return;
     if (!session.access_token) { setLoading(false); return; }
     if (loadedAccessToken.current === session.access_token) return;
     loadedAccessToken.current = session.access_token;
     try {
       const response = await apiFetch('/me', {}, session.access_token);
       if (!response.ok) { loadedAccessToken.current = null; await supabase.auth.signOut(); setAuthError(`We could not verify your YOSO account. The API did not return your profile from ${apiBaseUrl}/me.`); setUser(null); setLoading(false); return; }
       const profile = await response.json() as AuthenticatedUser;
       clearAuthCallbackParams();
       setUser(profile); setOnboarding(profile.role === 'creator' && !profile.creatorId); setPage(profile.role === 'creator' ? 'My Tasks' : profile.role === 'account_manager' ? 'Distribute Post' : 'Money Dashboard'); setLoading(false);
     } catch {
       loadedAccessToken.current = null; setAuthError('We could not verify your YOSO account. Please sign in again.'); setUser(null); setLoading(false);
     }
   };
   const finishWithoutSession = () => {
     if (cancelled) return;
     setUser(null); setLoading(false);
   };
   const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
     if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) window.setTimeout(() => void loadAuthenticatedUser(session), 0);
     if (event === 'INITIAL_SESSION' && !session) window.setTimeout(async () => {
       if (!hasAuthCallbackParams()) { finishWithoutSession(); return; }
       const { data } = await supabase.auth.getSession();
       if (data.session) void loadAuthenticatedUser(data.session); else finishWithoutSession();
     }, 1500);
     if (event === 'SIGNED_OUT') { loadedAccessToken.current = null; setUser(null); setOnboarding(false); setLoading(false); }
   });
   window.setTimeout(async () => {
     if (loadedAccessToken.current || cancelled) return;
     const { data } = await supabase.auth.getSession();
     if (data.session) void loadAuthenticatedUser(data.session); else if (!hasAuthCallbackParams()) finishWithoutSession();
   }, 2500);
   return () => { cancelled = true; subscription.unsubscribe(); };
 }, []);
 const signInWithGoogle = async () => {
   if (!supabase) return;
   setAuthError(null);
   const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
   if (error) setAuthError(error.message);
 };
 const signOut = async () => { loadedAccessToken.current = null; await supabase?.auth.signOut(); setUser(null); setPage('My Tasks'); };
 if(loading) return <main className="splash"><div className="logo">YOSO<span>.</span></div><p>Checking your secure YOSO session…</p></main>;
 if(!user) return <main className="splash"><div className="logo">YOSO<span>.</span></div><h1>Creator operations, engineered.</h1><p>One calm place for every task, invoice, and payment.</p><button onClick={signInWithGoogle} className="primary google">Continue with Google</button>{authError&&<p className="auth-error">{authError}</p>}<small>Sign in to continue.</small></main>;
 if(onboarding) return <CreatorOnboarding user={user} onComplete={(creatorId) => { setUser({ ...user, creatorId }); setOnboarding(false); setPage('My Tasks'); }} />;
 const role = user.role;
 const nav = role==='creator'?['My Tasks','My Invoices','My Bank Details']: role==='account_manager'?['Distribute Post','Creator Directory','Task Board','Operations Dashboard']:['Distribute Post','Creator Directory','Task Board','Operations Dashboard','Rate Management','Approvals','Payments','Money Dashboard','Admin'];
 const render = () => {
  if(page==='Distribute Post') return <section><Hero eyebrow="Operations" title="Distribute a post" text="Send a structured task to the right creators without losing the thread."/><div className="card form"><label>Client<input placeholder="e.g. Nova Capital"/></label><label>LinkedIn post link<input type="url" placeholder="https://linkedin.com/posts/..."/></label><div className="two"><label>Repost quota<input type="number" defaultValue={4}/></label><label>Comment quota<input type="number" defaultValue={6}/></label></div><label>Targeting mode<select><option>Random (fair-spread)</option><option>By industry</option><option>Specific creators</option></select></label><button className="primary" onClick={()=>setSent(true)}><Send size={16}/>Send tasks</button>{sent&&<div className="success"><Check size={18}/>4 reposts + 6 comments requested; tasks sent to 10 creators.</div>}</div></section>;
  if(page==='Creator Directory'||page==='Rate Management') return <section><Hero eyebrow="Network" title={page} text={page==='Rate Management'?'Set the rates that safely power creator invoices.':'A clear view of your creator network and its capacity.'}/><div className="toolbar"><input placeholder="Search creators"/><button className="secondary">Filter by industry</button><span>{creators.length} creators</span></div><div className="card tablewrap"><table><thead><tr><th>Creator</th><th>Industry</th><th>Followers</th><th>₹ / Repost</th><th>₹ / Comment</th><th>Status</th></tr></thead><tbody>{creators.map(c=><tr key={c.email}><td><b>{c.name}</b><small>{c.email}</small></td><td>{c.industry}</td><td>{c.followers.toLocaleString('en-IN')}</td><td>{page==='Rate Management'?<input className="rate" defaultValue={c.rateRepost ?? ''} placeholder="—"/>:c.rateRepost?money(c.rateRepost):<Pill kind="bad">Rate pending</Pill>}</td><td>{page==='Rate Management'?<input className="rate" defaultValue={c.rateComment ?? ''} placeholder="—"/>:c.rateComment?money(c.rateComment):'—'}</td><td><Pill kind={c.status==='Active'?'good':'neutral'}>{c.status}</Pill></td></tr>)}</tbody></table></div></section>;
  if(page==='Approvals'||page==='Payments'||page==='My Invoices') { const mine=page==='My Invoices'; return <section><Hero eyebrow={mine?'Creator portal':'Finance'} title={mine?'My invoices':page} text={mine?'Your monthly record, updated as payment moves.':'Review, release, and keep every payout auditable.'}/>{page==='Payments'&&<div className="notice">Reminder active since the 10th — 3 approved invoices remain unpaid. <button className="link">Download bank file</button></div>}<div className="card tablewrap"><table><thead><tr><th>Creator</th><th>Month</th><th>Work</th><th>Amount</th><th>Bank</th><th>Status</th><th></th></tr></thead><tbody>{invoices.filter(x=>!mine||x.name==='Ravi Kumar').map(i=>{const isPaid=paid.includes(i.name);return <tr key={i.name}><td><b>{i.name}</b></td><td>{i.month}</td><td>{i.reposts} reposts · {i.comments} comments</td><td className={i.amount===null?'danger':''}>{money(i.amount)}</td><td><Pill kind={i.bank==='Match'?'good':'bad'}>{i.bank}</Pill></td><td>{isPaid?<Pill kind="good">Paid today</Pill>:<Pill kind={i.approval==='Approved'?'good':'pending'}>{i.approval}</Pill>}</td><td>{!mine&&page==='Approvals'&&i.approval==='Pending'&&<><button className="tiny">Approve</button><button className="text-danger">Reject</button></>}{!mine&&page==='Payments'&&i.approval==='Approved'&&!isPaid&&<button className="tiny" onClick={()=>setPaid([...paid,i.name])}>Mark paid</button>}</td></tr>})}</tbody></table></div></section> }
  if(page==='My Tasks') return <section><Hero eyebrow="Creator portal" title="My tasks" text="Your active LinkedIn tasks, with the clock doing the nagging."/><article className="task"><div><Pill>REPOST</Pill><h3>Nova Capital</h3><a>linkedin.com/posts/novacapital-growth</a></div><div className="countdown">1:42:18 <small>remaining</small></div><div><button className="primary">Upload screenshot</button><button className="secondary">Reject</button></div></article><div className="empty">No other tasks right now. You’ll be notified when a post comes in.</div></section>;
  if(page==='My Bank Details') return <section><Hero eyebrow="Creator portal" title="My bank details" text="Saved once, held safely, and reused for invoice checks."/><div className="card form"><label>Account number<input defaultValue="50100••••4821"/></label><label>IFSC code<input defaultValue="HDFC0001234"/></label><button className="primary">Save secure details</button></div></section>;
  if(page==='Task Board') return <section><Hero eyebrow="Operations" title="Task board" text="Live assignment status across current posts."/><div className="card board"><div><b>Nova Capital · Growth update</b><small>4 / 4 reposts · 5 / 6 comments filled</small></div><Pill kind="pending">1 task active</Pill><ChevronRight/></div><div className="card board"><div><b>Arclight · Product launch</b><small>3 / 3 reposts · 2 / 2 comments filled</small></div><Pill kind="good">Closed</Pill><ChevronRight/></div></section>;
  if(page==='Operations Dashboard') return <Dashboard ops/>;
  if(page==='Admin') return <section><Hero eyebrow="Control room" title="Admin" text="Manage company access and the creator pool."/><div className="card form"><h3>Add team member</h3><label>Email<input placeholder="new.member@yosomedia.in"/></label><label>Role<select><option>Account manager</option><option>Founder / Finance</option><option>Co-founder</option></select></label><button className="primary">Add team member</button></div></section>;
  return <Dashboard/>;
 };
 return <div className="app"><aside><div className="logo">YOSO<span>.</span></div><p className="motto">Reach isn't luck.<br/>It's engineered.</p><nav>{nav.map(n=><button key={n} className={page===n?'active':''} onClick={()=>setPage(n)}>{n==='Money Dashboard'?<CircleDollarSign/>:n.includes('Dashboard')?<LayoutDashboard/>:n.includes('Creator')?<Users/>:n.includes('Task')?<ClipboardList/>:n.includes('Invoice')||n==='Approvals'||n==='Payments'?<FileText/>:n==='Admin'?<Settings/>:<Plus/>}{n}</button>)}</nav><div className="side-bottom"><button onClick={signOut}><LogOut/>Sign out</button></div></aside><main className="content"><header><div><Pill kind="neutral">{role.replace('_',' ')}</Pill></div><div className="profile"><Bell size={18}/><span>{user.email}</span><b>{user.email.charAt(0).toUpperCase()}</b></div></header>{render()}</main></div>;
}
function Hero({eyebrow,title,text}:{eyebrow:string,title:string,text:string}){return <div className="hero"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>}
function CreatorOnboarding({user,onComplete}:{user:AuthenticatedUser,onComplete:(creatorId:string)=>void}){
 const [name,setName]=useState(''),[industry,setIndustry]=useState(''),[followers,setFollowers]=useState(''),[linkedinUrl,setLinkedinUrl]=useState(''),[bankAccount,setBankAccount]=useState(''),[ifsc,setIfsc]=useState(''),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase||!apiBaseUrl)return;setSaving(true);setError(null);try{const response=await apiFetch('/creators/onboard',{method:'POST',body:JSON.stringify({name,industry,followers:Number(followers),linkedin_url:linkedinUrl,bank_account:bankAccount,ifsc})});const data=await response.json();if(!response.ok){setError(data.error||'We could not save your details.');setSaving(false);return;}onComplete(data.id);}catch{setError('Your session expired. Please sign in again.');setSaving(false);}};
 return <main className="splash"><div className="onboarding"><div className="logo">YOSO<span>.</span></div><h1>Welcome to YOSO</h1><p>Tell us a little about your creator profile to get started.</p><form onSubmit={submit} className="onboarding-form"><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Industry<select required value={industry} onChange={e=>setIndustry(e.target.value)}><option value="">Select industry</option><option>Finance</option><option>Tech/SaaS</option><option>D2C/Retail</option><option>Health/Wellness</option><option>Other</option></select></label><label>Followers<input required min="0" type="number" value={followers} onChange={e=>setFollowers(e.target.value)}/></label><label>LinkedIn profile URL<input required type="url" value={linkedinUrl} onChange={e=>setLinkedinUrl(e.target.value)}/></label><label>Bank account number<input required value={bankAccount} onChange={e=>setBankAccount(e.target.value)}/></label><label>IFSC code<input required value={ifsc} onChange={e=>setIfsc(e.target.value)}/></label>{error&&<p className="auth-error">{error}</p>}<button disabled={saving} className="primary" type="submit">{saving?'Saving…':'Complete onboarding'}</button></form></div></main>;
}
function Dashboard({ops=false}:{ops?:boolean}){return <section><Hero eyebrow={ops?'Operations':'Finance'} title={ops?'Operations dashboard':'Money dashboard'} text={ops?'The shape of work across your creator network.':'A clean read on payouts, flags, and what needs your attention.'}/><div className="kpis">{(ops?[['Active creators','4'],['Inactive creators','1'],['Posts this month','12'],['Tasks completed','86%']]:[['Paid this month','₹1,24,500'],['Paid YTD','₹6,48,200'],['Rate flags','1'],['Bank mismatches','1']]).map(([a,b],i)=><div className="metric" key={a}><small>{a}</small><strong className={i>1?'warning':''}>{b}</strong></div>)}</div><div className="grid"><div className="card chart"><h3>{ops?'Creator rotation':'Monthly payout'}</h3><div className="bars"><i style={{height:'42%'}}/><i style={{height:'61%'}}/><i style={{height:'85%'}}/><i style={{height:'54%'}}/><i style={{height:'76%'}}/><i style={{height:'93%'}}/></div><div className="axis"><span>Jan</span><span>Mar</span><span>May</span><span>Jun</span></div></div><div className="card insights"><h3>Needs attention</h3><p><Pill kind="bad">Rate pending</Pill> Arjun Mehta</p><p><Pill kind="bad">Bank mismatch</Pill> Sneha Patil</p><p><Pill kind="pending">Unpaid</Pill> 3 invoices await payment</p></div></div></section>}
createRoot(document.getElementById('root')!).render(<App/>);
