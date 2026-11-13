import { expect, test } from '@playwright/test';
import { addSubtask, createTag, createTodo, registerUser } from './helpers';

test.describe('Todo App E2E Suite (PRPs 01-11)', () => {
  test('unauthenticated users are redirected to /login for / and /calendar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('full user journey: WebAuthn register, CRUD, Priority, Recurring, Reminders, Subtasks, Tags, Search/Filter, Templates, Export/Import, Calendar', async ({
    page,
  }) => {
    const username = `e2e_user_${Date.now()}`;

    // 1. Register via Virtual WebAuthn Authenticator (PRP 11)
    await registerUser(page, username);
    await expect(page.getByRole('heading', { name: /Todo App/ })).toBeVisible();

    // 2. Todo CRUD + Priority (PRP 01 & PRP 02)
    await createTodo(page, { title: 'Low priority task', priority: 'low' });
    await createTodo(page, {
      title: 'High priority meeting',
      priority: 'high',
      dueDate: '2026-11-20T14:00',
      isRecurring: true,
      recurrencePattern: 'weekly',
      reminderMinutes: 60,
    });

    // Verify Priority + Recurrence + Reminder badges
    const highCard = page.locator('li', { hasText: 'High priority meeting' });
    await expect(highCard.getByText('High', { exact: true })).toBeVisible();
    await expect(highCard.getByText('🔄 weekly')).toBeVisible();
    await expect(highCard.getByText('🔔 1h')).toBeVisible();

    // Verify High priority appears before Low priority in Pending
    const pendingItems = page.locator('section', { hasText: 'Pending' }).locator('li');
    await expect(pendingItems.nth(0)).toContainText('High priority meeting');
    await expect(pendingItems.nth(1)).toContainText('Low priority task');

    // 3. Subtasks & Progress (PRP 05)
    await addSubtask(page, 'Low priority task', 'First step');
    await addSubtask(page, 'Low priority task', 'Second step');
    const lowCard = page.locator('li', { hasText: 'Low priority task' });
    await expect(lowCard.getByText('0/2 subtasks')).toBeVisible();
    await lowCard.locator('input[type="checkbox"]').nth(1).check();
    await expect(lowCard.getByText('1/2 subtasks')).toBeVisible();
    await expect(lowCard.getByText('50%')).toBeVisible();

    // 4. Recurring completion spawns next instance (PRP 03)
    await page
      .locator('section', { hasText: 'Pending' })
      .locator('li', { hasText: 'High priority meeting' })
      .first()
      .locator('input[type="checkbox"]')
      .first()
      .click();
    await expect(page.locator('section', { hasText: 'Completed' })).toContainText(
      'High priority meeting'
    );
    await expect(page.locator('section', { hasText: 'Pending' })).toContainText(
      'High priority meeting'
    );

    // 5. Tag System (PRP 06)
    await createTag(page, 'Work', '#3B82F6');
    await page.locator('form').getByRole('button', { name: 'Work' }).click();
    await createTodo(page, { title: 'Tagged work task', priority: 'medium' });
    const taggedCard = page.locator('li', { hasText: 'Tagged work task' });
    await expect(taggedCard.getByRole('button', { name: 'Work' })).toBeVisible();

    // 6. Search & Filtering (PRP 08)
    await page.getByPlaceholder('Search todos and subtasks...').fill('First step');
    await expect(page.getByText('Low priority task')).toBeVisible();
    await expect(page.getByText('Tagged work task')).not.toBeVisible();
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByText('Tagged work task')).toBeVisible();

    // 7. Template System (PRP 07)
    await page.getByPlaceholder('What needs to be done?').fill('Weekly Sync');
    await page.getByRole('button', { name: '💾 Save as Template' }).click();
    await page.getByPlaceholder('Template name').fill('Sync Template');
    await page.getByRole('button', { name: 'Save Template' }).click();
    await page.getByPlaceholder('What needs to be done?').fill('');
    await page.getByLabel('Use Template').selectOption({ label: 'Sync Template' });
    await expect(page.getByText('Weekly Sync')).toBeVisible();

    // 8. Export JSON & CSV API check (PRP 09)
    const jsonRes = await page.request.get('/api/todos/export?format=json');
    expect(jsonRes.ok()).toBe(true);
    const exported = await jsonRes.json();
    expect(exported.version).toBe(1);
    expect(exported.todos.length).toBeGreaterThanOrEqual(3);

    const csvRes = await page.request.get('/api/todos/export?format=csv');
    expect(csvRes.ok()).toBe(true);
    expect(await csvRes.text()).toContain('ID,Title,Completed,Due Date,Priority');

    // 9. Calendar View (PRP 10)
    await page.getByRole('link', { name: /Calendar/ }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await page.goto('/calendar?month=2026-11');
    await expect(page.getByText('November 2026')).toBeVisible();
    await expect(page.getByText('Deepavali')).toBeVisible(); // Seeded 2026-11-08 holiday
    await page.locator('[data-date="2026-11-20"]').click();
    await expect(page.getByRole('heading', { name: '2026-11-20' })).toBeVisible();
    await page.getByRole('button', { name: '✕' }).click();

    // 10. Logout (PRP 11)
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

