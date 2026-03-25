import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Scheduled task to validate data integrity
 * Ensures permanent owner fleets exist and no data is orphaned
 * Should run daily
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function should have API key auth or be called from a trusted source
    const authHeader = req.headers.get('authorization');
    const expectedToken = Deno.env.get('DATA_INTEGRITY_TOKEN');
    
    if (!authHeader?.startsWith('Bearer ') || authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Unauthorized data integrity check attempt');
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const permanentFleetNames = ['Dealer Fleet', 'Bar Auto Rentals LLC'];
    const results = [];

    // Check owner account
    const ownerFleets = await base44.asServiceRole.entities.Fleet.filter({ tenant_id: 'owner' });
    const existingNames = ownerFleets.map(f => f.name);
    const missing = permanentFleetNames.filter(name => !existingNames.includes(name));
    
    if (missing.length > 0) {
      console.log(`ALERT: Missing permanent fleets: ${missing.join(', ')}`);
      results.push({
        type: 'missing_fleet',
        fleets: missing,
        status: 'CRITICAL'
      });

      // Attempt to recreate
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
        try {
          const data = seedData[name];
          await base44.asServiceRole.entities.Fleet.create({
            tenant_id: 'owner',
            name,
            ...data,
          });
          console.log(`✅ Recreated fleet: ${name}`);
        } catch (err) {
          console.error(`Failed to recreate fleet ${name}:`, err.message);
        }
      }
    } else {
      results.push({
        type: 'permanent_fleets_ok',
        status: 'OK'
      });
    }

    // Check for orphaned tolls
    const allTolls = await base44.asServiceRole.entities.TollNotice.filter(
      { tenant_id: 'owner' },
      '-created_date',
      500
    );
    const validFleetIds = ownerFleets.map(f => f.id);
    const orphanedTolls = allTolls.filter(t => t.fleet && !validFleetIds.includes(t.fleet));
    
    if (orphanedTolls.length > 0) {
      console.log(`WARNING: Found ${orphanedTolls.length} orphaned tolls`);
      results.push({
        type: 'orphaned_tolls',
        count: orphanedTolls.length,
        status: 'WARNING'
      });
    }

    // Log the integrity check
    await base44.asServiceRole.entities.AdminLog.create({
      tenant_id: 'owner',
      log_type: 'sync_failure', // Using sync_failure as closest type
      severity: results.some(r => r.status === 'CRITICAL') ? 'critical' : 'low',
      title: 'Daily Data Integrity Check',
      message: `Integrity check completed. Missing fleets: ${missing.length}, Orphaned tolls: ${orphanedTolls.length}`,
      is_resolved: true,
    }).catch(err => console.error('Failed to log integrity check:', err.message));

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        fleets_ok: missing.length === 0,
        fleets_checked: permanentFleetNames.length,
        orphaned_tolls: orphanedTolls.length,
      }
    });
  } catch (error) {
    console.error('Data integrity check error:', error);
    return Response.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
});