import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ต่ออายุเซสชันล็อกอิน: access token อายุสั้น (~1 ชม.) ต้องมีตัวต่ออายุก่อนเรนเดอร์หน้า
 * ไม่งั้นผู้ใช้จะหลุดล็อกอินเองหลังชั่วโมงแรก (Server Component เขียน cookie ไม่ได้)
 * - ผู้เยี่ยมชมที่ไม่มี cookie ล็อกอิน ข้ามทันที ไม่เรียก Supabase เลย (ไม่เพิ่มความช้า)
 * - ไม่ตัดสินสิทธิ์ที่นี่ — สิทธิ์ตัดสินที่ RLS/can_access เท่านั้น
 */
export async function proxy(request: NextRequest) {
  // URL ที่เข้ารหัส % เสีย (เช่น /title/%E0%A4%A) ทำให้ Next คืน 500 ทุกเส้นทางที่มีพารามิเตอร์
  // → ตอบ 400 ตรง ๆ (ความผิดอยู่ที่คำขอ ไม่ใช่เซิร์ฟเวอร์ — 500 ทำให้ดูเหมือนระบบพังและรบกวนการเฝ้าระวัง)
  try {
    decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) {
    // หลังบ้าน: ไม่มีเซสชันเลย → ส่งไปล็อกอินทันที (ชั้นนอก; สิทธิ์แอดมินจริงตรวจในหน้า/action และ RLS)
    if (request.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/login?next=/admin", request.url));
    }
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
  const { data } = await supabase.auth.getUser(); // ตรวจ + ต่ออายุ แล้ว setAll ด้านบนจะเขียน cookie ใหม่

  // หลังบ้าน: ต้องตัดสินก่อนเรนเดอร์ จึงจะได้รหัสตอบกลับจริง (หน้าที่สตรีมแล้วเปลี่ยนจาก 200 ไม่ได้)
  // นี่คือชั้นนอกเพื่อ UX/ไม่เปิดเผยว่ามีหลังบ้าน — ชั้นที่ตัดสินจริงคือ requireAdmin() ในหน้า/action และ RLS
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!data.user) {
      return NextResponse.redirect(new URL("/login?next=/admin", request.url));
    }
    const profile = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile.data?.role !== "admin") {
      const notFound = NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
      for (const c of response.cookies.getAll()) notFound.cookies.set(c); // เก็บ cookie ที่เพิ่งต่ออายุไว้
      return notFound;
    }
  }
  return response;
}

export const config = {
  // ไม่รันกับไฟล์สถิตและรูป
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
