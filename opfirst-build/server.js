// Zero dependencies — only Node.js built-ins
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── IN-MEMORY DATABASE ────────────────────────────────────────────────────────
const db = { properties:[], units:[], tenants:[], leases:[], payments:[], vendors:[], tickets:[], messages:[], _seq:{} };
const nextId = t => (db._seq[t] = (db._seq[t]||0) + 1);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];
const insert = (t, o) => { const r = { ...o, id: nextId(t), created_at: now() }; db[t].push(r); return r; };
const update = (t, id, c) => { const i = db[t].findIndex(r => r.id == id); if (i === -1) return null; db[t][i] = { ...db[t][i], ...c }; return db[t][i]; };
const remove = (t, id) => { const i = db[t].findIndex(r => r.id == id); if (i !== -1) db[t].splice(i, 1); };
const find = (t, p) => db[t].filter(p || (() => true));
const findOne = (t, p) => db[t].find(p);

// ── SEED ──────────────────────────────────────────────────────────────────────
function seed() {
  insert('properties', { name:'Oak Avenue Portfolio', address:'2640 Oak Avenue', city:'Austin', state:'TX' });
  [['101',2,1,850,2400,'occupied'],['102',2,1,820,1950,'occupied'],['103',1,1,640,2200,'occupied'],
   ['104',2,2,980,2100,'vacant'],['201',3,2,1100,2650,'occupied'],['202',2,1,810,1800,'occupied'],
   ['203',2,1,830,2400,'occupied'],['204',2,2,960,2300,'expiring']
  ].forEach(([n,b,ba,s,r,st]) => insert('units', {property_id:1,unit_number:n,bedrooms:b,bathrooms:ba,sqft:s,monthly_rent:r,status:st}));
  [['Sarah','Chen','sarah.chen@email.com','(512) 555-0101'],['Marcus','Webb','marcus.webb@email.com','(512) 555-0102'],
   ['Tyler','Ramos','tyler.ramos@email.com','(512) 555-0103'],['Jessica','Park','jessica.park@email.com','(512) 555-0105'],
   ['Derek','Mills','derek.mills@email.com','(512) 555-0106'],['Aisha','Foster','aisha.foster@email.com','(512) 555-0107']
  ].forEach(([fn,ln,e,p]) => insert('tenants', {first_name:fn,last_name:ln,email:e,phone:p}));
  [[1,1,'2026-02-15','2026-08-15',2400,2400],[2,2,'2026-01-01','2026-07-01',1950,1950],
   [3,3,'2025-12-31','2026-06-30',2200,2200],[5,4,'2025-09-20','2026-09-20',2650,2650],
   [6,5,'2025-06-28','2026-06-28',1800,1800],[7,6,'2026-04-01','2026-10-01',2400,2400]
  ].forEach(([u,t,s,e,r,d]) => insert('leases', {unit_id:u,tenant_id:t,start_date:s,end_date:e,monthly_rent:r,security_deposit:d,status:'active'}));
  [[1,2400,'2026-03-01','2026-03-01','paid','ACH'],[2,1950,'2026-03-01','2026-03-01','paid','Card'],
   [3,2200,'2026-03-01',null,'late',null],[4,2650,'2026-03-01','2026-03-01','paid','Autopay'],
   [5,1800,'2026-03-01',null,'pending',null],[6,2400,'2026-03-01','2026-03-01','paid','ACH']
  ].forEach(([lid,amt,due,paid,st,m]) => insert('payments', {lease_id:lid,amount:amt,due_date:due,paid_date:paid,status:st,method:m,transaction_id:paid?'TXN-'+Math.random().toString(36).slice(2,10).toUpperCase():null}));
  [['Victor Plumbing','Plumbing','victor@vpplumbing.com','(512) 555-0201',4.9,23,'active','TX-PLB-2891','2026-12-31','Pass'],
   ['Fast Electric Co','Electrical','info@fastelectric.com','(512) 555-0202',4.7,17,'active','TX-ELC-7734','2026-06-30','Pass'],
   ['CoolAir HVAC','HVAC','service@coolair.com','(512) 555-0203',4.8,31,'active','TX-HVA-5521','2026-09-30','Pass'],
   ['Pro Handyman','General','jobs@prohandyman.com','(512) 555-0204',4.6,44,'active','TX-GEN-1102','2027-01-15','Pass'],
   ['Premier Plumbing LLC','Plumbing','apply@premierplumb.com','(512) 555-0205',5.0,0,'pending','TX-PLB-3344','2026-12-31','Pass'],
   ['SolarTech Electric','Electrical','hello@solartech.com','(512) 555-0206',5.0,0,'pending','TX-ELC-8891','2026-06-30','Review']
  ].forEach(([name,trade,email,phone,rating,jobs,status,lic,ins,bg]) => insert('vendors', {name,trade,email,phone,rating,jobs_completed:jobs,status,license_number:lic,insurance_expiry:ins,bg_check:bg}));
  [[2,2,1,'Plumbing','Bathroom sink not draining','Draining very slowly','urgent','in_progress','Today 2-5pm',2,null],
   [6,5,null,'HVAC','AC unit making loud noise','Grinding when running','emergency','open',null,1,null],
   [1,1,2,'Electrical','Kitchen outlet not working','Two outlets dead','urgent','assigned','Tomorrow 8am-12pm',3,null],
   [5,4,null,'Appliance','Dishwasher door latch broken','Latch snapped off','routine','open',null,0,null],
   [3,3,4,'General','Window screen torn','Large tear','routine','completed',null,2,95]
  ].forEach(([uid,tid,vid,cat,title,desc,urg,st,win,photos,cost]) => insert('tickets', {unit_id:uid,tenant_id:tid,vendor_id:vid,category:cat,title,description:desc,urgency:urg,status:st,scheduled_window:win,photos_count:photos,cost,completed_at:st==='completed'?now():null}));
  insert('messages', {ticket_id:1,sender_type:'system',sender_name:'System',body:'Ticket received. Reference: TKT-0001'});
  insert('messages', {ticket_id:1,sender_type:'tenant',sender_name:'Marcus Webb',body:'Sink slow for 3 days.'});
  insert('messages', {ticket_id:1,sender_type:'pm',sender_name:'Patricia Davis',body:'Victor Plumbing assigned.'});
  insert('messages', {ticket_id:2,sender_type:'system',sender_name:'System',body:'EMERGENCY ticket received.'});
}

