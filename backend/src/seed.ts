import 'dotenv/config'; import { createClient } from '@supabase/supabase-js';
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const creators=[['Ravi Kumar','ravi@gmail.com','Finance',18400,150,50],['Sneha Patil','sneha@gmail.com','D2C / Retail',26200,200,60],['Arjun Mehta','arjun@gmail.com','Tech / SaaS',9100,null,null],['Priya Nair','priya@gmail.com','Health / Wellness',14700,175,55]];
await db.from('creators').upsert(creators.map(([name,email,industry,followers,rate_repost,rate_comment])=>({name,email,industry,followers,rate_repost,rate_comment,bank_account:'50100xxxx4821',ifsc:'HDFC0001234'})),{onConflict:'email'}); console.log('Seeded sample YOSO creators.');
