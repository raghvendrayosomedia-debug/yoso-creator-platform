/// <reference types="vite/client" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { Bell, Check, ChevronRight, CircleDollarSign, ClipboardList, Download, FileText, LayoutDashboard, LogOut, Plus, Send, Settings, Users } from 'lucide-react';
import './styles.css';

type Role = 'creator' | 'account_manager' | 'founder_finance' | 'cofounder';
type User = { id:string; email:string; role:Role; creatorId?:string };
type CreatorProfile = { id:string; name:string; email:string; industry?:string; region?:string; followers?:number; linkedin_url?:string; bank_account?:string; ifsc?:string; rate_repost?:number|null; rate_comment?:number|null; rate_campaign?:number|null; status:'active'|'inactive' };
type Task = { id:string; type:'repost'|'comment'; state:string; assigned_at:string; expires_at?:string; screenshot_url?:string; reject_reason?:string; creator_id?:string; posts?:{client:string;link:string}; post_id?:string };
type Post = { id:string; client:string; link:string; repost_quota:number; comment_quota:number; targeting_mode:string; target_industry?:string; status:string; created_at:string; tasks?:Task[] };
type Invoice = { id:string; month_label:string; month_key?:string; upload_group_id?:string; reposts:number; comments:number; claimed_reposts?:number; claimed_comments?:number; claimed_amount?:number|null; amount_check_state?:'match'|'mismatch'|'unchecked'; amount_check_message?:string|null; verification_state?:'verified'|'mismatch'|'unchecked'; verification_message?:string|null; amount:number|null; invoice_url?:string|null; invoice_name?:string|null; bank_match:'match'|'mismatch'|'unchecked'; approval_state:'pending'|'approved'|'rejected'; reject_reason?:string; paid:boolean; paid_on?:string|null; creators?:{id?:string;name:string;email:string;bank_account?:string;ifsc?:string} };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const INDUSTRIES = ['Fintech','Marketing','Tech','Finance','D2C/Retail','Health/Wellness','Media/Entertainment','Real Estate','Education','Others'];
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const productionApiBaseUrl = 'https://yoso-creator-platform-production.up.railway.app';
const isLocalHost = (hostname:string) => ['localhost','127.0.0.1'].includes(hostname);
const normalizeApiBaseUrl = (value?:string) => {
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
const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
const apiUrl = (path:string) => `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', persistSession:true }
}) : null;

const money = (value:number|null|undefined) => value == null ? 'Pending' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value));
const Pill = ({children, kind='pending'}:{children:React.ReactNode; kind?:'good'|'bad'|'pending'|'neutral'}) => <span className={`pill ${kind}`}>{children}</span>;
const Empty = ({children}:{children:React.ReactNode}) => <div className="empty">{children}</div>;
const Hero = ({eyebrow,title,text}:{eyebrow:string; title:string; text:string}) => <div className="hero"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>;
const FileLink = ({href,label='View file'}:{href?:string|null; label?:string}) => href ? <a className="file-link" href={href} target="_blank" rel="noreferrer">{label}</a> : <small>No file</small>;
const verificationKind = (state?:string) => state === 'verified' ? 'good' : state === 'mismatch' ? 'bad' : 'pending';
const monthInfo = (date=new Date()) => ({ key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-01`, label:date.toLocaleString('en-IN',{month:'long',year:'2-digit'}).replace(' ','\'') });
const monthFromKey = (key:string) => { const d = new Date(`${key}T00:00:00.000Z`); return { key, label:d.toLocaleString('en-IN',{month:'long',year:'2-digit',timeZone:'UTC'}).replace(' ','\'') }; };
const recentMonths = (count=6) => Array.from({length:count},(_,index) => { const now = new Date(); return monthInfo(new Date(now.getFullYear(),now.getMonth()-index,1)); });

async function getAccessToken() {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Missing Supabase session.');
  return data.session.access_token;
}
async function apiFetch(path:string, init:RequestInit = {}, accessToken?:string) {
  const headers = new Headers(init.headers);
  const token = accessToken ?? await getAccessToken();
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const url = apiUrl(path);
  if (path === '/me') console.info('YOSO /me request', { url, hasBearerToken: headers.get('Authorization')?.startsWith('Bearer ') === true });
  return fetch(url, { ...init, headers });
}
async function apiJson<T>(path:string, init:RequestInit = {}, accessToken?:string): Promise<T> {
  const response = await apiFetch(path, init, accessToken);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || `Request failed: ${path}`);
  return data as T;
}
const urlBase64ToUint8Array = (base64String:string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
};
async function registerPushNotifications(user:User, accessToken:string, source:'auto'|'manual'='auto') {
  console.info('push:frontend:start', { source, role:user.role, hasCreatorId:!!user.creatorId, hasVapidPublicKey:!!vapidPublicKey });
  if (user.role !== 'creator' || !user.creatorId) { console.info('push:frontend:skip', { reason:'not an onboarded creator' }); return; }
  if (!vapidPublicKey) { console.warn('push:frontend:skip', { reason:'missing VITE_VAPID_PUBLIC_KEY' }); return; }
  if (!('serviceWorker' in navigator)) { console.warn('push:frontend:skip', { reason:'service worker unsupported' }); return; }
  if (!('PushManager' in window)) { console.warn('push:frontend:skip', { reason:'push manager unsupported' }); return; }
  if (!('Notification' in window)) { console.warn('push:frontend:skip', { reason:'notifications unsupported' }); return; }
  if (!window.isSecureContext) { console.warn('push:frontend:skip', { reason:'insecure context' }); return; }
  const registration = await navigator.serviceWorker.register('/sw.js');
  console.info('push:frontend:service-worker-registered', { scope:registration.scope });
  const ready = await navigator.serviceWorker.ready;
  console.info('push:frontend:permission-before-request', { permission:Notification.permission, source });
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  console.info('push:frontend:permission-after-request', { permission, source });
  if (permission !== 'granted') { console.warn('push:frontend:permission-not-granted', { permission, source }); return; }
  let subscription = await ready.pushManager.getSubscription();
  console.info('push:frontend:existing-subscription', { exists:!!subscription });
  if (!subscription) {
    subscription = await ready.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidPublicKey) });
    console.info('push:frontend:subscription-created', { endpoint:subscription.endpoint });
  }
  await apiJson('/push/subscribe', { method:'POST', body:JSON.stringify(subscription.toJSON()) }, accessToken);
  console.info('push:frontend:subscription-saved', { endpoint:subscription.endpoint });
}

