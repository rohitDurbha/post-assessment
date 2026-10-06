export interface WaitlistClient {
  id: string;
  name: string;
  phone: string;
  service: string;
  stylist: string;
  availability: string;
  joinedAt: string;
}

export interface SlotDetails {
  date: string;
  time: string;
  service: string;
  stylist: string;
}

export type ClientStatus = 'waiting' | 'offered' | 'accepted' | 'declined' | 'timed_out';

export interface ClientState {
  client: WaitlistClient;
  status: ClientStatus;
}

export interface LogEntry {
  time: string;
  message: string;
}

export interface OutreachState {
  slot: SlotDetails;
  demoMode: boolean;
  clients: ClientState[];
  status: 'in_progress' | 'filled' | 'unfilled';
  acceptedBy?: string;
  acceptedAt?: string;
  currentOfferId?: string;
  offeredAt?: string;
  log: LogEntry[];
}