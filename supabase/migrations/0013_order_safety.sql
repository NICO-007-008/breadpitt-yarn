-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_order_safety.sql
-- Closes gaps found in the ordering audit. Safe to re-run.
--   1) A promo code typed in at checkout (never "claimed") could be reused forever.
--      place_order now records every redeemed voucher, claimed or not.
--   2) Cancelling an order now gives the voucher back (it was lost for good).
--   3) A cancelled order can't be reopened (its stock was already returned, so
--      reopening would sell the same items twice).
--   4) Customers can't cancel an order that is already paid (no refund path).
--   5) Scheduled orders can't be set in the past.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) place_order: same as 0012 plus unclaimed-voucher redemption and a schedule check
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_fulfillment_type text,
  p_address text,
  p_unit_notes text,
  p_latitude double precision,
  p_longitude double precision,
  p_scheduled_at timestamptz,
  p_payment_method text,
  p_cart jsonb,
  p_promo_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id           uuid := auth.uid();
  v_fulfillment       text;
  v_address           text;
  v_unit_notes        text;
  v_lat               double precision;
  v_lng               double precision;
  v_payment_status    text;
  v_line              record;
  v_product           record;
  v_subtotal          numeric(10,2) := 0;
  v_eligible          numeric(10,2) := 0;
  v_delivery_fee      numeric(10,2);
  v_discount          numeric(10,2) := 0;
  v_voucher_id        uuid;
  v_voucher_code      text;
  v_voucher_discount_type      text;
  v_voucher_discount_value     numeric(10,2);
  v_voucher_minimum_spend      numeric(10,2);
  v_voucher_max_discount       numeric(10,2);
  v_voucher_eligible_categories text[];
  v_raw_discount       numeric(10,2);
  v_taxable            numeric(10,2);
  v_tax                numeric(10,2);
  v_total              numeric(10,2);
  v_order              public.orders;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  v_fulfillment := coalesce(p_fulfillment_type, 'delivery');
  if v_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Invalid fulfillment type.';
  end if;

  if p_payment_method not in ('cod', 'card', 'gcash', 'paymaya', 'grab_pay') then
    raise exception 'Invalid payment method.';
  end if;

  v_payment_status := case when p_payment_method = 'cod' then 'unpaid' else 'pending' end;

  if btrim(p_customer_name) = '' or btrim(p_phone) = '' then
    raise exception 'Recipient name and phone are required.';
  end if;

  -- 5) A scheduled order must be in the future (small grace for clock drift).
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '2 minutes' then
    raise exception 'The scheduled time has already passed. Please pick a later time.';
  end if;

  if v_fulfillment = 'pickup' then
    v_address := '';
    v_unit_notes := '';
    v_lat := null;
    v_lng := null;
  else
    v_address := coalesce(p_address, '');
    v_unit_notes := coalesce(p_unit_notes, '');
    v_lat := p_latitude;
    v_lng := p_longitude;
    if btrim(v_address) = '' then
      raise exception 'Delivery address is required.';
    end if;
  end if;

  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select v.discount_type, v.discount_value, v.minimum_spend, v.max_discount, v.eligible_categories, v.id, v.code
      into v_voucher_discount_type, v_voucher_discount_value, v_voucher_minimum_spend, v_voucher_max_discount, v_voucher_eligible_categories, v_voucher_id, v_voucher_code
      from public.vouchers v
     where upper(v.code) = upper(btrim(p_promo_code))
       and v.active
       and (v.starts_at is null or v.starts_at <= now())
       and (v.expires_at is null or v.expires_at > now());

    if not found then
      raise exception 'Invalid or expired promo code.';
    end if;

    if exists (
      select 1 from public.user_vouchers uv
       where uv.user_id = v_user_id
         and uv.voucher_id = v_voucher_id
         and uv.status = 'redeemed'
    ) then
      raise exception 'This voucher has already been redeemed.';
    end if;
  end if;

  for v_line in
    select i.product_id, i.qty
      from jsonb_to_recordset(p_cart) as i(product_id uuid, qty int)
  loop
    if v_line.product_id is null then
      raise exception 'Your cart contains an unknown product.';
    end if;

    select p.* into v_product from public.products p where p.id = v_line.product_id;

    if v_product.id is null then
      raise exception 'Your cart contains an unavailable product.';
    end if;

    if v_line.qty is null then
      raise exception 'Quantity is missing for %. Please remove and re-add the item.', v_product.name;
    end if;
    if v_line.qty <= 0 then
      raise exception 'Quantity for % must be at least 1.', v_product.name;
    end if;

    if v_product.stock_quantity is null or v_product.stock_quantity < v_line.qty then
      raise exception 'Only % left in stock for %. Please reduce the quantity or choose another item.',
        coalesce(v_product.stock_quantity, 0), v_product.name;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_line.qty;

    if v_voucher_id is not null
       and (v_voucher_eligible_categories is null
            or array_length(v_voucher_eligible_categories, 1) is null
            or v_product.category = any (v_voucher_eligible_categories)) then
      v_eligible := v_eligible + v_product.price * v_line.qty;
    end if;
  end loop;

  v_delivery_fee := case
    when v_fulfillment = 'delivery' and v_subtotal < 500 then 60
    else 0
  end;

  if v_voucher_id is not null then
    if v_eligible <= 0 then
      raise exception 'The promo code does not apply to anything in your basket.';
    end if;
    if v_eligible < v_voucher_minimum_spend then
      raise exception 'Spend ₱% or more to apply this promo code.',
        to_char(v_voucher_minimum_spend, 'FM999,999.00');
    end if;

    v_raw_discount := case
      when v_voucher_discount_type = 'percent'
        then v_eligible * v_voucher_discount_value / 100
      else v_voucher_discount_value
    end;
    if v_voucher_max_discount is not null then
      v_raw_discount := least(v_raw_discount, v_voucher_max_discount);
    end if;
    v_discount := round(least(greatest(v_raw_discount, 0), v_eligible), 2);
  end if;

  v_taxable := greatest(v_subtotal - v_discount, 0);
  v_tax     := round(v_taxable * 0.12, 2);
  v_total   := round(v_taxable + v_delivery_fee + v_tax, 2);

  insert into public.orders (
    user_id, customer_name, phone, fulfillment_type, address, unit_notes,
    latitude, longitude, scheduled_at, payment_method, payment_status,
    subtotal, delivery_fee, tax, total, discount, voucher_code, voucher_id
  ) values (
    v_user_id, btrim(p_customer_name), btrim(p_phone), v_fulfillment,
    v_address, v_unit_notes, v_lat, v_lng, p_scheduled_at,
    p_payment_method, v_payment_status,
    v_subtotal, v_delivery_fee, v_tax, v_total, v_discount,
    v_voucher_code, v_voucher_id
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, price, quantity, image_url)
  select v_order.id, i.product_id, p.name, p.price, i.qty, p.image_url
    from jsonb_to_recordset(p_cart) as i(product_id uuid, qty int)
    join public.products p on p.id = i.product_id;

  -- 1) Redeem the voucher against this order. If the customer typed the code in
  --    without claiming it first, create the wallet row as redeemed so the code
  --    can't be used again.
  if v_voucher_id is not null then
    insert into public.user_vouchers (user_id, voucher_id, status, redeemed_at, used_order_id)
    values (v_user_id, v_voucher_id, 'redeemed', now(), v_order.id)
    on conflict (user_id, voucher_id) do update
      set status = 'redeemed',
          redeemed_at = now(),
          used_order_id = excluded.used_order_id;
  end if;

  return v_order;
end $$;

revoke execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) from public, anon;
grant execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) to authenticated;

-- 2) Give the voucher back when its order is cancelled.
create or replace function public.token_voucher_release()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.user_vouchers
       set status = 'claimed', redeemed_at = null, used_order_id = null
     where used_order_id = new.id
       and status = 'redeemed';
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_release_voucher on public.orders;
create trigger trg_orders_release_voucher
  after update of status on public.orders
  for each row execute function public.token_voucher_release();

-- 3) A cancelled order stays cancelled.
create or replace function public.token_block_reopen()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'A cancelled order cannot be reopened. Ask the customer to place a new order.';
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_block_reopen on public.orders;
create trigger trg_orders_block_reopen
  before update of status on public.orders
  for each row execute function public.token_block_reopen();

-- 4) Customers may only cancel their own PENDING order that has not been paid.
drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders
  for update using (
    public.has_role('store_admin') or public.has_role('admin')
    or (user_id = auth.uid() and status = 'pending' and payment_status <> 'paid')
  )
  with check (
    public.has_role('store_admin') or public.has_role('admin')
    or (user_id = auth.uid() and status = 'cancelled')
  );

notify pgrst, 'reload schema';
