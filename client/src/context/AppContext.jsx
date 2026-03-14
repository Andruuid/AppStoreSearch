import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [searchState, setSearchState] = useState({
    results: [],
    searched: false,
    filters: { term: '', category: '', price: 'all' },
    viewMode: 'grid',
  });

  const [opportunityState, setOpportunityState] = useState({
    results: [],
    searched: false,
    tab: 0,
    category: '',
    sortBy: 'installs',
    sortDir: 'desc',
  });

  const [gemState, setGemState] = useState({
    results: [],
    searched: false,
    category: '',
    sortBy: 'score',
    sortDir: 'desc',
  });

  const [crawlerState, setCrawlerState] = useState({
    status: null,
    gems: [],
    threshold: 40,
    budget: 200,
    sortBy: 'score',
    sortDir: 'desc',
  });

  return (
    <AppContext.Provider value={{ searchState, setSearchState, opportunityState, setOpportunityState, gemState, setGemState, crawlerState, setCrawlerState }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
