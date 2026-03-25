import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Validates critical tenant data integrity
 * Ensures permanent fleets exist and owner fleets are properly separated
 * Called during deployment or regularly to prevent data loss
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only owner can validate
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const ownerTenantId = 'owner';
    const permanentFleetNames = ['Dealer Fleet', 'Bar Auto Rentals LLC'];

    // Check owner tenant exists
    const ownerTenant = await base44.asServiceRole.entities.Tenant.filter({ id: ownerTenantId }).catch(() => []);
    
    // Ensure permanent fleets exist
    const ownerFleets = await base44.asServiceRole.entities.Fleet.filter({ tenant_id: ownerTenantId });
    const existingNames = ownerFleets.map(f => f.name);
    
    const missing = permanentFleetNames.filter(name => !existingNames.includes(name));
    const created = [];
    
    if (missing.length > 0) {
      console.log(`Recreating missing permanent fleets: ${missing.join(', ')}`);
      
      const seedData = {
        'Dealer Fleet': {
          platforms: ['turo', 'upcar', 'rentcentric'],
          color: '#4A9EFF',
          email_alias: 'dealer@fleettollpro.com',
          is_active: true,
        },
        'Bar Auto Rentals LLC': {
          platforms: ['turo', 'upcar', 'signnow'],
          color: '#F97316',
          email_alias: 'bar@fleettollpro.com',
          is_active: true,
        }
      };
      
      for (const name of missing) {
        const data = seedData[name];
        const fleet = await base44.asServiceRole.entities.Fleet.create({
          tenant_id: ownerTenantId,
          name,
          ...data,
        });
        created.push(fleet);
      }
    }

    // Verify no tolls/contracts are orphaned
    const allTolls = await base44.asServiceRole.entities.TollNotice.filter({ tenant_id: ownerTenantId }, '-created_date', 1000);
    const validFleetIds = ownerFleets.map(f => f.id);
    const orphanedTolls = allTolls.filter(t => t.fleet && !validFleetIds.includes(t.fleet));
    
    const allContracts = await base44.asServiceRole.entities.RentalContract.filter({ tenant_id: ownerTenantId }, '-created_date', 1000);
    const orphanedContracts = allContracts.filter(c => c.fleet && !validFleetIds.includes(c.fleet));

    return Response.json({
      status: 'valid',
      permanent_fleets_ok: missing.length === 0,
      permanent_fleets_created: created.length,
      orphaned_tolls: orphanedTolls.length,
      orphaned_contracts: orphanedContracts.length,
      message: missing.length === 0 
        ? 'All permanent fleets exist and data is intact'
        : `Recreated ${created.length} missing permanent fleets`
    });
  } catch (error) {
    console.error('Data validation error:', error);
    return Response.json({ 
      error: error.message,
      status: 'validation_error'
    }, { status: 500 });
  }
});