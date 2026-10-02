import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth, signToken, verifyPassword } from "./auth.js";
import { stkPush } from "./mpesa.js";
import { mikrotikStatus } from "./mikrotik.js";
import { activatePaidPayment, expireSessions } from "./billing.js";

const app = express();
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"1mb"}));
app.use(morgan("combined"));
app.use(express.static("public"));

app.get("/health", async (_req,res)=>{
  try { await db.$queryRaw`SELECT 1`; res.json({ok:true,service:"cruze-billing",time:new Date().toISOString()}); }
  catch(e){res.status(503).json({ok:false,error:e.message});}
});

app.post("/api/auth/login", async (req,res)=>{
  const body=z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(req.body);
  if(!body.success) return res.status(400).json({error:"Invalid login"});
  const admin=await db.admin.findUnique({where:{email:body.data.email}});
  if(!admin || !(await verifyPassword(body.data.password,admin.password))) return res.status(401).json({error:"Invalid credentials"});
  res.json({token:signToken(admin)});
});

app.get("/api/packages", async (_req,res)=>{
  res.json(await db.package.findMany({where:{active:true},orderBy:{sortOrder:"asc"}}));
});

app.get("/api/admin/packages",requireAuth,async (_req,res)=>res.json(await db.package.findMany({orderBy:{sortOrder:"asc"}})));

app.post("/api/admin/packages",requireAuth,async(req,res)=>{
  const s=z.object({
    name:z.string().min(2),description:z.string().optional(),price:z.number().int().positive(),
    type:z.enum(["TIME","DATA","TIME_DATA","UNLIMITED"]),durationMinutes:z.number().int().positive(),
    dataBytes:z.number().int().nonnegative().nullable().optional(),downloadMbps:z.number().positive().nullable().optional(),
    uploadMbps:z.number().positive().nullable().optional(),maxDevices:z.number().int().positive().default(1),
    dailyPurchaseLimit:z.number().int().positive().nullable().optional(),multiplePurchase:z.boolean().default(true)
  }).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:s.error.issues});
  res.status(201).json(await db.package.create({data:s.data}));
});

app.patch("/api/admin/packages/:id",requireAuth,async(req,res)=>{
  try { res.json(await db.package.update({where:{id:req.params.id},data:req.body})); }
  catch(e){res.status(404).json({error:"Package not found"});}
});

app.delete("/api/admin/packages/:id",requireAuth,async(req,res)=>{
  try { res.json(await db.package.update({where:{id:req.params.id},data:{active:false}})); }
  catch(e){res.status(404).json({error:"Package not found"});}
});

app.get("/api/admin/customers",requireAuth,async(_req,res)=>{
  res.json(await db.customer.findMany({orderBy:{createdAt:"desc"},include:{sessions:true}}));
});

app.post("/api/customers",async(req,res)=>{
  const s=z.object({phone:z.string().min(9).max(15),name:z.string().optional(),macAddress:z.string().optional()}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:"Invalid customer"});
  res.json(await db.customer.upsert({where:{phone:s.data.phone},update:s.data,create:s.data}));
});

app.post("/api/payments/stk",async(req,res)=>{
  const s=z.object({phone:z.string().min(9),packageId:z.string()}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:"Invalid request"});
  const pkg=await db.package.findUnique({where:{id:s.data.packageId}});
  if(!pkg || !pkg.active)return res.status(404).json({error:"Package unavailable"});
  const customer=await db.customer.upsert({where:{phone:s.data.phone},update:{},create:{phone:s.data.phone}});
  const payment=await db.payment.create({data:{customerId:customer.id,packageId:pkg.id,amount:pkg.price,phone:s.data.phone}});
  try {
    const mpesa=await stkPush({phone:s.data.phone,amount:pkg.price,reference:`CRUZE-${payment.id}`});
    await db.payment.update({where:{id:payment.id},data:{checkoutRequestId:mpesa.CheckoutRequestID,merchantRequestId:mpesa.MerchantRequestID}});
    res.json({paymentId:payment.id,...mpesa});
  } catch(e) {
    await db.payment.update({where:{id:payment.id},data:{status:"FAILED"}});
    res.status(502).json({error:"M-Pesa request failed",detail:e.response?.data || e.message});
  }
});

app.post("/api/payments/callback",async(req,res)=>{
  const body=req.body;
  const cb=body?.Body?.stkCallback;
  if(!cb)return res.json({ResultCode:0,ResultDesc:"Accepted"});
  const payment=await db.payment.findFirst({where:{checkoutRequestId:cb.CheckoutRequestID}});
  if(!payment)return res.json({ResultCode:0,ResultDesc:"Accepted"});
  if(cb.ResultCode===0){
    const items=Object.fromEntries((cb.CallbackMetadata?.Item||[]).map(x=>[x.Name,x.Value]));
    await db.payment.update({where:{id:payment.id},data:{status:"SUCCESS",mpesaReceipt:String(items.MpesaReceiptNumber||""),paidAt:new Date(),rawCallback:body}});
    await activatePaidPayment(payment.id);
  } else {
    await db.payment.update({where:{id:payment.id},data:{status:"FAILED",rawCallback:body}});
  }
  res.json({ResultCode:0,ResultDesc:"Accepted"});
});

app.get("/api/mikrotik/status",requireAuth,async(_req,res)=>res.json(await mikrotikStatus()));

app.get("/api/admin/overview",requireAuth,async(_req,res)=>{
  const [customers,active,packages,payments,revenue]=await Promise.all([
    db.customer.count(),db.session.count({where:{status:"ACTIVE"}}),db.package.count({where:{active:true}}),
    db.payment.count(),db.payment.aggregate({where:{status:"SUCCESS"},_sum:{amount:true}})
  ]);
  res.json({customers,active,packages,payments,revenue:revenue._sum.amount||0});
});

app.get("/api/settings",requireAuth,async(_req,res)=>{
  const rows=await db.setting.findMany();
  res.json(Object.fromEntries(rows.map(x=>[x.key,x.value])));
});

app.patch("/api/settings",requireAuth,async(req,res)=>{
  for(const [key,value] of Object.entries(req.body||{}))
    await db.setting.upsert({where:{key},create:{key,value:String(value)},update:{value:String(value)}});
  res.json({ok:true});
});

app.get("/api/admin/payments",requireAuth,async(_req,res)=>{
  res.json(await db.payment.findMany({orderBy:{createdAt:"desc"},take:100,include:{customer:true,package:true}}));
});

setInterval(async()=>{try{await expireSessions();}catch(e){console.error("expiry worker",e.message)}},30000);

const port=Number(process.env.PORT||8080);
app.listen(port,()=>console.log(`Cruze Billing listening on ${port}`));
