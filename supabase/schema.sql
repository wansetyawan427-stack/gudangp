-- =============================================================
-- GudangKu - Supabase Schema
-- Jalankan script ini di: Supabase Dashboard > SQL Editor > Run
-- =============================================================

-- ---------- PROFILES (profil pengguna) ----------
-- Role: admin (semua menu), gudang (produk & stok),
--       kasir (POS & transaksi), pelanggan (belanja)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text not null default 'pelanggan' check (role in ('admin', 'gudang', 'kasir', 'pelanggan')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil pengguna aplikasi gudang';

-- ---------- PRODUCTS (barang) ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text,
  description text,
  unit text not null default 'pcs',
  barcode text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_name_idx on public.products (name);

-- ---------- CATEGORIES (kategori barang) ----------
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Master kategori barang';

-- ---------- STOCK_TRANSACTIONS (stok masuk / keluar) ----------
create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity integer not null check (quantity > 0),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists stock_transactions_product_idx
  on public.stock_transactions (product_id, created_at desc);

-- ---------- TRANSACTIONS (penjualan) ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  cashier_id uuid references public.profiles (id) on delete set null,
  total numeric(12, 2) not null default 0 check (total >= 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'qris', 'transfer', 'debit')),
  created_at timestamptz not null default now()
);

create index if not exists transactions_created_idx
  on public.transactions (created_at desc);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_sku text,
  quantity integer not null check (quantity > 0),
  price numeric(12, 2) not null check (price >= 0)
);

create index if not exists transaction_items_trx_idx
  on public.transaction_items (transaction_id);

-- ---------- TRIGGER: buat profile otomatis saat signup ----------
-- Pengguna pertama otomatis jadi ADMIN, berikutnya Pelanggan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'admin' else 'pelanggan' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- FUNCTION: proses transaksi stok ----------
create or replace function public.process_stock_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
begin
  if new.type = 'in' then
    update public.products set stock = stock + new.quantity where id = new.product_id;
  elsif new.type = 'out' then
    select stock into current_stock from public.products where id = new.product_id;
    if current_stock is null then
      raise exception 'Produk tidak ditemukan';
    end if;
    if current_stock < new.quantity then
      raise exception 'Stok tidak mencukupi (tersedia %, diminta %)', current_stock, new.quantity;
    end if;
    update public.products set stock = stock - new.quantity where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_process_stock_transaction on public.stock_transactions;
create trigger trg_process_stock_transaction
  before insert on public.stock_transactions
  for each row execute function public.process_stock_transaction();

