import { useState, useEffect } from 'react';
import {
  Box, TextField, MenuItem, Button, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getCategories } from '../services/api';

export default function FilterBar({ onSearch, showSearch = true, showPrice = true }) {
  const [categories, setCategories] = useState([]);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('all');

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ term, category, price });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
      {showSearch && (
        <TextField
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Search apps..."
          size="small"
          sx={{ minWidth: 220, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
        />
      )}

      <TextField
        select
        value={category}
        onChange={e => setCategory(e.target.value)}
        size="small"
        sx={{ minWidth: 180 }}
        label="Category"
      >
        <MenuItem value="">All Categories</MenuItem>
        {categories.map(c => (
          <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
        ))}
      </TextField>

      {showPrice && (
        <TextField
          select
          value={price}
          onChange={e => setPrice(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
          label="Price"
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="free">Free</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
        </TextField>
      )}

      <Button type="submit" variant="contained" disableElevation>
        Search
      </Button>
    </Box>
  );
}
