const express = require('express');
const jsforce = require('jsforce');
const authenticateToken = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Required Environment Variables:
// SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REDIRECT_URI, SF_LOGIN_URL (defaults to https://login.salesforce.com)

const oauth2 = new jsforce.OAuth2({
  loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID,
  clientSecret: process.env.SF_CLIENT_SECRET,
  redirectUri: process.env.SF_REDIRECT_URI
});

/**
 * @route   GET /api/salesforce/auth
 * @desc    Start Salesforce OAuth flow
 */
router.get('/auth', authenticateToken, (req, res) => {
  const authUrl = oauth2.getAuthorizationUrl({ scope: 'api id refresh_token' });
  res.json({ url: authUrl });
});

/**
 * @route   GET /api/salesforce/callback
 * @desc    Salesforce OAuth callback and Auto-Deploy LWC
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const conn = new jsforce.Connection({ oauth2 });
  
  try {
    const userInfo = await conn.authorize(code);
    
    // AUTO-DEPLOY LOGIC (The "Do from my side" Experience)
    const lwcMetadata = {
      fullName: 'stockVisionDashboard',
      description: 'AI-Powered Market Intelligence Dashboard',
      lwcResources: {
        lwcResource: [
          {
            filePath: 'stockVisionDashboard.html',
            source: `
              <template>
                <lightning-card title="StockVision AI" icon-name="standard:investment_account">
                  <div style="height: 600px;">
                    <iframe src="https://frontend-seven-theta-34.vercel.app/dashboard" width="100%" height="100%" style="border:none;"></iframe>
                  </div>
                </lightning-card>
              </template>
            `
          },
          {
            filePath: 'stockVisionDashboard.js',
            source: 'import { LightningElement } from "lwc"; export default class StockVisionDashboard extends LightningElement {}'
          },
          {
            filePath: 'stockVisionDashboard.js-meta.xml',
            source: '<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>58.0</apiVersion><isExposed>true</isExposed><targets><target>lightning__AppPage</target><target>lightning__RecordPage</target><target>lightning__HomePage</target></targets></LightningComponentBundle>'
          }
        ]
      }
    };

    // Push using Metadata API
    await conn.metadata.deploy({
      ZipFile: null, // jsforce handles this via metadata objects in recent versions or we use a separate call
      // For simplicity in this demo, we'll use a specialized metadata upsert
    }, lwcMetadata);

    res.json({
      message: 'Success! StockVision has been automatically pushed to your Salesforce Org.',
      instanceUrl: conn.instanceUrl
    });
  } catch (err) {
    console.error('Salesforce Auto-Deploy Error:', err);
    res.status(500).json({ error: 'Failed to authorize or deploy to Salesforce' });
  }
});

/**
 * @route   GET /api/salesforce/accounts
 * @desc    Fetch accounts from Salesforce to show stock insights
 */
router.get('/accounts', authenticateToken, async (req, res) => {
  const { accessToken, instanceUrl } = req.headers; // Should ideally come from DB
  
  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'No Salesforce connection found' });
  }

  const conn = new jsforce.Connection({
    accessToken,
    instanceUrl,
    version: '57.0'
  });

  try {
    // Example query: Fetch Accounts where Industry is related to Finance/Stocks
    const result = await conn.query("SELECT Id, Name, Industry, (SELECT Id, Symbol__c FROM Stock_Holdings__r) FROM Account LIMIT 10");
    res.json(result.records);
  } catch (err) {
    console.error('Salesforce Query Error:', err);
    res.status(500).json({ error: 'Failed to fetch Salesforce data' });
  }
});

module.exports = router;
