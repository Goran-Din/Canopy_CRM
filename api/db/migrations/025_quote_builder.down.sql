DROP TABLE IF EXISTS quote_signatures;
DROP TRIGGER IF EXISTS quote_line_items_updated_at ON quote_line_items;
DROP TABLE IF EXISTS quote_line_items;
DROP TRIGGER IF EXISTS quote_sections_updated_at ON quote_sections;
DROP TABLE IF EXISTS quote_sections;
DROP TRIGGER IF EXISTS quotes_v2_updated_at ON quotes_v2;
DROP TABLE IF EXISTS quotes_v2;
