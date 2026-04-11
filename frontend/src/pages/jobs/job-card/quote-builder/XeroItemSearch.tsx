import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/client';

interface XeroItem {
  item_code: string;
  name: string;
  description: string;
  default_price: number | null;
}

interface XeroItemSearchProps {
  value: string;
  xeroItemCode: string | null;
  xeroDefaultPrice: number | null;
  onSelect: (item: { item_name: string; description: string; xero_item_code: string; xero_default_price: number | null }) => void;
  onCustom: (name: string) => void;
}

export function XeroItemSearch({ value, xeroItemCode, xeroDefaultPrice, onSelect, onCustom }: XeroItemSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<XeroItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const { data } = await apiClient.get('/v1/xero-items', { params: { search: term } });
      setResults(Array.isArray(data) ? data.slice(0, 10) : (data.data || []).slice(0, 10));
      setIsOpen(true);
    } catch { setResults([]); } finally { setIsSearching(false); }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (item: XeroItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect({
      item_name: item.name,
      description: item.description || '',
      xero_item_code: item.item_code,
      xero_default_price: item.default_price,
    });
  };

  const handleCustom = () => { setIsOpen(false); onCustom(query); };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search Xero items..."
          className="pl-8 h-8 text-sm"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isSearching && <p className="px-3 py-2 text-xs text-muted-foreground">Searching...</p>}
          {results.map((item) => (
            <button key={item.item_code} className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0" onClick={() => handleSelect(item)}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">{item.item_code}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
              {item.default_price != null && <p className="text-xs text-muted-foreground">Xero default: ${item.default_price.toFixed(2)}</p>}
            </button>
          ))}
          <button className="w-full text-left px-3 py-2 hover:bg-muted text-sm text-primary" onClick={handleCustom}>+ Use custom item</button>
        </div>
      )}
      {xeroItemCode && xeroDefaultPrice != null && (
        <p className="text-xs text-muted-foreground mt-0.5">Xero default: ${xeroDefaultPrice.toFixed(2)}</p>
      )}
    </div>
  );
}
