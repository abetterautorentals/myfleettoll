import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find Rachel's contract
    const rachelContracts = await base44.asServiceRole.entities.RentalContract.filter(
      { renter_name: 'RACHEL LYNN WOLOSKY' },
      '-start_date',
      10
    );

    if (rachelContracts.length === 0) {
      return Response.json({ error: 'Rachel contract not found' }, { status: 404 });
    }

    const contract = rachelContracts[0];

    // Find Rachel's customer record
    const rachelCustomers = await base44.asServiceRole.entities.Customer.filter(
      { full_name: 'RACHEL LYNN WOLOSKY' },
      '-created_date',
      10
    );

    if (rachelCustomers.length === 0) {
      return Response.json({ error: 'Rachel customer not found' }, { status: 404 });
    }

    const customer = rachelCustomers[0];

    // Update with full contract details
    const updated = await base44.asServiceRole.entities.Customer.update(customer.id, {
      full_name: 'RACHEL LYNN WOLOSKY',
      email: contract.renter_email || 'Rlw902009@gmail.com',
      phone: contract.renter_phone || '',
      license_number: contract.license_number || '',
      address: contract.address || '433 Buena Vista Ave Apt 116, Alameda, CA 94501',
      insurance_company: contract.insurance_company || '',
      insurance_policy: contract.insurance_policy || '',
      insurance_phone: contract.insurance_phone || '',
      preferred_fleet: contract.fleet === 'concesionario' ? 'concesionario' : 'bar_auto_rentals',
      source: contract.platform || 'direct',
      last_rental_date: contract.end_date,
      marketing_opt_in: true,
      loyalty_tier: 'silver',
      total_rentals: 1,
      total_tolls_paid: 0,
      total_spent: 0,
    });

    console.log(`[restoreRachelWolosky] Updated customer ${customer.id}`);

    return Response.json({
      success: true,
      customer_id: customer.id,
      full_name: updated.full_name,
      email: updated.email,
      license_number: updated.license_number,
      address: updated.address,
      contract_id: contract.id,
      rental_dates: `${contract.start_date} to ${contract.end_date}`,
    });
  } catch (error) {
    console.error('[restoreRachelWolosky] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});