import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFleet, setActiveFleet] = useState('all');

  useEffect(() => {
    supabase.from('fleets').select('*').order('name').then(({ data }) => {
      setFleets(data || []);
      setLoading(false);
    });
  }, []);

  const tenant = {
    id: 'owner',
    company_name: 'FleetToll Pro',
    subscription_status: 'active',
    subscription_plan: 'owner',
    trial_ends_at: null,
    onboarding_completed: true,
  };

  const user = {
    id: 'owner',
    email: 'lizzethamaya211@gmail.com',
    full_name: 'Lizzeth Amaya',
    role: 'admin',
  };

  const plan = { name: 'Owner', maxFleets: null, maxTolls: null };

  return (
    <TenantContext.Provider value={{
      tenant,
      user,
      fleets,
      loading,
      isOwner: true,
      plan,
      canAddFleet: true,
      activeFleet,
      setActiveFleet,
      loadFleets: async () => {},
      refreshTenant: async () => {},
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
