import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, i: number) => page.getByTestId('exercise-card').nth(i);

test('logger Push day, overlever genindlæsning og gemmer', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Træn' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Push day' }).click();
  await expect(page).toHaveURL(/#\/workout$/);

  // Topsættet fra rutinen står som placeholder, og ét tryk logger det.
  const first = card(page, 0);
  await expect(first).toContainText('HS Plate Loaded Shoulder Press');
  await expect(first.getByLabel('Vægt i kg, sæt 1')).toHaveAttribute('placeholder', '55');
  await expect(first.getByLabel('Reps, sæt 1')).toHaveAttribute('placeholder', '5');
  await first.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await expect(first.getByLabel('Vægt i kg, sæt 1')).toHaveValue('55');
  await expect(page.getByRole('timer')).toBeVisible();

  // Komma som decimaltegn.
  const second = card(page, 1);
  await second.getByLabel('Vægt i kg, sæt 1').fill('62,5');
  await second.getByLabel('Reps, sæt 1').fill('8');
  await second.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await expect(second.getByTestId('set-row').first()).toHaveAttribute('data-done', 'true');

  // Opvarmningssæt via menuen.
  await first.getByRole('button', { name: /Flere valg for/ }).click();
  await page.getByRole('button', { name: 'Tilføj opvarmningssæt' }).click();
  await expect(first.getByRole('button', { name: /Sæt O, Opvarmning/ })).toBeVisible();

  // Genindlæs midt i træningen: alt er der stadig, også pausetimeren.
  await page.reload();
  await expect(card(page, 1).getByLabel('Vægt i kg, sæt 1')).toHaveValue('62,5');
  await expect(page.getByRole('timer')).toBeVisible();

  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await expect(page.getByRole('dialog', { name: 'Afslut træning' })).toBeVisible();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await page.getByRole('button', { name: 'Opdatér rutine' }).click();
  await expect(page.getByText('Træning gemt.')).toBeVisible();
  await expect(page.getByText('62,5 x 8')).toBeVisible();

  // Rutinen er opdateret, men har stadig alle 11 øvelser.
  await page.goto('./#/routines/routine-push');
  await expect(page.getByRole('listitem').filter({ hasText: 'Neutral Grip Shoulder Press' })).toContainText('62,5 kg x 8');
  await expect(page.locator('ol > li')).toHaveCount(11);

  // Anden træning: "Forrige" viser sidste gang, og en tungere vægt giver rekord.
  await page.getByRole('button', { name: 'Start rutine' }).click();
  const again = card(page, 1);
  await expect(again.getByTestId('set-row').first()).toContainText('62,5 x 8');
  await again.getByLabel('Vægt i kg, sæt 1').fill('65');
  await again.getByLabel('Reps, sæt 1').fill('8');
  await again.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await expect(again.getByLabel(/Tungeste vægt/)).toBeVisible();

  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await expect(page.getByText('1 ny rekord')).toBeVisible();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await page.getByRole('button', { name: 'Behold rutinen' }).click();

  await page.getByRole('link', { name: 'Historik' }).click();
  await expect(page.getByRole('link', { name: /Push day/ })).toHaveCount(2);
});

test('en rettet værdi overlever et hurtigt tryk på ✓ og på Afslut', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Start Push day' }).click();
  const first = card(page, 0);
  await expect(first.getByLabel('Reps, sæt 1')).toHaveAttribute('placeholder', '5');
  // Skriv og tryk ✓ med det samme, uden at forlade feltet først.
  await first.getByLabel('Reps, sæt 1').fill('6');
  await first.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await expect(first.getByTestId('set-row').first()).toHaveAttribute('data-done', 'true');
  await expect(first.getByLabel('Reps, sæt 1')).toHaveValue('6');
  await expect(first.getByLabel('Vægt i kg, sæt 1')).toHaveValue('55');

  // Ret et færdigt sæt og tryk Afslut med det samme.
  await first.getByLabel('Vægt i kg, sæt 1').fill('56');
  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await expect(page.getByText('Træning gemt.')).toBeVisible();
  await expect(page.getByText('56 x 6')).toBeVisible();
});

