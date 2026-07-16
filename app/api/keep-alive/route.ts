import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase ulanishini sozlaymiz
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Yoki NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    // Istalgan bitta jadvaldan bitta dona ma'lumot o'qiymiz (faollik yaratish uchun)
    const { data, error } = await supabase
      .from('users') // O'zingizda bor jadval nomini yozing (masalan, users)
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Supabase successfully pinged!" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}