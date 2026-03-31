'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Search } from 'lucide-react';
import InputAdornment from '@mui/material/InputAdornment';

interface Suggestion {
  id: string;
  name: string;
  types: string[];
  rating: number | null;
  thumbnailUrl: string | null;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Called when a suggestion is selected. If not provided, navigates to the game detail page. */
  onSelect?: (gameId: string, gameName: string) => void;
  placeholder?: string;
}

export default function SearchAutocomplete({ value, onChange, onSubmit, onSelect, placeholder = 'Search games...' }: SearchAutocompleteProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(value.trim())}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(
            (data.results ?? []).map((g: Record<string, unknown>) => ({
              id: g.id,
              name: g.name,
              types: g.types ?? [],
              rating: g.rating ?? null,
              thumbnailUrl: g.thumbnailUrl ?? null,
            }))
          );
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  return (
    <Autocomplete
      freeSolo
      open={open && suggestions.length > 0}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={suggestions}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name)}
      getOptionKey={(opt) => (typeof opt === 'string' ? opt : opt.id)}
      loading={loading}
      filterOptions={(x) => x} // Don't filter client-side, server already filtered
      inputValue={value}
      onInputChange={(_, newValue, reason) => {
        if (reason === 'input') onChange(newValue);
      }}
      onChange={(_, selected) => {
        if (selected && typeof selected !== 'string') {
          if (onSelect) {
            onSelect(selected.id, selected.name);
          } else {
            router.push(`/games/${encodeURIComponent(selected.id)}`);
          }
        }
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
        return (
          <li key={key} {...rest}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
              {option.thumbnailUrl ? (
                <Box
                  component="img"
                  src={option.thumbnailUrl}
                  alt=""
                  sx={{ width: 36, height: 36, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: 'action.hover', flexShrink: 0 }} />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {option.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.types.join(', ')}
                  {option.rating ? ` · ${option.rating.toFixed(1)}` : ''}
                </Typography>
              </Box>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setOpen(false);
              onSubmit();
            }
          }}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      sx={{ flex: 1, minWidth: 200 }}
    />
  );
}
