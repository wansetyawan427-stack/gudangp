-- =============================================================
-- GudangKu - UPGRADE (untuk instalasi lama)
-- Jalankan di SQL Editor jika sudah pernah menjalankan schema.sql
-- versi sebelumnya. Menambah: kategori, gambar produk, CRUD stok,
-- void transaksi, dan update transaksi.
-- =============================================================

-- Tabel kategori
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- Kolom gambar produk
alter table public.products add column if not exists image_url text;

-- Fungsi: edit riwayat stok
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

  if v_rec.type = 'in' then
    v_after := v_prd.stock - v_rec.quantity;
  else
    v_after := v_prd.stock + v_rec.quantity;
  end if;
  if v_after < 0 then
    raise exception 'Hasil koreksi tidak valid (stok menjadi negatif)';
  end if;

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

-- Fungsi: hapus riwayat stok
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

-- Fungsi: void transaksi (batalkan, stok dikembalikan)
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
  for v_it in
    select product_id, quantity from public.transaction_items
    where transaction_id = v_trx.id
  loop
    if v_it.product_id is not null then
      update public.products set stock = stock + v_it.quantity where id = v_it.product_id;
      delete from public.stock_transactions
       where product_id = v_it.product_id and type = 'out'
         and note = 'Penjualan ' || v_trx.code;
    end if;
  end loop;
  delete from public.transactions where id = v_trx.id;
  return jsonb_build_object('ok', true, 'code', v_trx.code);
end;
$$;

-- RLS kategori
alter table public.categories enable row level security;

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

-- Update transaksi untuk admin/kasir (mis. ubah metode bayar)
drop policy if exists "transactions_update_staff" on public.transactions;
create policy "transactions_update_staff" on public.transactions
  for update to authenticated
  using (public.current_role() in ('admin', 'kasir'))
  with check (public.current_role() in ('admin', 'kasir'));

grant execute on function public.update_stock_record(uuid, text, integer, text) to authenticated;
grant execute on function public.delete_stock_record(uuid) to authenticated;
grant execute on function public.void_sale(uuid) to authenticated;

-- Tabel pengaturan (Gemini API key dsb) khusus admin
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

grant select, insert, update, delete on public.settings to authenticated;

-- Seed kategori awal
insert into public.categories (name)
values ('Sembako'), ('Minuman'), ('Rumah Tangga'), ('Perawatan')
on conflict (name) do nothing;