test('maskine optaget: springes over og sidste data vises næste gang', async ({ page }) => {
  const finish = async () => {
    await page.getByRole('button', { name: 'Afslut', exact: true }).click();
    await page.getByRole('button', { name: 'Fjern dem' }).click();
    await page.getByRole('button', { name: 'Gem træning' }).click();
    await expect(page.getByText('Træning gemt.')).toBeVisible();
  };

  // 1. træning: Neutral Grip Shoulder Press logges med 62,5 x 8.
  await page.goto('./');
  await page.getByRole('button', { name: 'Start Push day' }).click();
  const neutral = page.getByTestId('exercise-card').filter({ hasText: 'Neutral Grip Shoulder Press' });
  await neutral.getByLabel('Vægt i kg, sæt 1').fill('62,5');
  await neutral.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await finish();
  await page.getByRole('button', { name: 'Behold rutinen' }).click();

  // 2. træning: maskinen er optaget.
  await page.goto('./');
  await page.getByRole('button', { name: 'Start Push day' }).click();
  await card(page, 0).getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  const n2 = page.getByTestId('exercise-card').filter({ hasText: 'Neutral Grip Shoulder Press' });
  await n2.getByRole('button', { name: /Flere valg for/ }).click();
  await page.getByRole('button', { name: 'Maskine optaget' }).click();
  // Kortet lægger sig nederst, foldet sammen, og viser sidste data.
  const last = page.getByTestId('exercise-card').last();
  await expect(last).toContainText('Neutral Grip Shoulder Press');
  await expect(last).toContainText('Maskine optaget');
  await expect(last).toContainText('62,5 x 8');
  // Afslut: den sprungne øvelse tælles ikke med som ufærdige sæt.
  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('9 sæt er ikke markeret som færdige');
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await expect(page.getByRole('dialog', { name: 'Afslut træning' })).toContainText('Maskine optaget: Neutral Grip Shoulder Press');
  await page.getByRole('button', { name: 'Gem træning' }).click();
  await expect(page.getByText('Træning gemt.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opdatér rutine' })).toHaveCount(0);

  // 3. træning: "Forrige" viser stadig 62,5 x 8.
  await page.goto('./');
  await page.getByRole('button', { name: 'Start Push day' }).click();
  const n3 = page.getByTestId('exercise-card').filter({ hasText: 'Neutral Grip Shoulder Press' });
  await expect(n3.getByTestId('set-row').first()).toContainText('62,5 x 8');
});

test('tom træning, egen øvelse og sletning med fortryd', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await page.getByRole('button', { name: 'Tilføj øvelse' }).click();
  await page.getByLabel('Søg i øvelser').fill('bænkpres');
  await page.getByRole('button', { name: /^Bench Press \(Barbell\)/ }).click();
  await page.getByRole('button', { name: 'Tilføj 1 øvelse' }).click();

  const c = card(page, 0);
  await c.getByLabel('Vægt i kg, sæt 1').fill('80');
  await c.getByLabel('Reps, sæt 1').fill('5');
  await c.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await c.getByRole('button', { name: 'Tilføj sæt' }).click();
  await expect(c.getByLabel('Vægt i kg, sæt 2')).toHaveAttribute('placeholder', '80');

  // Slet via sættype-menuen og fortryd.
  await c.getByRole('button', { name: /Sæt 2, Normalt sæt/ }).click();
  await page.getByRole('button', { name: 'Slet sæt' }).click();
  await expect(c.getByTestId('set-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fortryd', exact: true }).click();
  await expect(c.getByTestId('set-row')).toHaveCount(2);

  // Ét tryk mangler reps uden placeholder: fokus flyttes til feltet i stedet.
  await page.getByRole('button', { name: 'Tilføj øvelse' }).click();
  await page.getByLabel('Søg i øvelser').fill('Min maskine');
  await page.getByRole('button', { name: 'Opret "Min maskine"' }).click();
  await page.getByRole('button', { name: 'Opret og vælg' }).click();
  await page.getByRole('button', { name: 'Tilføj 1 øvelse' }).click();
  const mine = card(page, 1);
  await expect(mine).toContainText('Min maskine');
  await mine.getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await expect(mine.getByLabel('Vægt i kg, sæt 1')).toBeFocused();

  await page.getByRole('button', { name: 'Kassér træning' }).click();
  await page.getByRole('button', { name: 'Kassér træning' }).last().click();
  await expect(page.getByRole('button', { name: 'Start tom træning' })).toBeVisible();
});

test('rutine: ret et mål og gem med det samme', async ({ page }) => {
  await page.goto('./#/routines/routine-pull/edit');
  await page.getByLabel('Mål i kg, sæt 1').first().fill('65');
  await page.getByRole('button', { name: 'Gem rutine' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'CS T-Bar Row' })).toContainText('65 kg x 7');
});

test('backup: eksport, slet alt, import giver de samme data', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Start Pull day' }).click();
  await card(page, 0).getByRole('button', { name: 'Sæt 1 færdigt' }).click();
  await page.getByRole('button', { name: 'Afslut', exact: true }).click();
  await page.getByRole('button', { name: 'Fjern dem' }).click();
  await page.getByRole('button', { name: 'Gem træning' }).click();
  // Sættet er logget præcis som rutinen, så der spørges ikke om at opdatere den.
  await expect(page.getByText('Træning gemt.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opdatér rutine' })).toHaveCount(0);

  await page.goto('./#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportér backup' }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();

  await page.getByRole('button', { name: 'Slet alle data' }).click();
  await page.getByLabel('Skriv SLET for at bekræfte').fill('SLET');
  // Appen genindlæser sig selv efter sletningen. Vent på det, før vi går videre.
  await Promise.all([page.waitForEvent('load'), page.getByRole('dialog').getByRole('button', { name: 'Slet alle data' }).click()]);
  await page.goto('./#/history');
  await expect(page.getByText('Ingen træninger endnu.')).toBeVisible();

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.getByText(/1 træninger/)).toBeVisible();
  await page.getByRole('button', { name: 'Flet med mine data' }).click();
  await page.goto('./#/history');
  await expect(page.getByRole('link', { name: /Pull day/ })).toHaveCount(1);
});

test('virker offline efter første besøg', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Træn' })).toBeVisible();
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Træn' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Træn' })).toBeVisible();
  await page.getByRole('link', { name: 'Statistik' }).click();
  await expect(page.getByRole('heading', { name: 'Statistik' })).toBeVisible();
  await context.setOffline(false);
});
