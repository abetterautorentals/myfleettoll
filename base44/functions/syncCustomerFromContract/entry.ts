import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Handle both direct API calls and automation payloads
    let contract_data = body.contract_data || body.data;
    let contract_id = body.contract_id || body.event?.entity_id;

    if (!contract_data?.renter_name || !contract_data?.renter_email) {
      return Response.json({ error: 'Missing renter info' }, { status: 400 });
    }

    const email = contract_data.renter_email.toLowerCase();

    // Check if customer exists
    const existing = await base44.asServiceRole.entities.Customer.filter(
      { email: contract_data.renter_email },
      '-created_date',
      1
    );

    const fleet = contract_data.fleet || 'bar_auto_rentals';
    const preferred_fleet = fleet === 'concesionario' ? 'concesionario' : 'bar_auto_rentals';

    const customerData = {
      full_name: contract_data.renter_name,
      email: contract_data.renter_email,
      phone: contract_data.renter_phone || '',
      license_number: contract_data.license_number || '',
      address: contract_data.address || '',
      insurance_company: contract_data.insurance_company || '',
      insurance_policy: contract_data.insurance_policy || '',
      preferred_fleet: preferred_fleet,
      last_rental_date: contract_data.end_date,
      source: contract_data.platform || 'direct',
      marketing_opt_in: true,
    };

    let customer;
    if (existing.length > 0) {
      // Update existing customer
      customer = existing[0];
      
      // Recalculate rental count and update customer fields
      const allContracts = await base44.asServiceRole.entities.RentalContract.filter(
        { 
          $or: [
            { renter_name: contract_data.renter_name },
            { renter_email: contract_data.renter_email }
          ]
        },
        '-start_date',
        500
      );
      
      const updateData = {
        ...customerData,
        total_rentals: allContracts.length,
        loyalty_tier: allContracts.length >= 3 ? 'gold' : (allContracts.length >= 2 ? 'silver' : 'bronze'),
      };

      // Merge in license, address, insurance if not already set
      if (!customer.license_number && contract_data.license_number) {
        updateData.license_number = contract_data.license_number;
      }
      if (!customer.address && contract_data.address) {
        updateData.address = contract_data.address;
      }
      if (!customer.insurance_company && contract_data.insurance_company) {
        updateData.insurance_company = contract_data.insurance_company;
      }
      if (!customer.insurance_policy && contract_data.insurance_policy) {
        updateData.insurance_policy = contract_data.insurance_policy;
      }
      if (!customer.insurance_phone && contract_data.insurance_phone) {
        updateData.insurance_phone = contract_data.insurance_phone;
      }

      await base44.asServiceRole.entities.Customer.update(customer.id, updateData);

      console.log(`[syncCustomerFromContract] Updated customer ${customer.id} from contract`);
    } else {
      // Create new customer
      const newCustomer = await base44.asServiceRole.entities.Customer.create({
        ...customerData,
        total_rentals: 1,
        loyalty_tier: 'bronze',
        total_tolls_paid: 0,
        total_spent: 0,
      });

      customer = newCustomer;
      console.log(`[syncCustomerFromContract] Created customer ${customer.id} from contract`);
    }

    return Response.json({
      success: true,
      customer_id: customer.id,
      action: existing.length > 0 ? 'updated' : 'created',
    });
  } catch (error) {
    console.error('[syncCustomerFromContract] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});