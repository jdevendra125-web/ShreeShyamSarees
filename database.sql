-- Run this SQL in your Supabase SQL Editor to set up all tables

-- 1. Table for registered visitors
CREATE TABLE IF NOT EXISTS visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  place TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  sms_status TEXT DEFAULT 'pending'
);

-- 2. Table for product details
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  sale_price NUMERIC, -- Offer price
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Table for size-wise stock quantities
CREATE TABLE IF NOT EXISTS product_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT NOT NULL, -- e.g., 'Free Size', 'S', 'M', 'L', 'XL'
  quantity INTEGER NOT NULL DEFAULT 0 CONSTRAINT quantity_non_negative CHECK (quantity >= 0),
  UNIQUE(product_id, size)
);

-- 4. Table for online customer orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of items ordered: [{id, name, size, qty, price}]
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Table for staff-generated sales invoices
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of items sold: [{id, name, size, qty, price}]
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for all tables
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Visitors Policies
CREATE POLICY "Allow public insert visitors" ON visitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select visitors" ON visitors FOR SELECT USING (true);
CREATE POLICY "Allow public update visitors" ON visitors FOR UPDATE USING (true);

-- Products Policies
CREATE POLICY "Allow public select products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete products" ON products FOR DELETE USING (true);

-- Stock Policies
CREATE POLICY "Allow public select stock" ON product_stock FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock" ON product_stock FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stock" ON product_stock FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stock" ON product_stock FOR DELETE USING (true);

-- Orders Policies
CREATE POLICY "Allow public select orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON orders FOR UPDATE USING (true);

-- Sales Policies
CREATE POLICY "Allow public select sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert sales" ON sales FOR INSERT WITH CHECK (true);
