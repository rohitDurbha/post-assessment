import express from 'express';
import path from 'path';
import { Connection, Client } from '@temporalio/client';
import {
  waitlistOutreachWorkflow,
  getStateQuery,
  acceptOfferSignal,
  declineOfferSignal,
} from './workflows';
import type { SlotDetails, OutreachState } from './types';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function createClient(): Promise<Client> {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  return new Client({ connection });
}

app.post('/api/start-outreach', async (req, res) => {
  try {
    const { demoMode, ...slot } = req.body as SlotDetails & { demoMode: boolean };
    const workflowId = `outreach-${Date.now()}`;
    const client     = await createClient();

    await client.workflow.start(waitlistOutreachWorkflow, {
      taskQueue: 'assessment-starter',
      workflowId,
      args: [slot, demoMode ?? false],
    });

    res.json({ workflowId });
  } catch (err) {
    console.error('start-outreach error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/status/:workflowId', async (req, res) => {
  try {
    const client = await createClient();
    const handle = client.workflow.getHandle(req.params.workflowId);
    const state  = await handle.query(getStateQuery);
    res.json(state);
  } catch (err) {
    console.error('status error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/respond/:workflowId/:clientId/:response', async (req, res) => {
  const { workflowId, clientId, response } = req.params;
  try {
    const client = await createClient();
    const handle = client.workflow.getHandle(workflowId);
    const state  = await handle.query(getStateQuery) as OutreachState;

    if (state.status === 'filled') {
      const winner = state.clients.find(c => c.client.id === clientId && c.status === 'accepted');
      if (!winner) return res.json({ success: false, reason: 'slot_taken' });
    }

    if (state.currentOfferId !== clientId) {
      return res.json({ success: false, reason: 'offer_expired' });
    }

    if (response === 'accept')       await handle.signal(acceptOfferSignal, clientId);
    else if (response === 'decline') await handle.signal(declineOfferSignal, clientId);
    else return res.status(400).json({ error: 'Invalid response' });

    res.json({ success: true });
  } catch (err) {
    console.error('respond error:', err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Juniper Salon running at http://localhost:${PORT}`));