// ── JOIN HELPERS ──────────────────────────────────────────────────────────────
const tName = id => { const t = findOne('tenants', t => t.id == id); return t ? t.first_name + ' ' + t.last_name : null; };
const uNum = id => findOne('units', u => u.id == id)?.unit_number || null;
const vName = id => findOne('vendors', v => v.id == id)?.name || null;

// ── REQUEST HELPERS ───────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') { json(res, {}); return; }

  // API routes
  if (pathname.startsWith('/api/')) {
    const body = (method === 'POST' || method === 'PUT') ? await readBody(req) : {};
    const parts = pathname.replace('/api/', '').split('/');
    const resource = parts[0];
    const id = parts[1];
    const sub = parts[2];

    try {
      // Dashboard
      if (resource === 'dashboard' && method === 'GET') {
        const uG={}, pG={}, tG={};
        db.units.forEach(u => (uG[u.status] = (uG[u.status]||0)+1));
        db.payments.forEach(p => { if(!pG[p.status]) pG[p.status]={status:p.status,count:0,total:0}; pG[p.status].count++; pG[p.status].total += parseFloat(p.amount)||0; });
        db.tickets.forEach(t => { const k=t.urgency+'|'+t.status; if(!tG[k]) tG[k]={urgency:t.urgency,status:t.status,count:0}; tG[k].count++; });
        const rM={};
        db.payments.filter(p=>p.status==='paid').forEach(p => { const d=new Date(p.due_date); const mon=d.toLocaleString('en-US',{month:'short'}); const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); if(!rM[key]) rM[key]={month:mon,collected:0,key}; rM[key].collected += parseFloat(p.amount)||0; });
        return json(res, {units:Object.entries(uG).map(([s,c])=>({status:s,count:c})),payments:Object.values(pG),tickets:Object.values(tG),vendors:[{count:db.vendors.filter(v=>v.status==='active').length}],revenue:Object.values(rM).sort((a,b)=>a.key.localeCompare(b.key)).slice(-6)});
      }

      // Properties
      if (resource === 'properties') {
        if (method === 'GET' && !id) return json(res, db.properties.map(p=>({...p,unit_count:db.units.filter(u=>u.property_id==p.id).length})));
        if (method === 'POST') { const {name,address,city,state}=body; if(!name||!address||!city) return json(res,{error:'name,address,city required'},400); return json(res, insert('properties',{name,address,city,state:state||'TX'}), 201); }
        if (method === 'PUT' && id) { const r=update('properties',id,body); if(!r) return json(res,{error:'Not found'},404); return json(res,r); }
        if (method === 'DELETE' && id) { remove('properties',id); return json(res,{ok:true}); }
      }

      // Units
      if (resource === 'units') {
        if (method === 'GET' && !id) {
          return json(res, db.units.map(u => {
            const prop=findOne('properties',p=>p.id==u.property_id)||{};
            const lease=findOne('leases',l=>l.unit_id==u.id&&l.status==='active');
            const tenant=lease?findOne('tenants',t=>t.id==lease.tenant_id):null;
            const n=new Date(); const pay=lease?findOne('payments',p=>p.lease_id==lease.id&&new Date(p.due_date).getMonth()===n.getMonth()&&new Date(p.due_date).getFullYear()===n.getFullYear()):null;
            return{...u,property_name:prop.name,address:prop.address,tenant_name:tenant?tenant.first_name+' '+tenant.last_name:null,tenant_id:tenant?.id||null,lease_id:lease?.id||null,end_date:lease?.end_date||null,lease_rent:lease?.monthly_rent||null,payment_status:pay?.status||null};
          }).sort((a,b)=>a.unit_number.localeCompare(b.unit_number)));
        }
        if (method === 'GET' && id) { const u=findOne('units',u=>u.id==id); if(!u) return json(res,{error:'Not found'},404); return json(res,{...u,property_name:findOne('properties',p=>p.id==u.property_id)?.name}); }
        if (method === 'POST') { const{property_id,unit_number,bedrooms,bathrooms,sqft,monthly_rent}=body; if(!property_id||!unit_number) return json(res,{error:'property_id and unit_number required'},400); return json(res,insert('units',{property_id,unit_number,bedrooms:bedrooms||1,bathrooms:bathrooms||1,sqft:sqft||null,monthly_rent:monthly_rent||0,status:'vacant'}),201); }
        if (method === 'PUT' && id) { const r=update('units',id,body); if(!r) return json(res,{error:'Not found'},404); return json(res,r); }
        if (method === 'DELETE' && id) { remove('units',id); return json(res,{ok:true}); }
      }

      // Tenants
      if (resource === 'tenants') {
        if (method === 'GET' && !id) return json(res, db.tenants.map(t=>{const l=findOne('leases',l=>l.tenant_id==t.id&&l.status==='active');const u=l?findOne('units',u=>u.id==l.unit_id):null;return{...t,unit_id:u?.id,unit_number:u?.unit_number,end_date:l?.end_date,monthly_rent:l?.monthly_rent,lease_status:l?.status};}).sort((a,b)=>a.last_name.localeCompare(b.last_name)));
        if (method === 'GET' && id) { const t=findOne('tenants',t=>t.id==id); if(!t) return json(res,{error:'Not found'},404); return json(res,t); }
        if (method === 'POST') { const{first_name,last_name,email,phone}=body; if(!first_name||!last_name||!email) return json(res,{error:'first_name,last_name,email required'},400); if(findOne('tenants',t=>t.email===email)) return json(res,{error:'Email already exists'},400); return json(res,insert('tenants',{first_name,last_name,email,phone:phone||null}),201); }
        if (method === 'PUT' && id) { const r=update('tenants',id,body); if(!r) return json(res,{error:'Not found'},404); return json(res,r); }
        if (method === 'DELETE' && id) { remove('tenants',id); return json(res,{ok:true}); }
      }

      // Leases
      if (resource === 'leases') {
        if (method === 'GET' && !id) return json(res, db.leases.map(l=>{const u=findOne('units',u=>u.id==l.unit_id)||{};const t=findOne('tenants',t=>t.id==l.tenant_id)||{};const p=findOne('properties',p=>p.id==u.property_id)||{};return{...l,unit_number:u.unit_number,property_id:u.property_id,property_name:p.name,tenant_name:t.first_name+' '+t.last_name,tenant_email:t.email,tenant_phone:t.phone};}).sort((a,b)=>b.id-a.id));
        if (method === 'POST') { const{unit_id,tenant_id,start_date,end_date,monthly_rent,security_deposit}=body; if(!unit_id||!tenant_id||!start_date||!end_date||!monthly_rent) return json(res,{error:'Missing required fields'},400); const l=insert('leases',{unit_id,tenant_id,start_date,end_date,monthly_rent,security_deposit:security_deposit||0,status:'active'}); update('units',unit_id,{status:'occupied'}); insert('payments',{lease_id:l.id,amount:monthly_rent,due_date:start_date,status:'pending',paid_date:null,method:null,transaction_id:null}); return json(res,l,201); }
        if (method === 'PUT' && id) { const{end_date,monthly_rent,status}=body; const c={}; if(end_date)c.end_date=end_date; if(monthly_rent)c.monthly_rent=monthly_rent; if(status)c.status=status; const r=update('leases',id,c); if(!r) return json(res,{error:'Not found'},404); if(status==='terminated')update('units',r.unit_id,{status:'vacant'}); return json(res,r); }
        if (method === 'DELETE' && id) { const l=findOne('leases',l=>l.id==id); remove('leases',id); if(l)update('units',l.unit_id,{status:'vacant'}); return json(res,{ok:true}); }
      }

      // Payments
      if (resource === 'payments') {
        if (method === 'GET' && !id) return json(res, db.payments.map(p=>{const l=findOne('leases',l=>l.id==p.lease_id)||{};const u=findOne('units',u=>u.id==l.unit_id)||{};const t=findOne('tenants',t=>t.id==l.tenant_id)||{};return{...p,unit_id:u.id,unit_number:u.unit_number,tenant_name:t.first_name+' '+t.last_name,tenant_email:t.email};}).sort((a,b)=>new Date(b.due_date)-new Date(a.due_date)));
        if (method === 'POST') { const{lease_id,amount,due_date}=body; if(!lease_id||!amount||!due_date) return json(res,{error:'lease_id,amount,due_date required'},400); return json(res,insert('payments',{lease_id,amount,due_date,status:'pending',paid_date:null,method:null,transaction_id:null}),201); }
        if (method === 'PUT' && id) { const{status,method:m,paid_date}=body; const c={}; if(status)c.status=status; if(m)c.method=m; if(paid_date)c.paid_date=paid_date; if(status==='paid'){c.paid_date=paid_date||today();c.transaction_id='TXN-'+Math.random().toString(36).slice(2,10).toUpperCase();} const r=update('payments',id,c); if(!r) return json(res,{error:'Not found'},404); return json(res,r); }
        if (method === 'DELETE' && id) { remove('payments',id); return json(res,{ok:true}); }
      }

      // Tickets
      if (resource === 'tickets') {
        if (method === 'GET' && !id) { const o={emergency:1,urgent:2,routine:3}; return json(res, db.tickets.map(t=>({...t,unit_number:uNum(t.unit_id),tenant_name:tName(t.tenant_id),vendor_name:vName(t.vendor_id),vendor_phone:findOne('vendors',v=>v.id==t.vendor_id)?.phone})).sort((a,b)=>(o[a.urgency]||9)-(o[b.urgency]||9)||b.id-a.id)); }
        if (method === 'GET' && id && !sub) { const t=findOne('tickets',t=>t.id==id); if(!t) return json(res,{error:'Not found'},404); const u=findOne('units',u=>u.id==t.unit_id)||{}; const p=findOne('properties',p=>p.id==u.property_id)||{}; const ten=findOne('tenants',ten=>ten.id==t.tenant_id)||{}; const v=findOne('vendors',v=>v.id==t.vendor_id)||{}; const msgs=find('messages',m=>m.ticket_id==t.id).sort((a,b)=>a.id-b.id); return json(res,{...t,unit_number:u.unit_number,address:p.address,tenant_name:ten.first_name+' '+ten.last_name,tenant_email:ten.email,tenant_phone:ten.phone,vendor_name:v.name,vendor_phone:v.phone,vendor_trade:v.trade,messages:msgs}); }
        if (method === 'POST' && !id) { const{unit_id,tenant_id,category,title,description,urgency}=body; if(!unit_id||!category||!title) return json(res,{error:'unit_id,category,title required'},400); const t=insert('tickets',{unit_id,tenant_id:tenant_id||null,vendor_id:null,category,title,description:description||null,urgency:urgency||'routine',status:'open',scheduled_window:null,photos_count:0,cost:null,completed_at:null}); insert('messages',{ticket_id:t.id,sender_type:'system',sender_name:'System',body:'Ticket received. Reference: TKT-'+String(t.id).padStart(4,'0')}); return json(res,t,201); }
        if (method === 'PUT' && id && !sub) { const{status,urgency,vendor_id,scheduled_window,cost,description}=body; const c={}; if(status)c.status=status; if(urgency)c.urgency=urgency; if(vendor_id!==undefined)c.vendor_id=vendor_id; if(scheduled_window!==undefined)c.scheduled_window=scheduled_window; if(cost!==undefined)c.cost=cost; if(description!==undefined)c.description=description; if(status==='completed')c.completed_at=now(); const r=update('tickets',id,c); if(!r) return json(res,{error:'Not found'},404); const autoMsg={assigned:'Vendor assigned.',in_progress:'Vendor on-site.',completed:'Work completed. Ticket closed.',cancelled:'Ticket cancelled.'}; if(autoMsg[status])insert('messages',{ticket_id:Number(id),sender_type:'system',sender_name:'System',body:autoMsg[status]}); return json(res,r); }
        if (method === 'POST' && id && sub === 'message') { const{sender_type,sender_name,body:msgBody}=body; if(!sender_type||!sender_name||!msgBody) return json(res,{error:'sender_type,sender_name,body required'},400); return json(res,insert('messages',{ticket_id:Number(id),sender_type,sender_name,body:msgBody}),201); }
        if (method === 'DELETE' && id) { const nid=Number(id); db.messages=db.messages.filter(m=>m.ticket_id!==nid); remove('tickets',id); return json(res,{ok:true}); }
      }

      // Vendors
      if (resource === 'vendors') {
        if (method === 'GET' && !id) { const o={active:1,pending:2,suspended:3}; return json(res,[...db.vendors].sort((a,b)=>(o[a.status]||9)-(o[b.status]||9)||b.rating-a.rating)); }
        if (method === 'POST') { const{name,trade,email,phone,license_number,insurance_expiry,bg_check}=body; if(!name||!trade) return json(res,{error:'name and trade required'},400); return json(res,insert('vendors',{name,trade,email:email||null,phone:phone||null,rating:5.0,jobs_completed:0,status:'pending',license_number:license_number||null,insurance_expiry:insurance_expiry||null,bg_check:bg_check||'Pending'}),201); }
        if (method === 'PUT' && id) { const allowed=['name','trade','email','phone','status','rating','license_number','insurance_expiry','bg_check']; const c={}; allowed.forEach(k=>{if(body[k]!==undefined)c[k]=body[k];}); const r=update('vendors',id,c); if(!r) return json(res,{error:'Not found'},404); return json(res,r); }
        if (method === 'DELETE' && id) { remove('vendors',id); return json(res,{ok:true}); }
      }

      json(res, { error: 'Not found' }, 404);
    } catch(e) {
      console.error('Route error:', e.message);
      json(res, { error: e.message }, 500);
    }
    return;
  }

  // Serve static files
  if (pathname === '/' || pathname === '') {
    serveFile(res, path.join(__dirname, 'public', 'index.html'));
  } else {
    serveFile(res, path.join(__dirname, 'public', pathname));
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
seed();
console.log('Database ready');

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    console.error('Request error:', e.message);
    try { json(res, { error: 'Internal error' }, 500); } catch(_) {}
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('OpFirst PMS running on port ' + PORT);
});

process.on('unhandledRejection', r => console.error('Unhandled:', r));
process.on('uncaughtException', e => { console.error('Uncaught:', e.message); process.exit(1); });
