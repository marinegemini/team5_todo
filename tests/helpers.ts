import { expect, type Page } from '@playwright/test';

export async function setupVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { client, authenticatorId };
}

export async function registerUser(page: Page, username: string) {
  await setupVirtualAuthenticator(page);
  await page.goto('/login');
  await page.fill('#username', username);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL('/');
}

export async function createTodo(
  page: Page,
  options: {
    title: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string;
    isRecurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminderMinutes?: number;
  }
) {
  await page.getByPlaceholder('What needs to be done?').fill(options.title);
  if (options.priority) {
    await page.getByLabel('Priority', { exact: true }).selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.getByLabel('Due date').fill(options.dueDate);
  }
  if (options.isRecurring) {
    await page.getByLabel('Repeat').check();
    if (options.recurrencePattern) {
      await page.getByLabel('Recurrence pattern').selectOption(options.recurrencePattern);
    }
  }
  if (options.reminderMinutes) {
    await page.getByLabel('Reminder').selectOption(String(options.reminderMinutes));
  }
  await page.locator('form').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(options.title)).toBeVisible();
}

export async function addSubtask(page: Page, todoTitle: string, subtaskTitle: string) {
  const todoCard = page.locator('li', { hasText: todoTitle });
  const toggleBtn = todoCard.getByRole('button', { name: /Subtasks/ });
  if ((await toggleBtn.textContent())?.includes('▶')) {
    await toggleBtn.click();
  }
  await todoCard.getByPlaceholder('Add subtask...').fill(subtaskTitle);
  await todoCard.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(todoCard.getByText(subtaskTitle)).toBeVisible();
}

export async function createTag(page: Page, name: string, color = '#3B82F6') {
  await page.getByRole('button', { name: '+ Manage Tags' }).click();
  await page.getByPlaceholder('Tag name').fill(name);
  await page.getByLabel('Tag color').fill(color);
  await page.getByRole('button', { name: 'Create Tag' }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
}
