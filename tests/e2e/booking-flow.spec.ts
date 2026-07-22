import { test, expect } from '@playwright/test';

/**
 * Golden Path — Calendar → BookingForm → Submit
 *
 * TODO: Replace placeholder selectors with real data-testid / role selectors
 * after you add them to Calendar.tsx and BookingForm.tsx.
 */
test.describe('Booking golden path', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Replace with your auth helper (Google OAuth mock, test cookie, or bypass route).
    // await loginAsTestUser(page);
    await page.goto('/calendar');
  });

  test('navigates from calendar to booking form', async ({ page }) => {
    // TODO: selector — available calendar day cell (not blocked/booked)
    const availableDay = page.locator('[data-testid="calendar-day-available"]').first();
    await expect(availableDay).toBeVisible();
    await availableDay.click();

    // TODO: selector — confirm/open booking action if a popup appears first
    const openBookingButton = page.locator('[data-testid="open-booking-form"]');
    if (await openBookingButton.isVisible()) {
      await openBookingButton.click();
    }

    await expect(page).toHaveURL(/\/booking/);
    // TODO: selector — booking form root container
    await expect(page.locator('[data-testid="booking-form"]')).toBeVisible();
  });

  test('submits a new booking event', async ({ page }) => {
    // --- Step 1: Open calendar and pick a date ---
    await page.goto('/calendar');
    // TODO: selector — pick a specific open date
    await page.locator('[data-testid="calendar-day-available"]').first().click();
    // TODO: selector — optional popup confirm
    await page.locator('[data-testid="open-booking-form"]').click({ timeout: 5_000 }).catch(() => {});

    // --- Step 2: Fill required booking fields ---
    // TODO: selector — client A full name
    await page.locator('[data-testid="client-a-name"]').fill('ישראל ישראלי');
    // TODO: selector — client A ID number
    await page.locator('[data-testid="client-a-id"]').fill('123456789');
    // TODO: selector — event type dropdown
    await page.locator('[data-testid="event-type"]').selectOption('חתונה');
    // TODO: selector — time of day (morning / noon / evening)
    await page.locator('[data-testid="time-of-day-evening"]').click();
    // TODO: selector — guest count
    await page.locator('[data-testid="guest-count"]').fill('300');

    // --- Step 3: Submit ---
    // TODO: selector — submit / save booking button
    await page.locator('[data-testid="submit-booking"]').click();

    // --- Step 4: Assert success ---
    // TODO: selector — success toast, redirect, or confirmation modal
    await expect(page.locator('[data-testid="booking-success"]')).toBeVisible({ timeout: 15_000 });
  });
});
