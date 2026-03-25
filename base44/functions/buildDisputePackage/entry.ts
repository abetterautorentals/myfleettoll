import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { license_plate, renter_name, tenant_id } = await req.json();
    if (!license_plate) return Response.json({ error: 'license_plate required' }, { status: 400 });

    const plate = license_plate.toUpperCase().replace(/\s+/g, '');
    console.log(`[buildDisputePackage] Building package for plate ${plate}`);

    // 1. Fetch all matched tolls for this plate
    const allTolls = await base44.asServiceRole.entities.TollNotice.filter({ license_plate: plate });
    const tolls = allTolls.filter(t => t.match_status === 'matched' || t.matched_contract_id);

    if (tolls.length === 0) {
      return Response.json({ error: 'No matched tolls found for this plate' }, { status: 400 });
    }

    // 2. Fetch all unique contracts covering these tolls
    const contractIds = [...new Set(tolls.map(t => t.matched_contract_id).filter(Boolean))];
    const contracts = [];
    for (const cid of contractIds) {
      const found = await base44.asServiceRole.entities.RentalContract.filter({ id: cid });
      if (found[0]) contracts.push(found[0]);
    }

    // Sort contracts by start date
    contracts.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // 3. Map each toll to its covering contract
    const tollCoverage = tolls.map(toll => {
      const coveringContract = contracts.find(c => c.id === toll.matched_contract_id);
      const tollDate = new Date(toll.occurrence_date);
      const covered = coveringContract
        ? tollDate >= new Date(coveringContract.start_date) && tollDate <= new Date(coveringContract.end_date)
        : false;
      return { toll, contract: coveringContract, covered };
    });

    const totalAmount = tolls.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const coveredCount = tollCoverage.filter(tc => tc.covered).length;
    const uncoveredCount = tollCoverage.length - coveredCount;

    // Get renter name from first contract
    const renterDisplayName = renter_name || contracts[0]?.renter_name || 'Unknown Renter';
    const companyName = 'BAR Better Auto Rentals LLC';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ─── BUILD PDF ───
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true });

    // ── PAGE 1: COVER DISPUTE LETTER ──
    doc.setFillColor(30, 40, 80);
    doc.rect(0, 0, 216, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 15, 22);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('TOLL LIABILITY TRANSFER REQUEST', 15, 35);
    doc.setFontSize(10);
    doc.text(`Vehicle: ${plate}  |  ${today}`, 15, 44);

    doc.setTextColor(30, 30, 30);
    let y = 62;

    // Summary box
    doc.setFillColor(245, 247, 255);
    doc.rect(15, y - 4, 186, 32, 'F');
    doc.setDrawColor(30, 40, 80);
    doc.rect(15, y - 4, 186, 32, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PACKAGE SUMMARY', 20, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Tolls: ${tolls.length}  |  Total Amount: $${totalAmount.toFixed(2)}  |  Contracts: ${contracts.length}`, 20, y + 10);
    doc.text(`Renter: ${renterDisplayName}  |  Plate: ${plate}`, 20, y + 18);
    doc.text(`All Toll Dates Covered by Contract: ${uncoveredCount === 0 ? 'YES' : 'NO — ' + uncoveredCount + ' uncovered'}`, 20, y + 26);
    y += 40;

    // Letter body
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('To: Bay Area FasTrak Customer Service', 15, y);
    doc.text('CustomerService@BayAreaFasTrak.org', 15, y + 6);
    y += 18;

    doc.setFont('helvetica', 'normal');
    const letterBody = [
      `Re: Liability Transfer Request — Rental Vehicle ${plate} — ${tolls.length} Toll Transactions — $${totalAmount.toFixed(2)}`,
      '',
      `To Whom It May Concern,`,
      '',
      `We are formally requesting the transfer of toll liability for vehicle ${plate} to the renter identified below.`,
      `During the periods covered by the attached rental contracts, this vehicle was operated exclusively`,
      `by the renter ${renterDisplayName} under a signed rental agreement.`,
      '',
      `Per California Vehicle Code Section 40255, toll liability transfers to the renter when a vehicle`,
      `is operated under a written rental agreement. The attached signed contracts establish that`,
      `${renterDisplayName} was the responsible operator during all toll occurrence dates listed herein.`,
      '',
      `RENTAL SUMMARY:`,
      `  Renter: ${renterDisplayName}`,
      `  Vehicle: ${plate}`,
      `  Contracts attached: ${contracts.length}`,
      `  Toll transactions covered: ${coveredCount} of ${tolls.length}`,
      `  Total liability: $${totalAmount.toFixed(2)}`,
      '',
      `Please find attached:`,
      `  1. This dispute/transfer request letter`,
      `  2. Summary table of all toll transactions with contract coverage`,
      `  3. All ${contracts.length} signed rental contract(s) covering the relevant periods`,
      '',
      `We request that you transfer liability for the above charges to the renter or contact us`,
      `at abetterautorentals@gmail.com with any questions.`,
      '',
      `Sincerely,`,
      companyName,
      `abetterautorentals@gmail.com`,
    ].join('\n');

    const letterLines = doc.splitTextToSize(letterBody, 182);
    doc.text(letterLines, 15, y);

    // ── PAGE 2: TOLL SUMMARY TABLE ──
    doc.addPage();
    doc.setFillColor(30, 40, 80);
    doc.rect(0, 0, 216, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 15, 12);
    doc.text('TOLL TRANSACTIONS WITH CONTRACT COVERAGE', 201, 12, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    y = 26;

    // Table header
    doc.setFillColor(30, 40, 80);
    doc.rect(15, y, 186, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Ticket #', 17, y + 5.5);
    doc.text('Date', 50, y + 5.5);
    doc.text('Location', 75, y + 5.5);
    doc.text('Amount', 140, y + 5.5);
    doc.text('Contract Period', 158, y + 5.5);
    y += 10;

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    let rowAlt = false;

    // Sort tolls by date
    const sortedCoverage = [...tollCoverage].sort((a, b) => new Date(a.toll.occurrence_date) - new Date(b.toll.occurrence_date));

    for (const { toll: t, contract: c, covered } of sortedCoverage) {
      if (y > 258) {
        doc.addPage();
        doc.setFillColor(30, 40, 80);
        doc.rect(0, 0, 216, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TOLL TRANSACTIONS (continued)', 15, 12);
        doc.setTextColor(30, 30, 30);
        y = 26;
      }
      if (rowAlt) { doc.setFillColor(245, 247, 255); doc.rect(15, y - 3, 186, 8, 'F'); }
      rowAlt = !rowAlt;
      if (!covered) { doc.setFillColor(255, 235, 235); doc.rect(15, y - 3, 186, 8, 'F'); }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text((t.transaction_id || 'N/A').substring(0, 14), 17, y + 2);
      doc.text(t.occurrence_date || '', 50, y + 2);
      doc.text((t.location || 'N/A').substring(0, 22), 75, y + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${(t.amount || 0).toFixed(2)}`, 140, y + 2);
      doc.setFont('helvetica', 'normal');
      if (c) {
        const cStart = c.start_date ? new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
        const cEnd = c.end_date ? new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '?';
        doc.text(`${cStart}–${cEnd}`, 158, y + 2);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text('NO CONTRACT', 158, y + 2);
        doc.setTextColor(30, 30, 30);
      }
      y += 8;
    }

    // Total row
    doc.setFillColor(30, 40, 80);
    doc.rect(15, y + 2, 186, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL — ${tolls.length} transactions`, 17, y + 8);
    doc.text(`$${totalAmount.toFixed(2)}`, 140, y + 8);

    // ── PAGES N+: CONTRACTS ──
    for (let ci = 0; ci < contracts.length; ci++) {
      const c = contracts[ci];
      doc.addPage();
      doc.setFillColor(30, 40, 80);
      doc.rect(0, 0, 216, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 15, 12);
      doc.text(`RENTAL CONTRACT ${ci + 1} of ${contracts.length}`, 201, 12, { align: 'right' });
      doc.setTextColor(30, 30, 30);
      y = 28;

      const startStr = c.start_date ? new Date(c.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const endStr = c.end_date ? new Date(c.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

      // Contract box
      doc.setFillColor(245, 247, 255);
      doc.rect(15, y - 4, 186, 14, 'F');
      doc.setDrawColor(30, 40, 80);
      doc.rect(15, y - 4, 186, 14, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${c.renter_name || 'Unknown'} — ${c.license_plate || plate}`, 20, y + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${startStr}  →  ${endStr}`, 20, y + 9);
      y += 22;

      const fields = [
        ['Renter Name', c.renter_name],
        ['Email', c.renter_email],
        ['Phone', c.renter_phone],
        ['License Plate', c.license_plate],
        ['Vehicle', [c.vehicle_year, c.vehicle_make, c.vehicle_model, c.vehicle_color].filter(Boolean).join(' ')],
        ['Start Date', startStr],
        ['End Date', endStr],
        ['Platform', c.platform],
        ['Reservation ID', c.reservation_id],
        ['Signature Status', c.signature_status?.toUpperCase()],
        ['Insurance', c.insurance_company],
        ['Policy #', c.insurance_policy],
      ].filter(([, v]) => v);

      doc.setFontSize(9);
      for (const [label, val] of fields) {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(val || '').substring(0, 80), 65, y);
        y += 8;
      }

      y += 6;
      if (c.contract_pdf_url) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 80, 200);
        doc.text('Signed Contract PDF:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(c.contract_pdf_url.substring(0, 90), 20, y + 7);
        doc.setTextColor(30, 30, 30);
        y += 18;
      }

      // List tolls covered by this contract
      const thisTolls = tollCoverage.filter(tc => tc.contract?.id === c.id);
      if (thisTolls.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Tolls covered by this contract (${thisTolls.length}):`, 20, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        for (const { toll: t } of thisTolls) {
          if (y > 258) { doc.addPage(); y = 20; }
          doc.text(`• ${t.occurrence_date}  ${t.location || 'Unknown'}  $${(t.amount || 0).toFixed(2)}`, 25, y);
          y += 6;
        }
      }
    }

    // Finalize
    const pdfBytes = doc.output('arraybuffer');
    const pdfSizeMB = (pdfBytes.byteLength / 1024 / 1024).toFixed(2);
    const pdfB64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const pdfDataUrl = `data:application/pdf;base64,${pdfB64}`;

    // Upload PDF
    let pdfUrl = null;
    try {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const up = await base44.integrations.Core.UploadFile({ file: blob });
      pdfUrl = up.file_url;
    } catch (e) {
      console.error('[buildDisputePackage] upload failed:', e.message);
    }

    // Update all matched tolls to dispute_status = 'pdf_generated'
    for (const { toll: t } of tollCoverage) {
      await base44.asServiceRole.entities.TollNotice.update(t.id, { dispute_status: 'pdf_generated' });
    }

    // Build Gmail draft to FasTrak
    const emailSubject = `Liability Transfer Request — Rental Vehicle ${plate} — ${tolls.length} Toll Transactions`;
    const emailBody = `To: Bay Area FasTrak Customer Service

Re: Liability Transfer Request — Rental Vehicle ${plate} — ${tolls.length} Toll Transactions — $${totalAmount.toFixed(2)}

To Whom It May Concern,

We are formally requesting the transfer of toll liability for vehicle ${plate} to the renter identified below.

Renter: ${renterDisplayName}
Plate: ${plate}
Total Transactions: ${tolls.length}
Total Amount: $${totalAmount.toFixed(2)}
Contracts Attached: ${contracts.length}

Please find the complete dispute package attached, including all signed rental contracts and toll notices.

Per California Vehicle Code Section 40255, toll liability transfers to the renter when a vehicle is operated under a written rental agreement.

${pdfUrl ? 'PDF Package: ' + pdfUrl : ''}

Sincerely,
BAR Better Auto Rentals LLC
abetterautorentals@gmail.com`;

    let draftCreated = false;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const boundary = 'pkg_' + Date.now();
      const rawEmail = [
        `To: CustomerService@BayAreaFasTrak.org`,
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
        `Content-Type: application/pdf; name="DisputePackage_${plate}.pdf"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="DisputePackage_${plate}.pdf"`,
        ``,
        pdfB64,
        `--${boundary}--`,
      ].join('\r\n');

      const encoded = btoa(unescape(encodeURIComponent(rawEmail)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw: encoded } }),
      });
      draftCreated = draftRes.ok;
      if (!draftRes.ok) console.error('[buildDisputePackage] Gmail draft failed:', await draftRes.text());
    } catch (e) {
      console.error('[buildDisputePackage] Gmail error:', e.message);
    }

    return Response.json({
      success: true,
      plate,
      renter_name: renterDisplayName,
      toll_count: tolls.length,
      contract_count: contracts.length,
      covered_count: coveredCount,
      uncovered_count: uncoveredCount,
      total_amount: totalAmount,
      size_mb: pdfSizeMB,
      pdf_data_url: pdfDataUrl,
      pdf_url: pdfUrl,
      filename: `DisputePackage_${plate}.pdf`,
      draft_created: draftCreated,
      email_subject: emailSubject,
      contracts_summary: contracts.map(c => ({
        id: c.id,
        start: c.start_date,
        end: c.end_date,
        renter: c.renter_name,
        tolls_covered: tollCoverage.filter(tc => tc.contract?.id === c.id).length,
      })),
    });

  } catch (error) {
    console.error('[buildDisputePackage] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});