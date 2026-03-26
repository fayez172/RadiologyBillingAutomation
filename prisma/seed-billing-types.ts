import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const BILLING_TYPES = [
  { modalities: "CR, DX", name: "X-Ray_Single_View", display_name: "X-Ray Single View" },
  { modalities: "CR, DX", name: "X-Ray_B/V", display_name: "X-Ray Both View" },
  { modalities: "CR, DX", name: "X-Ray_Both_B/V", display_name: "X-Ray Both B/V" },
  { modalities: "CR, DX", name: "CR_Unknown", display_name: "CR Unknown" },
  { modalities: "CR, DX", name: "DX_Unknown", display_name: "DX Unknown" },
  { modalities: "CR, DX", name: "Contrast_X-Ray", display_name: "Contrast X-Ray" },
  { modalities: "CR, DX", name: "Bone_Age", display_name: "Bone Age" },
  { modalities: "CR, DX", name: "X-Ray_Whole_Spine", display_name: "X-Ray Whole Spine" },
  { modalities: "MG", name: "Mammography_Both_View", display_name: "Mammography Both View" },
  { modalities: "MG", name: "Mammography_Single_View", display_name: "Mammography Single View" },
  { modalities: "ECG", name: "ECG", display_name: "ECG" },
  { modalities: "ECG", name: "OPG", display_name: "OPG" },
  { modalities: "CT", name: "CT_Scan_Brain", display_name: "CT Scan Brain" },
  { modalities: "CT", name: "CT_Scan_U/A_Chest_&_others", display_name: "CT Scan U/A Chest & Others" },
  { modalities: "CT", name: "CT_Scan_W/A", display_name: "CT Scan W/A" },
  { modalities: "CT", name: "Chest+W/A", display_name: "Chest + W/A" },
  { modalities: "CT", name: "CT_Angiogram", display_name: "CT Angiogram" },
  { modalities: "CT", name: "CT_Angiogram+CT_Scan_Brain", display_name: "CT Angiogram + CT Scan Brain" },
  { modalities: "CT", name: "CT_Cisternography", display_name: "CT Cisternography" },
  { modalities: "CT", name: "CT_Unknown", display_name: "CT Unknown" },
  { modalities: "MR", name: "MRI_Brain/Lumbar/Cervical/Dorsal_spine", display_name: "MRI Brain/Lumbar/Cervical/Dorsal Spine" },
  { modalities: "MR", name: "MRI_Brain/spine_with_Screening_others_part", display_name: "MRI Brain/Spine with Screening" },
  { modalities: "MR", name: "MRI_Pelvis/Upper_Abdomen/Extremities", display_name: "MRI Pelvis/Upper Abdomen/Extremities" },
  { modalities: "MR", name: "MRI_Whole_Abdomen/KUB", display_name: "MRI Whole Abdomen/KUB" },
  { modalities: "MR", name: "MRI_Angiogram", display_name: "MRI Angiogram" },
  { modalities: "MR", name: "MRI_Angiogram*2", display_name: "MRI Angiogram ×2" },
  { modalities: "MR", name: "MRI_Whole_Spine", display_name: "MRI Whole Spine" },
  { modalities: "MR", name: "MRI_T2_Images", display_name: "MRI T2 Images" },
  { modalities: "MR", name: "MR_Unknown", display_name: "MR Unknown" },
  { modalities: "MR", name: "MRI_Cardiac", display_name: "MRI Cardiac" },
  { modalities: "CR,CT,MR", name: "BILL_OF_RSB", display_name: "Bill of RSB" },
  { modalities: "CR,CT,MR", name: "No_Bill", display_name: "No Bill" }
];

async function main() {
  console.log('🚀 Starting Billing Type and Mapping seed...');

  // 1. Seed Billing Types
  for (const type of BILLING_TYPES) {
    const isSpecial = ['BILL_OF_RSB', 'No_Bill'].includes(type.name);
    await prisma.billingType.upsert({
      where: { name: type.name },
      update: {
        display_name: type.display_name,
        modalities: type.modalities,
        is_billable: !isSpecial,
        default_hospital_price: 0, // Will be updated by user later or kept as 0
        default_radiologist_price: 0,
      },
      create: {
        name: type.name,
        display_name: type.display_name,
        modalities: type.modalities,
        is_billable: !isSpecial,
        default_hospital_price: 0,
        default_radiologist_price: 0,
      }
    });
  }
  console.log(`✅ Seeded ${BILLING_TYPES.length} Billing Types.`);

  // 2. Read Mapping.xlsx
  const filePath = path.join('c:', 'RadiologyBillingAutomation', 'Mapping.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  if (rows.length === 0) {
    console.log('⚠️ Mapping.xlsx is empty. Skipping mapping seed.');
    return;
  }

  // 3. Clear existing Mappings
  await prisma.mapping.deleteMany({});
  console.log('🗑️ Cleared existing mappings.');

  // 4. Import new mappings
  let count = 0;
  for (const row of rows) {
    const modality = String(row['Modality'] || '').trim().toUpperCase();
    const procedure = String(row['Procedure'] || '').trim();
    const type = String(row['Type'] || '').trim();
    const typeDr = String(row['TypeDR'] || '').trim();

    if (!modality || !procedure || !type) continue;

    try {
      await prisma.mapping.create({
        data: {
          modality,
          procedure_pattern: procedure,
          type,
          type_dr: typeDr || type,
          is_regex: procedure.includes('^') || procedure.includes('.*'),
          priority: 0,
          is_active: true,
        }
      });
      count++;
    } catch (err) {
      console.error(`❌ Failed to import row: ${modality} | ${procedure}`);
    }
  }

  console.log(`✅ Imported ${count} mappings from Mapping.xlsx.`);
  console.log('🏁 Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
