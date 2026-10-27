import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const REPO = 'me/loeft-data';
const TOKEN = 'github_pat_test_123';

interface FakeRepo {
  file: { text: string; sha: string } | null;
  puts: { message: string; text: string }[];
}

const blobSha = (text: string) => {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
};

/** Falsk GitHub API i browseren: ét repo med én fil. */
async function fakeGitHub(page: Page, opts: { status?: number; isPublic?: boolean; initial?: string } = {}): Promise<FakeRepo> {
  const repo: FakeRepo = { file: opts.initial ? { text: opts.initial, sha: blobSha(opts.initial) } : null, puts: [] };
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    };
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    expect(req.headers()['authorization']).toBe(`Bearer ${TOKEN}`);
    if (opts.status) return json(opts.status, { message: 'nope' });
    const path = new URL(req.url()).pathname;
    if (path === `/repos/${REPO}`) return json(200, { private: !opts.isPublic, permissions: { push: true } });
    if (path === `/repos/${REPO}/contents/loeft-backup.json`) {
      if (req.method() === 'GET') {
        if (!repo.file) return json(404, { message: 'Not Found' });
        if ((req.headers()['accept'] ?? '').includes('raw')) return route.fulfill({ status: 200, headers: cors, body: repo.file.text });
        return json(200, { sha: repo.file.sha });
      }
      const body = JSON.parse(req.postData() ?? '{}') as { message: string; content: string; sha?: string };
      if (repo.file && body.sha !== repo.file.sha) return json(409, { message: 'conflict' });
      const text = Buffer.from(body.content, 'base64').toString('utf8');
      repo.file = { text, sha: blobSha(text) };
      repo.puts.push({ message: body.message, text });
      return json(201, { content: { sha: repo.file.sha } });
    }
    return json(404, { message: 'Not Found' });
  });
  return repo;
}

async function connect(page: Page) {
  await page.goto('./#/settings');
  const box = page.getByTestId('github-backup');
  await box.getByLabel('Repo').fill(REPO);
  await box.getByLabel('Adgangsnøgle').fill(TOKEN);
  await box.getByRole('button', { name: 'Forbind' }).click();
}

const finishedWorkouts = (repo: FakeRepo) =>
  repo.file ? (JSON.parse(repo.file.text) as { data: { workouts: { name: string }[] } }).data.workouts : [];

test('forbinder og sender backup, når en træning gemmes, men ikke for hvert sæt', async ({ page }) => {
  const repo = await fakeGitHub(page);
  await connect(page);
  await expect(page.getByTestId('github-backup')).toContainText('Alt er sendt');
  expect(repo.puts).toHaveLength(1);
  expect(finishedWorkouts(repo)).toHaveLength(0);

  await page.goto('./');
  await page.getByRole('button', { name: 'Start Push day' }).click();
  await page.getByTestId('exercise-card').first().getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await page.waitForTimeout(3500);
  expect(repo.puts).toHaveLength(1);

  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await expect(page.getByText('Træning gemt.')).toBeVisible();

  await expect.poll(() => repo.puts.length, { timeout: 15000 }).toBe(2);
  expect(repo.puts[1].message).toMatch(/^Backup: 1 træning/);
  expect(finishedWorkouts(repo).map((w) => w.name)).toEqual(['Push day']);
  for (const p of repo.puts) expect(p.text).not.toContain('github_pat_');

  // Ingen påmindelse om manuel backup, når den automatiske kører.
  await page.goto('./');
  await expect(page.getByText('Du har ikke taget en backup endnu.')).toHaveCount(0);
});

test('ny telefon: henter data fra repoet', async ({ page }) => {
  const now = Date.now();
  const backup = {
    app: 'loeft',
    schemaVersion: 1,
    exportedAt: now,
    data: {
      exercises: [
        { id: 'ex-flyes', name: 'Flyes', aliases: [], type: 'weight_reps', primaryMuscle: 'chest', secondaryMuscles: [], equipment: 'machine', isCustom: true },
      ],
      routines: [],
      workouts: [
        {
          id: 'w-old',
          name: 'Gammel træning',
          startedAt: now - 86400000,
          endedAt: now - 86400000 + 3600000,
          exerciseIds: ['ex-flyes'],
          exercises: [{ exerciseId: 'ex-flyes', restSec: 90, sets: [{ id: 's1', type: 'normal', kg: 85, reps: 5, done: true }] }],
        },
      ],
      settings: {},
    },
  };
  await fakeGitHub(page, { initial: JSON.stringify(backup) });
  await connect(page);
  await expect(page.getByRole('dialog')).toContainText('Repoet har 1 træning');
  await page.getByRole('button', { name: 'Hent mine data' }).click();
  await expect(page.getByTestId('github-backup')).toContainText('Sender til');
  await page.goto('./#/history');
  await expect(page.getByRole('link', { name: /Gammel træning/ })).toBeVisible();
});

test('afviser et offentligt repo og en forkert nøgle', async ({ page }) => {
  await fakeGitHub(page, { isPublic: true });
  await connect(page);
  await expect(page.getByRole('alert')).toContainText('Repoet er offentligt');

  await page.unrouteAll();
  await fakeGitHub(page, { status: 401 });
  await page.getByTestId('github-backup').getByRole('button', { name: 'Forbind' }).click();
  await expect(page.getByRole('alert')).toContainText('Nøglen virker ikke');
});

test('uden net venter backuppen og sendes, når nettet kommer igen', async ({ page, context }) => {
  const repo = await fakeGitHub(page);
  await connect(page);
  await expect(page.getByTestId('github-backup')).toContainText('Alt er sendt');

  await page.goto('./');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Start Pull day' }).click();
  await page.getByTestId('exercise-card').first().getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await expect(page.getByText('Træning gemt.')).toBeVisible();
  await page.waitForTimeout(3500);
  expect(repo.puts).toHaveLength(1);

  await context.setOffline(false);
  await expect.poll(() => repo.puts.length, { timeout: 15000 }).toBe(2);
  expect(finishedWorkouts(repo).map((w) => w.name)).toEqual(['Pull day']);
});
