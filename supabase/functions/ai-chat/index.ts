// AI Asisten untuk aplikasi GudangKu
// Endpoint: POST /functions/v1/ai-chat
//
// Cara deploy:
//   supabase functions deploy ai-chat --no-verify-jwt
//
// Secret yang dibutuhkan (Supabase Dashboard > Edge Functions > ai-chat > Secrets):
//   AI_API_KEY  -> kunci API penyedia model (mis. OpenAI)
//   AI_BASE_URL -> default https://api.openai.com/v1
//   AI_MODEL    -> default gpt-4o-mini
//   AI_IMAGE_KEY      -> (opsional) kunci untuk generate gambar, default pakai AI_API_KEY
//   AI_IMAGE_BASE_URL -> default https://api.openai.com/v1
//   AI_IMAGE_MODEL    -> default dall-e-3
//
// Keamanan: JWT user diverifikasi di sini, jadi hanya pengguna yang login
// yang bisa memakai AI asisten.

import { createClient } from "jsr:@supabase/supabase-js@2";

const AI_API_KEY = Deno.env.get("AI_API_KEY");
const AI_BASE_URL =
  (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

// Konfigurasi pembuatan gambar (opsional)
// Default mengarah ke endpoint OpenAI /images/generations.
const AI_IMAGE_KEY = Deno.env.get("AI_IMAGE_KEY");
const AI_IMAGE_BASE_URL =
  (Deno.env.get("AI_IMAGE_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const AI_IMAGE_MODEL = Deno.env.get("AI_IMAGE_MODEL") || "dall-e-3";

const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `Kamu adalah "GudangKu", asisten AI untuk aplikasi manajemen gudang.
Tugasmu membantu pengguna mengelola data produk dan stok. Gunakan bahasa Indonesia yang
ramah dan ringkas. Jawab berdasarkan data yang kamu ambil lewat tools.
Jika user meminta gambar (mis. "buat gambar logo", "generate gambar produk"), gunakan tool
generate_image dan tampilkan hasilnya sebagai markdown image dengan format ![hasil](url_gambar).
Jika kamu tidak tahu, katakan jujur dan sarankan hal yang bisa dilakukan.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_products",
      description:
        "Mengambil daftar produk. Opsional cari berdasarkan kata kunci (nama, sku, kategori, barcode).",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Kata kunci pencarian (optional)",
          },
          limit: {
            type: "integer",
            description: "Jumlah maksimal hasil, default 50",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock",
      description: "Produk yang stoknya menipis (≤ stok minimum) atau habis.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_history",
      description: "Riwayat transaksi stok masuk/keluar terbaru.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Jumlah riwayat, default 20",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description:
        "Ringkasan gudang: jumlah produk, total stok, total nilai stok, produk menipis, dan produk habis.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Menghasilkan gambar baru berdasarkan prompt/deskripsi (mis. logo, foto produk, ilustrasi). Hasilkan gambar jika pengguna memintanya.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Deskripsi gambar yang ingin dibuat" },
        },
        required: ["prompt"],
      },
    },
  },
];

// ---------- Tools (menjalankan query ke Supabase pakai service role) ----------
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_products": {
      const search = String(args.search || "").trim();
      const limit = Math.min(Number(args.limit) || 50, 200);
      let query = serviceClient
        .from("products")
        .select("id, sku, name, category, unit, price, stock, min_stock, barcode")
        .order("name")
        .limit(limit);
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,sku.ilike.%${search}%,category.ilike.%${search}%,barcode.ilike.%${search}%`,
        );
      }
      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    }
    case "get_low_stock": {
      const { data, error } = await serviceClient
        .from("products")
        .select("id, name, sku, stock, min_stock, unit")
        .lte("stock", "min_stock")
        .order("stock")
        .limit(100);
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    }
    case "get_stock_history": {
      const limit = Math.min(Number(args.limit) || 20, 100);
      const { data, error } = await serviceClient
        .from("stock_transactions")
        .select("id, type, quantity, note, created_at, products(name, sku, unit)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    }
    case "get_dashboard_summary": {
      const { data, error } = await serviceClient.rpc("get_dashboard_summary");
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    }
    case "generate_image": {
      const imageKey = AI_IMAGE_KEY || AI_API_KEY;
      if (!imageKey) {
        return "ERROR: AI_IMAGE_KEY / AI_API_KEY belum dikonfigurasi. Admin harus mengisi secret pada Edge Function ai-chat di Supabase Dashboard agar gambar bisa dibuat.";
      }
      const prompt = String(args.prompt || "").slice(0, 1000);
      if (!prompt) return "Error: prompt kosong";
      const res = await fetch(`${AI_IMAGE_BASE_URL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${imageKey}`,
        },
        body: JSON.stringify({
          model: AI_IMAGE_MODEL,
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `Error generating image (${res.status}): ${text}`;
      }
      const json = await res.json();
      const img = json?.data?.[0];
      if (img?.url) return JSON.stringify({ url: img.url });
      if (img?.b64_json) {
        return JSON.stringify({ url: `data:image/png;base64,${img.b64_json}`, note: "data-url" });
      }
      return "Error: provider tidak mengembalikan gambar.";
    }
    default:
      return `Tool tidak dikenal: ${name}`;
  }
}

// ---------- Handler ----------
async function handleChatCompletion(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
): Promise<Response> {
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `AI provider error (${res.status})`, detail: text },
        { status: 502 },
      );
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message;

    // Ada panggilan tool -> proses, lalu lanjutkan dialog
    if (message?.tool_calls?.length) {
      const continuePayload = { role: "assistant", content: message.content, tool_calls: message.tool_calls };
      const toolResults: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];

      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          /* args tetap kosong */
        }
        const result = await runTool(call.function.name, args);
        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      messages = [...messages, continuePayload as never, ...toolResults];
      continue;
    }

    // Selesai: tidak ada tool call lagi
    return Response.json({ reply: message?.content || "Maaf, saya gagal menemukan jawaban." });
  }

  return Response.json(
    { error: "AI terlalu banyak berpikir. Coba pertanyaan yang lebih spesifik." },
    { status: 408 },
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method tidak diizinkan" }, { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // Verifikasi JWT user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return Response.json({ error: "Anda harus login terlebih dahulu" }, { status: 401 });
    }

    if (!AI_API_KEY) {
      return Response.json(
        {
          error:
            "AI belum dikonfigurasi. Admin perlu mengisi secret AI_API_KEY pada Edge Function ai-chat di Supabase Dashboard.",
        },
        { status: 500 },
      );
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
    }

    return await handleChatCompletion(AI_API_KEY, messages);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Terjadi kesalahan tak terduga" },
      { status: 500 },
    );
  }
});