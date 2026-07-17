import { z } from 'zod';

export const transportVehicleStatuses = ['active', 'inactive'] as const;
export const transportStaffRoles = ['driver', 'conductor'] as const;
export const transportDirections = ['pickup', 'dropoff', 'both'] as const;
export const transportTripStatuses = ['scheduled', 'completed', 'cancelled'] as const;
export const transportAttendanceStatuses = ['present', 'absent', 'boarded'] as const;

const staffAssignmentSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(transportStaffRoles),
});

const stopSchema = z.object({
  name: z.string().min(1).max(200),
  sequence: z.number().int().min(1),
  pickupTime: z.string().max(10).optional().nullable(),
  dropoffTime: z.string().max(10).optional().nullable(),
});

export const listTransportVehiclesQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(transportVehicleStatuses).optional(),
  search: z.string().optional(),
});

export type ListTransportVehiclesQuery = z.infer<typeof listTransportVehiclesQuerySchema>;

export const createTransportVehicleSchema = z.object({
  branchId: z.string().min(1),
  plateNumber: z.string().min(1).max(50),
  makeModel: z.string().max(200).optional().nullable(),
  capacity: z.number().int().min(1).max(200).optional().nullable(),
  status: z.enum(transportVehicleStatuses).optional(),
  gpsDeviceId: z.string().max(100).optional().nullable(),
  staff: z.array(staffAssignmentSchema).optional(),
});

export type CreateTransportVehicleInput = z.infer<typeof createTransportVehicleSchema>;

export const updateTransportVehicleSchema = createTransportVehicleSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    staff: z.array(staffAssignmentSchema).optional(),
  });

export type UpdateTransportVehicleInput = z.infer<typeof updateTransportVehicleSchema>;

export const createTransportVehicleDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().max(100).optional().nullable(),
});

export type CreateTransportVehicleDocumentInput = z.infer<
  typeof createTransportVehicleDocumentSchema
>;

export const listTransportRoutesQuerySchema = z.object({
  branchId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type ListTransportRoutesQuery = z.infer<typeof listTransportRoutesQuerySchema>;

export const createTransportRouteSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  stops: z.array(stopSchema).min(1),
});

export type CreateTransportRouteInput = z.infer<typeof createTransportRouteSchema>;

export const updateTransportRouteSchema = createTransportRouteSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    stops: z.array(stopSchema).optional(),
  });

export type UpdateTransportRouteInput = z.infer<typeof updateTransportRouteSchema>;

export const listStudentTransportQuerySchema = z.object({
  branchId: z.string().optional(),
  routeId: z.string().optional(),
  studentId: z.string().optional(),
  search: z.string().optional(),
});

export type ListStudentTransportQuery = z.infer<typeof listStudentTransportQuerySchema>;

export const createStudentTransportSchema = z.object({
  branchId: z.string().min(1),
  studentId: z.string().min(1),
  routeId: z.string().min(1),
  stopId: z.string().min(1),
  direction: z.enum(transportDirections),
});

export type CreateStudentTransportInput = z.infer<typeof createStudentTransportSchema>;

export const updateStudentTransportSchema = createStudentTransportSchema
  .omit({ branchId: true })
  .partial();

export type UpdateStudentTransportInput = z.infer<typeof updateStudentTransportSchema>;

export const listTransportTripsQuerySchema = z.object({
  branchId: z.string().optional(),
  routeId: z.string().optional(),
  vehicleId: z.string().optional(),
  status: z.enum(transportTripStatuses).optional(),
  tripDate: z.string().optional(),
  direction: z.enum(transportDirections).optional(),
});

export type ListTransportTripsQuery = z.infer<typeof listTransportTripsQuerySchema>;

export const createTransportTripSchema = z.object({
  branchId: z.string().min(1),
  routeId: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  tripDate: z.string().min(1),
  direction: z.enum(transportDirections),
  status: z.enum(transportTripStatuses).optional(),
});

export type CreateTransportTripInput = z.infer<typeof createTransportTripSchema>;

export const updateTransportTripSchema = createTransportTripSchema
  .omit({ branchId: true })
  .partial();

export type UpdateTransportTripInput = z.infer<typeof updateTransportTripSchema>;

export const bulkTransportAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(transportAttendanceStatuses),
        recordedAt: z.string().datetime().optional(),
      }),
    )
    .min(1),
});

export type BulkTransportAttendanceInput = z.infer<typeof bulkTransportAttendanceSchema>;

export const transportGpsWebhookSchema = z.object({
  deviceId: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  recordedAt: z.string().datetime().optional(),
});

export type TransportGpsWebhookInput = z.infer<typeof transportGpsWebhookSchema>;
