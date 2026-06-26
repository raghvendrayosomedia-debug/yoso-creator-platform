/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { Bell, Check, ChevronRight, CircleDollarSign, ClipboardList, FileText, LayoutDashboard, LogOut, Plus, Send, Settings, Users } from 'lucide-react';
import './styles.css';

type Role = 'creator' | 'account_manager' | 'founder_finance' | 'cofounder';
type AuthenticatedUser = { id: string; email: string; role: Role; creatorId?: string };
type CreatorProfile = { id:string; name:string; email:string; industry?:string; followers?:number; linkedin_url?:string; bank_account?:string; ifsc?:string };
type MyTask = { id:string; type:'repost'|'comment'; state:string; assigned_at:string; expires_at?:string; screenshot_url?:string; reject_reason?:string; posts?:{client:string;link:string} };
type MyInvoice = { id:string; month_label:string; reposts:number; comments:number; amount:number|null; bank_match:'match'|'mismatch'|'unchecked'; approval_state:'pending'|'approved'|'rejected'; paid:boolean; paid_on?:string|null };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const productionApiBaseUrl = 'https://yoso-creator-platform-production.up.railway.app';
const isLocalHost = (hostname:string) => ['localhost', '127.0.0.1'].includes(hostname);
const normalizeApiBaseUrl = (value?: string) => {
  const configured = value?.trim();
  if (!configured) return productionApiBaseUrl;
  try {
    const url = new URL(configured);
    url.hash = ''; url.search = '';
    const pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
    const normalized = `${url.origin}${pathname}`;
    const pointsAtFrontend = typeof window !== 'undefined' && url.origin === window.location.origin && !isLocalHost(window.location.hostname);
    return pointsAtFrontend ? productionApiBaseUrl : normalized;
  } catch {
    return productionApiBaseUrl;
  }
};
const configuredApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
const apiBaseUrl = configuredApiBaseUrl;
const apiUrl = (path:string) => `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
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
  const url = apiUrl(path);
  if (path === '/me') console.info('YOSO /me request', { url, hasBearerToken: headers.get('Authorization')?.startsWith('Bearer ') === true });
  return fetch(url, { ...init, headers });
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
 const [creatorTasks,setCreatorTasks]=useState<MyTask[]>([]),[creatorInvoices,setCreatorInvoices]=useState<MyInvoice[]>([]),[creatorProfile,setCreatorProfile]=useState<CreatorProfile|null>(null),[creatorLoading,setCreatorLoading]=useState(false),[creatorNotice,setCreatorNotice]=useState<string|null>(null),[bankAccount,setBankAccount]=useState(''),[ifsc,setIfsc]=useState('');
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
       if (!response.ok) { loadedAccessToken.current = null; await supabase.auth.signOut(); setAuthError(`We could not verify your YOSO account. The API did not return your profile from ${apiUrl('/me')}.`); setUser(null); setLoading(false); return; }
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
 const refreshCreatorData = async (clearNotice=true) => {
   if (!user || user.role !== 'creator' || !user.creatorId) return;
   setCreatorLoading(true); if(clearNotice)setCreatorNotice(null);
   try {
     const [tasksResponse,invoicesResponse,profileResponse] = await Promise.all([apiFetch('/tasks/mine'),apiFetch('/invoices/mine'),apiFetch('/creators/me')]);
     if (!tasksResponse.ok || !invoicesResponse.ok || !profileResponse.ok) throw new Error('Creator data failed to load');
     const [tasks,invoices,profile] = await Promise.all([tasksResponse.json(),invoicesResponse.json(),profileResponse.json()]) as [MyTask[],MyInvoice[],CreatorProfile];
     setCreatorTasks(tasks); setCreatorInvoices(invoices); setCreatorProfile(profile); setBankAccount(profile.bank_account||''); setIfsc(profile.ifsc||'');
   } catch { setCreatorNotice('We could not load your latest creator data.'); }
   finally { setCreatorLoading(false); }
 };
 useEffect(() => { void refreshCreatorData(); }, [user?.email,user?.creatorId,user?.role]);
 const uploadTaskScreenshot = (taskId:string) => { const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.onchange=async()=>{const file=input.files?.[0]; if(!file)return; const body=new FormData(); body.append('screenshot',file); setCreatorNotice(null); const response=await apiFetch(`/tasks/${taskId}/screenshot`,{method:'POST',body}); if(response.ok){setCreatorNotice('Screenshot uploaded.'); await refreshCreatorData(false);}else setCreatorNotice('Screenshot upload failed.');}; input.click(); };
 const rejectTask = async (taskId:string) => { const reason=window.prompt('Reason for rejecting this task?'); if(reason===null)return; const response=await apiFetch(`/tasks/${taskId}/reject`,{method:'POST',body:JSON.stringify({reason})}); if(response.ok){setCreatorNotice('Task rejected.'); await refreshCreatorData(false);}else setCreatorNotice('Task rejection failed.'); };
 const saveBankDetails = async () => { const response=await apiFetch('/creators/me',{method:'PATCH',body:JSON.stringify({bank_account:bankAccount,ifsc})}); if(response.ok){const profile=await response.json() as CreatorProfile; setCreatorProfile(profile); setCreatorNotice('Bank details saved.');}else setCreatorNotice('Bank details could not be saved.'); };
 const uploadInvoice = () => { const input=document.createElement('input'); input.type='file'; input.accept='application/pdf,image/*'; input.onchange=async()=>{const file=input.files?.[0]; if(!file)return; const body=new FormData(); body.append('invoice',file); const response=await apiFetch('/invoices/upload',{method:'POST',body}); if(response.ok){setCreatorNotice('Invoice uploaded.'); await refreshCreatorData(false);}else setCreatorNotice('Invoice upload failed.');}; input.click(); };
 const signOut = async () => { loadedAccessToken.current = null; await supabase?.auth.signOut(); setUser(null); setPage('My Tasks'); };
 if(loading) return <main className="splash"><div className="logo">YOSO<span>.</span></div><p>Checking your secure YOSO session…</p></main>;
 if(!user) return <main className="splash"><div className="logo">YOSO<span>.</span></div><h1>Creator operations, engineered.</h1><p>One calm place for every task, invoice, and payment.</p><button onClick={signInWithGoogle} className="primary google">Continue with Google</button>{authError&&<p className="auth-error">{authError}</p>}<small>Sign in to continue.</small></main>;
 if(onboarding) return <CreatorOnboarding user={user} onComplete={(creatorId) => { setUser({ ...user, creatorId }); setOnboarding(false); setPage('My Tasks'); }} />;
 const role = user.role;
 const nav = role==='creator'?['My Tasks','My Invoices','My Bank Details']: role==='account_manager'?['Distribute Post','Creator Directory','Task Board','Operations Dashboard']:['Distribute Post','Creator Directory','Task Board','Operations Dashboard','Rate Management','Approvals','Payments','Money Dashboard','Admin'];
 const render = () => {
  if(page==='Distribute Post') return <section><Hero eyebrow="Operations" title="Distribute a post" text="Send a structured task to the right creators without losing the thread."/><div className="card form"><label>Client<input placeholder="e.g. Nova Capital"/></label><label>LinkedIn post link<input type="url" placeholder="https://linkedin.com/posts/..."/></label><div className="two"><label>Repost quota<input type="number" defaultValue={4}/></label><label>Comment quota<input type="number" defaultValue={6}/></label></div><label>Targeting mode<select><option>Random (fair-spread)</option><option>By industry</option><option>Specific creators</option></select></label><button className="primary" onClick={()=>setSent(true)}><Send size={16}/>Send tasks</button>{sent&&<div className="success"><Check size={18}/>4 reposts + 6 comments requested; tasks sent to 10 creators.</div>}</div></section>;
  if(page==='Creator Directory'||page==='Rate Management') return <section><Hero eyebrow="Network" title={page} text={page==='Rate Management'?'Set the rates that safely power creator invoices.':'A clear view of your creator network and its capacity.'}/><div className="toolbar"><input placeholder="Search creators"/><button className="secondary">Filter by industry</button><span>{creators.length} creators</span></div><div className="card tablewrap"><table><thead><tr><th>Creator</th><th>Industry</th><th>Followers</th><th>₹ / Repost</th><th>₹ / Comment</th><th>Status</th></tr></thead><tbody>{creators.map(c=><tr key={c.email}><td><b>{c.name}</b><small>{c.email}</small></td><td>{c.industry}</td><td>{c.followers.toLocaleString('en-IN')}</td><td>{page==='Rate Management'?<input className="rate" defaultValue={c.rateRepost ?? ''} placeholder="—"/>:c.rateRepost?money(c.rateRepost):<Pill kind="bad">Rate pending</Pill>}</td><td>{page==='Rate Management'?<input className="rate" defaultValue={c.rateComment ?? ''} placeholder="—"/>:c.rateComment?money(c.rateComment):'—'}</td><td><Pill kind={c.status==='Active'?'good':'neutral'}>{c.status}</Pill></td></tr>)}</tbody></table></div></section>;
  if(page==='My Invoices') return <section><Hero eyebrow="Creator portal" title="My invoices" text="Your monthly record, updated as payment moves."/><div className="toolbar"><button className="primary" onClick={uploadInvoice}><FileText size={16}/>Upload invoice</button>{creatorNotice&&<span>{creatorNotice}</span>}</div><div className="card tablewrap"><table><thead><tr><th>Month</th><th>Work</th><th>Amount</th><th>Bank</th><th>Status</th><th>Paid</th></tr></thead><tbody>{creatorInvoices.map(i=><tr key={i.id}><td>{i.month_label}</td><td>{i.reposts} reposts · {i.comments} comments</td><td className={i.amount===null?'danger':''}>{money(i.amount)}</td><td><Pill kind={i.bank_match==='match'?'good':i.bank_match==='mismatch'?'bad':'pending'}>{i.bank_match}</Pill></td><td><Pill kind={i.approval_state==='approved'?'good':i.approval_state==='rejected'?'bad':'pending'}>{i.approval_state}</Pill></td><td>{i.paid?<Pill kind="good">Paid</Pill>:<Pill>Pending</Pill>}</td></tr>)}</tbody></table>{!creatorLoading&&!creatorInvoices.length&&<div className="empty">No invoices yet.</div>}</div></section>;
  if(page==='Approvals'||page==='Payments') { return <section><Hero eyebrow="Finance" title={page} text="Review, release, and keep every payout auditable." />{page==='Payments'&&<div className="notice">Reminder active since the 10th — 3 approved invoices remain unpaid. <button className="link">Download bank file</button></div>}<div className="card tablewrap"><table><thead><tr><th>Creator</th><th>Month</th><th>Work</th><th>Amount</th><th>Bank</th><th>Status</th><th></th></tr></thead><tbody>{invoices.map(i=>{const isPaid=paid.includes(i.name);return <tr key={i.name}><td><b>{i.name}</b></td><td>{i.month}</td><td>{i.reposts} reposts · {i.comments} comments</td><td className={i.amount===null?'danger':''}>{money(i.amount)}</td><td><Pill kind={i.bank==='Match'?'good':'bad'}>{i.bank}</Pill></td><td>{isPaid?<Pill kind="good">Paid today</Pill>:<Pill kind={i.approval==='Approved'?'good':'pending'}>{i.approval}</Pill>}</td><td>{page==='Approvals'&&i.approval==='Pending'&&<><button className="tiny">Approve</button><button className="text-danger">Reject</button></>}{page==='Payments'&&i.approval==='Approved'&&!isPaid&&<button className="tiny" onClick={()=>setPaid([...paid,i.name])}>Mark paid</button>}</td></tr>})}</tbody></table></div></section> }
  if(page==='My Tasks') return <section><Hero eyebrow="Creator portal" title="My tasks" text="Your active LinkedIn tasks, with the clock doing the nagging." />{creatorNotice&&<div className="notice">{creatorNotice}</div>}{creatorTasks.map(t=><article className="task" key={t.id}><div><Pill>{t.type.toUpperCase()}</Pill><h3>{t.posts?.client||'LinkedIn task'}</h3><a href={t.posts?.link} target="_blank" rel="noreferrer">{t.posts?.link||'No link available'}</a></div><div className="countdown">{t.state}<small>{t.expires_at?new Date(t.expires_at).toLocaleString('en-IN'):''}</small></div><div>{t.state==='sent'&&<><button className="primary" onClick={()=>uploadTaskScreenshot(t.id)}>Upload screenshot</button><button className="secondary" onClick={()=>rejectTask(t.id)}>Reject</button></>}</div></article>)}{!creatorLoading&&!creatorTasks.length&&<div className="empty">No tasks right now.</div>}</section>;
  if(page==='My Bank Details') return <section><Hero eyebrow="Creator portal" title="My bank details" text="Saved once, held safely, and reused for invoice checks." />{creatorNotice&&<div className="notice">{creatorNotice}</div>}<div className="card form"><label>Account number<input value={bankAccount} onChange={e=>setBankAccount(e.target.value)}/></label><label>IFSC code<input value={ifsc} onChange={e=>setIfsc(e.target.value)}/></label>{creatorProfile&&<label>LinkedIn profile<input value={creatorProfile.linkedin_url||''} readOnly/></label>}<button className="primary" onClick={saveBankDetails}>Save secure details</button></div></section>;
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
