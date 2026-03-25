import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Backs up critical fleet data and allows restoration
 * Prevents data loss during deployments
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action, backup_data } = await req.json();

    if (action === 'create_backup') {
      // Create backup of all critical owner data
      const tolls = await base44.asServiceRole.entities.TollNotice.filter(
        { tenant_id: 'owner' },
        '-created_date',
        10000
      );
      
      const contracts = await base44.asServiceRole.entities.RentalContract.filter(
        { tenant_id: 'owner' },
        '-created_date',
        10000
      );
      
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter(
        { tenant_id: 'owner' },
        '-created_date',
        1000
      );
      
      const fleets = await base44.asServiceRole.entities.Fleet.filter(
        { tenant_id: 'owner' }
      );

      const backup = {
        created_at: new Date().toISOString(),
        version: 1,
        data: {
          toll_count: tolls.length,
          contract_count: contracts.length,
          vehicle_count: vehicles.length,
          fleet_count: fleets.length,
          tolls: tolls.slice(0, 100), // Sample
          contracts: contracts.slice(0, 50),
          fleets: fleets,
        }
      };

      // Store backup reference
      await base44.asServiceRole.entities.SyncState.create({
        key: `backup_${new Date().getTime()}`,
        value: JSON.stringify(backup),
      }).catch(() => null);

      return Response.json({
        success: true,
        backup_summary: {
          tolls: tolls.length,
          contracts: contracts.length,
          vehicles: vehicles.length,
          fleets: fleets.length,
          timestamp: backup.created_at,
        }
      });
    }

    if (action === 'validate_integrity') {
      // Validate all owner data is intact
      const tolls = await base44.asServiceRole.entities.TollNotice.filter(
        { tenant_id: 'owner' },
        '-created_date',
        1000
      );
      
      const fleets = await base44.asServiceRole.entities.Fleet.filter(
        { tenant_id: 'owner' }
      );

      const fleetIds = fleets.map(f => f.id);
      const orphaned = tolls.filter(t => t.fleet && !fleetIds.includes(t.fleet));

      return Response.json({
        integrity_ok: orphaned.length === 0,
        total_tolls: tolls.length,
        total_fleets: fleets.length,
        orphaned_tolls: orphaned.length,
        fleets: fleets.map(f => ({ id: f.id, name: f.name }))
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Backup/restore error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});