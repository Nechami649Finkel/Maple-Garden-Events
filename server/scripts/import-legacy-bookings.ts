/**
 * Import legacy bookings from Excel (.xlsx) or CSV.
 *
 * Expected columns (Hebrew or English):
 *   תאריך/date, משבצת/slot, סוג/type, שמות/names, טלפון/phone, אורחים/guests
 * Optional: אופציה/isOption (true/false/כן/לא), מחיר/price, ת.ז./idNumber
 *
 * Usage (from server/):
 *   npm run db:import-legacy -- --file ../data/legacy-2026.csv
 *   npm run db:import-legacy -- --file ../data/legacy.xlsx --dry-run
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { allocateEventCode, initOrderSequence } from '../src/utils/eventCode';
import { parseCalendarDate, calendarDateForStorage, toCalendarDateKey, prismaCalendarDayWhere } from '../src/utils/dateLocal';
import { formatStoredTimeOfDay, normalizeTimeSlot, type TimeSlot } from '../src/utils/timeSlot';

dotenv.config();

type Row = Record<string, string>;

const HEADER_MAP: Record<string, string> = {
  תאריך: 'date',
  date: 'date',
  משבצת: 'slot',
  slot: 'slot',
  timeslot: 'slot',
  סוג: 'type',
  type: 'type',
  eventtype: 'type',
  שמות: 'names',
  names: 'names',
  name: 'names',
  טלפון: 'phone',
  phone: 'phone',
  אורחים: 'guests',
  guests: 'guests',
  guestcount: 'guests',
  אופציה: 'isOption',
  isoption: 'isOption',
  option: 'isOption',
  מחיר: 'price',
  price: 'price',
  totalprice: 'price',
  'ת.ז.': 'idNumber',
  idnumber: 'idNumber',
  id: 'idNumber',
};

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, '');
  return HEADER_MAP[h.trim()] || HEADER_MAP[key] || key;
}

function parseCsv(content: string): Row[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }

  return rows;
}

function parseXlsx(filePath: string): Row[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return raw.map((r) => {
    const row: Row = {};
    for (const [k, v] of Object.entries(r)) {
      row[normalizeHeader(String(k))] = String(v ?? '').trim();
    }
    return row;
  });
}

function parseBool(value: string | undefined): boolean {
  const v = (value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'כן' || v === 'אופציה';
}

function parseSlot(raw: string): TimeSlot {
  const slot = normalizeTimeSlot(raw) || normalizeTimeSlot(null, raw);
  return slot || 'evening';
}

function parseDate(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseCalendarDate(trimmed);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    return parseCalendarDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  return parseCalendarDate(
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`,
  );
}

async function ensureEventDate(date: Date, isOption: boolean) {
  const key = toCalendarDateKey(date);
  const storageDate = calendarDateForStorage(key);
  let eventDate = await prisma.eventDate.findFirst({
    where: prismaCalendarDayWhere(key),
  });

  if (!eventDate) {
    eventDate = await prisma.eventDate.create({
      data: {
        date: storageDate,
        status: isOption ? 'OPTION' : 'BOOKED',
      },
    });
  }

  return eventDate;
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice(7)
    || process.argv[process.argv.indexOf('--file') + 1];
  const dryRun = process.argv.includes('--dry-run');

  if (!fileArg) {
    console.error('❌ Usage: npm run db:import-legacy -- --file <path.csv|xlsx> [--dry-run]');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing.');
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  const rows = ext === '.xlsx' || ext === '.xls'
    ? parseXlsx(filePath)
    : parseCsv(fs.readFileSync(filePath, 'utf8'));

  if (rows.length === 0) {
    console.log('No rows to import.');
    return;
  }

  console.log(dryRun ? '🔍 Dry run' : '📥 Importing legacy bookings...');
  console.log(`Found ${rows.length} row(s)\n`);

  if (!dryRun) await initOrderSequence();

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const dateRaw = row.date;
      const names = row.names;
      if (!dateRaw || !names) {
        skipped++;
        errors.push({ row: rowNum, message: 'חסר תאריך או שמות' });
        continue;
      }

      const eventDate = parseDate(dateRaw);
      const slot = parseSlot(row.slot || 'ערב');
      const isOption = parseBool(row.isOption);
      const guestCount = Math.max(1, parseInt(row.guests || '100', 10) || 100);
      const totalPrice = parseFloat(row.price || '0') || 0;
      const pricePerPortion = guestCount > 0 ? totalPrice / guestCount : 0;

      const ed = await ensureEventDate(eventDate, isOption);

      const existing = await prisma.booking.findFirst({
        where: { calendarDateId: ed.id, timeSlot: slot },
      });
      if (existing) {
        skipped++;
        errors.push({ row: rowNum, message: `כפילות: ${dateRaw} ${slot} (${existing.clientAFullName})` });
        continue;
      }

      const eventCode = dryRun ? `DRY-${rowNum}` : await allocateEventCode(isOption ? 'OPT' : 'EVT');

      const data = {
        clientAFullName: names,
        clientAIdNumber: row.idNumber || '000000000',
        clientAPhone: row.phone || '050-0000000',
        calendarDateId: ed.id,
        eventType: row.type || 'חתונה',
        timeOfDay: formatStoredTimeOfDay(slot),
        timeSlot: slot,
        guestCount,
        finalPricePortion: pricePerPortion,
        totalPrice,
        eventCode,
        createdBy: 'import-legacy',
        isOption,
      };

      if (dryRun) {
        console.log(`  [dry] ${dateRaw} | ${slot} | ${names} | ${eventCode}`);
      } else {
        await prisma.booking.create({ data });
        if (!isOption) {
          await prisma.eventDate.update({
            where: { id: ed.id },
            data: { status: 'BOOKED', clientName: names, clientPhone: row.phone || null },
          });
        }
        console.log(`  ✅ ${dateRaw} | ${slot} | ${names} → ${eventCode}`);
      }

      imported++;
    } catch (err) {
      skipped++;
      errors.push({ row: rowNum, message: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped:  ${skipped}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) {
      console.log(`  Row ${e.row}: ${e.message}`);
    }
    if (!dryRun && imported === 0) process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