function App() {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [authError,setAuthError] = useState<string|null>(null);
  const [page,setPage] = useState('My Tasks');
  const [notice,setNotice] = useState<string|null>(null);
  const [pushNotice,setPushNotice] = useState<string|null>(null);
  const loadedAccessToken = useRef<string|null>(null);
  const pushRegisteredAccessToken = useRef<string|null>(null);

  const [creators,setCreators] = useState<CreatorProfile[]>([]);
  const [posts,setPosts] = useState<Post[]>([]);
  const [invoices,setInvoices] = useState<Invoice[]>([]);
  const [myTasks,setMyTasks] = useState<Task[]>([]);
  const [myInvoices,setMyInvoices] = useState<Invoice[]>([]);
  const [myProfile,setMyProfile] = useState<CreatorProfile|null>(null);
  const [ops,setOps] = useState<any>(null);
  const [moneyRows,setMoneyRows] = useState<Invoice[]>([]);

  const [postForm,setPostForm] = useState({client:'',link:'',repost_quota:0,comment_quota:0,targeting_mode:'random',target_industry:''});
  const [bank,setBank] = useState({bank_account:'',ifsc:''});
  const [invoiceClaim,setInvoiceClaim] = useState({claimed_reposts:'',claimed_comments:'',claimed_amount:''});
  const [selectedInvoiceMonth,setSelectedInvoiceMonth] = useState(monthInfo().key);
  const [selectedInvoiceMonths,setSelectedInvoiceMonths] = useState<string[]>([monthInfo().key]);
  const [financeInvoiceMonth,setFinanceInvoiceMonth] = useState(monthInfo().key);
  const [rateEdits,setRateEdits] = useState<Record<string,{rate_repost:string;rate_comment:string;rate_campaign:string}>>({});
  const [creatorFilters,setCreatorFilters] = useState({industry:'',region:'',followersMin:'',followersMax:'',rateMin:'',rateMax:''});
  const [newUser,setNewUser] = useState({email:'',name:'',role:'account_manager' as Role});

  const refreshCreator = async () => {
    if (!user || user.role !== 'creator' || !user.creatorId) return;
    const [tasks,rows,profile] = await Promise.all([
      apiJson<Task[]>('/tasks/mine'),
      apiJson<Invoice[]>('/invoices/mine'),
      apiJson<CreatorProfile>('/creators/me')
    ]);
    setMyTasks(tasks); setMyInvoices(rows); setMyProfile(profile); setBank({bank_account:profile.bank_account || '', ifsc:profile.ifsc || ''});
  };
  const refreshStaff = async () => {
    if (!user || user.role === 'creator') return;
    const [creatorRows,postRows,opsRows] = await Promise.all([
      apiJson<CreatorProfile[]>('/creators'),
      apiJson<Post[]>('/posts'),
      apiJson<any>('/dashboard/ops')
    ]);
    setCreators(creatorRows); setPosts(postRows); setOps(opsRows);
    setRateEdits(Object.fromEntries(creatorRows.map(c => [c.id, { rate_repost:String(c.rate_repost ?? ''), rate_comment:String(c.rate_comment ?? ''), rate_campaign:String(c.rate_campaign ?? '') }])));
    if (user.role !== 'account_manager') {
      const [invoiceRows,moneyData] = await Promise.all([apiJson<Invoice[]>('/invoices'), apiJson<Invoice[]>('/dashboard/money')]);
      setInvoices(invoiceRows); setMoneyRows(moneyData);
    }
  };
  const refreshAll = async () => {
    setNotice(null);
    try { await refreshCreator(); await refreshStaff(); }
    catch (error:any) { setNotice(error.message || 'Could not load latest data.'); }
  };

  useEffect(() => {
    if (!supabase) { setAuthError('Authentication is not configured.'); setLoading(false); return; }
    let cancelled = false;
    const loadUser = async (session:Session) => {
      if (cancelled || loadedAccessToken.current === session.access_token) return;
      loadedAccessToken.current = session.access_token;
      try {
        const profile = await apiJson<User>('/me', {}, session.access_token);
        setUser(profile);
        setPage(profile.role === 'creator' ? (profile.creatorId ? 'My Tasks' : 'Onboarding') : profile.role === 'account_manager' ? 'Distribute Post' : 'Money Dashboard');
        setLoading(false);
        if (pushRegisteredAccessToken.current !== session.access_token) {
          pushRegisteredAccessToken.current = session.access_token;
          void registerPushNotifications(profile, session.access_token, 'auto').catch(error => {
            pushRegisteredAccessToken.current = null;
            console.error('push:frontend:failed', error);
          });
        }
      } catch (error:any) {
        loadedAccessToken.current = null; setAuthError(error.message); setUser(null); setLoading(false);
      }
    };
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event,session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) void loadUser(session);
      if (event === 'INITIAL_SESSION' && !session) setLoading(false);
      if (event === 'SIGNED_OUT') { loadedAccessToken.current = null; pushRegisteredAccessToken.current = null; setUser(null); setLoading(false); }
    });
    setTimeout(async () => {
      if (loadedAccessToken.current || cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) void loadUser(data.session); else setLoading(false);
    }, 1000);
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if(user && page !== 'Onboarding') void refreshAll(); }, [user?.email,user?.role,user?.creatorId]);

  const signIn = async () => {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:window.location.origin } });
    if (error) setAuthError(error.message);
  };
  const signOut = async () => { await supabase?.auth.signOut(); setUser(null); setPage('My Tasks'); };

  const completeOnboarding = async (body:any) => {
    const profile = await apiJson<CreatorProfile>('/creators/onboard', { method:'POST', body:JSON.stringify(body) });
    const nextUser = user ? { ...user, creatorId:profile.id } : null;
    setUser(nextUser);
    setPage('My Tasks');
    setNotice('Onboarding saved.');
    if (nextUser) void registerPushNotifications(nextUser, await getAccessToken(), 'auto').catch(error => console.error('push:frontend:failed', error));
  };
  const enableNotifications = async () => {
    if (!user) return;
    setPushNotice('Requesting notification permission...');
    try {
      await registerPushNotifications(user, await getAccessToken(), 'manual');
      const permission = 'Notification' in window ? Notification.permission : 'unsupported';
      setPushNotice(permission === 'granted' ? 'Notifications enabled for task alerts.' : `Notifications are ${permission}.`);
    } catch (error:any) {
      console.error('push:frontend:manual-failed', error);
      setPushNotice(error.message || 'Could not enable notifications.');
    }
  };
  const sendTestPush = async () => {
    setPushNotice('Sending test push...');
    try {
      const result = await apiJson<{attempted:number;sent:number;failed:number;reason?:string}>('/push/test', { method:'POST' });
      console.info('push:frontend:test-result', result);
      setPushNotice(`Test push sent: ${result.sent}/${result.attempted}.`);
    } catch (error:any) {
      console.error('push:frontend:test-failed', error);
      setPushNotice(error.message || 'Could not send test push.');
    }
  };
  const uploadTaskScreenshot = (taskId:string) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const body = new FormData(); body.append('screenshot', file);
      try { await apiJson(`/tasks/${taskId}/screenshot`, { method:'POST', body }); setNotice('Screenshot uploaded.'); await refreshCreator(); }
      catch (error:any) { setNotice(error.message); }
    };
    input.click();
  };
  const rejectTask = async (taskId:string) => {
    const reason = window.prompt('Reason for rejecting this task?');
    if (reason === null) return;
    try { await apiJson(`/tasks/${taskId}/reject`, { method:'POST', body:JSON.stringify({ reason }) }); setNotice('Task rejected.'); await refreshCreator(); }
    catch (error:any) { setNotice(error.message); }
  };
  const saveBank = async () => {
    try { const profile = await apiJson<CreatorProfile>('/creators/me', { method:'PATCH', body:JSON.stringify(bank) }); setMyProfile(profile); setNotice('Bank details saved.'); }
    catch (error:any) { setNotice(error.message); }
  };
  const uploadInvoice = () => {
    const claimedReposts = Number(invoiceClaim.claimed_reposts);
    const claimedComments = Number(invoiceClaim.claimed_comments);
    const claimedAmount = Number(invoiceClaim.claimed_amount);
    if (!invoiceClaim.claimed_reposts.trim() || !invoiceClaim.claimed_comments.trim() || !invoiceClaim.claimed_amount.trim() || !Number.isInteger(claimedReposts) || claimedReposts < 0 || !Number.isInteger(claimedComments) || claimedComments < 0 || Number.isNaN(claimedAmount) || claimedAmount < 0) { setNotice('Enter claimed reposts, comments, and amount before uploading.'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const body = new FormData(); body.append('invoice', file); body.append('claimed_reposts', String(claimedReposts)); body.append('claimed_comments', String(claimedComments)); body.append('claimed_amount', String(claimedAmount)); body.append('months', JSON.stringify(selectedInvoiceMonths.length ? selectedInvoiceMonths : [monthInfo().key]));
      try { await apiJson('/invoices/upload', { method:'POST', body }); setNotice('Invoice uploaded.'); await refreshCreator(); }
      catch (error:any) { setNotice(error.message); }
    };
    input.click();
  };
  const distributePost = async () => {
    try {
      await apiJson('/posts', { method:'POST', body:JSON.stringify({ ...postForm, repost_quota:Number(postForm.repost_quota), comment_quota:Number(postForm.comment_quota) }) });
      setPostForm({client:'',link:'',repost_quota:0,comment_quota:0,targeting_mode:'random',target_industry:''}); setNotice('Post distributed.'); await refreshStaff();
    } catch (error:any) { setNotice(error.message); }
  };
  const closePost = async (id:string) => { await apiJson(`/posts/${id}/close`, { method:'POST' }); setNotice('Post closed.'); await refreshStaff(); };
  const saveRates = async (creator:CreatorProfile) => {
    const values = rateEdits[creator.id];
    await apiJson(`/creators/${creator.id}/rates`, { method:'PATCH', body:JSON.stringify({ rate_repost:Number(values.rate_repost), rate_comment:Number(values.rate_comment), rate_campaign:Number(values.rate_campaign) }) });
    setNotice('Rates saved.'); await refreshStaff();
  };
  const setCreatorStatus = async (creator:CreatorProfile,status:'active'|'inactive') => { await apiJson(`/creators/${creator.id}/status`, { method:'PATCH', body:JSON.stringify({ status }) }); setNotice('Creator status updated.'); await refreshStaff(); };
  const updateInvoice = async (invoice:Invoice,action:'approve'|'reject'|'pay') => {
    const body = action === 'reject' ? JSON.stringify({ reason:window.prompt('Reason for rejection?') || 'Rejected' }) : undefined;
    await apiJson(`/invoices/${invoice.id}/${action}`, { method:'PATCH', body });
    setNotice(`Invoice ${action} complete.`); await refreshStaff();
  };
  const downloadBankFile = async () => {
    const month = financeInvoiceMonth || currentMonth.key;
    const response = await apiFetch(`/invoices/export?month=${encodeURIComponent(month)}`);
    if (!response.ok) { setNotice('Could not download bank file.'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `yoso-bank-${month || 'approved'}.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  const addTeamMember = async () => {
    await apiJson('/users', { method:'POST', body:JSON.stringify(newUser) });
    setNewUser({email:'',name:'',role:'account_manager'}); setNotice('Team member saved.');
  };

  const nav = useMemo(() => {
    if (!user) return [];
    if (user.role === 'creator') return ['My Tasks','My Invoices','My Bank Details'];
    if (user.role === 'account_manager') return ['Distribute Post','Creator Directory','Task Board','Operations Dashboard'];
    return ['Distribute Post','Creator Directory','Task Board','Operations Dashboard','Rate Management','Approvals','Payments','Money Dashboard','Admin'];
  }, [user?.role]);
  const canViewRates = !!user && user.role !== 'account_manager' && user.role !== 'creator';
  const filteredCreators = creators.filter(c => {
    const minFollowers = creatorFilters.followersMin ? Number(creatorFilters.followersMin) : null;
    const maxFollowers = creatorFilters.followersMax ? Number(creatorFilters.followersMax) : null;
    const minRate = creatorFilters.rateMin ? Number(creatorFilters.rateMin) : null;
    const maxRate = creatorFilters.rateMax ? Number(creatorFilters.rateMax) : null;
    const rates = [c.rate_repost,c.rate_comment,c.rate_campaign].filter(v => v != null).map(Number);
    const rateMatch = !canViewRates || ((!minRate || rates.some(r => r >= minRate)) && (!maxRate || rates.some(r => r <= maxRate)));
    return (!creatorFilters.industry || c.industry === creatorFilters.industry) &&
      (!creatorFilters.region || (c.region || '').toLowerCase().includes(creatorFilters.region.toLowerCase())) &&
      (minFollowers == null || Number(c.followers || 0) >= minFollowers) &&
      (maxFollowers == null || Number(c.followers || 0) <= maxFollowers) &&
      rateMatch;
  });
  const customIndustries = Array.from(new Set(creators.map(c=>c.industry).filter((i):i is string=>!!i&&!INDUSTRIES.includes(i))));
  const currentMonth = monthInfo();
  const monthOptions = (rows:Invoice[]) => Array.from(new Set([...recentMonths().map(m=>m.key),...rows.map(i=>i.month_key).filter((k):k is string=>!!k)])).sort((a,b)=>b.localeCompare(a)).map(monthFromKey);
  const creatorInvoiceMonths = monthOptions(myInvoices);
  const financeInvoiceMonths = monthOptions(invoices);
  const visibleMyInvoices = myInvoices.filter(i=>(i.month_key || '')===selectedInvoiceMonth);
  const visibleFinanceInvoices = invoices.filter(i=>(i.month_key || '')===financeInvoiceMonth);
  const financeMonthCreators = creators.map(c => {
    const rows = visibleFinanceInvoices.filter(i=>i.creators?.id===c.id);
    return { creator:c, rows, amount:rows.reduce((sum,i)=>sum+Number(i.amount||0),0), paid:rows.filter(i=>i.paid).length };
  });
  const filteredCreatorIds = new Set(filteredCreators.map(c=>c.id));
  const filteredOpsTasks = (ops?.tasks || []).filter((t:any) => !t.creator_id || filteredCreatorIds.has(t.creator_id));
  const moneyByMonth = Array.from(moneyRows.reduce((map,row) => {
    const key = row.month_key || row.month_label || 'Unknown';
    const current = map.get(key) || { key, label:row.month_label || key, invoices:0, approved:0, paid:0, mismatches:0, total:0, approvedTotal:0, paidTotal:0, pendingPayout:0 };
    const amount = Number(row.amount || 0);
    current.invoices += 1;
    current.total += amount;
    if (row.approval_state === 'approved') { current.approved += 1; current.approvedTotal += amount; if (!row.paid) current.pendingPayout += amount; }
    if (row.paid) { current.paid += 1; current.paidTotal += amount; }
    if (row.bank_match === 'mismatch') current.mismatches += 1;
    map.set(key,current);
    return map;
  }, new Map<string,{key:string;label:string;invoices:number;approved:number;paid:number;mismatches:number;total:number;approvedTotal:number;paidTotal:number;pendingPayout:number}>()).values()).sort((a,b)=>b.key.localeCompare(a.key));

  if (loading) return <main className="splash"><div className="logo">YOSO<span>.</span></div><p>Checking your secure YOSO session...</p></main>;
  if (!user) return <main className="splash"><div className="logo">YOSO<span>.</span></div><h1>Creator operations, engineered.</h1><p>One calm place for every task, invoice, and payment.</p><button onClick={signIn} className="primary google">Continue with Google</button>{authError&&<p className="auth-error">{authError}</p>}<small>Sign in to continue.</small></main>;
  if (page === 'Onboarding') return <CreatorOnboarding onComplete={completeOnboarding} />;

  const render = () => {
    if (page === 'My Tasks') return <section><Hero eyebrow="Creator portal" title="My tasks" text="Your current LinkedIn assignments." /><div className="toolbar"><button className="primary" onClick={enableNotifications}><Bell size={16}/>Enable notifications</button><button className="secondary" onClick={sendTestPush}>Send test push</button>{pushNotice&&<span>{pushNotice}</span>}</div>{notice&&<div className="notice">{notice}</div>}{myTasks.map(t => <article className="task" key={t.id}><div><Pill>{t.type.toUpperCase()}</Pill><h3>{t.posts?.client || 'LinkedIn task'}</h3>{t.posts?.link ? <a href={t.posts.link} target="_blank" rel="noreferrer">{t.posts.link}</a> : <small>No link saved</small>}</div><div className="countdown">{t.state}<small>{t.expires_at ? new Date(t.expires_at).toLocaleString('en-IN') : ''}</small></div><div>{t.state === 'sent' && <><button className="primary" onClick={() => uploadTaskScreenshot(t.id)}>Upload screenshot</button><button className="secondary" onClick={() => rejectTask(t.id)}>Reject</button></>}</div></article>)}{!myTasks.length&&<Empty>No tasks right now.</Empty>}</section>;
    if (page === 'My Invoices') return <section><Hero eyebrow="Creator portal" title="My invoices" text="Month-wise invoice history and payment status." /><MonthTabs months={creatorInvoiceMonths} value={selectedInvoiceMonth} onChange={setSelectedInvoiceMonth} />{selectedInvoiceMonth===currentMonth.key&&<><div className="toolbar"><input type="number" min="0" placeholder="Claimed reposts" value={invoiceClaim.claimed_reposts} onChange={e=>setInvoiceClaim({...invoiceClaim,claimed_reposts:e.target.value})}/><input type="number" min="0" placeholder="Claimed comments" value={invoiceClaim.claimed_comments} onChange={e=>setInvoiceClaim({...invoiceClaim,claimed_comments:e.target.value})}/><input type="number" min="0" placeholder="Claimed amount" value={invoiceClaim.claimed_amount} onChange={e=>setInvoiceClaim({...invoiceClaim,claimed_amount:e.target.value})}/><button className="primary" onClick={uploadInvoice}><FileText size={16}/>Upload invoice</button>{notice&&<span>{notice}</span>}</div><div className="month-picks">{creatorInvoiceMonths.filter(m=>m.key<=currentMonth.key).map(m=><label key={m.key}><input type="checkbox" checked={selectedInvoiceMonths.includes(m.key)} onChange={e=>setSelectedInvoiceMonths(e.target.checked?[...new Set([...selectedInvoiceMonths,m.key])]:selectedInvoiceMonths.filter(k=>k!==m.key))}/>{m.label}</label>)}</div></>}{selectedInvoiceMonth!==currentMonth.key&&<div className="notice">Past months are read-only history.</div>}<InvoiceTable rows={visibleMyInvoices} mine />{!visibleMyInvoices.length&&<Empty>No invoices for this month.</Empty>}</section>;
    if (page === 'My Bank Details') return <section><Hero eyebrow="Creator portal" title="My bank details" text="Saved details used for invoice checks." />{notice&&<div className="notice">{notice}</div>}<div className="card form"><label>Account number<input value={bank.bank_account} onChange={e=>setBank({...bank,bank_account:e.target.value})}/></label><label>IFSC code<input value={bank.ifsc} onChange={e=>setBank({...bank,ifsc:e.target.value})}/></label>{myProfile&&<label>LinkedIn profile<input value={myProfile.linkedin_url || ''} readOnly/></label>}<button className="primary" onClick={saveBank}>Save secure details</button></div></section>;
    if (page === 'Distribute Post') return <section><Hero eyebrow="Operations" title="Distribute a post" text="Create real repost and comment tasks for creators." />{notice&&<div className="notice">{notice}</div>}<div className="card form"><label>Client<input value={postForm.client} onChange={e=>setPostForm({...postForm,client:e.target.value})}/></label><label>LinkedIn post link<input type="url" value={postForm.link} onChange={e=>setPostForm({...postForm,link:e.target.value})}/></label><div className="two"><label>Repost quota<input type="number" min="0" value={postForm.repost_quota} onChange={e=>setPostForm({...postForm,repost_quota:Number(e.target.value)})}/></label><label>Comment quota<input type="number" min="0" value={postForm.comment_quota} onChange={e=>setPostForm({...postForm,comment_quota:Number(e.target.value)})}/></label></div><label>Targeting mode<select value={postForm.targeting_mode} onChange={e=>setPostForm({...postForm,targeting_mode:e.target.value})}><option value="random">Random</option><option value="industry">By industry</option></select></label>{postForm.targeting_mode==='industry'&&<label>Target industry<select value={postForm.target_industry} onChange={e=>setPostForm({...postForm,target_industry:e.target.value})}><option value="">Select industry</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}</select></label>}<button className="primary" onClick={distributePost}><Send size={16}/>Send tasks</button></div></section>;
    if (page === 'Creator Directory' || page === 'Rate Management') return <section><Hero eyebrow="Network" title={page} text="Live creator records from the database." /><div className="toolbar"><select value={creatorFilters.industry} onChange={e=>setCreatorFilters({...creatorFilters,industry:e.target.value})}><option value="">All industries</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}{customIndustries.map(i=><option key={i} value={i}>{i}</option>)}</select><input placeholder="Region / city" value={creatorFilters.region} onChange={e=>setCreatorFilters({...creatorFilters,region:e.target.value})}/><input placeholder="Min followers" type="number" value={creatorFilters.followersMin} onChange={e=>setCreatorFilters({...creatorFilters,followersMin:e.target.value})}/><input placeholder="Max followers" type="number" value={creatorFilters.followersMax} onChange={e=>setCreatorFilters({...creatorFilters,followersMax:e.target.value})}/>{canViewRates&&<><input placeholder="Min rate" type="number" value={creatorFilters.rateMin} onChange={e=>setCreatorFilters({...creatorFilters,rateMin:e.target.value})}/><input placeholder="Max rate" type="number" value={creatorFilters.rateMax} onChange={e=>setCreatorFilters({...creatorFilters,rateMax:e.target.value})}/></>}<button className="secondary" onClick={refreshStaff}>Refresh</button><span>{filteredCreators.length} creators</span></div><div className="card tablewrap"><table><thead><tr><th>Creator</th><th>Industry</th><th>Region</th><th>LinkedIn Followers</th>{canViewRates&&<><th>Repost rate</th><th>Comment rate</th><th>Campaign rate</th></>}<th>Status</th><th></th></tr></thead><tbody>{filteredCreators.map(c => <tr key={c.id}><td><b>{c.name}</b><small>{c.email}</small></td><td>{c.industry || '-'}</td><td>{c.region || '-'}</td><td>{c.followers ?? '-'}</td>{canViewRates&&<><td>{page==='Rate Management'?<input className="rate" value={rateEdits[c.id]?.rate_repost ?? ''} onChange={e=>setRateEdits({...rateEdits,[c.id]:{...rateEdits[c.id],rate_repost:e.target.value}})}/>:money(c.rate_repost)}</td><td>{page==='Rate Management'?<input className="rate" value={rateEdits[c.id]?.rate_comment ?? ''} onChange={e=>setRateEdits({...rateEdits,[c.id]:{...rateEdits[c.id],rate_comment:e.target.value}})}/>:money(c.rate_comment)}</td><td>{page==='Rate Management'?<input className="rate" value={rateEdits[c.id]?.rate_campaign ?? ''} onChange={e=>setRateEdits({...rateEdits,[c.id]:{...rateEdits[c.id],rate_campaign:e.target.value}})}/>:money(c.rate_campaign)}</td></>}<td><Pill kind={c.status==='active'?'good':'neutral'}>{c.status}</Pill></td><td>{page==='Rate Management'&&canViewRates&&<button className="tiny" onClick={()=>saveRates(c)}>Save rates</button>}<button className="text-danger" onClick={()=>setCreatorStatus(c,c.status==='active'?'inactive':'active')}>{c.status==='active'?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div>{!filteredCreators.length&&<Empty>No creators match these filters.</Empty>}</section>;
    if (page === 'Task Board') return <section><Hero eyebrow="Operations" title="Task board" text="Live posts and task completion." />{posts.map(p => { const tasks = p.tasks || []; const done = tasks.filter(t=>t.state==='done').length; return <div className="card board task-board" key={p.id}><div><b>{p.client}</b><small>{done} / {tasks.length} tasks complete - {p.status}</small><small>{p.link}</small><div className="proof-list">{tasks.map(t=><div className="proof-row" key={t.id}><span>{t.type} - {t.state}</span><FileLink href={t.screenshot_url} label="View screenshot" /></div>)}</div></div><Pill kind={p.status==='closed'?'good':'pending'}>{p.status}</Pill>{p.status!=='closed'&&<button className="tiny" onClick={()=>closePost(p.id)}>Close</button>}<ChevronRight/></div>; })}{!posts.length&&<Empty>No posts yet.</Empty>}</section>;
    if (page === 'Approvals') return <section><Hero eyebrow="Finance" title="Approvals" text="Approve or reject submitted invoices by month." /><MonthTabs months={financeInvoiceMonths} value={financeInvoiceMonth} onChange={setFinanceInvoiceMonth} />{notice&&<div className="notice">{notice}</div>}<MonthlyCreatorSummary rows={financeMonthCreators} /><InvoiceTable rows={visibleFinanceInvoices} actions={(i)=><>{i.approval_state==='pending'&&<><button className="tiny" onClick={()=>updateInvoice(i,'approve')}>Approve</button><button className="text-danger" onClick={()=>updateInvoice(i,'reject')}>Reject</button></>}</>} />{!visibleFinanceInvoices.length&&<Empty>No invoices for this month.</Empty>}</section>;
    if (page === 'Payments') return <section><Hero eyebrow="Finance" title="Payments" text="Mark approved invoices as paid." /><MonthTabs months={financeInvoiceMonths} value={financeInvoiceMonth} onChange={setFinanceInvoiceMonth} /><div className="toolbar"><button className="primary" onClick={downloadBankFile}><Download size={16}/>Download bank file</button>{notice&&<span>{notice}</span>}</div><InvoiceTable rows={visibleFinanceInvoices.filter(i=>i.approval_state==='approved')} actions={(i)=><>{!i.paid&&<button className="tiny" onClick={()=>updateInvoice(i,'pay')}>Mark paid</button>}</>} /></section>;
    if (page === 'Operations Dashboard') return <section><Hero eyebrow="Dashboard" title="Operations dashboard" text="Filtered creator and task activity from the database." /><div className="toolbar"><select value={creatorFilters.industry} onChange={e=>setCreatorFilters({...creatorFilters,industry:e.target.value})}><option value="">All industries</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}{customIndustries.map(i=><option key={i} value={i}>{i}</option>)}</select><input placeholder="Region / city" value={creatorFilters.region} onChange={e=>setCreatorFilters({...creatorFilters,region:e.target.value})}/><input placeholder="Min followers" type="number" value={creatorFilters.followersMin} onChange={e=>setCreatorFilters({...creatorFilters,followersMin:e.target.value})}/><input placeholder="Max followers" type="number" value={creatorFilters.followersMax} onChange={e=>setCreatorFilters({...creatorFilters,followersMax:e.target.value})}/>{canViewRates&&<><input placeholder="Min rate" type="number" value={creatorFilters.rateMin} onChange={e=>setCreatorFilters({...creatorFilters,rateMin:e.target.value})}/><input placeholder="Max rate" type="number" value={creatorFilters.rateMax} onChange={e=>setCreatorFilters({...creatorFilters,rateMax:e.target.value})}/></>}<button className="secondary" onClick={refreshStaff}>Refresh</button><span>{filteredCreators.length} creators</span></div><div className="kpis"><div className="metric"><small>Filtered active creators</small><strong>{filteredCreators.filter(c=>c.status==='active').length}</strong></div><div className="metric"><small>Filtered inactive creators</small><strong>{filteredCreators.filter(c=>c.status==='inactive').length}</strong></div><div className="metric"><small>Open posts</small><strong>{posts.filter(p=>p.status==='open').length}</strong></div><div className="metric"><small>Filtered tasks tracked</small><strong>{filteredOpsTasks.length}</strong></div></div><div className="card tablewrap" style={{marginTop:16}}><table><thead><tr><th>Creator</th><th>Industry</th><th>Region</th><th>LinkedIn Followers</th><th>Status</th><th>Tasks</th><th>Done</th></tr></thead><tbody>{filteredCreators.map(c=>{const tasks=filteredOpsTasks.filter((t:any)=>t.creator_id===c.id);return <tr key={c.id}><td><b>{c.name}</b><small>{c.email}</small></td><td>{c.industry || '-'}</td><td>{c.region || '-'}</td><td>{c.followers ?? '-'}</td><td><Pill kind={c.status==='active'?'good':'neutral'}>{c.status}</Pill></td><td>{tasks.length}</td><td>{tasks.filter((t:any)=>t.state==='done').length}</td></tr>})}</tbody></table></div>{!filteredCreators.length&&<Empty>No creators match these filters.</Empty>}</section>;
    if (page === 'Money Dashboard') return <section><Hero eyebrow="Finance" title="Money dashboard" text="Month-wise expenditure and payout visibility." /><div className="kpis"><div className="metric"><small>Total invoices</small><strong>{moneyRows.length}</strong></div><div className="metric"><small>Approved expenditure</small><strong>{money(moneyRows.filter(i=>i.approval_state==='approved').reduce((sum,i)=>sum+Number(i.amount||0),0))}</strong></div><div className="metric"><small>Paid</small><strong>{money(moneyRows.filter(i=>i.paid).reduce((sum,i)=>sum+Number(i.amount||0),0))}</strong></div><div className="metric"><small>Pending payout</small><strong>{money(moneyRows.filter(i=>i.approval_state==='approved'&&!i.paid).reduce((sum,i)=>sum+Number(i.amount||0),0))}</strong></div></div><div className="card tablewrap" style={{marginTop:16}}><table><thead><tr><th>Month</th><th>Invoices</th><th>Approved</th><th>Paid</th><th>Approved expenditure</th><th>Paid amount</th><th>Pending payout</th><th>Bank mismatches</th></tr></thead><tbody>{moneyByMonth.map(row=><tr key={row.key}><td><b>{row.label}</b></td><td>{row.invoices}</td><td>{row.approved}</td><td>{row.paid}</td><td>{money(row.approvedTotal)}</td><td>{money(row.paidTotal)}</td><td>{money(row.pendingPayout)}</td><td>{row.mismatches}</td></tr>)}</tbody></table></div>{!moneyByMonth.length&&<Empty>No invoice data yet.</Empty>}</section>;
    if (page === 'Admin') return <section><Hero eyebrow="Control room" title="Admin" text="Manage team access." />{notice&&<div className="notice">{notice}</div>}<div className="card form"><label>Email<input value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></label><label>Name<input value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/></label><label>Role<select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value as Role})}><option value="account_manager">Account manager</option><option value="founder_finance">Founder / finance</option><option value="cofounder">Co-founder</option></select></label><button className="primary" onClick={addTeamMember}>Add team member</button></div></section>;
    return null;
  };

  return <div className="app"><aside><div className="logo">YOSO<span>.</span></div><p className="motto">Reach isn't luck.<br/>It's engineered.</p><nav>{nav.map(n=><button key={n} className={page===n?'active':''} onClick={()=>{setNotice(null);setPage(n)}}>{n==='Money Dashboard'?<CircleDollarSign/>:n.includes('Dashboard')?<LayoutDashboard/>:n.includes('Creator')?<Users/>:n.includes('Task')?<ClipboardList/>:n.includes('Invoice')||n==='Approvals'||n==='Payments'?<FileText/>:n==='Admin'?<Settings/>:<Plus/>}{n}</button>)}</nav><div className="side-bottom"><button onClick={signOut}><LogOut/>Sign out</button></div></aside><main className="content"><header><div><Pill kind="neutral">{user.role.replace('_',' ')}</Pill></div><div className="profile"><Bell size={18}/><span>{user.email}</span><b>{user.email.charAt(0).toUpperCase()}</b></div></header>{render()}</main></div>;
}

function CreatorOnboarding({onComplete}:{onComplete:(body:any)=>Promise<void>}) {
  const [form,setForm] = useState({name:'',industry:'',customIndustry:'',region:'',followers:0,linkedin_url:'',bank_account:'',ifsc:''});
  const [error,setError] = useState<string|null>(null);
  const [saving,setSaving] = useState(false);
  const submit = async (event:React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    const industry = form.industry === 'Others' ? form.customIndustry.trim() : form.industry;
    try { await onComplete({...form,industry}); }
    catch (err:any) { setError(err.message || 'We could not save your details.'); }
    finally { setSaving(false); }
  };
  return <main className="splash"><div className="onboarding"><div className="logo">YOSO<span>.</span></div><h1>Welcome to YOSO</h1><p>Tell us a little about your creator profile to get started.</p><form onSubmit={submit} className="onboarding-form"><label>Full Name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Industry<select required value={form.industry} onChange={e=>setForm({...form,industry:e.target.value,customIndustry:''})}><option value="">Select industry</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}</select></label>{form.industry==='Others'&&<label>Custom industry<input required value={form.customIndustry} onChange={e=>setForm({...form,customIndustry:e.target.value})}/></label>}<label>Region / City<input value={form.region} onChange={e=>setForm({...form,region:e.target.value})}/></label><label>LinkedIn Followers<input required min="0" type="number" value={form.followers} onChange={e=>setForm({...form,followers:Number(e.target.value)})}/></label><label>LinkedIn profile URL<input required type="url" value={form.linkedin_url} onChange={e=>setForm({...form,linkedin_url:e.target.value})}/></label><label>Bank account number<input value={form.bank_account} onChange={e=>setForm({...form,bank_account:e.target.value})}/></label><label>IFSC code<input value={form.ifsc} onChange={e=>setForm({...form,ifsc:e.target.value})}/></label>{error&&<p className="auth-error">{error}</p>}<button disabled={saving} className="primary" type="submit">{saving?'Saving...':'Complete onboarding'}</button></form></div></main>;
}

function InvoiceTable({rows,mine=false,actions}:{rows:Invoice[]; mine?:boolean; actions?:(invoice:Invoice)=>React.ReactNode}) {
  return <div className="card tablewrap"><table><thead><tr>{!mine&&<th>Creator</th>}<th>Month</th><th>Work</th><th>Amounts</th><th>Invoice</th><th>Verification</th><th>Bank</th><th>Status</th><th>Paid</th>{actions&&<th></th>}</tr></thead><tbody>{rows.map(i=><tr key={i.id}>{!mine&&<td><b>{i.creators?.name || '-'}</b><small>{i.creators?.email || ''}</small></td>}<td>{i.month_label}</td><td>{i.reposts} reposts / {i.comments} comments<small>Claimed {i.claimed_reposts ?? 0} / {i.claimed_comments ?? 0}</small></td><td className={i.amount==null?'danger':''}><b>{money(i.amount)}</b><small>Claimed {money(i.claimed_amount)}</small><Pill kind={i.amount_check_state==='match'?'good':i.amount_check_state==='mismatch'?'bad':'pending'}>{i.amount_check_state === 'mismatch' ? 'Amount mismatch' : i.amount_check_state === 'match' ? 'Amount match' : 'Amount unchecked'}</Pill><small>{i.amount_check_message || ''}</small></td><td><FileLink href={i.invoice_url} label={i.invoice_name || 'View invoice'} /></td><td><Pill kind={verificationKind(i.verification_state)}>{i.verification_state === 'verified' ? 'Verified' : i.verification_state === 'mismatch' ? 'Mismatch' : 'Unchecked'}</Pill><small>{i.verification_message || ''}</small></td><td><Pill kind={i.bank_match==='match'?'good':i.bank_match==='mismatch'?'bad':'pending'}>{i.bank_match}</Pill></td><td><Pill kind={i.approval_state==='approved'?'good':i.approval_state==='rejected'?'bad':'pending'}>{i.approval_state}</Pill></td><td>{i.paid?<Pill kind="good">Paid</Pill>:<Pill>Pending</Pill>}</td>{actions&&<td>{actions(i)}</td>}</tr>)}</tbody></table></div>;
}

function MonthTabs({months,value,onChange}:{months:Array<{key:string;label:string}>; value:string; onChange:(key:string)=>void}) {
  return <div className="tabs">{months.map(m=><button key={m.key} className={value===m.key?'active':''} onClick={()=>onChange(m.key)}>{m.label}</button>)}</div>;
}

function MonthlyCreatorSummary({rows}:{rows:Array<{creator:CreatorProfile;rows:Invoice[];amount:number;paid:number}>}) {
  return <div className="card tablewrap month-summary"><table><thead><tr><th>Creator</th><th>Raised</th><th>Pending</th><th>Approved</th><th>Paid</th><th>Amount</th></tr></thead><tbody>{rows.map(row=><tr key={row.creator.id}><td><b>{row.creator.name}</b><small>{row.creator.email}</small></td><td>{row.rows.length}</td><td>{row.rows.filter(i=>i.approval_state==='pending').length}</td><td>{row.rows.filter(i=>i.approval_state==='approved').length}</td><td>{row.paid}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div>;
}

function Dashboard({title,rows}:{title:string; rows:Array<[string,string|number]>}) {
  return <section><Hero eyebrow="Dashboard" title={title} text="Live operational data from the backend." /><div className="kpis">{rows.map(([label,value])=><div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></section>;
}

createRoot(document.getElementById('root')!).render(<App/>);
