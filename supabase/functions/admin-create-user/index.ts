// Admin: membuat pengguna baru langsung dari aplikasi
// Endpoint: POST /functions/v1/admin-create-user
//
// Cara deploy:
//   supabase functions deploy admin-create-user --no-verify-jwt
//
// Hanya role admin yang boleh memanggil. Memakai service role key
// agar bisa membuat akun auth + mengatur role sekaligus.
//
// Body: { email, password, full_name?, role? }

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = ["admin", "gudang", "kasir", "pelanggan"];

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method tidak diizinkan" }, { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // 1) Verifikasi JWT & pastikan pemanggil admin
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anon.auth.getUser(jwt);
    if (authError || !user) {
      return Response.json({ error: "Anda harus login terlebih dahulu" }, { status: 401 });
    }
    const { data: prof } = await anon
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (prof?.role !== "admin") {
      return Response.json({ error: "Hanya admin yang bisa membuat pengguna" }, { status: 403 });
    }

    // 2) Validasi body
    const { email, password, full_name, role } = await req.json().catch(() => ({}));
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Email tidak valid" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }
    const targetRole = ALLOWED_ROLES.includes(role) ? role : "pelanggan";
    const name = (full_name || email.split("@")[0]).trim();

    // 3) Buat akun (email langsung terkonfirmasi)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    // 4) Set role (profile dibuat oleh trigger dengan role 'pelanggan')
    await admin.from("profiles").update({ role: targetRole }).eq("id", data.user.id);

    return Response.json({
      id: data.user.id,
      email: data.user.email,
      full_name: name,
      role: targetRole,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Terjadi kesalahan tak terduga" },
      { status: 500 }
    );
  }
});