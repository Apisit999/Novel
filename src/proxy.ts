import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ต่ออายุเซสชันล็อกอิน: access token อายุสั้น (~1 ชม.) ต้องมีตัวต่ออายุก่อนเรนเดอร์หน้า
 * ไม่งั้นผู้ใช้จะหลุดล็อกอินเองหลังชั่วโมงแรก (Server Component เขียน cookie ไม่ได้)
 * - ผู้เยี่ยมชมที่ไม่มี cookie ล็อกอิน ข้ามทันที ไม่เรียก Supabase เลย (ไม่เพิ่มความช้า)
 * - ไม่ตัดสินสิทธิ์ที่นี่ — สิทธิ์ตัดสินที่ RLS/can_access เท่านั้น
 */
export async function proxy(request: NextRequest) {
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );
  await supabase.auth.getUser(); // ตรวจ + ต่ออายุ แล้ว setAll ด้านบนจะเขียน cookie ใหม่
  return response;
}

export const config = {
  // ไม่รันกับไฟล์สถิตและรูป
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
