import { test, expect } from '@playwright/test';

test.describe('Multisig Wallet Setup', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('should display the initial setup screen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Manual Multisig Setup' })).toBeVisible();
    await expect(page.getByText('RPC ConnectionDisconnected')).toBeVisible();
  });

  test('should toggle between manual and bootstrap setup modes', async ({ page }) => {
    // Check initial state
    await expect(page.getByText('Manual SetupQuick Bootstrap')).toBeVisible();
    
    // Click bootstrap mode
    await page.getByRole('button', { name: 'Quick Bootstrap' }).click();
    await expect(page.getByText('Connect to your Bitcoin node')).toBeVisible();
    
  });

  test('should validate RPC connection', async ({ page }) => {
    
    // Here we are clicking on the RPC Connection to open the Popup 
    await expect(page.getByText('RPC ConnectionDisconnected')).toBeVisible();
    await page.getByText('RPC ConnectionDisconnected').click();
    
    //make sure the popUp is open
    await expect(page.getByRole('textbox', { name: 'Host' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Port' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();

    // will implement the connection later
  });

  test('should handle wallet operations UI elements', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Enter xpub' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'BIP32 Path' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Key' })).toBeDisabled();
    
    // Filling wrong xpub so we get the error
    await page.getByRole('textbox', { name: 'Enter xpub' }).fill('test-wallet');
    await page.getByRole('textbox', { name: 'BIP32 Path' }).fill('2');
    
    await expect(page.getByRole('button', { name: 'Add Key' })).toBeEnabled();
    
    // Add key
    await page.getByRole('button', { name: 'Add Key' }).click();

    //check the error
    await expect(page.getByText('Invalid xpub format. Must')).toBeVisible();

    // Fill correct xpub
    await page.getByRole('textbox', { name: 'Enter xpub' }).fill('tpubDDhuck2tbFdoyQzQy5p8xWprcypYz99cidzHsw1gW3n1k6fCRjQDC6nhxZt6d4SCXqHZ4a8K8R61DZdWZLYDKdbKxYWScZsAPMoWVdBLStC');
    await page.getByRole('textbox', { name: 'BIP32 Path' }).fill('m/49\'/1\'/0\'');
    await expect(page.getByRole('button', { name: 'Add Key' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add Key' }).click();

    //adding another xpub
    await page.getByRole('textbox', { name: 'Enter xpub' }).fill('tpubDDUjVtJfN3uihuszSCbu917hqpZJiAPtGN1evwGVCcq9kMZ1ojpzVgqAMFinacGfBgwMtCAcuF9P1LSXCPpKfdkL6YMCisRgAyD4Vav7T3');
    await page.getByRole('textbox', { name: 'BIP32 Path' }).fill('m/49\'/1\'/0\'');
    await expect(page.getByRole('button', { name: 'Add Key' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add Key' }).click();

    //check the error
    await expect(page.getByText('Invalid extended public key')).toBeVisible();

    // Fill correct xpub
    await page.getByRole('textbox', { name: 'Enter xpub' }).fill('tpubDDUjVtJfN3uihuszSCbu917hqpZJiAPtGN1evwGVCcq9kMZ1ojpzVgqAMFinacGfBgwMtCAcuF9P1LSXCPpKfdkLJ6YMCisRgAyD4Vav7T3');
    await page.getByRole('textbox', { name: 'BIP32 Path' }).fill('m/49\'/1\'/0\'');
    await expect(page.getByRole('button', { name: 'Add Key' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add Key' }).click();

    //spin down the signers
    await expect(page.locator('div').filter({ hasText: /^Total Signers$/ }).getByRole('spinbutton')).toBeVisible();

    //check the total signers
    await expect(page.locator('div').filter({ hasText: /^Total Signers$/ }).getByRole('spinbutton')).toHaveValue('2');

    //check the required signers
    await expect(page.locator('div').filter({ hasText: /^Required Signatures$/ }).getByRole('spinbutton')).toHaveValue('2');

    //lets create multi sig
    await page.getByRole('button', { name: 'Create Multisig Wallet' }).click();

    //lets click on addresses and verify
    await page.getByRole('button', { name: '📋 Addresses' }).click();

    //check the addresses
    await expect(page.getByText('bcrt1qkmyuewdzzscs7uy6vvgfznucmpt0ej3f7f4qmk4pmvr3gl7aqw3ssc48sj')).toBeVisible();
    await expect(page.getByText('bcrt1q74camca7ff0cr89d5k982560k5jgy3xdlch70sy69rsqnpveyfwq7aq2v8')).toBeVisible();
    await expect(page.getByText('bcrt1qq9kr890hjx7gxyzkj3nfd7d3zqqsjt063xk4vfy58dvve28v3xxs0rkxcz')).toBeVisible();
    await expect(page.getByText('bcrt1qsaszq0prj5etppehl00feduqp292dww3cwy7msp7mp5ypy5jfchqz3nzpl')).toBeVisible();
  });
});
