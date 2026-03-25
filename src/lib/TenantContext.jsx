import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TenantContext = createContext(null);

export const PLANS = {
  starter:      { name: 'Starter',      price: 29,  maxFleets: 1,    maxTolls: 50,  color: 'bg-blue-500' },
  professional: { name: 'Professional', price: 49,  maxFleets: 3,    maxTolls: null, color: 'bg-purple-500' },
  business:     { name: 'Business',     price: 99,  maxFleets: null, maxTolls: null, color: 'bg-amber-500' },
  owner:        { name: 'Owner',        price: 0,   maxFleets: null, maxTolls: null, color: 'bg-green-500' },
  free:         { name: 'Free',         price: 0,   maxFleets: 1,    maxTolls: 10,  color: 'bg-gray-500' },
};

// The owner's permanent fleets — ALWAYS seeded, NEVER deletable, permanently isolated
const OWNER_FLEET_NAMES = ['APEX', 'BAR'];
const OWNER_FLEETS_SEED = [
  {
    name: 'APEX',
    platforms: ['turo', 'upcar', 'rentcentric'],
    color: '#4A9EFF',
    email_alias: 'apex@fleettollpro.com',
    is_active: true,
    is_permanent: true,
  },
  {
    name: 'BAR',
    platforms: ['turo', 'upcar', 'signnow'],
    color: '#F97316',
    email_alias: 'bar@fleettollpro.com',
    is_active: true,
    is_permanent: true,
  },
];

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeFleet, setActiveFleet] = useState('all'); // global fleet filter

  useEffect(() => {
    loadTenant();
  }, []);

  const loadTenant = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      if (me.role === 'admin') {
        const ownerTenant = {
          id: 'owner',
          owner_user_id: me.id,
          owner_email: me.email,
          company_name: 'FleetToll Pro (Owner)',
          subscription_plan: 'owner',
          subscription_status: 'free',
          onboarding_completed: true,
          free_access: true,
        };
        setTenant(ownerTenant);
        await loadFleetsAndSeedOwner(me.id);
        setLoading(false);
        return;
      }

      const tenants = await base44.entities.Tenant.filter({ owner_user_id: me.id });
      if (tenants.length > 0) {
        setTenant(tenants[0]);
        await loadFleets(tenants[0].id);
        base44.entities.Tenant.update(tenants[0].id, { last_login: new Date().toISOString() });
      }
    } catch (e) {
      console.error('Tenant load error', e);
    } finally {
      setLoading(false);
    }
  };

  // For the owner: load fleets and seed APEX + BAR if they don't exist yet
  // This also cleans up old fleet names
  const loadFleetsAndSeedOwner = async (ownerUserId) => {
    try {
      let existing = await base44.entities.Fleet.filter({ tenant_id: 'owner' });

      // Clean up old fleet names (Dealer Fleet, Bar Auto Rentals LLC)
      const oldNames = ['Dealer Fleet', 'Bar Auto Rentals LLC'];
      for (const fleet of existing) {
        if (oldNames.includes(fleet.name)) {
          await base44.entities.Fleet.delete(fleet.id);
        }
      }

      // Reload after cleanup
      existing = await base44.entities.Fleet.filter({ tenant_id: 'owner' });

      // Ensure APEX + BAR always exist
      for (const seed of OWNER_FLEETS_SEED) {
        const already = existing.find(f => f.name === seed.name);
        if (!already) {
          const created = await base44.entities.Fleet.create({ ...seed, tenant_id: 'owner' });
          existing = [...existing, created];
        }
      }

      // Mark permanent fleets in UI (readonly fields)
      const markedFleets = existing.map(f => ({
        ...f,
        is_permanent: OWNER_FLEET_NAMES.includes(f.name),
      }));

      setFleets(markedFleets);
    } catch (e) {
      console.error('Failed to load/seed owner fleets:', e);
      setFleets([]);
    }
  };

  const loadFleets = async (tenantId) => {
    try {
      const f = await base44.entities.Fleet.filter({ tenant_id: tenantId });
      setFleets(f);
    } catch (e) {
      setFleets([]);
    }
  };

  const refreshTenant = async () => {
    if (!tenant?.id) return;
    if (tenant.id === 'owner') {
      await loadFleetsAndSeedOwner(user?.id);
      return;
    }
    const updated = await base44.entities.Tenant.filter({ owner_user_id: user?.id });
    if (updated.length > 0) {
      setTenant(updated[0]);
      await loadFleets(updated[0].id);
    }
  };

  const isOwner = user?.role === 'admin';
  const plan = PLANS[tenant?.subscription_plan] || PLANS.starter;
  const canAddFleet = isOwner || plan.maxFleets === null || fleets.length < plan.maxFleets;

  return (
    <TenantContext.Provider value={{
      tenant, setTenant,
      fleets, setFleets, loadFleets, refreshTenant,
      loading, user, isOwner, plan, canAddFleet,
      activeFleet, setActiveFleet,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}