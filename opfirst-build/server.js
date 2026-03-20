const express = require('express');
const cors = require('cors');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = new PGlite();

async function initDB() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL,
      city TEXT NOT NULL, state TEXT DEFAULT 'TX', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY, property_id INTEGER REFERENCES properties(id),
      unit_number TEXT NOT NULL, bedrooms INTEGER DEFAULT 1,
      bathrooms NUMERIC(3,1) DEFAULT 1.0, sqft INTEGER,
      monthly_rent NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'vacant' CHECK(status IN ('vacant','occupied','expiring','maintenance')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, phone TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS leases (
      id SERIAL PRIMARY KEY, unit_id INTEGER REFERENCES units(id),
      tenant_id INTEGER REFERENCES tenants(id), start_date DATE NOT NULL,
      end_date DATE NOT NULL, monthly_rent NUMERIC(10,2) NOT NULL,
      security_deposit NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','expiring','expired','terminated')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY, lease_id INTEGER REFERENCES leases(id),
      amount NUMERIC(10,2) NOT NULL, due_date DATE NOT NULL, paid_date DATE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','late','failed')),
      method TEXT, transaction_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, trade TEXT NOT NULL,
      email TEXT, phone TEXT, rating NUMERIC(3,1) DEFAULT 5.0,
      jobs_completed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
      license_number TEXT, insurance_expiry DATE,
      bg_check TEXT DEFAULT 'Pending' CHECK(bg_check IN ('Pending','Pass','Review','Fail')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY, unit_id INTEGER REFERENCES units(id),
      tenant_id INTEGER REFERENCES tenants(id), vendor_id INTEGER REFERENCES vendors(id),
      category TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      urgency TEXT DEFAULT 'routine' CHECK(urgency IN ('emergency','urgent','routine')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open','assigned','scheduled','in_progress','completed','cancelled')),
      scheduled_window TEXT, photos_count INTEGER DEFAULT 0,
      cost NUMERIC(10,2), created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, ticket_id INTEGER REFERENCES tickets(id),
      sender_type TEXT NOT NULL CHECK(sender_type IN ('pm','tenant','vendor','system')),
      sender_name TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const check = await db.query('SELECT COUNT(*) as c FROM properties');
  if (parseInt(check.rows[0].c) === 0) await seedData();
  console.log('Database ready');
}

async function seedData() {
  await db.query(`INSERT INTO properties(name,address,city,state) VALUES('Oak Avenue Portfolio','2640 Oak Avenue','Austin','TX')`);
  const units = [
    ['101',2,1.0,850,2400,'occupied'],['102',2,1.0,820,1950,'occupied'],
    ['103',1,1.0,640,2200,'occupied'],['104',2,2.0,980,2100,'vacant'],
    ['201',3,2.0,1100,2650,'occupied'],['202',2,1.0,810,1800,'occupied'],
    ['203',2,1.0,830,2400,'occupied'],['204',2,2.0,960,2300,'expiring'],
  ];
  for (const [n,b,ba,s,r,st] of units)
    await db.query(`INSERT INTO units(property_id,unit_number,bedrooms,bathrooms,sqft,monthly_rent,status) VALUES(1,$1,$2,$3,$4,$5,$6)`,[n,b,ba,s,r,st]);

  const tenants = [
    ['Sarah','Chen','sarah.chen@email.com','(512) 555-0101'],
    ['Marcus','Webb','marcus.webb@email.com','(512) 555-0102'],
    ['Tyler','Ramos','tyler.ramos@email.com','(512) 555-0103'],
    ['Jessica','Park','jessica.park@email.com','(512) 555-0105'],
    ['Derek','Mills','derek.mills@email.com','(512) 555-0106'],
    ['Aisha','Foster','aisha.foster@email.com','(512) 555-0107'],
  ];
  for (const [fn,ln,e,p] of tenants)
    await db.query(`INSERT INTO tenants(first_name,last_name,email,phone) VALUES($1,$2,$3,$4)`,[fn,ln,e,p]);

  const leases = [
    [1,1,'2026-02-15','2026-08-15',2400,2400],
    [2,2,'2026-01-01','2026-07-01',1950,1950],
    [3,3,'2025-12-31','2026-06-30',2200,2200],
    [5,4,'2025-09-20','2026-09-20',2650,2650],
    [6,5,'2025-06-28','2026-06-28',1800,1800],
    [7,6,'2026-04-01','2026-10-01',2400,2400],
  ];
  for (const [uid,tid,s,e,r,d] of leases)
    await db.query(`INSERT INTO leases(unit_id,tenant_id,start_date,end_date,monthly_rent,security_deposit) VALUES($1,$2,$3,$4,$5,$6)`,[uid,tid,s,e,r,d]);

  const payments = [
    [1,2400,'2026-03-01','2026-03-01','paid','ACH'],
    [2,1950,'2026-03-01','2026-03-01','paid','Card'],
    [3,2200,'2026-03-01',null,'late',null],
    [4,2650,'2026-03-01','2026-03-01','paid','Autopay'],
    [5,1800,'2026-03-01',null,'pending',null],
    [6,2400,'2026-03-01','2026-03-01','paid','ACH'],
  ];
  for (const [lid,amt,due,paid,st,m] of payments)
    await db.query(`INSERT INTO payments(lease_id,amount,due_date,paid_date,status,method,transaction_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [lid,amt,due,paid,st,m,paid?'TXN-'+Math.random().toString(36).slice(2,10).toUpperCase():null]);

  const vendors = [
    ['Victor Plumbing','Plumbing','victor@vpplumbing.com','(512) 555-0201',4.9,23,'active','TX-PLB-2891','2026-12-31','Pass'],
    ['Fast Electric Co','Electrical','info@fastelectric.com','(512) 555-0202',4.7,17,'active','TX-ELC-7734','2026-06-30','Pass'],
    ['CoolAir HVAC','HVAC','service@coolair.com','(512) 555-0203',4.8,31,'active','TX-HVA-5521','2026-09-30','Pass'],
    ['Pro Handyman','General','jobs@prohandyman.com','(512) 555-0204',4.6,44,'active','TX-GEN-1102','2027-01-15','Pass'],
    ['Premier Plumbing LLC','Plumbing','apply@premierplumb.com','(512) 555-0205',5.0,0,'pending','TX-PLB-3344','2026-12-31','Pass'],
    ['SolarTech Electric','Electrical','hello@solartech.com','(512) 555-0206',5.0,0,'pending','TX-ELC-8891','2026-06-30','Review'],
  ];
  for (const [name,trade,email,phone,rating,jobs,status,lic,ins,bg] of vendors)
    await db.query(`INSERT INTO vendors(name,trade,email,phone,rating,jobs_completed,status,license_number,insurance_expiry,bg_check) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [name,trade,email,phone,rating,jobs,status,lic,ins,bg]);

  const tickets = [
    [2,2,1,'Plumbing','Bathroom sink not draining','Sink draining very slowly, likely clogged','urgent','in_progress','Today 2-5pm',2,null],
    [6,5,null,'HVAC','AC unit making loud noise','Grinding sound when running','emergency','open',null,1,null],
    [1,1,2,'Electrical','Kitchen outlet not working','Two outlets near fridge dead','urgent','assigned','Tomorrow 8am-12pm',3,null],
    [5,4,null,'Appliance','Dishwasher door latch broken','Door latch snapped off','routine','open',null,0,null],
    [3,3,4,'General','Window screen torn','Bedroom screen has large tear','routine','completed',null,2,95],
  ];
  for (const [uid,tid,vid,cat,title,desc,urg,st,win,photos,cost] of tickets)
    await db.query(`INSERT INTO tickets(unit_id,tenant_id,vendor_id,category,title,description,urgency,status,scheduled_window,photos_count,cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uid,tid,vid,cat,title,desc,urg,st,win,photos,cost]);

  await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES(1,'system','System','Ticket received. Reference: TKT-0001')`);
  await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES(1,'tenant','Marcus Webb','The sink has been slow for about 3 days')`);
  await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES(1,'pm','Patricia Davis','Assigned Victor Plumbing. They will contact you to confirm.')`);
  await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES(2,'system','System','EMERGENCY ticket received. PM notified immediately.')`);
  console.log('Seed data loaded');
}

// ─── ROUTE HELPER ─────────────────────────────────────────────────────────────
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', wrap(async (req, res) => {
  const [units,payments,tickets,vendors,revenue] = await Promise.all([
    db.query(`SELECT status, COUNT(*) as count FROM units GROUP BY status`),
    db.query(`SELECT status, COUNT(*) as count, SUM(amount) as total FROM payments WHERE due_date >= DATE_TRUNC('month', NOW()) GROUP BY status`),
    db.query(`SELECT urgency, status, COUNT(*) as count FROM tickets GROUP BY urgency, status`),
    db.query(`SELECT COUNT(*) as count FROM vendors WHERE status='active'`),
    db.query(`SELECT TO_CHAR(due_date,'Mon') as month, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected FROM payments WHERE due_date >= NOW() - INTERVAL '6 months' GROUP BY DATE_TRUNC('month',due_date), TO_CHAR(due_date,'Mon') ORDER BY DATE_TRUNC('month',due_date)`),
  ]);
  res.json({ units: units.rows, payments: payments.rows, tickets: tickets.rows, vendors: vendors.rows, revenue: revenue.rows });
}));

// ─── PROPERTIES ───────────────────────────────────────────────────────────────
app.get('/api/properties', wrap(async (req, res) => {
  const r = await db.query(`SELECT p.*, COUNT(u.id) as unit_count FROM properties p LEFT JOIN units u ON u.property_id=p.id GROUP BY p.id ORDER BY p.id`);
  res.json(r.rows);
}));
app.post('/api/properties', wrap(async (req, res) => {
  const { name, address, city, state } = req.body;
  if (!name || !address || !city) return res.status(400).json({ error: 'name, address, city required' });
  const r = await db.query(`INSERT INTO properties(name,address,city,state) VALUES($1,$2,$3,$4) RETURNING *`, [name, address, city, state || 'TX']);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/properties/:id', wrap(async (req, res) => {
  const { name, address, city, state } = req.body;
  const r = await db.query(`UPDATE properties SET name=$1,address=$2,city=$3,state=$4 WHERE id=$5 RETURNING *`, [name, address, city, state, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.delete('/api/properties/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM properties WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── UNITS ────────────────────────────────────────────────────────────────────
app.get('/api/units', wrap(async (req, res) => {
  const r = await db.query(`
    SELECT u.*, p.name as property_name, p.address,
           t.first_name||' '||t.last_name as tenant_name, t.id as tenant_id,
           l.id as lease_id, l.end_date, l.monthly_rent as lease_rent,
           pay.status as payment_status
    FROM units u
    LEFT JOIN properties p ON p.id=u.property_id
    LEFT JOIN leases l ON l.unit_id=u.id AND l.status='active'
    LEFT JOIN tenants t ON t.id=l.tenant_id
    LEFT JOIN payments pay ON pay.lease_id=l.id AND pay.due_date >= DATE_TRUNC('month',NOW()) AND pay.due_date < DATE_TRUNC('month',NOW())+INTERVAL '1 month'
    ORDER BY u.unit_number`);
  res.json(r.rows);
}));
app.get('/api/units/:id', wrap(async (req, res) => {
  const r = await db.query(`SELECT u.*, p.name as property_name FROM units u LEFT JOIN properties p ON p.id=u.property_id WHERE u.id=$1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.post('/api/units', wrap(async (req, res) => {
  const { property_id, unit_number, bedrooms, bathrooms, sqft, monthly_rent } = req.body;
  if (!property_id || !unit_number) return res.status(400).json({ error: 'property_id and unit_number required' });
  const r = await db.query(`INSERT INTO units(property_id,unit_number,bedrooms,bathrooms,sqft,monthly_rent) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [property_id, unit_number, bedrooms||1, bathrooms||1, sqft||null, monthly_rent||0]);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/units/:id', wrap(async (req, res) => {
  const { unit_number, bedrooms, bathrooms, sqft, monthly_rent, status } = req.body;
  const r = await db.query(`UPDATE units SET unit_number=$1,bedrooms=$2,bathrooms=$3,sqft=$4,monthly_rent=$5,status=COALESCE($6,status) WHERE id=$7 RETURNING *`,
    [unit_number, bedrooms, bathrooms, sqft, monthly_rent, status, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.delete('/api/units/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM units WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── TENANTS ──────────────────────────────────────────────────────────────────
app.get('/api/tenants', wrap(async (req, res) => {
  const r = await db.query(`
    SELECT t.*, l.unit_id, u.unit_number, l.end_date, l.monthly_rent, l.status as lease_status
    FROM tenants t
    LEFT JOIN leases l ON l.tenant_id=t.id AND l.status='active'
    LEFT JOIN units u ON u.id=l.unit_id
    ORDER BY t.last_name`);
  res.json(r.rows);
}));
app.get('/api/tenants/:id', wrap(async (req, res) => {
  const r = await db.query(`SELECT * FROM tenants WHERE id=$1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.post('/api/tenants', wrap(async (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  if (!first_name || !last_name || !email) return res.status(400).json({ error: 'first_name, last_name, email required' });
  const r = await db.query(`INSERT INTO tenants(first_name,last_name,email,phone) VALUES($1,$2,$3,$4) RETURNING *`, [first_name, last_name, email, phone||null]);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/tenants/:id', wrap(async (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  const r = await db.query(`UPDATE tenants SET first_name=$1,last_name=$2,email=$3,phone=$4 WHERE id=$5 RETURNING *`,
    [first_name, last_name, email, phone, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.delete('/api/tenants/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM tenants WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── LEASES ───────────────────────────────────────────────────────────────────
app.get('/api/leases', wrap(async (req, res) => {
  const r = await db.query(`
    SELECT l.*, u.unit_number, u.property_id,
           t.first_name||' '||t.last_name as tenant_name,
           t.email as tenant_email, t.phone as tenant_phone,
           p.name as property_name
    FROM leases l
    JOIN units u ON u.id=l.unit_id
    JOIN tenants t ON t.id=l.tenant_id
    JOIN properties p ON p.id=u.property_id
    ORDER BY l.created_at DESC`);
  res.json(r.rows);
}));
app.post('/api/leases', wrap(async (req, res) => {
  const { unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit } = req.body;
  if (!unit_id || !tenant_id || !start_date || !end_date || !monthly_rent)
    return res.status(400).json({ error: 'Missing required fields' });
  const r = await db.query(`INSERT INTO leases(unit_id,tenant_id,start_date,end_date,monthly_rent,security_deposit) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit||0]);
  await db.query(`UPDATE units SET status='occupied' WHERE id=$1`, [unit_id]);
  await db.query(`INSERT INTO payments(lease_id,amount,due_date,status) VALUES($1,$2,$3,'pending')`, [r.rows[0].id, monthly_rent, start_date]);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/leases/:id', wrap(async (req, res) => {
  const { end_date, monthly_rent, status } = req.body;
  const r = await db.query(`UPDATE leases SET end_date=COALESCE($1,end_date),monthly_rent=COALESCE($2,monthly_rent),status=COALESCE($3,status) WHERE id=$4 RETURNING *`,
    [end_date, monthly_rent, status, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  if (status === 'terminated') {
    await db.query(`UPDATE units SET status='vacant' WHERE id=(SELECT unit_id FROM leases WHERE id=$1)`, [req.params.id]);
  }
  res.json(r.rows[0]);
}));
app.delete('/api/leases/:id', wrap(async (req, res) => {
  const lease = await db.query(`SELECT unit_id FROM leases WHERE id=$1`, [req.params.id]);
  await db.query(`DELETE FROM leases WHERE id=$1`, [req.params.id]);
  if (lease.rows.length) await db.query(`UPDATE units SET status='vacant' WHERE id=$1`, [lease.rows[0].unit_id]);
  res.json({ ok: true });
}));

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
app.get('/api/payments', wrap(async (req, res) => {
  const r = await db.query(`
    SELECT pay.*, l.unit_id, u.unit_number,
           t.first_name||' '||t.last_name as tenant_name, t.email as tenant_email
    FROM payments pay
    JOIN leases l ON l.id=pay.lease_id
    JOIN units u ON u.id=l.unit_id
    JOIN tenants t ON t.id=l.tenant_id
    ORDER BY pay.due_date DESC, pay.id DESC LIMIT 200`);
  res.json(r.rows);
}));
app.post('/api/payments', wrap(async (req, res) => {
  const { lease_id, amount, due_date } = req.body;
  if (!lease_id || !amount || !due_date) return res.status(400).json({ error: 'lease_id, amount, due_date required' });
  const r = await db.query(`INSERT INTO payments(lease_id,amount,due_date,status) VALUES($1,$2,$3,'pending') RETURNING *`,
    [lease_id, amount, due_date]);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/payments/:id', wrap(async (req, res) => {
  const { status, method, paid_date } = req.body;
  const txn = status === 'paid' ? 'TXN-' + Math.random().toString(36).slice(2,10).toUpperCase() : null;
  const r = await db.query(`UPDATE payments SET status=COALESCE($1,status),method=COALESCE($2,method),paid_date=COALESCE($3,paid_date),transaction_id=COALESCE($4,transaction_id) WHERE id=$5 RETURNING *`,
    [status, method||null, paid_date||(status==='paid'?new Date().toISOString().split('T')[0]:null), txn, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.delete('/api/payments/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM payments WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── TICKETS ──────────────────────────────────────────────────────────────────
app.get('/api/tickets', wrap(async (req, res) => {
  const r = await db.query(`
    SELECT tk.*, u.unit_number,
           t.first_name||' '||t.last_name as tenant_name,
           v.name as vendor_name, v.phone as vendor_phone
    FROM tickets tk
    JOIN units u ON u.id=tk.unit_id
    LEFT JOIN tenants t ON t.id=tk.tenant_id
    LEFT JOIN vendors v ON v.id=tk.vendor_id
    ORDER BY CASE tk.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END, tk.created_at DESC`);
  res.json(r.rows);
}));
app.get('/api/tickets/:id', wrap(async (req, res) => {
  const [ticket, msgs] = await Promise.all([
    db.query(`SELECT tk.*, u.unit_number, p.address,
           t.first_name||' '||t.last_name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
           v.name as vendor_name, v.phone as vendor_phone, v.trade as vendor_trade
      FROM tickets tk
      JOIN units u ON u.id=tk.unit_id
      JOIN properties p ON p.id=u.property_id
      LEFT JOIN tenants t ON t.id=tk.tenant_id
      LEFT JOIN vendors v ON v.id=tk.vendor_id
      WHERE tk.id=$1`, [req.params.id]),
    db.query(`SELECT * FROM messages WHERE ticket_id=$1 ORDER BY created_at`, [req.params.id])
  ]);
  if (!ticket.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ ...ticket.rows[0], messages: msgs.rows });
}));
app.post('/api/tickets', wrap(async (req, res) => {
  const { unit_id, tenant_id, category, title, description, urgency } = req.body;
  if (!unit_id || !category || !title) return res.status(400).json({ error: 'unit_id, category, title required' });
  const r = await db.query(`INSERT INTO tickets(unit_id,tenant_id,category,title,description,urgency) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [unit_id, tenant_id||null, category, title, description||null, urgency||'routine']);
  await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES($1,'system','System',$2)`,
    [r.rows[0].id, `Ticket received. Reference: TKT-${String(r.rows[0].id).padStart(4,'0')}`]);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/tickets/:id', wrap(async (req, res) => {
  const { status, urgency, vendor_id, scheduled_window, cost, description } = req.body;
  const r = await db.query(`
    UPDATE tickets SET
      status=COALESCE($1,status), urgency=COALESCE($2,urgency),
      vendor_id=COALESCE($3,vendor_id), scheduled_window=COALESCE($4,scheduled_window),
      cost=COALESCE($5,cost), description=COALESCE($6,description),
      completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
    WHERE id=$7 RETURNING *`,
    [status||null, urgency||null, vendor_id||null, scheduled_window||null, cost||null, description||null, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  if (status === 'assigned')
    await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES($1,'system','System',$2)`,
      [req.params.id, 'Vendor assigned. They will contact the tenant to schedule.']);
  if (status === 'in_progress')
    await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES($1,'system','System','Vendor is on-site. Work in progress.')`,
      [req.params.id]);
  if (status === 'completed')
    await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES($1,'system','System','Work completed. Ticket closed.')`,
      [req.params.id]);
  res.json(r.rows[0]);
}));
app.post('/api/tickets/:id/message', wrap(async (req, res) => {
  const { sender_type, sender_name, body } = req.body;
  if (!sender_type || !sender_name || !body) return res.status(400).json({ error: 'sender_type, sender_name, body required' });
  const r = await db.query(`INSERT INTO messages(ticket_id,sender_type,sender_name,body) VALUES($1,$2,$3,$4) RETURNING *`,
    [req.params.id, sender_type, sender_name, body]);
  res.status(201).json(r.rows[0]);
}));
app.delete('/api/tickets/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM messages WHERE ticket_id=$1`, [req.params.id]);
  await db.query(`DELETE FROM tickets WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── VENDORS ──────────────────────────────────────────────────────────────────
app.get('/api/vendors', wrap(async (req, res) => {
  const r = await db.query(`SELECT * FROM vendors ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, rating DESC`);
  res.json(r.rows);
}));
app.post('/api/vendors', wrap(async (req, res) => {
  const { name, trade, email, phone, license_number, insurance_expiry, bg_check } = req.body;
  if (!name || !trade) return res.status(400).json({ error: 'name and trade required' });
  const r = await db.query(`INSERT INTO vendors(name,trade,email,phone,license_number,insurance_expiry,bg_check) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, trade, email||null, phone||null, license_number||null, insurance_expiry||null, bg_check||'Pending']);
  res.status(201).json(r.rows[0]);
}));
app.put('/api/vendors/:id', wrap(async (req, res) => {
  const { name, trade, email, phone, status, rating, license_number, insurance_expiry, bg_check } = req.body;
  const r = await db.query(`UPDATE vendors SET name=COALESCE($1,name),trade=COALESCE($2,trade),email=COALESCE($3,email),phone=COALESCE($4,phone),status=COALESCE($5,status),rating=COALESCE($6,rating),license_number=COALESCE($7,license_number),insurance_expiry=COALESCE($8,insurance_expiry),bg_check=COALESCE($9,bg_check) WHERE id=$10 RETURNING *`,
    [name||null, trade||null, email||null, phone||null, status||null, rating||null, license_number||null, insurance_expiry||null, bg_check||null, req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));
app.delete('/api/vendors/:id', wrap(async (req, res) => {
  await db.query(`DELETE FROM vendors WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('API error:', err.message);
  res.status(500).json({ error: err.message });
});

// ─── START ────────────────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so Render's port scanner can detect the open port
const HOST = '0.0.0.0';

function startServer() {
  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  OpFirst PMS running at http://${HOST}:${PORT}\n`);
  });
  server.on('error', (err) => {
    console.error('Server error:', err.message);
    process.exit(1);
  });
}

initDB()
  .then(() => {
    startServer();
  })
  .catch((err) => {
    console.error('Database init failed:', err.message);
    console.error('Starting server without seed data...');
    // Still start the server so Render sees an open port
    startServer();
  });

// Catch any unhandled promise rejections so the process doesn't exit silently
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});
