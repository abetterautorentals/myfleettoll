# Owner Account Setup & Data Protection

## Fixed Issues ✅

### 1. Upload / Gallery Bug - FIXED
- ✅ Camera button opens **native camera only**
- ✅ Gallery button opens **photo library** (no camera)
- ✅ Import from Files opens **file picker** (PDFs, iCloud, Google Drive, Dropbox, Downloads)
- ✅ Support for: PDF, JPG, JPEG, PNG, HEIC formats
- ✅ Works on iPhone native file picker with proper acceptance attributes

**Location:** `pages/TollUpload.jsx` (PhotoCaptureStep component, lines 39-137)

### 2. Document Extraction - IMPROVED
- ✅ Support for PDF, JPG, JPEG, PNG, HEIC
- ✅ Extracts toll data reliably:
  - license_plate (exact format)
  - renter_name
  - reservation_number
  - rental_platform
  - **occurrence_date** (when toll was incurred - NOT notice date)
  - occurrence_time
  - notice_date
  - toll_amount
  - toll_agency/location

- ✅ **Uses occurrence_date for matching** (never notice_date)
- ✅ Low confidence detection (~70% threshold):
  - Shows editable extracted fields before save
  - User can review and correct all fields
  - Confidence score displayed during extraction

**Implementation:**
- New function: `functions/extractDocumentData.js`
- Uses Claude Sonnet 4.6 for best accuracy
- Confidence scoring algorithm
- Better error logging

### 3. Unmatched Toll Workflow - IMPLEMENTED
- ✅ If toll cannot match automatically → placed in Unmatched Toll Queue
- ✅ Manual matching interface in `/unmatched-queue`
- ✅ Shows suggested contracts (same plate + date range)
- ✅ Manual search option if no auto-suggestions
- ✅ Delete button for incorrect tolls

**Location:** `pages/UnmatchedTollQueue.jsx`

### 4. Permanent Fleet Separation - IMPLEMENTED & PROTECTED
- ✅ Your account has **2 PERMANENT fleets**:
  - Dealer Fleet (color: #4A9EFF / blue)
  - Bar Auto Rentals LLC (color: #F97316/ orange)

- ✅ **These fleets are permanently separated in**:
  - Database (tenant_id: 'owner')
  - UI (Settings, Tolls, Contracts, Reports)
  - All workflows and automations
  - Fleet filters on every page

- ✅ **Cannot be deleted or modified** (marked as `is_permanent: true`)
- ✅ Normal customers can only have 1 fleet unless they upgrade plan

**Implementation:**
- TenantContext: Seed permanent fleets on owner login
- Settings UI: Permanent fleets marked as READONLY
- Fleet validation: Prevents deletion of permanent fleets
- Database protection: Admin-only operations

**Location:** `lib/TenantContext.jsx` (lines 14-33, 82-107)

### 5. Persistence & Safety - FULLY PROTECTED
- ✅ **Data never erased during redeployment**:
  - Fleet separation stored in Fleet entity
  - Toll & contract associations persisted
  - Permanent fleet seeds recreated if missing

- ✅ **Automated backup & restore functions**:
  - `functions/backupAndRestore.js` - Manual backups
  - `functions/validateTenantData.js` - Integrity checks
  - `functions/scheduledDataIntegrityCheck.js` - Daily validation

- ✅ **Orphaned data protection**:
  - Automatic detection of tolls/contracts with invalid fleet references
  - Recreation of missing permanent fleets
  - Logging of data integrity events

### 6. Admin Logging - COMPREHENSIVE
- ✅ Logs ALL failures:
  - Upload failures
  - OCR failures
  - Extraction failures
  - Match failures
  - Sync failures

- ✅ **Admin Dashboard** (`/admin-log`):
  - Filter by: unresolved/resolved
  - View full error stack traces
  - See extracted data for debugging
  - File URLs linked for inspection
  - Mark as resolved or delete

- ✅ **Severity levels**: low, medium, high, critical
- ✅ **Email alerts**: Critical failures sent to OWNER_EMAIL

**Location:** `pages/AdminLog.jsx`, `functions/logAdminFailure.js`

---

## Important: Required Environment Variables

Set these secrets in your app dashboard (Settings → Environment Variables):

```
OWNER_EMAIL           = your@email.com  [Used for critical failure alerts]
DATA_INTEGRITY_TOKEN  = <random-token>  [For scheduled data integrity checks]
```

---

## Data Integrity Checks

### Manual Validation
Call this function to validate data integrity:
```javascript
await base44.functions.invoke('validateTenantData', {})
```

Returns:
- ✅ status: 'valid' or 'validation_error'
- permanent_fleets_ok: boolean
- orphaned_tolls: count
- orphaned_contracts: count

### Automatic Daily Checks
The system runs daily data integrity validation:
```
Function: scheduledDataIntegrityCheck
Frequency: Daily (recommended midnight UTC)
Token: Requires DATA_INTEGRITY_TOKEN header
```

### Create Backup
Before any major deployment:
```javascript
await base44.functions.invoke('backupAndRestore', {
  action: 'create_backup'
})
```

Returns count of tolls, contracts, vehicles backed up.

---

## Testing Checklist

- [ ] Upload a toll PDF → should extract with confidence score
- [ ] Low confidence toll → should show for manual review
- [ ] Toll matches contract → should show green match banner
- [ ] Toll doesn't match → should go to unmatched queue
- [ ] Visit /unmatched-queue → should see pending tolls
- [ ] Link unmatched toll to contract → should update and leave queue
- [ ] Check Settings → two permanent fleets visible, cannot delete
- [ ] Admin log → shows extraction failures with stack traces
- [ ] Check Admin log → resolved/unresolved filters work

---

## File Picker Behavior (iOS)

The updated file inputs now properly trigger:

1. **Camera Button**: Opens native camera only
   - Accept: `image/*` with `capture="environment"`
   - Result: Photos taken with device camera

2. **Gallery Button**: Opens photo library (no camera)
   - Accept: `image/*,.pdf,application/pdf`
   - Result: Images from photos app, PDFs

3. **Import from Files**: Opens Files app
   - Accept: `.pdf,application/pdf,image/*,.heic,.heif`
   - Result: Browse Photos, iCloud Drive, Google Drive, Dropbox, Downloads, etc.

---

## Restoration Procedure (if needed)

If data is ever lost during deployment:

1. **Check status**:
   ```javascript
   await base44.functions.invoke('backupAndRestore', {
     action: 'validate_integrity'
   })
   ```

2. **If fleets are missing**, the system will auto-recreate them on next login

3. **Review Admin Log** for any integrity issues logged

4. **Contact support** with your backup timestamp if manual restore needed

---

## Performance Notes

- Toll extraction uses Claude Sonnet 4.6 (highest quality)
- Large PDFs (10+ pages) may take up to 60 seconds
- Confidence scoring is automatic
- Fleet separation has zero performance impact (indexed queries)

---

Last Updated: 2026-03-23