-- ---------- FUNCTION: helper role pengguna ----------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- FUNCTION: proses penjualan (create_sale) ----------
-- Dipakai Kasir / Admin / Pelanggan. Otomatis:
--   - membuat transaksi + item
--   - mencatat histori stok keluar ('out')
--   - mengurangi stok produk (lewat trigger process_stock_transaction)
--     sehingga tidak terjadi pengurangan ganda
create or replace function public.create_sale(
  p_items jsonb,
  p_payment_method text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_tid uuid;
  v_total numeric := 0;
  v_code text;
  v_pid uuid;
  v_qty integer;
  v_item jsonb;
  v_prd public.products%rowtype;
begin
  if v_uid is null then
    raise exception 'Harus login';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role not in ('kasir', 'admin', 'pelanggan') then
    raise exception 'Role ini tidak boleh bertransaksi';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;

  v_code := 'TRX-' || to_char(now(), 'YYYYMMDD')
            || '-' || upper(substr(md5(v_uid::text || clock_timestamp()::text), 1, 6));

  insert into public.transactions (code, customer_id, cashier_id, total, payment_method)
  values (
    v_code,
    case when v_role = 'pelanggan' then v_uid end,
    case when v_role in ('kasir', 'admin') then v_uid end,
    0,
    p_payment_method
  )
  returning id into v_tid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_pid is null or v_qty is null or v_qty < 1 then
      raise exception 'Item dalam keranjang tidak valid';
    end if;

    select * into v_prd from public.products where id = v_pid for update;
    if not found then
      raise exception 'Produk tidak ditemukan';
    end if;

    -- validasi stok dipakai ulang oleh trigger saat insert stock_transactions
    insert into public.stock_transactions (product_id, type, quantity, note, created_by)
    values (v_pid, 'out', v_qty, 'Penjualan ' || v_code, v_uid);

    insert into public.transaction_items
      (transaction_id, product_id, product_name, product_sku, quantity, price)
    values (v_tid, v_pid, v_prd.name, v_prd.sku, v_qty, v_prd.price);

    v_total := v_total + (v_qty * v_prd.price);
  end loop;

  update public.transactions set total = v_total where id = v_tid;

  return jsonb_build_object('id', v_tid, 'code', v_code, 'total', v_total);
end;
$$;

-- ---------- FUNCTION: hapus pengguna oleh admin ----------
create or replace function public.admin_delete_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Hanya admin yang bisa menghapus pengguna';
  end if;
  if p_target = auth.uid() then
    raise exception 'Tidak bisa menghapus akun sendiri';
  end if;
  delete from public.profiles where id = p_target;
  delete from auth.users where id = p_target;
end;
$$;

-- ---------- FUNCTION: edit riwayat stok (CRUD) ----------
-- Mengoreksi catatan stok masuk/keluar sekaligus menyesuaikan stok produk
-- secara aman (undo effect lama -> apply effect baru).
create or replace function public.update_stock_record(
  p_id uuid,
  p_type text,
  p_quantity integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_role();
  v_rec public.stock_transactions%rowtype;
  v_prd public.products%rowtype;
  v_after integer;
begin
  if v_role not in ('admin', 'gudang') then
    raise exception 'Role tidak diizinkan mengubah stok';
  end if;
  if p_type not in ('in', 'out') then
    raise exception 'Tipe tidak valid';
  end if;
  if p_quantity < 1 then
    raise exception 'Jumlah harus minimal 1';
  end if;

  select * into v_rec from public.stock_transactions where id = p_id for update;
  if not found then
    raise exception 'Riwayat stok tidak ditemukan';
  end if;
  if v_rec.note like 'Penjualan%' then
    raise exception 'Catatan penjualan tidak bisa diubah di sini. Batalkan lewat menu Transaksi.';
  end if;

  select * into v_prd from public.products where id = v_rec.product_id for update;
  if not found then
    raise exception 'Produk tidak ditemukan';
  end if;

  -- undo effect lama
  if v_rec.type = 'in' then
    v_after := v_prd.stock - v_rec.quantity;
  else
    v_after := v_prd.stock + v_rec.quantity;
  end if;
  if v_after < 0 then
    raise exception 'Hasil koreksi tidak valid (stok menjadi negatif)';
  end if;

  -- apply effect baru
  if p_type = 'in' then
    v_after := v_after + p_quantity;
  else
    v_after := v_after - p_quantity;
    if v_after < 0 then
      raise exception 'Stok tidak mencukupi untuk pengurangan ini';
    end if;
  end if;

  update public.products set stock = v_after where id = v_prd.id;
  update public.stock_transactions
     set type = p_type, quantity = p_quantity, note = p_note
   where id = p_id;

  return jsonb_build_object('ok', true, 'stock', v_after);
end;
$$;

-- ---------- FUNCTION: hapus riwayat stok (CRUD) ----------
-- Menghapus catatan stok sekaligus membatalkan efeknya ke stok produk.
create or replace function public.delete_stock_record(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_role();
  v_rec public.stock_transactions%rowtype;
  v_prd public.products%rowtype;
  v_after integer;
begin
  if v_role not in ('admin', 'gudang') then
    raise exception 'Role tidak diizinkan menghapus stok';
  end if;

  select * into v_rec from public.stock_transactions where id = p_id for update;
  if not found then
    raise exception 'Riwayat stok tidak ditemukan';
  end if;
  if v_rec.note like 'Penjualan%' then
    raise exception 'Catatan penjualan tidak bisa dihapus di sini. Batalkan lewat menu Transaksi.';
  end if;

  select * into v_prd from public.products where id = v_rec.product_id for update;

  -- batalkan efek
  if v_rec.type = 'in' then
    v_after := v_prd.stock - v_rec.quantity;
  else
    v_after := v_prd.stock + v_rec.quantity;
  end if;
  if v_after < 0 then
    raise exception 'Hasil hapus tidak valid (stok menjadi negatif)';
  end if;

  update public.products set stock = v_after where id = v_prd.id;
  delete from public.stock_transactions where id = p_id;

  return jsonb_build_object('ok', true, 'stock', v_after);
end;
$$;

-- ---------- FUNCTION: void / batalkan transaksi (CRUD hapus) ----------
-- Membatalkan penjualan: mengembalikan stok produk, menghapus catatan
-- stok keluar milik transaksi tsb, lalu menghapus transaksi + item-nya.
create or replace function public.void_sale(p_trx_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_role();
  v_trx public.transactions%rowtype;
  v_it record;
begin
  if v_role not in ('admin', 'kasir') then
    raise exception 'Role tidak diizinkan membatalkan transaksi';
  end if;

  select * into v_trx from public.transactions where id = p_trx_id;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  -- kembalikan stok & hapus catatan stok keluarnya
  for v_it in
    select product_id, quantity from public.transaction_items
    where transaction_id = v_trx.id
  loop
    if v_it.product_id is not null then
      update public.products
         set stock = stock + v_it.quantity
       where id = v_it.product_id;

      delete from public.stock_transactions
       where product_id = v_it.product_id
         and type = 'out'
         and note = 'Penjualan ' || v_trx.code;
    end if;
  end loop;

  delete from public.transactions where id = v_trx.id;

  return jsonb_build_object('ok', true, 'code', v_trx.code);
end;
$$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- Profil: pengguna bisa melihat & mengubah sendiri; admin lihat semua & kelola role
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.current_role() = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.current_role() = 'admin');

-- Produk: semua login bisa lihat; admin & gudang bisa tulis/edit; admin hapus
drop policy if exists "products_select_auth" on public.products;
create policy "products_select_auth" on public.products
  for select to authenticated using (true);

drop policy if exists "products_insert_ops" on public.products;
create policy "products_insert_ops" on public.products
  for insert to authenticated
  with check (public.current_role() in ('admin', 'gudang'));

drop policy if exists "products_update_ops" on public.products;
create policy "products_update_ops" on public.products
  for update to authenticated
  using (public.current_role() in ('admin', 'gudang'))
  with check (public.current_role() in ('admin', 'gudang'));

drop policy if exists "products_delete_admin" on public.products;
create policy "products_delete_admin" on public.products
  for delete to authenticated
  using (public.current_role() = 'admin');

-- Transaksi stok: lihat semua yang login; input hanya admin/gudang; admin bisa hapus
drop policy if exists "stock_select_auth" on public.stock_transactions;
create policy "stock_select_auth" on public.stock_transactions
  for select to authenticated using (true);

drop policy if exists "stock_insert_ops" on public.stock_transactions;
create policy "stock_insert_ops" on public.stock_transactions
  for insert to authenticated
  with check (public.current_role() in ('admin', 'gudang') and auth.uid() = created_by);

drop policy if exists "stock_delete_admin" on public.stock_transactions;
create policy "stock_delete_admin" on public.stock_transactions
  for delete to authenticated
  using (public.current_role() = 'admin');

-- Transaksi: kasir & admin lihat semua, pelanggan lihat transaksi sendiri.
-- Insert/update dilakukan lewat create_sale() (security definer).
drop policy if exists "transactions_select_staff" on public.transactions;
create policy "transactions_select_staff" on public.transactions
  for select to authenticated
  using (public.current_role() in ('admin', 'kasir'));

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists "transactions_update_staff" on public.transactions;
create policy "transactions_update_staff" on public.transactions
  for update to authenticated
  using (public.current_role() in ('admin', 'kasir'))
  with check (public.current_role() in ('admin', 'kasir'));

drop policy if exists "transaction_items_select_staff" on public.transaction_items;
create policy "transaction_items_select_staff" on public.transaction_items
  for select to authenticated
  using (
    public.current_role() in ('admin', 'kasir')
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.customer_id = auth.uid()
    )
  );

-- Kategori: semua login bisa lihat; admin & gudang boleh kelola (CRUD)
drop policy if exists "categories_select_auth" on public.categories;
create policy "categories_select_auth" on public.categories
  for select to authenticated using (true);

drop policy if exists "categories_insert_ops" on public.categories;
create policy "categories_insert_ops" on public.categories
  for insert to authenticated
  with check (public.current_role() in ('admin', 'gudang'));

drop policy if exists "categories_update_ops" on public.categories;
create policy "categories_update_ops" on public.categories
  for update to authenticated
  using (public.current_role() in ('admin', 'gudang'))
  with check (public.current_role() in ('admin', 'gudang'));

drop policy if exists "categories_delete_ops" on public.categories;
create policy "categories_delete_ops" on public.categories
  for delete to authenticated
  using (public.current_role() in ('admin', 'gudang'));

-- Pengaturan (mis. Gemini API key): khusus admin bisa baca & tulis
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_select_admin" on public.settings;
create policy "settings_select_admin" on public.settings
  for select to authenticated
  using (public.current_role() = 'admin');

drop policy if exists "settings_insert_admin" on public.settings;
create policy "settings_insert_admin" on public.settings
  for insert to authenticated
  with check (public.current_role() = 'admin');

drop policy if exists "settings_update_admin" on public.settings;
create policy "settings_update_admin" on public.settings
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists "settings_delete_admin" on public.settings;
create policy "settings_delete_admin" on public.settings
  for delete to authenticated
  using (public.current_role() = 'admin');

-- ---------- FUNCTION: ringkasan dashboard (dipanggil dari app) ----------
create or replace function public.get_dashboard_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'total_products', count(*),
    'total_stock', coalesce(sum(stock), 0),
    'total_value', coalesce(sum(stock * price), 0),
    'low_stock', count(*) filter (where stock <= min_stock),
    'out_of_stock', count(*) filter (where stock = 0)
  )
  into result
  from public.products;

  return result;
end;
$$;

grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.create_sale(jsonb, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.update_stock_record(uuid, text, integer, text) to authenticated;
grant execute on function public.delete_stock_record(uuid) to authenticated;
grant execute on function public.void_sale(uuid) to authenticated;

grant select, insert, update, delete on public.settings to authenticated;

-- ---------- SEED DATA AWAL (opsional, untuk contoh) ----------
insert into public.categories (name)
values ('Sembako'), ('Minuman'), ('Rumah Tangga'), ('Perawatan')
on conflict (name) do nothing;

insert into public.products (sku, name, category, unit, barcode, price, stock, min_stock, description)
values
  ('SKU-BSG5', 'Beras Premium 5kg', 'Sembako', 'sak', '8991002100010', 68000, 120, 20, 'Beras pulen kualitas premium 5kg'),
  ('SKU-MNY2', 'Minyak Goreng 2L', 'Sembako', 'pcs', '8991002100027', 38000, 80, 15, 'Minyak goreng kemasan 2 liter'),
  ('SKU-SGMR1', 'Gula Pasir 1kg', 'Sembako', 'pcs', '8991002100034', 17000, 150, 25, 'Gula pasir putih murni 1kg'),
  ('SKU-TLH3', 'Telur Ayam 1kg', 'Sembako', 'kg', '8991002100041', 28000, 3, 10, 'Telur ayam negeri segar'),
  ('SKU-KPPS', 'Kopi Susu Sachet', 'Minuman', 'dus', '8991002100058', 15000, 200, 30, 'Kopi susu sachet isi 10'),
  ('SKU-ATRM', 'Air Mineral 600ml', 'Minuman', 'dus', '8991002100065', 20000, 60, 15, 'Air mineral kemasan 600ml isi 12'),
  ('SKU-SBNP', 'Sabun Cuci Piring', 'Rumah Tangga', 'pcs', '8991002100072', 12000, 4, 8, 'Sabun cuci piring lemon'),
  ('SKU-SDRM', 'Sampo 100ml', 'Perawatan', 'pcs', '8991002100089', 18000, 45, 10, 'Sampo anti ketombe 100ml')
on conflict (sku) do nothing;