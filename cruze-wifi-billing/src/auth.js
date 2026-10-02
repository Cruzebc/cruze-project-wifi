import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
const secret = process.env.JWT_SECRET;

export async function hashPassword(p) { return bcrypt.hash(p, 12); }
export async function verifyPassword(p, h) { return bcrypt.compare(p, h); }
export function signToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email }, secret, { expiresIn: "12h" });
}
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  try { req.admin = jwt.verify(h.slice(7), secret); next(); }
  catch { return res.status(401).json({error:"Invalid or expired token"}); }
}
