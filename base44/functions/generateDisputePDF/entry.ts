import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { toll_id, type = 'dispute' } = await req.json();
    if (!toll_id) return Response.json({ error: 'Missing toll_id' }, { status: 400 });

    console.log(`[generateDisputePDF] Generating PDF for toll ${toll_id}`);

    const toll = await base44.asServiceRole.entities.TollNotice.get(toll_id);
    if (!toll) return Response.json({ error: 'Toll not found' }, { status: 404 });

    let contract = null;
    if (toll.matched_contract_id) {
      const contracts = await base44.asServiceRole.entities.RentalContract.filter({ id: toll.matched_contract_id });
      contract = contracts[0] || null;
    }

    let fleet = null;
    if (toll.fleet) {
      const fleets = await base44.asServiceRole.entities.Fleet.filter({ name: toll.fleet });
      fleet = fleets[0] || null;
    }

    const isOaklandViolation = toll.agency === 'City of Oakland' || toll.is_violation;

    let relatedTolls = [toll];
    if (contract) {
      const allTolls = await base44.asServiceRole.entities.TollNotice.filter({ matched_contract_id: toll.matched_contract_id });
      relatedTolls = allTolls.length > 0 ? allTolls : [toll];
    }

    // ─── CREATE PDF ───
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true });
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const isViolation = type === 'violation' || toll.is_violation;
    const companyName = fleet?.name || 'BAR Better Auto Rentals LLC';
    const companyEmail = fleet?.email_alias || 'management@fleettollpro.com';

    // PAGE 1: COVER PAGE
    doc.setFillColor(30, 40, 80);
    doc.rect(0, 0, 216, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 15, 25);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    const docTitle = isOaklandViolation ? 'CITY OF OAKLAND VIOLATION NOTICE' : (isViolation ? 'RENTER INVOICE & TOLL NOTICE' : 'TOLL LIABILITY DISPUTE PACKAGE');
    doc.text(docTitle, 15, 38);

    doc.setTextColor(30, 30, 30);
    let y = 65;

    // Renter info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RENTER INFORMATION:', 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${contract?.renter_name || 'Unknown'}`, 20, y);
    y += 6;
    doc.text(`Address: 433 Buena Vista Ave Apt 116, Alameda, CA 94501`, 20, y);
    y += 6;
    doc.text(`Driver License: E2328547`, 20, y);
    y += 6;
    doc.text(`Email: ${contract?.renter_email || 'N/A'}`, 20, y);
    y += 6;
    doc.text(`Phone: ${contract?.renter_phone || 'N/A'}`, 20, y);
    y += 12;

    // Transaction IDs
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSACTION DETAILS:', 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Transaction ID / Ticket: ${toll.transaction_id || 'N/A'}`, 20, y);
    y += 6;
    doc.text(`Notice Date: ${toll.notice_date || 'N/A'}`, 20, y);
    y += 6;
    doc.text(`Occurrence Date: ${toll.occurrence_date || 'N/A'}`, 20, y);
    y += 12;

    // Vehicle info
    doc.setFont('helvetica', 'bold');
    doc.text('VEHICLE INFORMATION:', 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    const vehicleInfo = [contract?.vehicle_year, contract?.vehicle_make, contract?.vehicle_model].filter(Boolean).join(' ') || 'N/A';
    doc.text(`Vehicle: ${vehicleInfo}`, 20, y);
    y += 6;
    doc.text(`Color: ${contract?.vehicle_color || 'N/A'}`, 20, y);
    y += 6;
    // Format plate with CA prefix
    const formattedPlate = toll.license_plate && !toll.license_plate.startsWith('CA') ? `CA${toll.license_plate}` : toll.license_plate;
    doc.text(`Plate: ${formattedPlate}`, 20, y);
    y += 12;

    // Rental period
    doc.setFont('helvetica', 'bold');
    doc.text('RENTAL PERIOD:', 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    const startDate = contract?.start_date ? new Date(contract.start_date).toLocaleDateString() : 'N/A';
    const endDate = contract?.end_date ? new Date(contract.end_date).toLocaleDateString() : 'N/A';
    doc.text(`From: ${startDate}`, 20, y);
    y += 6;
    doc.text(`To: ${endDate}`, 20, y);
    y += 12;

    // Total amount
    const totalAmount = relatedTolls.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AMOUNT OWED:', 15, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(220, 38, 38);
    doc.text(`$${totalAmount.toFixed(2)}`, 20, y);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${today}`, 20, y);

    // PAGE 2+: TOLL DETAILS
    doc.addPage();
    y = 20;
    doc.setFillColor(30, 40, 80);
    doc.rect(0, 0, 216, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 15, 12);
    const detailHeader = isOaklandViolation ? 'VIOLATION NOTICE DETAIL' : 'TOLL DETAIL';
    doc.text(detailHeader, 201, 12, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    y = 28;

    // Table header
    doc.setFillColor(30, 40, 80);
    doc.rect(15, y, 186, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Ticket #', 18, y + 5.5);
    doc.text('Occur Date', 45, y + 5.5);
    doc.text('Notice Date', 75, y + 5.5);
    doc.text('Location', 110, y + 5.5);
    doc.text('Amount', 175, y + 5.5);
    y += 10;

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    let rowAlt = false;

    for (const t of relatedTolls) {
      if (y > 255) {
        doc.addPage();
        y = 20;
      }
      if (rowAlt) { doc.setFillColor(245, 247, 255); doc.rect(15, y - 3, 186, 8, 'F'); }
      rowAlt = !rowAlt;
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      // Show transaction ID if found; otherwise reference the toll notice page
    const transactionDisplay = t.transaction_id && t.transaction_id !== 'N/A' 
      ? t.transaction_id 
      : (t.notice_image_urls && t.notice_image_urls.length > 0 ? `See attached page 1` : 'N/A');
    doc.text(transactionDisplay, 18, y + 2);
      doc.text(t.occurrence_date || '', 45, y + 2);
      doc.text(t.notice_date || '', 75, y + 2);
      // Wrap location text to avoid truncation
      const locText = t.location || 'N/A';
      const wrappedLoc = doc.splitTextToSize(locText, 55);
      doc.setFontSize(8.5);
      doc.text(wrappedLoc[0] || '', 110, y + 2);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${(t.amount || 0).toFixed(2)}`, 175, y + 2);
      if (t.is_violation) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'normal');
        doc.text('VIOLATION', 18, y + 7);
        doc.setTextColor(30, 30, 30);
      }
      y += 10;
    }

    // Total row
    doc.setFillColor(30, 40, 80);
    doc.rect(15, y, 186, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 130, y + 6);
    doc.text(`$${totalAmount.toFixed(2)}`, 175, y + 6);

    // PAGE N: FULL RENTAL CONTRACT (EMBEDDED PDF PAGES)
    let finalPdfDoc = doc;
    if (contract && contract.contract_pdf_url) {
      try {
        // Fetch the contract PDF
        console.log(`[generateDisputePDF] Fetching contract PDF: ${contract.contract_pdf_url}`);
        const contractPdfRes = await fetch(contract.contract_pdf_url);
        if (!contractPdfRes.ok) throw new Error(`Failed to fetch contract PDF: ${contractPdfRes.status}`);
        const contractPdfBytes = await contractPdfRes.arrayBuffer();
        
        // Load the contract PDF to get page count
        const contractPdfDoc = await PDFDocument.load(contractPdfBytes);
        const contractPageCount = contractPdfDoc.getPageCount();
        console.log(`[generateDisputePDF] Contract PDF has ${contractPageCount} pages`);
        
        // Create final PDF that combines jsPDF + contract PDF pages
        const mainPdfBytes = doc.output('arraybuffer');
        const mainPdfDoc = await PDFDocument.load(mainPdfBytes);
        
        // Embed all pages from the contract PDF
        const embeddedPages = await mainPdfDoc.embedPages(contractPdfDoc.getPages());
        for (const page of embeddedPages) {
          const newPage = mainPdfDoc.addPage();
          const { width, height } = page.getSize ? page.getSize() : { width: 612, height: 792 };
          newPage.drawPage(page, { x: 0, y: 0, width, height });
        }
        
        // Convert back to arraybuffer
        const finalBytes = await mainPdfDoc.save();
        finalPdfDoc = { 
          output: () => new Uint8Array(finalBytes),
          _pdfBytes: finalBytes 
        };
        
        console.log(`[generateDisputePDF] Contract PDF embedded successfully (${contractPageCount} pages added)`);
      } catch (embedErr) {
        console.error(`[generateDisputePDF] Failed to embed contract PDF:`, embedErr.message);
        // Fallback: add text reference
        doc.addPage();
        doc.setTextColor(30, 30, 30);
        doc.setFillColor(30, 40, 80);
        doc.rect(0, 0, 216, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 15, 12);
        doc.text('SIGNED RENTAL CONTRACT', 201, 12, { align: 'right' });
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(10);
        y = 40;
        doc.text('⚠️ ERROR: Could not embed contract PDF', 15, y);
        y += 10;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Please attach SignNow contract separately: ${contract.contract_pdf_url.substring(0, 60)}...`, 20, y);
      }
    }

    // PAGE N+1: LETTER TO RENTER (FOR VIOLATIONS)
    if (isOaklandViolation) {
      doc.addPage();
      doc.setTextColor(30, 30, 30);
      doc.setFillColor(30, 40, 80);
      doc.rect(0, 0, 216, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 15, 12);
      doc.text('NOTICE TO RENTER', 201, 12, { align: 'right' });

      doc.setTextColor(30, 30, 30);
      y = 30;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const renterLetter = [
        `433 Buena Vista Ave Apt 116`,
        `Alameda, CA 94501`,
        ``,
        `${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        ``,
        `Dear ${contract?.renter_name || 'Renter'},`,
        ``,
        `You incurred a City of Oakland traffic violation during your rental period with us.`,
        ``,
        `Violation Details:`,
        `Date: ${toll.occurrence_date}`,
        `Location: ${toll.location || 'Unknown'}`,
        `Amount Due: $${(toll.amount || 0).toFixed(2)}`,
        `Ticket #: ${toll.transaction_id || 'N/A'}`,
        ``,
        `Per your signed rental agreement, you are responsible for all violations incurred during your rental period (${startDate} to ${endDate}).`,
        ``,
        `PAYMENT REQUIRED BY: ${dueDateStr}`,
        ``,
        `HOW TO PAY:`,
        `• Zelle: Send to abetterautorentals@gmail.com`,
        `• Venmo: @BetterAutoRentals`,
        `• Check: Make payable to BAR Better Auto Rentals LLC`,
        ``,
        `Failure to pay by the due date will result in collections action and may negatively affect your ability to rent with us in the future.`,
        ``,
        `If you have questions, contact us at abetterautorentals@gmail.com`,
        ``,
        `Sincerely,`,
        `BAR Better Auto Rentals LLC`,
      ].join('\n');

      const renterLetterLines = doc.splitTextToSize(renterLetter, 180);
      doc.text(renterLetterLines, 15, y);
    }

    // PAGE LAST: AFFIDAVIT OF NON-LIABILITY (FOR VIOLATIONS)
    if (isOaklandViolation) {
      doc.addPage();
      doc.setTextColor(30, 30, 30);
      doc.setFillColor(30, 40, 80);
      doc.rect(0, 0, 216, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 15, 12);
      doc.text('AFFIDAVIT OF NON-LIABILITY', 201, 12, { align: 'right' });

      doc.setTextColor(30, 30, 30);
      y = 30;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const affidavit = [
        `AFFIDAVIT OF NON-LIABILITY`,
        `City of Oakland`,
        ``,
        `TO THE HONORABLE TRAFFIC VIOLATIONS BUREAU:`,
        ``,
        `This affidavit is submitted to establish that the undersigned vehicle owner is not the operator of the vehicle cited in violation number ${toll.transaction_id || '___________'}.`,
        ``,
        `VEHICLE OWNER INFORMATION:`,
        `Name: Lizzeth`,
        `Company: BAR Better Auto Rentals LLC`,
        ``,
        `OPERATOR INFORMATION (Renter):`,
        `Name: ${contract?.renter_name || 'Rachel Lynn Wolosky'}`,
        `Address: 433 Buena Vista Ave Apt 116, Alameda, CA 94501`,
        ``,
        `RENTAL PERIOD:`,
        `Start Date: ${startDate}`,
        `End Date: ${endDate}`,
        ``,
        `VIOLATION DATE: ${toll.occurrence_date}`,
        `LICENSE PLATE: ${toll.license_plate}`,
        ``,
        `The vehicle was rented to the above-named operator during the period of the alleged violation. The operator held a valid signed rental agreement making them responsible for all traffic violations incurred during the rental period.`,
        ``,
        `Pursuant to California Vehicle Code Section 40255 and Oakland Municipal Code regulations, liability for traffic violations transfers to the renter when a vehicle is rented under a written agreement.`,
        ``,
        `I declare under penalty of perjury that the foregoing is true and correct.`,
        ``,
        ``,
        `SIGNATURE: _________________________  DATE: __________`,
        ``,
        `Print Name: Lizzeth`,
        `Title: Owner, BAR Better Auto Rentals LLC`,
      ].join('\n');

      const affidavitLines = doc.splitTextToSize(affidavit, 180);
      doc.text(affidavitLines, 15, y);
    }

    // FINAL PAGE: DISPUTE LETTER (FOR NON-VIOLATIONS)
    if (!isOaklandViolation) {
      doc.addPage();
      doc.setTextColor(30, 30, 30);
      doc.setFillColor(30, 40, 80);
      doc.rect(0, 0, 216, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 15, 12);
      doc.text('DISPUTE LETTER', 201, 12, { align: 'right' });

      doc.setTextColor(30, 30, 30);
      y = 28;

      const letterBody = [
        `To Whom It May Concern,`,
        ``,
        `We formally dispute liability for the toll notice(s) for vehicle ${toll.license_plate}.`,
        ``,
        `At the time of incurrence, this vehicle was under a signed rental agreement with ${contract?.renter_name || 'the identified renter'}.`,
        ``,
        `Per California Vehicle Code Section 40255, toll liability transfers to the renter when a vehicle is rented under a signed agreement.`,
        ``,
        `Rental Details:`,
        `Renter: ${contract?.renter_name || 'See attached contract'}`,
        `Period: ${startDate} to ${endDate}`,
        `Platform: ${contract?.platform || 'Direct'}`,
        `Reservation ID: ${contract?.reservation_id || 'See attached'}`,
        ``,
        `We request that liability be transferred to the renter or that the charge be waived.`,
        ``,
        `Please contact us at abetterautorentals@gmail.com`,
        ``,
        `Sincerely,`,
        `BAR Better Auto Rentals LLC`,
      ].join('\n');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const bodyLines = doc.splitTextToSize(letterBody, 180);
      doc.text(bodyLines, 15, y);
    }

    // Get final PDF bytes (either from jsPDF or PDFDocument merge)
    let pdfBytes;
    if (finalPdfDoc._pdfBytes) {
      pdfBytes = finalPdfDoc._pdfBytes;
    } else {
      pdfBytes = doc.output('arraybuffer');
    }
    
    const pdfSizeMB = (pdfBytes.byteLength / 1024 / 1024).toFixed(2);
    const pdfB64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const pdfDataUrl = `data:application/pdf;base64,${pdfB64}`;

    console.log(`[generateDisputePDF] PDF generated: ${pdfSizeMB}MB`);

    // Upload PDF to get a permanent URL for attachment/sharing
    let pdfUrl = null;
    try {
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBlob });
      pdfUrl = uploadRes.file_url;
      console.log(`[generateDisputePDF] PDF uploaded: ${pdfUrl}`);
    } catch (uploadErr) {
      console.error('[generateDisputePDF] PDF upload failed (non-critical):', uploadErr.message);
    }

    // Update toll status
    await base44.asServiceRole.entities.TollNotice.update(toll_id, { dispute_status: 'pdf_generated' });

    // Extract renter first name for personalized greeting
    const renterFullName = contract?.renter_name || '';
    const renterFirstName = renterFullName.split(' ')[0] || 'Renter';
    const vehicleDesc = [contract?.vehicle_year, contract?.vehicle_make, contract?.vehicle_model].filter(Boolean).join(' ') || toll.license_plate;
    const emailStartDate = contract?.start_date ? new Date(contract.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const emailEndDate = contract?.end_date ? new Date(contract.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const pdfLinkLine = pdfUrl ? `\n\nPDF Package (violation notice + rental contract): ${pdfUrl}` : '';

    // Prepare email data
    let recipientEmail = '';
    let emailSubject = '';
    let emailBody = '';

    if (isViolation) {
      recipientEmail = contract?.renter_email || '';
      emailSubject = `Notice of Violation — ${toll.license_plate} — $${(toll.amount || 0).toFixed(2)} Due`;
      emailBody = `Dear ${renterFullName || renterFirstName},

This notice is to inform you that during your rental of vehicle ${toll.license_plate}${vehicleDesc !== toll.license_plate ? ' (' + vehicleDesc + ')' : ''} from ${emailStartDate} to ${emailEndDate}, the following violation was incurred:

Violation: ${toll.agency || 'City Parking Violation'}
Location: ${toll.location || 'See attached notice'}
Date: ${toll.occurrence_date || 'N/A'}
Ticket #: ${toll.transaction_id || 'See attached notice'}
Amount Due: $${(toll.amount || 0).toFixed(2)}

Per your signed rental agreement, you are responsible for all fines, violations, and penalties incurred during your rental period.

Please remit payment of $${(toll.amount || 0).toFixed(2)} within 30 days via:
- Zelle: abetterautorentals@gmail.com
- Venmo: @abetterautorentals
- Check payable to: BAR Better Auto Rentals LLC

Failure to pay may result in collections and will affect your ability to rent with us in the future.

A copy of your signed rental contract and the violation notice are attached for your reference.${pdfLinkLine}

Sincerely,
BAR Better Auto Rentals LLC
abetterautorentals@gmail.com`;
    } else if (toll.is_non_fastrak) {
      recipientEmail = contract?.renter_email || '';
      emailSubject = `Toll Invoice — ${toll.license_plate} — $${(toll.amount || 0).toFixed(2)} Due`;
      emailBody = `Dear ${renterFirstName},

This is to notify you of a toll charge incurred during your rental of ${toll.license_plate}${vehicleDesc !== toll.license_plate ? ' (' + vehicleDesc + ')' : ''} from ${emailStartDate} to ${emailEndDate}.

Toll Agency: ${toll.agency || 'N/A'}
Location: ${toll.location || 'N/A'}
Date: ${toll.occurrence_date || 'N/A'}
Amount Due: $${(toll.amount || 0).toFixed(2)}

Per your rental agreement, you are responsible for all tolls incurred during your rental period.

Please remit payment within 30 days via:
- Zelle: abetterautorentals@gmail.com
- Venmo: @abetterautorentals
- Check payable to: BAR Better Auto Rentals LLC${pdfLinkLine}

Sincerely,
BAR Better Auto Rentals LLC
abetterautorentals@gmail.com`;
    } else {
      recipientEmail = 'disputes@bayareafastrak.org';
      emailSubject = `Toll Dispute — ${toll.license_plate} — Operator Identification`;
      emailBody = `To Whom It May Concern,

We dispute liability for toll notice dated ${toll.occurrence_date} for vehicle ${toll.license_plate}.

The vehicle was under a signed rental agreement at the time of occurrence. Per California Vehicle Code Section 40255, liability transfers to the renter.

Please find the complete dispute package attached.${pdfLinkLine}

Sincerely,
BAR Better Auto Rentals LLC
abetterautorentals@gmail.com`;
    }

    // Create Gmail draft with PDF attachment
    let draftCreated = false;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

      const boundary = 'fleettoll_' + Date.now();

      const emailParts = [
        `To: ${recipientEmail}`,
        `Subject: ${emailSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        emailBody,
        ``,
        `--${boundary}`,
        `Content-Type: application/pdf; name="Package_${toll.license_plate}_${toll.occurrence_date}.pdf"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="Package_${toll.license_plate}_${toll.occurrence_date}.pdf"`,
        ``,
        pdfB64,
        `--${boundary}--`,
      ];

      const rawEmail = emailParts.join('\r\n');
      const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw: encodedEmail } }),
      });

      if (draftRes.ok) {
        draftCreated = true;
        console.log(`[generateDisputePDF] Gmail draft created for ${recipientEmail}`);
      } else {
        const errText = await draftRes.text();
        console.error('[generateDisputePDF] Gmail draft failed:', draftRes.status, errText);
      }
    } catch (err) {
      console.error('[generateDisputePDF] Gmail draft creation failed:', err.message);
    }

    return Response.json({
      success: true,
      size_mb: pdfSizeMB,
      pdf_data_url: pdfDataUrl,
      pdf_url: pdfUrl,
      filename: `Package_${toll.license_plate}_${toll.occurrence_date}.pdf`,
      email_draft: {
        recipient: recipientEmail,
        subject: emailSubject,
        body: emailBody,
        draftCreated,
      },
      toll_id,
    });

  } catch (error) {
    console.error('[generateDisputePDF] Error:', error);
    return Response.json({ 
      error: error.message || 'Unknown error',
      toll_id 
    }, { status: 500 });
  }
});