export interface TransportStaffAssignment {
  id: string;
  vehicleId: string;
  userId: string;
  role: string;
  user?: { id: string; fullName: string; email: string; phone: string | null };
}

export interface TransportVehicleDocument {
  id: string;
  vehicleId: string;
  title: string;
  storagePath: string;
  mimeType: string | null;
}

export interface TransportVehicle {
  id: string;
  branchId: string;
  plateNumber: string;
  makeModel: string | null;
  capacity: number | null;
  status: string;
  gpsDeviceId: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastPingAt: string | null;
  staffAssignments?: TransportStaffAssignment[];
  documents?: TransportVehicleDocument[];
  _count?: { trips: number };
}

export interface TransportStop {
  id: string;
  routeId: string;
  name: string;
  sequence: number;
  pickupTime: string | null;
  dropoffTime: string | null;
}

export interface TransportRoute {
  id: string;
  branchId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  stops?: TransportStop[];
  _count?: { assignments: number; trips: number };
}

export interface StudentTransportAssignment {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string;
  direction: string;
  student?: { id: string; fullName: string; phone: string | null; batchId: string | null };
  route?: { id: string; name: string; code: string | null };
  stop?: TransportStop;
}

export interface TransportTrip {
  id: string;
  routeId: string;
  vehicleId: string | null;
  tripDate: string;
  direction: string;
  status: string;
  route?: { id: string; name: string; code: string | null; branchId: string };
  vehicle?: { id: string; plateNumber: string; makeModel: string | null } | null;
  _count?: { attendance: number };
  attendance?: Array<{
    id: string;
    studentId: string;
    status: string;
    recordedAt: string;
    student?: { id: string; fullName: string; phone: string | null };
  }>;
}

export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function statusBadgeCode(status: string): string {
  const normalized = status.toLowerCase();
  if (['active', 'completed', 'present', 'boarded'].includes(normalized)) return 'active';
  if (['inactive', 'cancelled', 'absent'].includes(normalized)) return 'inactive';
  if (['scheduled', 'pending'].includes(normalized)) return 'pending';
  return normalized;
}

export function formatCoords(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
