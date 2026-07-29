import { googleAuthEnabled } from "@/auth";

export function GET() {
  return Response.json({ googleAuth: googleAuthEnabled });
}
