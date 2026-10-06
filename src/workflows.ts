import { defineSignal, defineQuery, setHandler, condition, sleep } from '@temporalio/workflow';
import type { WaitlistClient, SlotDetails, OutreachState, ClientStatus } from './types';

export const acceptOfferSignal = defineSignal<[string]>('acceptOffer');
export const declineOfferSignal = defineSignal<[string]>('declineOffer');
export const getStateQuery = defineQuery<OutreachState>('getState');

const LIVE_TIMEOUT_MS  = 15 * 60 * 1000;
const DEMO_TIMEOUT_MS  = 20 * 1000;

const WAITLIST: WaitlistClient[] = [
  { id: '1', name: 'Sofia Reyes',   phone: '408-555-0101', service: 'Haircut', stylist: 'Maya',  availability: 'mornings',   joinedAt: '2026-09-15T09:00:00Z' },
  { id: '2', name: 'Jordan Kim',    phone: '408-555-0102', service: 'Color',   stylist: 'Any',   availability: 'afternoons', joinedAt: '2026-09-16T10:30:00Z' },
  { id: '3', name: 'Priya Nair',    phone: '408-555-0103', service: 'Haircut', stylist: 'Any',   availability: 'any',        joinedAt: '2026-09-17T11:00:00Z' },
  { id: '4', name: 'Marcus Webb',   phone: '408-555-0104', service: 'Color',   stylist: 'Maya',  availability: 'evenings',   joinedAt: '2026-09-18T14:00:00Z' },
  { id: '5', name: 'Aisha Okafor',  phone: '408-555-0105', service: 'Haircut', stylist: 'Maya',  availability: 'any',        joinedAt: '2026-09-20T09:30:00Z' },
  { id: '6', name: 'Danny Tran',    phone: '408-555-0106', service: 'Blowout', stylist: 'Any',   availability: 'mornings',   joinedAt: '2026-09-21T10:00:00Z' },
  { id: '7', name: 'Cleo Barnes',   phone: '408-555-0107', service: 'Color',   stylist: 'Any',   availability: 'any',        joinedAt: '2026-09-22T15:00:00Z' },
  { id: '8', name: 'Ravi Sharma',   phone: '408-555-0108', service: 'Haircut', stylist: 'Any',   availability: 'afternoons', joinedAt: '2026-09-23T11:30:00Z' },
];

function filterEligible(slot: SlotDetails): WaitlistClient[] {
  return WAITLIST
    .filter(c =>
      c.service.toLowerCase() === slot.service.toLowerCase() &&
      (c.stylist === 'Any' || c.stylist.toLowerCase() === slot.stylist.toLowerCase())
    )
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
}

export async function waitlistOutreachWorkflow(
  slot: SlotDetails,
  demoMode: boolean = false
): Promise<OutreachState> {
  const timeoutMs = demoMode ? DEMO_TIMEOUT_MS : LIVE_TIMEOUT_MS;
  const eligible  = filterEligible(slot);

  const state: OutreachState = {
    slot,
    demoMode,
    clients: eligible.map(c => ({ client: c, status: 'waiting' as ClientStatus })),
    status: 'in_progress',
    log: [],
  };

  setHandler(getStateQuery, () => state);

  if (eligible.length === 0) {
    state.status = 'unfilled';
    state.log.push({ time: new Date().toISOString(), message: 'No eligible clients found for this slot.' });
    return state;
  }

  state.log.push({
    time: new Date().toISOString(),
    message: `Outreach started for ${slot.service} with ${slot.stylist} on ${slot.date} at ${slot.time}. ${eligible.length} eligible client(s) found.`,
  });

  let pendingClientId: string | null = null;
  let pendingType: 'accept' | 'decline' | null = null;

  setHandler(acceptOfferSignal, (clientId: string) => {
    pendingClientId = clientId;
    pendingType = 'accept';
  });

  setHandler(declineOfferSignal, (clientId: string) => {
    pendingClientId = clientId;
    pendingType = 'decline';
  });

  for (const clientState of state.clients) {
    pendingClientId = null;
    pendingType     = null;

    clientState.status      = 'offered';
    state.currentOfferId    = clientState.client.id;
    state.offeredAt         = new Date().toISOString();

    state.log.push({
      time: new Date().toISOString(),
      message: `Offer sent to ${clientState.client.name} (${clientState.client.service}, prefers ${clientState.client.stylist}).`,
    });

    const responded = await condition(
      () => pendingClientId === clientState.client.id,
      timeoutMs
    );

    if (!responded) {
      clientState.status = 'timed_out';
      state.log.push({ time: new Date().toISOString(), message: `${clientState.client.name} did not respond in time.` });
    } else if (pendingType === 'accept') {
      clientState.status  = 'accepted';
      state.status        = 'filled';
      state.acceptedBy    = clientState.client.name;
      state.acceptedAt    = new Date().toISOString();
      state.currentOfferId  = undefined;
      state.offeredAt       = undefined;
      state.log.push({ time: new Date().toISOString(), message: `${clientState.client.name} accepted. Slot is now filled.` });
      return state;
    } else {
      clientState.status = 'declined';
      state.log.push({ time: new Date().toISOString(), message: `${clientState.client.name} declined.` });
    }
  }

  state.status         = 'unfilled';
  state.currentOfferId = undefined;
  state.offeredAt      = undefined;
  state.log.push({ time: new Date().toISOString(), message: 'All eligible clients contacted. Slot remains unfilled.' });
  return state;
}