import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all contracts
    const contracts = await base44.entities.RentalContract.list('-start_date', 1000);
    console.log(`[restoreCustomersFromContracts] Found ${contracts.length} contracts`);

    // Fetch existing customers
    const existingCustomers = await base44.entities.Customer.list('-created_date', 1000);
    const existingEmails = new Set(existingCustomers.map(c => c.email?.toLowerCase()));

    let created = 0;
    let skipped = 0;
    const results = [];

    // Process each contract
    for (const contract of contracts) {
      if (!contract.renter_name || !contract.renter_email) {
        skipped++;
        continue;
      }

      const email = contract.renter_email.toLowerCase();

      // Skip if customer already exists with this email
      if (existingEmails.has(email)) {
        skipped++;
        results.push({
          renter_name: contract.renter_name,
          email: contract.renter_email,
          status: 'skipped_exists',
        });
        continue;
      }

      // Determine fleet
      const fleet = contract.fleet || 'bar_auto_rentals';
      const preferred_fleet = fleet === 'concesionario' ? 'concesionario' : 'bar_auto_rentals';

      // Get all contracts for this renter to calculate loyalty tier
      const renterContracts = contracts.filter(c =>
        c.renter_name?.toLowerCase() === contract.renter_name.toLowerCase() ||
        c.renter_email?.toLowerCase() === contract.renter_email.toLowerCase()
      );

      // Create customer record
      const customerData = {
        full_name: contract.renter_name,
        email: contract.renter_email,
        phone: contract.renter_phone || '',
        license_number: contract.license_number || '',
        address: contract.address || '',
        insurance_company: contract.insurance_company || '',
        insurance_policy: contract.insurance_policy || '',
        insurance_phone: contract.insurance_phone || '',
        preferred_fleet: preferred_fleet,
        loyalty_tier: renterContracts.length >= 3 ? 'gold' : (renterContracts.length >= 2 ? 'silver' : 'bronze'),
        total_rentals: renterContracts.length,
        total_tolls_paid: 0,
        total_spent: 0,
        last_rental_date: contract.end_date,
        source: contract.platform || 'direct',
        marketing_opt_in: true,
      };

      try {
        await base44.entities.Customer.create(customerData);
        created++;
        existingEmails.add(email); // Add to set to prevent duplicates in same batch
        results.push({
          renter_name: contract.renter_name,
          email: contract.renter_email,
          status: 'created',
        });
      } catch (err) {
        console.error(`[restoreCustomersFromContracts] Failed to create customer for ${contract.renter_name}:`, err.message);
        results.push({
          renter_name: contract.renter_name,
          email: contract.renter_email,
          status: 'error',
          error: err.message,
        });
      }
    }

    console.log(`[restoreCustomersFromContracts] Created: ${created}, Skipped: ${skipped}`);

    return Response.json({
      success: true,
      created,
      skipped,
      total_contracts: contracts.length,
      results,
    });
  } catch (error) {
    console.error('[restoreCustomersFromContracts] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});