import { db } from "./db.js";
import { hashPassword } from "./auth.js";

const email = process.env.ADMIN_EMAIL || "admin@cruze.local";
const password = process.env.ADMIN_PASSWORD || "CHANGE_ME_NOW";
const existing = await db.admin.findUnique({where:{email}});
if (!existing) await db.admin.create({data:{email,password:await hashPassword(password)}});

const count = await db.package.count();
if (!count) {
  await db.package.createMany({data:[
    {name:"250 MB / 24 Hours",description:"Basic daily package",price:20,type:"DATA",durationMinutes:1440,dataBytes:250000000,downloadMbps:2,uploadMbps:1},
    {name:"1 GB / 1 Hour",description:"Fast hourly package",price:19,type:"TIME_DATA",durationMinutes:60,dataBytes:1000000000,downloadMbps:5,uploadMbps:2},
    {name:"1 GB / 1 Hour UNL",description:"Unlimited-speed-hour style package",price:21,type:"UNLIMITED",durationMinutes:60,downloadMbps:10,uploadMbps:5},
    {name:"20 SMS Daily",description:"Daily SMS offer",price:5,type:"TIME",durationMinutes:1440}
  ]});
}
console.log("Cruze seed complete");
await db.$disconnect();
